import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  PricechartingArchive,
  runImportThenArchive,
} from './pricecharting-archive';
import { catalogProductIsBox } from './pricecharting-catalog-search';
import {
  PRICE_COLUMNS,
  mergeManualHistoryPrices,
  manualHistoryPricePatch,
  parsePricechartingCsv,
  type PricechartingCsvRow,
} from './pricecharting-csv';

const CHUNK = 8_000;
const MAX_BYTES = 50 * 1024 * 1024;
const MAX_ROWS = 250_000;

const TEXT_COLUMNS = [
  'id',
  'console_name',
  'product_name',
  'upc',
  'genre',
  'tcg_id',
  'asin',
  'epid',
  'release_date',
  'source_file',
] as const;

/**
 * CSV fields + derived `is_sealed_box`.
 * `cover_image_url` is admin-set and must not be in this list.
 */
const INSERT_COLUMNS = [
  ...TEXT_COLUMNS.slice(0, 3),
  ...PRICE_COLUMNS,
  'upc',
  'sales_volume',
  'genre',
  'tcg_id',
  'asin',
  'epid',
  'release_date',
  'is_sealed_box',
  'source_file',
  'imported_at',
];

export type PricechartingImportResult = {
  runId: number;
  filename: string;
  rowCount: number;
  skipped: number;
  genres: Record<string, number>;
  totalProducts: number;
  historyCount: number;
  imported: true;
  archived: boolean;
  archiveError: string | null;
};

@Injectable()
export class PricechartingImportService {
  private readonly logger = new Logger(PricechartingImportService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly archive: PricechartingArchive,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Refresh Markets snapshots for sealed-box collections tied to these products. */
  private async enqueueSealedBoxSnapshots(
    productIds: readonly string[],
  ): Promise<void> {
    const ids = [
      ...new Set(
        productIds.map((id) => id.trim()).filter((id) => /^\d+$/.test(id)),
      ),
    ].slice(0, 500);
    if (ids.length === 0) return;
    try {
      const rows = (await this.dataSource.query(
        `SELECT DISTINCT collection_key
         FROM marketplace_collections
         WHERE components->>'assetKind' = 'sealed_box'
           AND components->>'pricechartingProductId' = ANY($1::text[])
         LIMIT 200`,
        [ids],
      )) as Array<{ collection_key: string }>;
      for (const row of rows) {
        const key = String(row.collection_key ?? '')
          .trim()
          .toLowerCase();
        if (!key) continue;
        this.eventEmitter.emit('snapshot.enqueue', {
          key,
          reason: 'price_delta',
        });
      }
    } catch (err) {
      this.logger.warn(
        `sealed-box snapshot enqueue skipped: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async summary(): Promise<{
    totalProducts: number;
    byGenre: { genre: string; count: number }[];
    recentRuns: {
      id: number;
      filename: string;
      rowCount: number;
      skippedCount: number;
      genres: Record<string, number>;
      status: string;
      errorMessage: string | null;
      createdAt: string;
    }[];
  }> {
    const [totalRow, genreRows, runs] = await Promise.all([
      this.dataSource.query(
        `SELECT COUNT(*)::int AS n FROM pricecharting_products`,
      ),
      this.dataSource.query(
        `SELECT COALESCE(genre, '(blank)') AS genre, COUNT(*)::int AS count
         FROM pricecharting_products
         GROUP BY genre
         ORDER BY count DESC
         LIMIT 30`,
      ),
      this.dataSource.query(
        `SELECT id, filename, row_count, skipped_count, genres, status, error_message, created_at
         FROM pricecharting_import_runs
         ORDER BY id DESC
         LIMIT 20`,
      ),
    ]);

    return {
      totalProducts: Number(totalRow?.[0]?.n ?? 0),
      byGenre: (genreRows ?? []).map(
        (r: { genre: string; count: number }) => ({
          genre: r.genre,
          count: Number(r.count),
        }),
      ),
      recentRuns: (runs ?? []).map(
        (r: {
          id: number;
          filename: string;
          row_count: number;
          skipped_count: number;
          genres: Record<string, number>;
          status: string;
          error_message: string | null;
          created_at: Date;
        }) => ({
          id: r.id,
          filename: r.filename,
          rowCount: Number(r.row_count),
          skippedCount: Number(r.skipped_count),
          genres: r.genres ?? {},
          status: r.status,
          errorMessage: r.error_message,
          createdAt: new Date(r.created_at).toISOString(),
        }),
      ),
    };
  }

  async importFile(
    file: {
      buffer: Buffer;
      originalname: string;
      size: number;
    },
    options?: {
      sportsArchive?: boolean;
      archiveSegments?: string[];
      /** Tests supply a Seoul day. Production omits this and uses seoulCalendarDay(). */
      observedOn?: string;
    },
  ): Promise<PricechartingImportResult> {
    const pending: {
      segments: string[] | null;
      archiveDate: string;
      sportsWrite: { folder: string; name: string } | null;
    } = { segments: null, archiveDate: '', sportsWrite: null };
    const outcome = await runImportThenArchive(
      async () => {
        if (!file?.buffer?.length) {
          throw new BadRequestException('CSV file is required');
        }
        if (file.size > MAX_BYTES) {
          throw new BadRequestException('CSV must be 50 MB or smaller');
        }
        let filename = (file.originalname || 'upload.csv').slice(0, 256);
        const text = file.buffer.toString('utf8');

        let parsed: ReturnType<typeof parsePricechartingCsv>;
        try {
          parsed = parsePricechartingCsv(text);
        } catch (err) {
          throw new BadRequestException(
            err instanceof Error ? err.message : 'Could not parse CSV',
          );
        }
        if (parsed.rows.length === 0) {
          throw new BadRequestException(
            'No product rows found. Header must include id and product-name.',
          );
        }
        if (parsed.rows.length > MAX_ROWS) {
          throw new BadRequestException(`CSV exceeds ${MAX_ROWS} rows`);
        }

        const day = options?.observedOn ?? seoulCalendarDay();
        if (options?.observedOn && !/^\d{4}-\d{2}-\d{2}$/.test(options.observedOn)) {
          throw new BadRequestException('observedOn must be YYYY-MM-DD');
        }
        if (options?.sportsArchive) {
          const slug = dominantSetSlug(parsed.rows);
          filename = `${slug}-${day}.csv`;
          pending.sportsWrite = { folder: path.join('sports', slug), name: filename };
          pending.segments = ['sports', slug];
        } else if (options?.archiveSegments?.length) {
          pending.segments = options.archiveSegments;
        }
        pending.archiveDate = day;

        const qr = this.dataSource.createQueryRunner();
        await qr.connect();
        await qr.startTransaction();
        let runId = 0;
        let historyCount = 0;
        try {
          const inserted = await qr.query(
            `INSERT INTO pricecharting_import_runs
               (filename, byte_size, row_count, skipped_count, genres, status)
             VALUES ($1, $2, $3, $4, $5::jsonb, 'success')
             RETURNING id`,
            [
              filename,
              file.size,
              parsed.rows.length,
              parsed.skipped,
              JSON.stringify(parsed.genres),
            ],
          );
          runId = Number(inserted[0].id);
          for (let i = 0; i < parsed.rows.length; i += CHUNK) {
            historyCount += await this.upsertChunk(
              qr,
              parsed.rows.slice(i, i + CHUNK),
              filename,
              day,
            );
          }
          await qr.commitTransaction();
        } catch (err) {
          await qr.rollbackTransaction();
          const message = err instanceof Error ? err.message : 'import failed';
          this.logger.error(`PriceCharting CSV import failed: ${message}`);
          throw new BadRequestException(`Import failed: ${message}`);
        } finally {
          await qr.release();
        }

        const total = await this.dataSource.query(
          `SELECT COUNT(*)::int AS n FROM pricecharting_products`,
        );
        this.logger.log(
          `PriceCharting CSV upserted ${parsed.rows.length} rows from ${filename} (run ${runId})`,
        );
        void this.enqueueSealedBoxSnapshots(parsed.rows.map((r) => r.id));
        return {
          runId,
          filename,
          rowCount: parsed.rows.length,
          skipped: parsed.skipped,
          genres: parsed.genres,
          totalProducts: Number(total?.[0]?.n ?? 0),
          historyCount,
        };
      },
      () => {
        if (!pending.segments) {
          return Promise.resolve({
            archived: false,
            attempted: false,
            key: null,
            error: null,
          });
        }
        return this.archive.archiveRawCsv({
          segments: pending.segments,
          csvBuffer: file.buffer,
          date: pending.archiveDate,
        });
      },
    );

    if (outcome.archive.attempted && !outcome.archive.archived && outcome.archive.error) {
      try {
        await this.dataSource.query(
          `UPDATE pricecharting_import_runs SET error_message = $2 WHERE id = $1`,
          [outcome.imported.runId, outcome.archive.error],
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'update failed';
        this.logger.error(
          `Could not record PriceCharting archive failure on run ${outcome.imported.runId}: ${message}`,
        );
      }
    }
    if (pending.sportsWrite) {
      await writePricechartingCsv(
        pending.sportsWrite.folder,
        pending.sportsWrite.name,
        file.buffer,
      );
    }

    return {
      ...outcome.imported,
      imported: true,
      archived: outcome.archive.archived,
      archiveError: outcome.archive.attempted ? outcome.archive.error : null,
    };
  }

  private async upsertChunk(
    qr: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
    rows: PricechartingCsvRow[],
    filename: string,
    observedOn: string,
  ): Promise<number> {
    const ids: string[] = [];
    const consoles: string[] = [];
    const names: string[] = [];
    const priceCols = PRICE_COLUMNS.map(() => [] as Array<number | null>);
    const upcs: Array<string | null> = [];
    const volumes: Array<number | null> = [];
    const genres: Array<string | null> = [];
    const tcgIds: Array<string | null> = [];
    const asins: Array<string | null> = [];
    const epids: Array<string | null> = [];
    const releases: Array<string | null> = [];
    const sealedFlags: boolean[] = [];

    for (const row of rows) {
      ids.push(row.id);
      consoles.push(row.consoleName.slice(0, 256));
      names.push(row.productName.slice(0, 512));
      PRICE_COLUMNS.forEach((col, i) => priceCols[i]!.push(row.prices[col] ?? null));
      upcs.push(row.upc);
      volumes.push(row.salesVolume);
      genres.push(row.genre);
      tcgIds.push(row.tcgId);
      asins.push(row.asin);
      epids.push(row.epid);
      releases.push(row.releaseDate);
      sealedFlags.push(
        catalogProductIsBox({
          genre: row.genre,
          productName: row.productName,
          consoleName: row.consoleName,
        }),
      );
    }

    const historyCount = await this.insertDailyPrices(qr, rows, observedOn);

    const priceStart = 5;
    const priceSelect = PRICE_COLUMNS.map(
      (_, i) => `$${priceStart + i}::int[]`,
    ).join(', ');
    const afterPrices = priceStart + PRICE_COLUMNS.length;
    const updates = INSERT_COLUMNS.filter((c) => c !== 'id')
      .map((c) => `${c} = EXCLUDED.${c}`)
      .join(', ');

    await qr.query(
      `INSERT INTO pricecharting_products (${INSERT_COLUMNS.join(', ')})
       SELECT id, console_name, product_name, ${PRICE_COLUMNS.join(', ')},
              upc, sales_volume, genre, tcg_id, asin, epid,
              release_date::date, is_sealed_box, $1, now()
       FROM unnest(
         $2::varchar[], $3::varchar[], $${4}::varchar[],
         ${priceSelect},
         $${afterPrices}::varchar[], $${afterPrices + 1}::int[],
         $${afterPrices + 2}::varchar[], $${afterPrices + 3}::varchar[],
         $${afterPrices + 4}::varchar[], $${afterPrices + 5}::varchar[],
         $${afterPrices + 6}::varchar[], $${afterPrices + 7}::boolean[]
       ) AS u(
         id, console_name, product_name, ${PRICE_COLUMNS.join(', ')},
         upc, sales_volume, genre, tcg_id, asin, epid, release_date, is_sealed_box
       )
       ON CONFLICT (id) DO UPDATE SET ${updates}`,
      [
        filename,
        ids,
        consoles,
        names,
        ...priceCols,
        upcs,
        volumes,
        genres,
        tcgIds,
        asins,
        epids,
        releases,
        sealedFlags,
      ],
    );
    return historyCount;
  }

  /**
   * One row per product per Seoul date, including days the cents did not change.
   * A second run on the same date updates that day.
   */
  private async insertDailyPrices(
    qr: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
    rows: PricechartingCsvRow[],
    observedOn: string,
  ): Promise<number> {
    if (rows.length === 0) return 0;
    const priceStart = 3;
    const priceArrays = PRICE_COLUMNS.map(
      () => [] as Array<number | null>,
    );
    const ids: string[] = [];
    for (const row of rows) {
      ids.push(row.id);
      PRICE_COLUMNS.forEach((col, i) => priceArrays[i]!.push(row.prices[col] ?? null));
    }
    const priceSql = PRICE_COLUMNS.map((_, i) => `$${priceStart + i}::int[]`).join(', ');
    const priceObject = PRICE_COLUMNS.map((col) => `'${col}', ${col}`).join(', ');
    await qr.query(
      `INSERT INTO pricecharting_price_history (product_id, observed_on, prices)
       SELECT id, $1::date, jsonb_build_object(${priceObject})
       FROM unnest($2::varchar[], ${priceSql}) AS u(id, ${PRICE_COLUMNS.join(', ')})
       ON CONFLICT (product_id, observed_on) DO UPDATE SET prices = EXCLUDED.prices`,
      [observedOn, ids, ...priceArrays],
    );
    return rows.length;
  }

  /**
   * One past (or same-day) price row. Does not change `pricecharting_products`.
   * Columns left blank keep that date's stored cents.
   */
  async recordManualHistory(
    productId: string,
    observedOn: string,
    rawPrices: Record<string, unknown>,
    opts?: { syncCurrent?: boolean },
  ): Promise<{
    productId: string;
    productName: string;
    consoleName: string;
    observedOn: string;
    savedCents: Record<string, number>;
    syncedCurrentLoose: boolean;
  }> {
    const id = productId.trim();
    if (!/^\d+$/.test(id)) {
      throw new BadRequestException('product id must be numeric');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(observedOn)) {
      throw new BadRequestException('observedOn must be YYYY-MM-DD');
    }
    let savedCents: Record<string, number>;
    try {
      savedCents = manualHistoryPricePatch(rawPrices);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Invalid prices',
      );
    }

    const found = (await this.dataSource.query(
      `SELECT product_name, console_name
       FROM pricecharting_products
       WHERE id = $1`,
      [id],
    )) as Array<{ product_name: string; console_name: string }>;
    const product = found[0];
    if (!product) {
      throw new BadRequestException('No catalog product with that id');
    }

    const prior = (await this.dataSource.query(
      `SELECT prices
       FROM pricecharting_price_history
       WHERE product_id = $1 AND observed_on = $2::date`,
      [id, observedOn],
    )) as Array<{ prices: Record<string, unknown> | null }>;
    const prices = mergeManualHistoryPrices(prior[0]?.prices ?? null, savedCents);
    await this.dataSource.query(
      `INSERT INTO pricecharting_price_history (product_id, observed_on, prices)
       VALUES ($1, $2::date, $3::jsonb)
       ON CONFLICT (product_id, observed_on) DO UPDATE SET prices = EXCLUDED.prices`,
      [id, observedOn, JSON.stringify(prices)],
    );

    let syncedCurrentLoose = false;
    const looseCents = savedCents.loose_price_cents;
    if (
      opts?.syncCurrent === true &&
      typeof looseCents === 'number' &&
      Number.isFinite(looseCents) &&
      looseCents >= 0
    ) {
      await this.dataSource.query(
        `UPDATE pricecharting_products
         SET loose_price_cents = $2
         WHERE id = $1`,
        [id, looseCents],
      );
      await this.dataSource.query(
        `UPDATE marketplace_collections
         SET components = jsonb_set(
           COALESCE(components, '{}'::jsonb),
           '{loosePriceCents}',
           to_jsonb($2::int),
           true
         )
         WHERE components->>'assetKind' = 'sealed_box'
           AND components->>'pricechartingProductId' = $1`,
        [id, looseCents],
      );
      syncedCurrentLoose = true;
    }

    void this.enqueueSealedBoxSnapshots([id]);
    return {
      productId: id,
      productName: product.product_name,
      consoleName: product.console_name,
      observedOn,
      savedCents,
      syncedCurrentLoose,
    };
  }

  /** Chart series for one product: every stored Seoul date, oldest first. */
  async priceSeries(productId: string): Promise<{
    productId: string;
    points: { observedOn: string; prices: Record<string, number | null> }[];
  }> {
    const id = productId.trim();
    if (!/^\d+$/.test(id)) {
      throw new BadRequestException('product id must be numeric');
    }
    const rows = (await this.dataSource.query(
      `SELECT to_char(observed_on, 'YYYY-MM-DD') AS observed_on, prices
       FROM pricecharting_price_history
       WHERE product_id = $1
       ORDER BY observed_on ASC`,
      [id],
    )) as Array<{ observed_on: string; prices: Record<string, number | null> }>;
    return {
      productId: id,
      points: rows.map((row) => ({
        observedOn: row.observed_on,
        prices: row.prices ?? {},
      })),
    };
  }
}

export function seoulCalendarDay(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Filesystem name from the set label inside the CSV, not the uploaded filename. */
export function dominantSetSlug(rows: PricechartingCsvRow[]): string {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const name = row.consoleName.trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  let best = '';
  let bestCount = 0;
  for (const [name, count] of counts) {
    if (count > bestCount) {
      best = name;
      bestCount = count;
    }
  }
  const slug = best
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || 'unknown-set';
}

function csvArchiveDir(): string {
  const configured = process.env.PRICECHARTING_CSV_DIR?.trim();
  if (configured) return configured;
  return path.join(process.cwd(), 'var', 'pricecharting');
}

/** Overwrites `{folder}/{filename}` when that path already exists. */
export async function writePricechartingCsv(
  folder: string,
  filename: string,
  body: Buffer,
): Promise<string> {
  const dir = path.join(csvArchiveDir(), folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), body);
  return path.join(folder, filename);
}
