import type { DataSource } from 'typeorm';
import { PRICE_COLUMNS } from './pricecharting-csv';
import { PricechartingImportService } from './pricecharting-import.service';
import type { PricechartingArchive } from './pricecharting-archive';

/**
 * In-memory stand-in for Postgres. The shared integration harness uses the
 * app database, so this spec applies the history and product upserts that
 * importFile actually sends, including ON CONFLICT.
 */
type HistoryRow = {
  productId: string;
  observedOn: string;
  prices: Record<string, number | null>;
};

type ProductRow = {
  id: string;
  prices: Record<string, number | null>;
};

function csv(lines: string[]): Buffer {
  const text = [
    'id\tconsole-name\tproduct-name\tloose-price\tmanual-only-price',
    ...lines,
  ].join('\n');
  return Buffer.from(text);
}

function pricesFromArrays(
  arrays: Array<Array<number | null>>,
  index: number,
): Record<string, number | null> {
  const prices: Record<string, number | null> = {};
  PRICE_COLUMNS.forEach((column, columnIndex) => {
    prices[column] = arrays[columnIndex]?.[index] ?? null;
  });
  return prices;
}

function memoryDatabase() {
  const history: HistoryRow[] = [];
  const products = new Map<string, ProductRow>();
  const archive = { archiveRawCsv: jest.fn() };

  async function query(sql: string, params: unknown[] = []): Promise<unknown> {
    if (/delete\s+from\s+pricecharting_price_history/i.test(sql)) {
      throw new Error('history import must not delete earlier dates');
    }
    if (sql.includes('INSERT INTO pricecharting_price_history')) {
      if (!sql.includes('ON CONFLICT (product_id, observed_on)')) {
        throw new Error('history upsert must key on product_id and observed_on');
      }
      const observedOn = String(params[0]);
      const ids = params[1] as string[];
      const arrays = params.slice(2) as Array<Array<number | null>>;
      ids.forEach((productId, index) => {
        const prices = pricesFromArrays(arrays, index);
        const existing = history.find(
          (row) => row.productId === productId && row.observedOn === observedOn,
        );
        if (existing) {
          existing.prices = prices;
          return;
        }
        history.push({ productId, observedOn, prices });
      });
      return [];
    }
    if (sql.includes('INSERT INTO pricecharting_products')) {
      if (!sql.includes('ON CONFLICT (id)')) {
        throw new Error('product upsert must key on id');
      }
      const ids = params[1] as string[];
      const arrays = params.slice(4, 4 + PRICE_COLUMNS.length) as Array<
        Array<number | null>
      >;
      ids.forEach((id, index) => {
        products.set(id, { id, prices: pricesFromArrays(arrays, index) });
      });
      return [];
    }
    if (sql.includes('INSERT INTO pricecharting_import_runs')) {
      return [{ id: 1 }];
    }
    if (sql.includes('COUNT(*)')) {
      return [{ n: products.size }];
    }
    throw new Error(`unexpected SQL: ${sql.slice(0, 80)}`);
  }

  const dataSource = {
    createQueryRunner: () => ({
      connect: async () => undefined,
      startTransaction: async () => undefined,
      commitTransaction: async () => undefined,
      rollbackTransaction: async () => undefined,
      release: async () => undefined,
      query,
    }),
    query,
  } as unknown as DataSource;

  const service = new PricechartingImportService(
    dataSource,
    archive as unknown as PricechartingArchive,
    { emit: () => true } as never,
  );
  return { service, history, products, archive };
}

describe('pricecharting price history dates', () => {
  it('keeps each Seoul date and updates the same day in place', async () => {
    const { service, history, products, archive } = memoryDatabase();
    const file = (body: Buffer) => ({
      buffer: body,
      originalname: 'pokemon-cards.csv',
      size: body.length,
    });

    await service.importFile(
      file(
        csv([
          '7569343\tPokemon 1998 KFC\tCharizard #6\t$50.00\t$10.00',
          '7569401\tPokemon 1998 KFC\tDragonite #149\t$29.99\t$5.00',
        ]),
      ),
      { observedOn: '2026-10-20' },
    );
    await service.importFile(
      file(csv(['7569343\tPokemon 1998 KFC\tCharizard #6\t$60.00\t$12.00'])),
      { observedOn: '2026-10-21' },
    );
    await service.importFile(
      file(csv(['7569343\tPokemon 1998 KFC\tCharizard #6\t$55.00\t$11.00'])),
      { observedOn: '2026-10-21' },
    );

    const charizard = history.filter((row) => row.productId === '7569343');
    const on20 = charizard.filter((row) => row.observedOn === '2026-10-20');
    const on21 = charizard.filter((row) => row.observedOn === '2026-10-21');
    expect(on20).toHaveLength(1);
    expect(on21).toHaveLength(1);
    expect(on20[0]?.prices.loose_price_cents).toBe(5000);
    expect(on20[0]?.prices.manual_only_price_cents).toBe(1000);
    expect(on21[0]?.prices.loose_price_cents).toBe(5500);
    expect(on21[0]?.prices.manual_only_price_cents).toBe(1100);

    const dragonite = history.filter((row) => row.productId === '7569401');
    expect(dragonite).toEqual([
      expect.objectContaining({
        observedOn: '2026-10-20',
        prices: expect.objectContaining({
          loose_price_cents: 2999,
          manual_only_price_cents: 500,
        }),
      }),
    ]);

    expect(products.get('7569343')?.prices.loose_price_cents).toBe(5500);
    expect(products.get('7569343')?.prices.manual_only_price_cents).toBe(1100);
    expect(products.get('7569401')?.prices.loose_price_cents).toBe(2999);
    expect(archive.archiveRawCsv).not.toHaveBeenCalled();
  });
});
