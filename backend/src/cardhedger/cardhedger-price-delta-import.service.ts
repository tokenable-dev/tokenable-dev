import * as fs from 'node:fs';
import * as path from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { readCardhedgerFeatureFlags } from '../config/cardhedger-feature-flags.util';
import { CardhedgerService } from './cardhedger.service';
import { CardhedgerPriceSubscriptionService } from './cardhedger-price-subscription.service';
import { CardhedgerDailyPriceExportRun } from './entities/cardhedger-daily-price-export-run.entity';
import { CardhedgerPriceDeltaCheckpoint } from './entities/cardhedger-price-delta-checkpoint.entity';
import { CardhedgerPriceDeltaImportRun } from './entities/cardhedger-price-delta-import-run.entity';
import {
  normalizePriceWebhookUpdates,
  type CardhedgerPriceUpdatePayload,
} from './utils/cardhedger-price-external-id.util';
import {
  buildDeltaImportSummary,
  type DeltaImportSummary,
} from './utils/cardhedger-price-delta-summary.util';

function kstYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

function isoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

export type DeltaImportResult = DeltaImportSummary & {
  id: number;
};

@Injectable()
export class CardhedgerPriceDeltaImportService {
  private readonly logger = new Logger(CardhedgerPriceDeltaImportService.name);

  constructor(
    private readonly cardhedger: CardhedgerService,
    private readonly config: ConfigService,
    private readonly subscriptions: CardhedgerPriceSubscriptionService,
    private readonly eventEmitter: EventEmitter2,
    @InjectRepository(CardhedgerPriceDeltaCheckpoint)
    private readonly checkpointRepo: Repository<CardhedgerPriceDeltaCheckpoint>,
    @InjectRepository(CardhedgerDailyPriceExportRun)
    private readonly exportRunRepo: Repository<CardhedgerDailyPriceExportRun>,
    @InjectRepository(CardhedgerPriceDeltaImportRun)
    private readonly deltaRunRepo: Repository<CardhedgerPriceDeltaImportRun>,
  ) {}

  private flags() {
    return (
      this.config.get<ReturnType<typeof readCardhedgerFeatureFlags>>(
        'marketplace.cardhedgerFeatureFlags',
      ) ?? readCardhedgerFeatureFlags()
    );
  }

  storageDir(): string {
    const raw = this.config.get<string>('CARDHEDGER_EXPORT_STORAGE_DIR')?.trim();
    return raw || path.join(process.cwd(), 'data', 'cardhedger-exports');
  }

  /**
   * Phase 8B — nightly import.
   * CSV (`daily-price-export`) is Elite/Enterprise only; default path is price-updates delta.
   */
  async runNightlyImport(fileDate = kstYesterday()): Promise<{
    fileDate: string;
    csv: CardhedgerDailyPriceExportRun | null;
    delta: DeltaImportResult | null;
  }> {
    return this.runImport('cron', fileDate);
  }

  async runImport(
    trigger: 'cron' | 'manual',
    fileDate = kstYesterday(),
  ): Promise<{
    fileDate: string;
    csv: CardhedgerDailyPriceExportRun | null;
    delta: DeltaImportResult | null;
  }> {
    const csv = await this.tryCsvExport(fileDate);
    const delta = await this.importPriceUpdatesDelta({
      catalogSync: trigger === 'manual',
    });
    return { fileDate, csv, delta };
  }

  async listDeltaImportRuns(limit = 12): Promise<CardhedgerPriceDeltaImportRun[]> {
    return this.deltaRunRepo.find({
      order: { ranAt: 'DESC' },
      take: Math.min(50, Math.max(1, limit)),
    });
  }

  async getDeltaImportRun(id: number): Promise<CardhedgerPriceDeltaImportRun | null> {
    return this.deltaRunRepo.findOne({ where: { id } });
  }

  private async tryCsvExport(
    fileDate: string,
  ): Promise<CardhedgerDailyPriceExportRun | null> {
    const flags = this.flags();
    if (!flags.dailyPriceExportCsvEnabled) {
      await this.exportRunRepo.save({
        fileDate,
        source: 'csv_export',
        status: 'skipped_disabled',
        rowCount: null,
        storagePath: null,
        errorMessage: 'CARDHEDGER_DAILY_EXPORT_CSV_ENABLED is off (non-Enterprise)',
      });
      return null;
    }

    try {
      this.cardhedger.assertConfigured();
      const { buffer, contentType } = await this.cardhedger.forwardBinary(
        `/v1/download/daily-price-export/${fileDate}`,
      );
      const dir = this.storageDir();
      fs.mkdirSync(dir, { recursive: true });
      const ext = contentType?.includes('csv') ? 'csv' : 'bin';
      const storagePath = path.join(dir, `daily-price-export-${fileDate}.${ext}`);
      fs.writeFileSync(storagePath, buffer);

      const text = buffer.toString('utf8');
      const rowCount = Math.max(0, text.split('\n').filter((l) => l.trim()).length - 1);

      const row = await this.exportRunRepo.save({
        fileDate,
        source: 'csv_export',
        status: 'success',
        rowCount,
        storagePath,
        errorMessage: null,
      });
      this.logger.log(
        JSON.stringify({
          msg: 'cardhedger_daily_csv_export',
          fileDate,
          rowCount,
          storagePath,
        }),
      );
      return row;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const httpStatus =
        typeof e === 'object' &&
        e != null &&
        'status' in e &&
        typeof (e as { status?: unknown }).status === 'number'
          ? (e as { status: number }).status
          : undefined;
      const enterprise =
        httpStatus === 403 ||
        /403|forbidden|enterprise|elite/i.test(msg);
      const runStatus = enterprise ? 'skipped_enterprise' : 'failed';
      await this.exportRunRepo.save({
        fileDate,
        source: 'csv_export',
        status: runStatus,
        rowCount: null,
        storagePath: null,
        errorMessage: msg.slice(0, 1000),
      });
      this.logger.warn(
        JSON.stringify({
          msg: 'cardhedger_daily_csv_export',
          fileDate,
          status: runStatus,
          error: msg.slice(0, 200),
        }),
      );
      return null;
    }
  }

  /**
   * Delta poll — API key only (no client_id). Maps card_id → our collections via DB.
   * When `catalogSync` is true (manual admin), also refreshes all Cardhedger-linked collections
   * if the global delta feed had no overlap with our catalog.
   */
  async importPriceUpdatesDelta(options?: {
    catalogSync?: boolean;
  }): Promise<DeltaImportResult | null> {
    if (!this.flags().dailyPriceDeltaImportEnabled) {
      return null;
    }

    const since = await this.readCheckpointSince();

    try {
      this.cardhedger.assertConfigured();
      const raw = await this.cardhedger.forwardJson('POST', '/v1/cards/price-updates', {
        body: { since, ignore_grades: ['Raw'] },
      });

      const updates = this.parseDeltaUpdates(raw);
      const cardIds = updates
        .map((u) => String(u.card_id ?? '').trim())
        .filter(Boolean);
      const cardIdToCollectionKeys =
        await this.subscriptions.mapCollectionKeysByCardIds(cardIds);

      const summary = buildDeltaImportSummary({
        sinceIso: since,
        updates,
        cardIdToCollectionKeys,
      });

      const enqueued = new Set(summary.enqueuedCollectionKeys);
      let catalogFallbackCount = 0;

      if (options?.catalogSync) {
        const catalogKeys = await this.subscriptions.listCatalogCollectionKeys();
        const fallbackRows: typeof summary.matchedCollections = [];

        for (const key of catalogKeys) {
          if (enqueued.has(key)) continue;
          enqueued.add(key);
          catalogFallbackCount++;
          fallbackRows.push({
            collectionKey: key,
            cardId: '',
            grade: null,
            price: null,
            cardDesc: 'Catalog sync — Cardhedger-linked collection',
            updateTimestamp: null,
          });
        }

        if (catalogFallbackCount > 0) {
          summary.catalogFallbackCount = catalogFallbackCount;
          summary.matchedCollectionCount = enqueued.size;
          summary.enqueuedCollectionKeys = [...enqueued].sort();
          summary.matchedCollections = [
            ...summary.matchedCollections,
            ...fallbackRows,
          ].sort((a, b) => a.collectionKey.localeCompare(b.collectionKey));
        }
      }

      for (const key of enqueued) {
        this.eventEmitter.emit('snapshot.enqueue', {
          key,
          reason: 'price_delta',
        });
      }

      if (updates.length > 0 && summary.latestTimestampIso) {
        await this.writeCheckpoint(summary.latestTimestampIso);
      }

      const saved = await this.deltaRunRepo.save({
        sinceIso: summary.sinceIso,
        latestTimestampIso: summary.latestTimestampIso,
        updateCount: summary.updateCount,
        uniqueCardIds: summary.uniqueCardIds,
        matchedCollectionCount: summary.matchedCollectionCount,
        deltaMatchedCollectionCount: summary.deltaMatchedCollectionCount,
        catalogFallbackCount: summary.catalogFallbackCount,
        unmatchedUpdateCount: summary.unmatchedUpdateCount,
        enqueuedCollectionKeys: summary.enqueuedCollectionKeys,
        matchedCollections: summary.matchedCollections,
        sampleUpdates: [],
        status: 'success',
        errorMessage: null,
      });

      this.logger.log(
        JSON.stringify({
          msg: 'cardhedger_price_delta_import',
          runId: saved.id,
          since,
          updates: summary.updateCount,
          deltaMatched: summary.deltaMatchedCollectionCount,
          catalogFallback: summary.catalogFallbackCount,
          enqueued: summary.matchedCollectionCount,
          latestTs: summary.latestTimestampIso,
        }),
      );

      return { id: saved.id, ...summary };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.deltaRunRepo.save({
        sinceIso: since,
        latestTimestampIso: null,
        updateCount: 0,
        uniqueCardIds: 0,
        matchedCollectionCount: 0,
        unmatchedUpdateCount: 0,
        enqueuedCollectionKeys: [],
        matchedCollections: [],
        sampleUpdates: [],
        status: 'failed',
        errorMessage: msg.slice(0, 1000),
      });
      throw e;
    }
  }

  private parseDeltaUpdates(raw: unknown): CardhedgerPriceUpdatePayload[] {
    if (typeof raw !== 'object' || raw == null) return [];
    const updates = (raw as { updates?: unknown }).updates;
    return normalizePriceWebhookUpdates({ updates });
  }

  private async readCheckpointSince(): Promise<string> {
    let row = await this.checkpointRepo.findOne({ where: { id: 1 } });
    if (!row) {
      const since = isoHoursAgo(24);
      row = await this.checkpointRepo.save({ id: 1, lastSinceIso: since });
      return since;
    }
    return row.lastSinceIso;
  }

  private async writeCheckpoint(lastSinceIso: string): Promise<void> {
    await this.checkpointRepo.save({ id: 1, lastSinceIso });
  }
}
