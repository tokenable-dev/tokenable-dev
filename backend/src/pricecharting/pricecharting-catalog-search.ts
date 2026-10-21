import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export type CatalogProductHit = {
  id: string;
  productName: string;
  consoleName: string;
  genre: string | null;
  releaseDate: string | null;
  upc: string | null;
  loosePriceCents: number | null;
};

type ProductRow = {
  id: string;
  product_name: string;
  console_name: string;
  genre: string | null;
  release_date: string | null;
  upc: string | null;
  loose_price_cents: number | null;
};

const PRODUCT_SELECT = `SELECT id, product_name, console_name, genre,
            to_char(release_date, 'YYYY-MM-DD') AS release_date,
            upc, loose_price_cents
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
  };
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

@Injectable()
export class PricechartingCatalogSearch {
  constructor(private readonly dataSource: DataSource) {}

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

  /** Function 2 shape: q only, at most 20 rows. Default order is product id. */
  async search(q: string, order: 'id' | 'name' = 'id'): Promise<CatalogProductHit[]> {
    const tokens = catalogQueryTokens(q ?? '');
    if (tokens.length === 0) throw new BadRequestException('q is required');
    const filter = tokenFilter(tokens, 1);
    const orderSql = order === 'name' ? 'product_name ASC, id ASC' : 'id ASC';
    const rows = await this.dataSource.query<ProductRow[]>(
      `${PRODUCT_SELECT} WHERE ${filter.sql} ORDER BY ${orderSql} LIMIT 20`,
      filter.params,
    );
    return rows.map(toHit);
  }

  /** Exact UPC string match. Leading zeros are kept. At most 20 rows. */
  async findByUpc(upc: string): Promise<CatalogProductHit[]> {
    const value = upc?.trim() ?? '';
    if (!value) throw new BadRequestException('upc is required');
    const rows = await this.dataSource.query<ProductRow[]>(
      `${PRODUCT_SELECT} WHERE upc = $1 ORDER BY id ASC LIMIT 20`,
      [value],
    );
    return rows.map(toHit);
  }
}
