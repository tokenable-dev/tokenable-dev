import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PRICECHARTING_NOT_CONFIGURED_CODE } from './pricecharting-errors';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { runWithPgSessionAdvisoryLock } from '../database/pg-session-advisory-lock.util';
import { PricechartingCatalogSource } from './entities/pricecharting-catalog-source.entity';
import {
  PricechartingImportService,
  seoulCalendarDay,
  writePricechartingCsv,
} from './pricecharting-import.service';
import {
  normalizeCatalogSourceUrl,
  PricechartingService,
} from './pricecharting.service';

const LOCK_KEY = 872314520;
const GAP_MS = 3_000;

export type PricechartingGuideRunResult = {
  key: string;
  ok: boolean;
  rowCount: number | null;
  error: string | null;
};

export type PricechartingGuidesRun = {
  skipped: boolean;
  results: PricechartingGuideRunResult[];
};
const GUIDE_URL = 'https://www.pricecharting.com/price-guide/download-custom';

export const PRICECHARTING_GUIDES = [
  { key: 'video-games', label: '비디오 게임', category: null },
  { key: 'pokemon-cards', label: '포켓몬 카드', category: 'pokemon-cards' },
  { key: 'magic-cards', label: '매직 카드', category: 'magic-cards' },
  { key: 'yugioh-cards', label: '유희왕 카드', category: 'yugioh-cards' },
  { key: 'one-piece-cards', label: '원피스 카드', category: 'one-piece-cards' },
] as const;

export const PRICECHARTING_GUIDE_KEYS = PRICECHARTING_GUIDES.map((guide) => guide.key);

export type PricechartingGuideSyncStatus = 'idle' | 'running' | 'success' | 'error';

export type PricechartingGuideView = {
  key: string;
  label: string;
  lastRowCount: number | null;
  lastRunAt: string | null;
  /** In-process guide sync (admin 「갱신」). Survives only for this Nest process. */
  syncStatus: PricechartingGuideSyncStatus;
  syncError: string | null;
  /** Set when the latest background sync for this guide finished successfully. */
  lastSyncResult: PricechartingGuideSyncDone | null;
};

export type PricechartingGuideSyncAccepted = {
  accepted: true;
  key: string;
  label: string;
  status: 'running';
};

export type PricechartingGuideSyncDone = {
  key: string;
  label: string;
  rowCount: number;
  historyCount: number;
  totalProducts: number;
  imported: true;
  archived: boolean;
  archiveError: string | null;
};

type GuideJobState = {
  status: PricechartingGuideSyncStatus;
  error: string | null;
  result: PricechartingGuideSyncDone | null;
};

function guideDownloadUrl(category: string | null): string {
  const url = new URL(GUIDE_URL);
  if (category) url.searchParams.set('category', category);
  return url.toString();
}

export type PricechartingSourceView = {
  id: number;
  label: string;
  url: string;
  enabled: boolean;
  lastStatus: 'success' | 'error' | null;
  lastError: string | null;
  lastRowCount: number | null;
  lastRunAt: string | null;
};

export type PricechartingSyncItem = {
  id: number;
  label: string;
  ok: boolean;
  rowCount: number | null;
  error: string | null;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function scrub(message: string): string {
  return message.replace(/([?&]t=)[^&\s]+/gi, '$1').slice(0, 500);
}

function isNotConfigured(err: unknown): boolean {
  if (!(err instanceof HttpException)) return false;
  const body = err.getResponse();
  return (
    body != null &&
    typeof body === 'object' &&
    (body as { code?: string }).code === PRICECHARTING_NOT_CONFIGURED_CODE
  );
}

function errorText(err: unknown): string {
  if (err instanceof HttpException) {
    const body = err.getResponse();
    if (typeof body === 'string') return scrub(body);
    if (body && typeof body === 'object' && 'message' in body) {
      const message = (body as { message?: string | string[] }).message;
      if (Array.isArray(message)) return scrub(message.join(', '));
      if (typeof message === 'string') return scrub(message);
    }
  }
  return scrub(err instanceof Error ? err.message : 'sync failed');
}

function toView(row: PricechartingCatalogSource): PricechartingSourceView {
  return {
    id: row.id,
    label: row.label,
    url: row.url,
    enabled: row.enabled,
    lastStatus: row.lastStatus,
    lastError: row.lastError,
    lastRowCount: row.lastRowCount,
    lastRunAt: row.lastRunAt ? row.lastRunAt.toISOString() : null,
  };
}

@Injectable()
export class PricechartingSyncService {
  private readonly logger = new Logger(PricechartingSyncService.name);
  /** At most one guide download+import at a time (this process). */
  private inFlight = false;
  private readonly guideJobs = new Map<string, GuideJobState>();

  constructor(
    @InjectRepository(PricechartingCatalogSource)
    private readonly sources: Repository<PricechartingCatalogSource>,
    private readonly imports: PricechartingImportService,
    private readonly pricecharting: PricechartingService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  private jobFor(key: string): GuideJobState {
    return (
      this.guideJobs.get(key) ?? {
        status: 'idle',
        error: null,
        result: null,
      }
    );
  }

  async guides(): Promise<PricechartingGuideView[]> {
    const filenames = PRICECHARTING_GUIDES.map((guide) => `${guide.key}.csv`);
    const runs = (await this.dataSource.query(
      `SELECT DISTINCT ON (filename)
         filename, row_count, created_at
       FROM pricecharting_import_runs
       WHERE filename = ANY($1::varchar[])
       ORDER BY filename, id DESC`,
      [filenames],
    )) as Array<{ filename: string; row_count: number; created_at: Date }>;
    const byFile = new Map(runs.map((run) => [run.filename, run]));
    return PRICECHARTING_GUIDES.map((guide) => {
      const run = byFile.get(`${guide.key}.csv`);
      const job = this.jobFor(guide.key);
      return {
        key: guide.key,
        label: guide.label,
        lastRowCount: run ? Number(run.row_count) : null,
        lastRunAt: run ? new Date(run.created_at).toISOString() : null,
        syncStatus: job.status,
        syncError: job.error,
        lastSyncResult: job.result,
      };
    });
  }

  async list(): Promise<PricechartingSourceView[]> {
    const rows = await this.sources.find({ order: { id: 'ASC' } });
    return rows.map(toView);
  }

  async create(label: string, url: string): Promise<PricechartingSourceView> {
    const normalized = normalizeCatalogSourceUrl(url);
    const row = this.sources.create({
      label: label.trim().slice(0, 128),
      url: normalized,
      enabled: true,
    });
    try {
      const saved = await this.sources.save(row);
      return toView(saved);
    } catch (err) {
      const code = (err as { code?: string; driverError?: { code?: string } }).driverError
        ?.code;
      if (err instanceof QueryFailedError && (code === '23505' || (err as { code?: string }).code === '23505')) {
        throw new BadRequestException('That CSV URL is already registered');
      }
      throw err;
    }
  }

  async remove(id: number): Promise<{ ok: true }> {
    await this.sources.delete({ id });
    return { ok: true };
  }

  /**
   * Admin 「갱신」 — accept immediately and import in the background.
   * Avoids nginx/proxy 504 while large guide CSVs download and upsert.
   */
  enqueueOne(key: string): PricechartingGuideSyncAccepted {
    const guide = PRICECHARTING_GUIDES.find((item) => item.key === key);
    if (!guide) throw new BadRequestException('Unknown price guide');
    if (this.inFlight) {
      throw new BadRequestException('A PriceCharting sync is already running');
    }
    this.inFlight = true;
    this.guideJobs.set(guide.key, {
      status: 'running',
      error: null,
      result: null,
    });
    void this.runOneInBackground(guide).catch((err) => {
      this.logger.error(
        `PriceCharting guide ${guide.key} background sync crashed: ${errorText(err)}`,
      );
    });
    return {
      accepted: true,
      key: guide.key,
      label: guide.label,
      status: 'running',
    };
  }

  private async runOneInBackground(
    guide: (typeof PRICECHARTING_GUIDES)[number],
  ): Promise<void> {
    try {
      const done = await this.runOneLocked(guide);
      this.guideJobs.set(guide.key, {
        status: 'success',
        error: null,
        result: done,
      });
    } catch (err) {
      const message = errorText(err);
      this.guideJobs.set(guide.key, {
        status: 'error',
        error: message,
        result: null,
      });
      this.logger.error(`PriceCharting guide ${guide.key} failed: ${message}`);
    } finally {
      this.inFlight = false;
    }
  }

  /**
   * Same import as each admin 「갱신」 button, one guide after another.
   * Skips when a sync is already running in this process or another replica holds the lock.
   */
  async runAllGuides(options?: { gapMs?: number }): Promise<PricechartingGuidesRun> {
    if (this.inFlight) {
      this.logger.warn('PriceCharting guide run skipped: a sync is already running');
      return { skipped: true, results: [] };
    }
    this.inFlight = true;
    const gapMs = options?.gapMs ?? GAP_MS;
    try {
      const lock = await runWithPgSessionAdvisoryLock(
        this.dataSource,
        LOCK_KEY,
        () => this.runGuidesSequentially(gapMs),
      );
      if (!lock.acquired) {
        this.logger.warn('PriceCharting guide run skipped: advisory lock busy');
        return { skipped: true, results: [] };
      }
      return { skipped: false, results: lock.value };
    } finally {
      this.inFlight = false;
    }
  }

  private async runGuidesSequentially(
    gapMs: number,
  ): Promise<PricechartingGuideRunResult[]> {
    const results: PricechartingGuideRunResult[] = [];
    for (let i = 0; i < PRICECHARTING_GUIDES.length; i += 1) {
      if (i > 0 && gapMs > 0) await sleep(gapMs);
      const guide = PRICECHARTING_GUIDES[i]!;
      this.guideJobs.set(guide.key, {
        status: 'running',
        error: null,
        result: null,
      });
      try {
        const done = await this.executeGuide(guide);
        this.guideJobs.set(guide.key, {
          status: 'success',
          error: null,
          result: done,
        });
        results.push({
          key: guide.key,
          ok: true,
          rowCount: done.rowCount,
          error: null,
        });
      } catch (err) {
        const message = errorText(err);
        this.guideJobs.set(guide.key, {
          status: 'error',
          error: message,
          result: null,
        });
        this.logger.error(`PriceCharting guide ${guide.key} failed: ${message}`);
        results.push({
          key: guide.key,
          ok: false,
          rowCount: null,
          error: message,
        });
        if (isNotConfigured(err)) break;
      }
    }
    const ok = results.filter((row) => row.ok).length;
    this.logger.log(
      `PriceCharting guide run finished: ${ok}/${results.length} ok`,
    );
    return results;
  }

  /** Download + upsert one fixed guide. The download URL is not returned to the client. */
  private async runOneLocked(
    guide: (typeof PRICECHARTING_GUIDES)[number],
  ): Promise<PricechartingGuideSyncDone> {
    const lock = await runWithPgSessionAdvisoryLock(this.dataSource, LOCK_KEY, () =>
      this.executeGuide(guide),
    );
    if (!lock.acquired) {
      throw new BadRequestException('A PriceCharting sync is already running');
    }
    return lock.value;
  }

  private async executeGuide(
    guide: (typeof PRICECHARTING_GUIDES)[number],
  ): Promise<PricechartingGuideSyncDone> {
    const buffer = await this.pricecharting.downloadPriceList(
      guideDownloadUrl(guide.category),
    );
    const imported = await this.imports.importFile(
      {
        buffer,
        originalname: `${guide.key}.csv`,
        size: buffer.length,
      },
      { archiveSegments: [guide.key] },
    );
    const day = seoulCalendarDay();
    const archive = await writePricechartingCsv(
      guide.key,
      `${guide.key}-${day}.csv`,
      buffer,
    );
    this.logger.log(
      `PriceCharting guide ${guide.key} upserted ${imported.rowCount} rows (${imported.historyCount} price rows). CSV ${archive}`,
    );
    return {
      key: guide.key,
      label: guide.label,
      rowCount: imported.rowCount,
      historyCount: imported.historyCount,
      totalProducts: imported.totalProducts,
      imported: true,
      archived: imported.archived,
      archiveError: imported.archiveError,
    };
  }

  /** Admin button. Downloads each enabled URL, then upserts the same catalog. */
  async runAll(): Promise<{ results: PricechartingSyncItem[] }> {
    if (this.inFlight) {
      throw new BadRequestException('A PriceCharting sync is already running');
    }
    this.inFlight = true;
    try {
      const lock = await runWithPgSessionAdvisoryLock(this.dataSource, LOCK_KEY, () =>
        this.syncEnabled(),
      );
      if (!lock.acquired) {
        throw new BadRequestException('A PriceCharting sync is already running');
      }
      return { results: lock.value };
    } finally {
      this.inFlight = false;
    }
  }

  private async syncEnabled(): Promise<PricechartingSyncItem[]> {
    const rows = await this.sources.find({
      where: { enabled: true },
      order: { id: 'ASC' },
    });
    const results: PricechartingSyncItem[] = [];
    for (let i = 0; i < rows.length; i += 1) {
      if (i > 0) await sleep(GAP_MS);
      results.push(await this.syncOne(rows[i]!));
    }
    this.logger.log(
      `PriceCharting catalog sync finished: ${results.filter((r) => r.ok).length}/${results.length} ok`,
    );
    return results;
  }

  private async syncOne(row: PricechartingCatalogSource): Promise<PricechartingSyncItem> {
    const filename = `${row.label.replace(/[^\w.-]+/g, '_').slice(0, 80) || 'catalog'}.csv`;
    try {
      const buffer = await this.pricecharting.downloadPriceList(row.url);
      const imported = await this.imports.importFile({
        buffer,
        originalname: filename,
        size: buffer.length,
      });
      await this.sources.update(row.id, {
        lastStatus: 'success',
        lastError: null,
        lastRowCount: imported.rowCount,
        lastRunAt: new Date(),
      });
      this.logger.log(
        `PriceCharting source ${row.id} upserted ${imported.rowCount} rows`,
      );
      return { id: row.id, label: row.label, ok: true, rowCount: imported.rowCount, error: null };
    } catch (err) {
      const message = errorText(err);
      await this.sources.update(row.id, {
        lastStatus: 'error',
        lastError: message,
        lastRunAt: new Date(),
      });
      this.logger.error(`PriceCharting source ${row.id} failed: ${message}`);
      return { id: row.id, label: row.label, ok: false, rowCount: null, error: message };
    }
  }
}

