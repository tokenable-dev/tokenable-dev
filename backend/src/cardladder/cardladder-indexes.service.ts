import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { CardladderIndexesScraperService } from './cardladder-indexes-scraper.service';
import {
  CARDLADDER_DASHBOARD_SLOTS,
  type CardladderDashboardIndexRow,
  type CardladderIndexesResponse,
  type CardladderScrapedIndex,
} from './cardladder-indexes.types';

const DISK_CACHE_SCHEMA_VERSION = 1;

@Injectable()
export class CardladderIndexesService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(CardladderIndexesService.name);
  private readonly cacheTtlMs: number;
  private readonly prewarmDelayMs: number;
  private readonly refreshIntervalMs: number;
  private readonly coldWaitMs: number;
  private readonly diskCachePath: string;

  private cacheValue: CardladderIndexesResponse | null = null;
  private cacheUpdatedAtMs = 0;
  private inflight: Promise<CardladderIndexesResponse> | null = null;
  private prewarmTimer: NodeJS.Timeout | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly scraper: CardladderIndexesScraperService,
    private readonly config: ConfigService,
  ) {
    this.cacheTtlMs =
      this.config.get<number>('cardladder.indexesCacheTtlMs') ??
      6 * 60 * 60 * 1000;
    this.prewarmDelayMs =
      this.config.get<number>('cardladder.indexesPrewarmDelayMs') ?? 5_000;
    this.refreshIntervalMs =
      this.config.get<number>('cardladder.indexesRefreshIntervalMs') ??
      6 * 60 * 60 * 1000;
    this.coldWaitMs =
      this.config.get<number>('cardladder.indexesColdWaitMs') ?? 8_000;
    this.diskCachePath = path.join(
      os.tmpdir(),
      `cardladder-indexes-v${DISK_CACHE_SCHEMA_VERSION}.json`,
    );
    this.hydrateFromDisk();
  }

  onApplicationBootstrap(): void {
    if (!this.prewarmEnabled()) return;
    const refreshH = Math.round(this.refreshIntervalMs / 3_600_000);
    this.logger.log(
      `Card Ladder indexes scheduler on — prewarm in ${this.prewarmDelayMs}ms, refresh every ${refreshH}h`,
    );
    this.prewarmTimer = setTimeout(() => {
      void this.rebuildCache().catch((err) =>
        this.logger.warn(
          `Card Ladder indexes prewarm failed: ${err instanceof Error ? err.message : err}`,
        ),
      );
    }, this.prewarmDelayMs);

    this.refreshTimer = setInterval(() => {
      void this.rebuildCache().catch((err) =>
        this.logger.warn(
          `Card Ladder indexes scheduled refresh failed: ${err instanceof Error ? err.message : err}`,
        ),
      );
    }, this.refreshIntervalMs);
  }

  onApplicationShutdown(): void {
    if (this.prewarmTimer) clearTimeout(this.prewarmTimer);
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  async getDashboardIndexes(opts?: {
    forceRefresh?: boolean;
  }): Promise<CardladderIndexesResponse> {
    const forceRefresh = opts?.forceRefresh === true;
    if (forceRefresh) {
      return this.rebuildCache();
    }

    const now = Date.now();
    const fresh =
      this.cacheValue != null &&
      this.filledSlotCount(this.cacheValue) > 0 &&
      now - this.cacheUpdatedAtMs < this.cacheTtlMs;

    if (fresh && this.cacheValue) {
      return { ...this.cacheValue, stale: false };
    }

    if (this.cacheValue && this.filledSlotCount(this.cacheValue) > 0) {
      void this.ensureFreshCache();
      return { ...this.cacheValue, stale: true };
    }

    if (this.inflight) {
      const raced = await this.raceInflight(this.coldWaitMs);
      if (raced) return raced;
      return this.bestEffortResponse();
    }

    void this.ensureFreshCache();
    const raced = await this.raceInflight(this.coldWaitMs);
    if (raced) return raced;
    return this.bestEffortResponse();
  }

  private prewarmEnabled(): boolean {
    return this.config.get<boolean>('cardladder.indexesPrewarmEnabled') === true;
  }

  private ensureFreshCache(): void {
    void this.rebuildCache().catch(() => undefined);
  }

  private filledSlotCount(payload: CardladderIndexesResponse): number {
    return payload.data.filter(
      (r) => r.changePct != null && Number.isFinite(r.changePct),
    ).length;
  }

  private bestEffortResponse(): CardladderIndexesResponse {
    if (this.cacheValue && this.filledSlotCount(this.cacheValue) > 0) {
      return { ...this.cacheValue, stale: true };
    }
    return this.emptyResponse();
  }

  private emptyResponse(): CardladderIndexesResponse {
    return {
      data: CARDLADDER_DASHBOARD_SLOTS.map((slot) => ({
        id: slot.id,
        slug: slot.slug,
        name: slot.title.replace(/ Index$/, ''),
        changePct: null,
        direction: null,
      })),
      updatedAt: new Date(0).toISOString(),
      source: 'cardladder',
      stale: true,
    };
  }

  /** Wait for in-flight scrape up to `waitMs`; null when still running. */
  private async raceInflight(
    waitMs: number,
  ): Promise<CardladderIndexesResponse | null> {
    if (!this.inflight || waitMs <= 0) return null;
    const result = await Promise.race([
      this.inflight.catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), waitMs)),
    ]);
    if (!result || this.filledSlotCount(result) === 0) return null;
    return result;
  }

  private async rebuildCache(): Promise<CardladderIndexesResponse> {
    if (this.inflight) return this.inflight;

    this.inflight = (async () => {
      const started = Date.now();
      const scraped = await this.scraper.scrapeIndexes();
      const payload = this.buildResponse(scraped);
      const filled = this.filledSlotCount(payload);

      if (filled > 0) {
        this.cacheValue = payload;
        this.cacheUpdatedAtMs = Date.now();
        this.writeDiskCache(payload);
        this.logger.log(
          `Card Ladder dashboard indexes cached in ${Date.now() - started}ms (${filled}/${payload.data.length} slots)`,
        );
        return { ...payload, stale: false };
      }

      this.logger.warn(
        `Card Ladder scrape produced 0/${payload.data.length} dashboard slots in ${Date.now() - started}ms`,
      );
      if (this.cacheValue && this.filledSlotCount(this.cacheValue) > 0) {
        return { ...this.cacheValue, stale: true };
      }
      return { ...payload, stale: true };
    })();

    try {
      return await this.inflight;
    } finally {
      this.inflight = null;
    }
  }

  private buildResponse(
    scraped: CardladderScrapedIndex[],
  ): CardladderIndexesResponse {
    const bySlug = new Map(
      scraped.map((row) => [row.slug.toLowerCase(), row] as const),
    );
    const data: CardladderDashboardIndexRow[] = CARDLADDER_DASHBOARD_SLOTS.map(
      (slot) => {
        const hit = bySlug.get(slot.slug);
        if (!hit) {
          return {
            id: slot.id,
            slug: slot.slug,
            name: slot.title.replace(/ Index$/, ''),
            changePct: null,
            direction: null,
          };
        }
        return {
          id: slot.id,
          slug: hit.slug,
          name: hit.name,
          changePct: hit.changePct,
          direction: hit.direction,
        };
      },
    );

    return {
      data,
      updatedAt: new Date().toISOString(),
      source: 'cardladder',
      stale: false,
    };
  }

  private hydrateFromDisk(): void {
    try {
      if (!fs.existsSync(this.diskCachePath)) return;
      const raw = fs.readFileSync(this.diskCachePath, 'utf8');
      const parsed = JSON.parse(raw) as {
        schemaVersion?: number;
        updatedAtMs?: number;
        payload?: CardladderIndexesResponse;
      };
      if (parsed.schemaVersion !== DISK_CACHE_SCHEMA_VERSION) return;
      if (!parsed.payload?.data?.length) return;
      if (this.filledSlotCount(parsed.payload) === 0) return;
      this.cacheValue = parsed.payload;
      this.cacheUpdatedAtMs = Number(parsed.updatedAtMs) || 0;
      const ageSec = Math.round((Date.now() - this.cacheUpdatedAtMs) / 1000);
      this.logger.log(`hydrated Card Ladder indexes from disk (age=${ageSec}s)`);
    } catch (err) {
      this.logger.debug(
        `Card Ladder disk cache hydrate skipped: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private writeDiskCache(payload: CardladderIndexesResponse): void {
    if (this.filledSlotCount(payload) === 0) return;
    try {
      fs.writeFileSync(
        this.diskCachePath,
        JSON.stringify({
          schemaVersion: DISK_CACHE_SCHEMA_VERSION,
          updatedAtMs: this.cacheUpdatedAtMs,
          payload,
        }),
        'utf8',
      );
    } catch (err) {
      this.logger.debug(
        `Card Ladder disk cache write skipped: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
