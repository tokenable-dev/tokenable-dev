import type { DataSource } from 'typeorm';
import {
  PricechartingCatalogSearch,
  wordPattern,
} from './pricecharting-catalog-search';

type Row = {
  id: string;
  product_name: string;
  console_name: string;
  genre: string | null;
  release_date: string | null;
  upc: string | null;
  loose_price_cents: number | null;
};

const BOX: Row = {
  id: '5490667',
  product_name: 'Pokemon Japanese Scarlet & Violet 151',
  console_name: 'Booster Box',
  genre: 'Sealed Product',
  release_date: '2023-06-16',
  upc: '333',
  loose_price_cents: 26128,
};

const OTHER: Row = {
  id: '100',
  product_name: 'Pokemon Japanese Scarlet & Violet 151',
  console_name: 'Booster Pack',
  genre: 'Sealed Product',
  release_date: '2023-06-16',
  upc: '045496830434',
  loose_price_cents: 500,
};

function matches(row: Row, sql: string, params: unknown[]): boolean {
  if (sql.includes('WHERE id = $1')) return row.id === params[0];
  if (sql.includes('WHERE upc = $1')) return row.upc === params[0];
  if (!sql.includes('~*')) return false;
  return params.every((param) => {
    const token = String(param).replace(/^\\m/, '').replace(/\\M$/, '');
    const re = new RegExp(`\\b${token}\\b`, 'i');
    return re.test(`${row.product_name} ${row.console_name}`);
  });
}

function database(rows: Row[]) {
  const query = jest.fn(async (sql: string, params: unknown[] = []) => {
    const limit = /LIMIT (\d+)/.exec(sql)?.[1];
    const found = rows.filter((row) => matches(row, sql, params));
    found.sort((a, b) => a.id.localeCompare(b.id));
    return found.slice(0, limit ? Number(limit) : found.length);
  });
  return { query, dataSource: { query } as unknown as DataSource };
}

describe('pricecharting local catalog search', () => {
  it('keeps loose price on the product id and does not call PriceCharting', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const { dataSource } = database([BOX, OTHER]);
    const search = new PricechartingCatalogSearch(dataSource);
    const result = await search.matchOne({ id: '5490667' });
    expect(result).toEqual({
      ambiguous: false,
      match: expect.objectContaining({
        id: '5490667',
        loosePriceCents: 26128,
        releaseDate: '2023-06-16',
      }),
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('matches UPC as text and keeps leading zeros', async () => {
    const { dataSource } = database([BOX, OTHER]);
    const search = new PricechartingCatalogSearch(dataSource);
    expect(await search.findByUpc('045496830434')).toEqual([
      expect.objectContaining({ id: '100', upc: '045496830434' }),
    ]);
    expect(await search.findByUpc('45496830434')).toEqual([]);
    expect(await search.matchOne({ upc: '333' })).toEqual({
      ambiguous: false,
      match: expect.objectContaining({ id: '5490667' }),
    });
  });

  it('returns one q match and refuses to pick among several', async () => {
    const { dataSource } = database([BOX, OTHER]);
    const search = new PricechartingCatalogSearch(dataSource);
    const one = await search.matchOne({ q: 'Booster Box' });
    expect(one.match?.id).toBe('5490667');
    expect(one.ambiguous).toBe(false);
    const many = await search.matchOne({ q: 'Scarlet' });
    expect(many).toEqual({ match: null, ambiguous: true });
  });

  it('returns at most 20 text matches ordered by id', async () => {
    const rows = Array.from({ length: 25 }, (_, index) => ({
      ...OTHER,
      id: String(index + 1).padStart(3, '0'),
      product_name: 'Sample Card',
      console_name: 'Base',
    }));
    const { dataSource } = database(rows);
    const search = new PricechartingCatalogSearch(dataSource);
    const found = await search.search('Sample');
    expect(found).toHaveLength(20);
    expect(found[0]?.id).toBe('001');
    expect(found[19]?.id).toBe('020');
  });

  it('treats box and booster as different words', () => {
    expect(wordPattern('box')).toBe('\\mbox\\M');
    expect(wordPattern('100%')).toBe('\\m100%\\M');
  });
});
