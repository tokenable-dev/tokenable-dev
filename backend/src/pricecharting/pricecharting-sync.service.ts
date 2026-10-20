import { BadRequestException, HttpException, Injectable, Logger } from '@nestjs/common';
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
const GUIDE_URL = 'https://www.pricecharting.com/price-guide/download-custom';

export const PRICECHARTING_GUIDES = [
  { key: 'video-games', label: '비디오 게임', category: null },
  { key: 'pokemon-cards', label: '포켓몬 카드', category: 'pokemon-cards' },
  { key: 'magic-cards', label: '매직 카드', category: 'magic-cards' },
  { key: 'yugioh-cards', label: '유희왕 카드', category: 'yugioh-cards' },
  { key: 'one-piece-cards', label: '원피스 카드', category: 'one-piece-cards' },
] as const;

export const PRICECHARTING_GUIDE_KEYS = PRICECHARTING_GUIDES.map((guide) => guide.key);

export type PricechartingGuideView = {
  key: string;
  label: string;
  lastRowCount: number | null;
  lastRunAt: string | null;
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
  private inFlight = false;

  constructor(
    @InjectRepository(PricechartingCatalogSource)
    private readonly sources: Repository<PricechartingCatalogSource>,
    private readonly imports: PricechartingImportService,
    private readonly pricecharting: PricechartingService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

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
      return {
        key: guide.key,
        label: guide.label,
        lastRowCount: run ? Number(run.row_count) : null,
        lastRunAt: run ? new Date(run.created_at).toISOString() : null,
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

  /** Admin button for one fixed guide. The download URL is not returned to the client. */
  async runOne(key: string): Promise<{
    key: string;
    label: string;
    rowCount: number;
    historyCount: number;
    totalProducts: number;
    imported: true;
    archived: boolean;
    archiveError: string | null;
  }> {
    const guide = PRICECHARTING_GUIDES.find((item) => item.key === key);
    if (!guide) throw new BadRequestException('Unknown price guide');
    if (this.inFlight) {
      throw new BadRequestException('A PriceCharting sync is already running');
    }
    this.inFlight = true;
    try {
      const lock = await runWithPgSessionAdvisoryLock(this.dataSource, LOCK_KEY, async () => {
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
        return { imported, archive };
      });
      if (!lock.acquired) {
        throw new BadRequestException('A PriceCharting sync is already running');
      }
      this.logger.log(
        `PriceCharting guide ${guide.key} upserted ${lock.value.imported.rowCount} rows (${lock.value.imported.historyCount} price rows). CSV ${lock.value.archive}`,
      );
      return {
        key: guide.key,
        label: guide.label,
        rowCount: lock.value.imported.rowCount,
        historyCount: lock.value.imported.historyCount,
        totalProducts: lock.value.imported.totalProducts,
        imported: true,
        archived: lock.value.imported.archived,
        archiveError: lock.value.imported.archiveError,
      };
    } finally {
      this.inFlight = false;
    }
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

