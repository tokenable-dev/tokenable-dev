import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { readCardhedgerFeatureFlags } from '../config/cardhedger-feature-flags.util';
import {
  CardhedgerPriceDeltaImportService,
  type DeltaImportResult,
} from './cardhedger-price-delta-import.service';

/** Phase 8B — nightly price delta import (CSV fallback optional, Enterprise-only). */
@Injectable()
export class CardhedgerPriceDeltaSchedulerService {
  private readonly logger = new Logger(CardhedgerPriceDeltaSchedulerService.name);
  private inFlight = false;

  constructor(
    private readonly config: ConfigService,
    private readonly deltaImport: CardhedgerPriceDeltaImportService,
  ) {}

  private flags() {
    return (
      this.config.get<ReturnType<typeof readCardhedgerFeatureFlags>>(
        'marketplace.cardhedgerFeatureFlags',
      ) ?? readCardhedgerFeatureFlags()
    );
  }

  cronEnabled(): boolean {
    const raw = this.config.get<string>('CARDHEDGER_PRICE_DELTA_CRON_ENABLED');
    if (raw === '1' || raw === 'true') return true;
    if (raw === '0' || raw === 'false') return false;
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  /** 04:00 KST — after Cardhedger daily export window; uses delta polling when CSV unavailable. */
  @Cron('0 0 4 * * *', { timeZone: 'Asia/Seoul' })
  async handleNightlyKst(): Promise<void> {
    if (!this.cronEnabled()) return;
    if (!this.flags().dailyPriceDeltaImportEnabled) return;
    await this.run('cron');
  }

  async run(trigger: 'cron' | 'manual'): Promise<{
    fileDate: string;
    csv: { status: string } | null;
    delta: DeltaImportResult | null;
  } | null> {
    if (this.inFlight) {
      this.logger.warn(
        JSON.stringify({ msg: 'cardhedger_price_delta_skipped', reason: 'in_flight', trigger }),
      );
      return null;
    }
    this.inFlight = true;
    try {
      const result = await this.deltaImport.runImport(trigger);
      this.logger.log(
        JSON.stringify({
          msg: 'cardhedger_price_delta_complete',
          trigger,
          fileDate: result.fileDate,
          deltaUpdates: result.delta?.updateCount ?? 0,
          deltaMatched: result.delta?.deltaMatchedCollectionCount ?? 0,
          catalogFallback: result.delta?.catalogFallbackCount ?? 0,
          deltaEnqueued: result.delta?.matchedCollectionCount ?? 0,
          csvStatus: result.csv?.status ?? null,
        }),
      );
      return {
        fileDate: result.fileDate,
        csv: result.csv ? { status: result.csv.status } : null,
        delta: result.delta,
      };
    } catch (e) {
      this.logger.error(
        JSON.stringify({
          msg: 'cardhedger_price_delta_failed',
          trigger,
          error: e instanceof Error ? e.message : String(e),
        }),
      );
      throw e;
    } finally {
      this.inFlight = false;
    }
  }
}
