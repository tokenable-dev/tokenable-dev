import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  CatalogCoverS3Service,
  catalogProductCoverObjectKey,
} from '../marketplace/collections/catalog-cover-s3.service';

export type CatalogProductHit = {
  id: string;
  productName: string;
  consoleName: string;
  genre: string | null;
  releaseDate: string | null;
  upc: string | null;
  loosePriceCents: number | null;
  coverImageUrl: string | null;
};

type ProductRow = {
  id: string;
  product_name: string;
  console_name: string;
  genre: string | null;
  release_date: string | null;
  upc: string | null;
  loose_price_cents: number | null;
  cover_image_url: string | null;
};

const PRODUCT_SELECT = `SELECT id, product_name, console_name, genre,
            to_char(release_date, 'YYYY-MM-DD') AS release_date,
            upc, loose_price_cents, cover_image_url
     FROM pricecharting_products`;

export function catalogQueryTokens(q: string): string[] {
  return q
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .slice(0, 8);
}

/** Whole word, so "box" does not match "booster". */
export function wordPattern(token: string): string {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return `\\m${escaped}\\M`;
}

function toHit(row: ProductRow): CatalogProductHit {
  return {
    id: row.id,
    productName: row.product_name,
    consoleName: row.console_name,
    genre: row.genre,
    releaseDate: row.release_date,
    upc: row.upc,
    loosePriceCents: row.loose_price_cents,
    coverImageUrl: row.cover_image_url?.trim() || null,
  };
}

/**
 * Box SKUs, including ones whose name never says "box"
 * (Booster Bundle, Premium Collection, Collector Chest, Booster Display).
 * Postgres word boundaries. Not a substitute for genre.
 */
const BOX_NAME =
  'box|booster bundle|half booster bundle|booster display|bundle display|build & battle stadium|build and battle stadium|build & battle display|collector chest|collectors chest|ultra-premium collection|ultra premium collection|premium collection|booster case';

/** Single cards and video-game editions whose title merely contains "box". */
const CARD_NOISE =
  'box topper|buy-a-box|buy a box|illustration box|storage box set|code in box|long box|cardboard box|big box|treasure box|puzzle box|ancient gear box|fairy box|mirror box|boom box|attack-in-the-box|tool box|toolbox|box of friends|box of |mystic box|music box|secret box|box promo|grand box|promotion pack';

const BOX_NAME_SQL = `\\m(${BOX_NAME})\\M`;

/**
 * Partner box mint classification (written to `is_sealed_box` on CSV upsert).
 * Sealed Product: box keyword in product_name OR console_name (packs stay out).
 * Card genres: product_name only, after card-number / noise exclusions.
 * Keep in sync with backend/sql/schema/077_pricecharting_is_sealed_box.sql.
 */
export const SEALED_BOX_SQL = `(
  (
    genre = 'Sealed Product'
    AND (
      product_name ~* '${BOX_NAME_SQL}'
      OR console_name ~* '${BOX_NAME_SQL}'
    )
  )
  OR (
    genre IS DISTINCT FROM 'Sealed Product'
    AND genre IS DISTINCT FROM 'Board & Card'
    AND (genre ILIKE '%card%' OR genre IS NULL OR genre = '')
    AND product_name ~* '${BOX_NAME_SQL}'
    AND product_name !~* '${CARD_NOISE}'
    AND product_name !~ '#[0-9]'
    AND product_name !~ '[A-Za-z0-9]{2,8}-[A-Za-z]{0,4}[0-9]{2,4}'
  )
)`;

const boxNamePattern = new RegExp(`\\b(${BOX_NAME})\\b`, 'i');
const cardNoisePattern = new RegExp(CARD_NOISE, 'i');
const cardNumberPattern = /#[0-9]/;
const setCodePattern = /[A-Za-z0-9]{2,8}-[A-Za-z]{0,4}[0-9]{2,4}/;

/** Same rule as {@link SEALED_BOX_SQL} / `is_sealed_box` backfill. */
export function catalogProductIsBox(input: {
  genre: string | null | undefined;
  productName: string;
  consoleName?: string | null;
}): boolean {
  const name = input.productName ?? '';
  const consoleName = input.consoleName ?? '';
  const genre = (input.genre ?? '').trim();
  if (genre === 'Sealed Product') {
    return boxNamePattern.test(name) || boxNamePattern.test(consoleName);
  }
  if (!boxNamePattern.test(name)) return false;
  if (genre === 'Board & Card') return false;
  if (genre !== '' && !/card/i.test(genre)) return false;
  if (cardNumberPattern.test(name) || setCodePattern.test(name)) return false;
  if (cardNoisePattern.test(name)) return false;
  return true;
}

function tokenFilter(tokens: string[], firstParam: number): { sql: string; params: string[] } {
  const params = tokens.map((token) => wordPattern(token));
  const sql = tokens
    .map((_, index) => {
      const n = firstParam + index;
      return `(product_name ~* $${n} OR console_name ~* $${n})`;
    })
    .join(' AND ');
  return { sql, params };
}

/**
 * SQL that recomputes `is_sealed_box` — keep in sync with {@link SEALED_BOX_SQL} /
 * `077_pricecharting_is_sealed_box.sql`.
 */
const BACKFILL_IS_SEALED_BOX_SQL = `
UPDATE pricecharting_products
SET is_sealed_box = ${SEALED_BOX_SQL}
WHERE is_sealed_box IS DISTINCT FROM (${SEALED_BOX_SQL})
`;

const ENSURE_SEALED_BOX_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_pricecharting_products_sealed_box
  ON pricecharting_products (id)
  INCLUDE (
    product_name,
    console_name,
    genre,
    release_date,
    upc,
    loose_price_cents,
    cover_image_url
  )
  WHERE is_sealed_box
`;

@Injectable()
export class PricechartingCatalogSearch implements OnModuleInit {
  private readonly logger = new Logger(PricechartingCatalogSearch.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Column default is false. If deploy added the column without the 077 backfill,
   * partner box search returns nothing — heal once at boot.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.ensureSealedBoxSearchReady();
    } catch (err) {
      this.logger.warn(
        `Sealed-box search ready check failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /** Backfill flags when none are set; ensure covering partial index exists. */
  async ensureSealedBoxSearchReady(): Promise<void> {
    const [hasAny, hasSealed] = await Promise.all([
      this.dataSource.query<{ ok: boolean }[]>(
        `SELECT EXISTS(SELECT 1 FROM pricecharting_products LIMIT 1) AS ok`,
      ),
      this.dataSource.query<{ ok: boolean }[]>(
        `SELECT EXISTS(SELECT 1 FROM pricecharting_products WHERE is_sealed_box LIMIT 1) AS ok`,
      ),
    ]);
    if (hasAny[0]?.ok && !hasSealed[0]?.ok) {
      this.logger.warn(
        'pricecharting_products.is_sealed_box is all false — running backfill',
      );
      await this.dataSource.query(BACKFILL_IS_SEALED_BOX_SQL);
      const after = await this.dataSource.query<{ sealed: string }[]>(
        `SELECT COUNT(*) FILTER (WHERE is_sealed_box)::text AS sealed
         FROM pricecharting_products`,
      );
      this.logger.log(`is_sealed_box backfill done: ${after[0]?.sealed ?? 0} sealed`);
    }
    const idx = await this.dataSource.query<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname = 'idx_pricecharting_products_sealed_box'`,
    );
    const def = idx[0]?.indexdef ?? '';
    if (!def || !/INCLUDE/i.test(def)) {
      if (def) {
        await this.dataSource.query(
          `DROP INDEX IF EXISTS idx_pricecharting_products_sealed_box`,
        );
      }
      await this.dataSource.query(ENSURE_SEALED_BOX_INDEX_SQL);
      this.logger.log('Ensured covering idx_pricecharting_products_sealed_box');
    }
  }

  /** Function 1 shape: exactly one of id, upc, q. Several q matches stay ambiguous. */
  async matchOne(input: {
    id?: string;
    upc?: string;
    q?: string;
  }): Promise<{ match: CatalogProductHit | null; ambiguous: boolean }> {
    const id = input.id?.trim() ?? '';
    const upc = input.upc?.trim() ?? '';
    const q = input.q?.trim() ?? '';
    const used = [id, upc, q].filter((value) => value.length > 0);
    if (used.length !== 1) {
      throw new BadRequestException('Provide exactly one of id, upc, or q');
    }
    if (id) {
      const rows = await this.dataSource.query<ProductRow[]>(
        `${PRODUCT_SELECT} WHERE id = $1 LIMIT 1`,
        [id],
      );
      return { match: rows[0] ? toHit(rows[0]) : null, ambiguous: false };
    }
    if (upc) {
      const rows = await this.dataSource.query<ProductRow[]>(
        `${PRODUCT_SELECT} WHERE upc = $1 ORDER BY id ASC LIMIT 2`,
        [upc],
      );
      if (rows.length > 1) return { match: null, ambiguous: true };
      return { match: rows[0] ? toHit(rows[0]) : null, ambiguous: false };
    }
    const tokens = catalogQueryTokens(q);
    if (tokens.length === 0) {
      throw new BadRequestException('q is required');
    }
    const filter = tokenFilter(tokens, 1);
    const rows = await this.dataSource.query<ProductRow[]>(
      `${PRODUCT_SELECT} WHERE ${filter.sql} ORDER BY id ASC LIMIT 2`,
      filter.params,
    );
    if (rows.length > 1) return { match: null, ambiguous: true };
    return { match: rows[0] ? toHit(rows[0]) : null, ambiguous: false };
  }

  /**
   * Function 2 shape: q only, at most 20 rows. Default order is product id.
   * `boxesOnly` is the partner mint search. Admin search leaves it false.
   */
  async search(
    q: string,
    order: 'id' | 'name' = 'id',
    boxesOnly = false,
  ): Promise<CatalogProductHit[]> {
    const tokens = catalogQueryTokens(q ?? '');
    if (tokens.length === 0) throw new BadRequestException('q is required');
    const filter = tokenFilter(tokens, 1);
    const orderSql = order === 'name' ? 'product_name ASC, id ASC' : 'id ASC';
    // Put is_sealed_box first so the covering partial index can Index Only Scan (~2k rows).
    const boxSql = boxesOnly ? 'is_sealed_box AND ' : '';
    const rows = await this.dataSource.query<ProductRow[]>(
      `${PRODUCT_SELECT} WHERE ${boxSql}${filter.sql} ORDER BY ${orderSql} LIMIT 20`,
      filter.params,
    );
    return rows.map(toHit);
  }

  /** Exact UPC string match. Leading zeros are kept. At most 20 rows. */
  async findByUpc(upc: string, boxesOnly = false): Promise<CatalogProductHit[]> {
    const value = upc?.trim() ?? '';
    if (!value) throw new BadRequestException('upc is required');
    const boxSql = boxesOnly ? 'is_sealed_box AND ' : '';
    const rows = await this.dataSource.query<ProductRow[]>(
      `${PRODUCT_SELECT} WHERE ${boxSql}upc = $1 ORDER BY id ASC LIMIT 20`,
      [value],
    );
    return rows.map(toHit);
  }

  /**
   * Admin box prep — paginated sealed products (covers before collection exists).
   */
  async listBoxes(input: {
    page?: number;
    pageSize?: number;
    q?: string;
    missingCoverOnly?: boolean;
  }): Promise<{
    items: CatalogProductHit[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const pageSize = Math.min(
      100,
      Math.max(1, Math.floor(input.pageSize ?? 40)),
    );
    const page = Math.max(1, Math.floor(input.page ?? 1));
    const offset = (page - 1) * pageSize;
    const tokens = catalogQueryTokens(input.q ?? '');
    const params: unknown[] = [];
    const where: string[] = ['is_sealed_box'];
    if (input.missingCoverOnly) {
      where.push(
        `(cover_image_url IS NULL OR BTRIM(cover_image_url) = '')`,
      );
    }
    if (tokens.length > 0) {
      const filter = tokenFilter(tokens, params.length + 1);
      where.push(`(${filter.sql})`);
      params.push(...filter.params);
    }
    const whereSql = where.join(' AND ');
    const countRows = await this.dataSource.query<{ n: string }[]>(
      `SELECT COUNT(*)::text AS n FROM pricecharting_products WHERE ${whereSql}`,
      params,
    );
    const total = Number(countRows[0]?.n ?? 0);
    const limitParam = params.length + 1;
    const offsetParam = params.length + 2;
    const rows = await this.dataSource.query<ProductRow[]>(
      `${PRODUCT_SELECT}
       WHERE ${whereSql}
       ORDER BY product_name ASC, id ASC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      [...params, pageSize, offset],
    );
    return {
      items: rows.map(toHit),
      total,
      page,
      pageSize,
    };
  }

  /**
   * Admin representative image for collection detail.
   * A partner's own photo stays on the minted token, not this column.
   */
  async setCover(
    covers: CatalogCoverS3Service,
    productId: string,
    file: Express.Multer.File,
  ): Promise<{ id: string; productName: string; coverImageUrl: string }> {
    const id = productId.trim();
    if (!id) throw new BadRequestException('Product id is required');
    const rows = await this.dataSource.query<{ id: string; product_name: string }[]>(
      `SELECT id, product_name FROM pricecharting_products WHERE id = $1 LIMIT 1`,
      [id],
    );
    const product = rows[0];
    if (!product) throw new NotFoundException('Catalog product not found');
    covers.validateUploadFile(file);
    const put = await covers.putBytesAtKey(
      catalogProductCoverObjectKey(covers.getObjectKeyPrefix(), id),
      file.buffer,
      file.mimetype,
    );
    const coverImageUrl = `${put.publicUrl}?v=${Date.now()}`;
    await this.dataSource.query(
      `UPDATE pricecharting_products SET cover_image_url = $2 WHERE id = $1`,
      [id, coverImageUrl],
    );
    await this.dataSource.query(
      `UPDATE marketplace_collections
       SET cover_image_url = $2
       WHERE components->>'assetKind' = 'sealed_box'
         AND components->>'pricechartingProductId' = $1`,
      [id, coverImageUrl],
    );
    return { id, productName: product.product_name, coverImageUrl };
  }
}
