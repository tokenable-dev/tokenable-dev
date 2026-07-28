import {
  DATA_INVENTORY_DOMAINS,
  DATA_STORE_CATALOG,
} from './data-inventory.catalog';

describe('data-inventory.catalog', () => {
  it('defines a unique store id per table', () => {
    const ids = DATA_STORE_CATALOG.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('maps every store to a known domain', () => {
    const domainIds = new Set(DATA_INVENTORY_DOMAINS.map((d) => d.id));
    for (const store of DATA_STORE_CATALOG) {
      expect(domainIds.has(store.domain)).toBe(true);
    }
  });

  it('covers core accumulated stores', () => {
    const tables = new Set(DATA_STORE_CATALOG.map((s) => s.table));
    expect(tables.has('collection_market_snapshots')).toBe(true);
    expect(tables.has('card_top100_daily_snapshots')).toBe(true);
    expect(tables.has('portfolio_daily_snapshots')).toBe(true);
    expect(tables.has('cardhedger_price_delta_import_runs')).toBe(true);
    expect(tables.has('vault_submissions')).toBe(true);
    expect(tables.has('vault_submission_items')).toBe(true);
  });
});
