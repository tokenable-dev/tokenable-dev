import type { DataSource } from 'typeorm';
import {
  PricechartingCatalogSearch,
  catalogProductIsBox,
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
  if (
    sql.includes('is_sealed_box') &&
    !catalogProductIsBox({
      genre: row.genre,
      productName: row.product_name,
      consoleName: row.console_name,
    })
  ) {
    return false;
  }
  if (sql.includes('WHERE id = $1')) return row.id === params[0];
  if (sql.includes('WHERE upc = $1')) return row.upc === params[0];
  if (!sql.includes('~*') && !sql.includes('is_sealed_box')) return false;
  const tokenParams = params.filter((param) => String(param).includes('\\m'));
  if (tokenParams.length === 0) return true;
  return tokenParams.every((param) => {
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

  it('keeps sealed boxes that do not say box, and drops cards', () => {
    expect(catalogProductIsBox({
      genre: 'Sealed Product',
      productName: 'Booster Bundle',
    })).toBe(true);
    expect(catalogProductIsBox({
      genre: 'Sealed Product',
      productName: 'Booster Box',
    })).toBe(true);
    expect(catalogProductIsBox({
      genre: 'Sealed Product',
      productName: 'Pokemon Japanese Scarlet & Violet 151',
      consoleName: 'Booster Box',
    })).toBe(true);
    expect(catalogProductIsBox({
      genre: 'Sealed Product',
      productName: 'Booster Pack',
      consoleName: 'Pokemon Base',
    })).toBe(false);
    expect(catalogProductIsBox({
      genre: 'Pokemon Card',
      productName: 'Mew V Box',
    })).toBe(true);
    expect(catalogProductIsBox({
      genre: 'Pokemon Card',
      productName: 'Blastoise GX Premium Collection',
    })).toBe(true);
    expect(catalogProductIsBox({
      genre: '',
      productName: 'Blaster Box',
    })).toBe(true);
    expect(catalogProductIsBox({
      genre: 'Sealed Product',
      productName: 'Booster Pack',
    })).toBe(false);
    expect(catalogProductIsBox({
      genre: 'Pokemon Card',
      productName: 'Secret Box #92',
    })).toBe(false);
    expect(catalogProductIsBox({
      genre: 'Magic Card',
      productName: "Teferi's Puzzle Box",
    })).toBe(false);
    expect(catalogProductIsBox({
      genre: 'Action & Adventure',
      productName: 'Zelda Musou [Premium Box]',
    })).toBe(false);
  });

  it('partner box search hides raw cards', async () => {
    const card: Row = {
      ...OTHER,
      id: '200',
      product_name: 'Charizard',
      console_name: 'Base',
      genre: 'Pokemon Card',
    };
    const bundle: Row = {
      ...BOX,
      id: '201',
      product_name: 'Booster Bundle',
      console_name: 'Pokemon Base',
      genre: 'Sealed Product',
    };
    const { dataSource } = database([card, bundle]);
    const search = new PricechartingCatalogSearch(dataSource);
    const hits = await search.search('Base', 'id', true);
    expect(hits.map((hit) => hit.id)).toEqual(['201']);
  });

  it('partner search finds booster box when set name is on console_name', async () => {
    const { dataSource, query } = database([
      {
        ...BOX,
        id: '5490667',
        product_name: 'Booster Box',
        console_name: 'Pokemon Japanese Scarlet & Violet 151',
        genre: 'Sealed Product',
      },
    ]);
    const search = new PricechartingCatalogSearch(dataSource);
    const hits = await search.search('booster box 151', 'id', true);
    expect(hits.map((hit) => hit.id)).toEqual(['5490667']);
    const sql = String(query.mock.calls[0]?.[0] ?? '');
    expect(sql).toMatch(/WHERE is_sealed_box AND/);
  });
});
