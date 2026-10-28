import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { runWithPgSessionAdvisoryLock } from '../database/pg-session-advisory-lock.util';
import { FxRate } from './fx-rate.entity';
import {
  FRANKFURTER_ECB_SOURCE,
  FRANKFURTER_VND_URL,
  frankfurterEcbRatesUrl,
  isObservationStale,
  parseEcbRatesPayload,
  parseUsdQuote,
  publishableFxSnapshot,
  supplementaryVndRate,
} from './fx-ecb';
import { ECB_QUOTE_CURRENCIES } from './supported-currencies';

/** Disjoint from portfolio and snapshot advisory locks. */
const FX_REFRESH_LOCK = 710_271_001;

export type PublicFxRates = {
  base: 'USD';
  source: typeof FRANKFURTER_ECB_SOURCE;
  observationDate: string | null;
  fetchedAt: string | null;
  stale: boolean;
  rates: Record<string, number>;
};

@Injectable()
export class FxService implements OnModuleInit {
  private readonly logger = new Logger(FxService.name);
  private memory: PublicFxRates = emptyRates();

  constructor(
    @InjectRepository(FxRate)
    private readonly rates: Repository<FxRate>,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.loadFromDb();
    } catch (err) {
      this.logger.warn(
        `FX rates were not loaded: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    void this.refresh('startup').catch((err) => {
      this.logger.warn(
        `FX startup refresh failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }

  getCached(): PublicFxRates {
    return this.memory;
  }

  async refresh(trigger: string): Promise<{ updated: boolean; skippedLock: boolean }> {
    const run = await runWithPgSessionAdvisoryLock(
      this.dataSource,
      FX_REFRESH_LOCK,
      () => this.fetchAndStore(),
    );
    if (!run.acquired) {
      await this.reloadAfterPeer(trigger);
      return { updated: false, skippedLock: true };
    }
    return { updated: run.value, skippedLock: false };
  }

  /**
   * Another process holds the refresh lock and is writing the new snapshot.
   * Wait until that lock is free, then read the committed rows. Do not keep
   * serving this process's previous memory after a peer refresh.
   */
  private async reloadAfterPeer(trigger: string): Promise<void> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    let locked = false;
    try {
      await qr.query('SELECT pg_advisory_lock($1)', [FX_REFRESH_LOCK]);
      locked = true;
      const loaded = await this.loadFromDb();
      this.logger.debug(
        `FX refresh followed a peer (${trigger}, loaded=${loaded})`,
      );
    } finally {
      if (locked) {
        try {
          await qr.query('SELECT pg_advisory_unlock($1)', [FX_REFRESH_LOCK]);
        } catch {
          // Connection release drops the session lock.
        }
      }
      await qr.release();
    }
  }

  private async fetchAndStore(): Promise<boolean> {
    const res = await fetch(frankfurterEcbRatesUrl(), {
      headers: {
        accept: 'application/json',
        'user-agent': 'TokenableFx/1.0',
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      throw new Error(`Frankfurter ECB HTTP ${res.status}`);
    }
    const parsed = parseEcbRatesPayload(await res.json());
    const vnd = await this.fetchVndRate();
    const previous = this.memory.observationDate;
    const unchanged =
      previous === parsed.observationDate &&
      ECB_QUOTE_CURRENCIES.every(
        (code) => this.memory.rates[code] === parsed.quotePerUsd[code],
      ) &&
      (vnd == null || this.memory.rates.VND === vnd.rate);
    if (unchanged && this.memory.fetchedAt) {
      return false;
    }
    const fetchedAt = new Date();
    const quotePerUsd = { ...parsed.quotePerUsd };
    if (vnd) quotePerUsd.VND = vnd.rate;
    else if (this.memory.rates.VND != null) quotePerUsd.VND = this.memory.rates.VND;
    await this.rates.manager.transaction(async (manager) => {
      const repo = manager.getRepository(FxRate);
      for (const code of ECB_QUOTE_CURRENCIES) {
        const rate = parsed.quotePerUsd[code];
        if (rate == null) continue;
        await repo.save(
          repo.create({
            currency: code,
            quotePerUsd: rate.toFixed(8),
            observationDate: parsed.observationDate,
            source: FRANKFURTER_ECB_SOURCE,
            fetchedAt,
          }),
        );
      }
      if (vnd) {
        await repo.save(
          repo.create({
            currency: 'VND',
            quotePerUsd: vnd.rate.toFixed(8),
            observationDate: vnd.date,
            source: 'frankfurter-bnm',
            fetchedAt,
          }),
        );
      }
    });
    this.memory = toPublic(parsed.observationDate, quotePerUsd, fetchedAt);
    this.logger.log(
      JSON.stringify({
        msg: 'fx_rates_updated',
        observationDate: parsed.observationDate,
        currencies: ECB_QUOTE_CURRENCIES.length,
      }),
    );
    return true;
  }

  private async loadFromDb(): Promise<boolean> {
    const stored = await this.rates.find();
    const next = publishableFxSnapshot(stored);
    if (!next) return false;
    const vnd = supplementaryVndRate(stored);
    if (vnd != null) next.quotePerUsd.VND = vnd;
    this.memory = toPublic(next.observationDate, next.quotePerUsd, next.fetchedAt);
    return true;
  }

  private async fetchVndRate(): Promise<{ date: string; rate: number } | null> {
    try {
      const res = await fetch(FRANKFURTER_VND_URL, {
        headers: {
          accept: 'application/json',
          'user-agent': 'TokenableFx/1.0',
        },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) return null;
      return parseUsdQuote(await res.json(), 'VND');
    } catch (err) {
      this.logger.warn(
        `VND rate was not fetched: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}

function emptyRates(): PublicFxRates {
  return {
    base: 'USD',
    source: FRANKFURTER_ECB_SOURCE,
    observationDate: null,
    fetchedAt: null,
    stale: true,
    rates: { USD: 1 },
  };
}

function toPublic(
  observationDate: string,
  quotePerUsd: Record<string, number>,
  fetchedAt: Date,
): PublicFxRates {
  return {
    base: 'USD',
    source: FRANKFURTER_ECB_SOURCE,
    observationDate,
    fetchedAt: fetchedAt.toISOString(),
    stale: isObservationStale(observationDate),
    rates: { USD: 1, ...quotePerUsd },
  };
}
