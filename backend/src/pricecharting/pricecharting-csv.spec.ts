import { dominantSetSlug } from './pricecharting-import.service';
import {
  mergeManualHistoryPrices,
  manualHistoryPricePatch,
  parsePricechartingCsv,
  usdToCents,
} from './pricecharting-csv';

const SAMPLE = [
  'id\tconsole-name\tproduct-name\tloose-price\tmanual-only-price\tgenre\trelease-date',
  '7569343\tPokemon 1998 KFC\tCharizard #6\t$139.98\t$2750.00\tPokemon Card\t1998-06-01',
  '7569401\tPokemon 1998 KFC\tDragonite #149\t$29.99\t$1300.00\tPokemon Card\t1998-06-01',
  '\tbad\trow\t\t\t\t',
].join('\n');

describe('sports set archive name', () => {
  it('uses the set inside the file, not the uploaded filename', () => {
    expect(
      dominantSetSlug([
        { consoleName: 'Basketball Cards 1986 Fleer' } as never,
        { consoleName: 'Basketball Cards 1986 Fleer' } as never,
        { consoleName: 'Other' } as never,
      ]),
    ).toBe('Basketball-Cards-1986-Fleer');
  });
});

describe('manual price history patch', () => {
  it('keeps omitted grades and writes only the dollars that were entered', () => {
    const patch = manualHistoryPricePatch({
      loose_price_cents: '261.28',
      manual_only_price_cents: '',
      bgs_10_price_cents: '$1,067.00',
    });
    expect(patch).toEqual({
      loose_price_cents: 26128,
      bgs_10_price_cents: 106700,
    });
    expect(
      mergeManualHistoryPrices(
        { loose_price_cents: 100, manual_only_price_cents: 275000 },
        patch,
      ).loose_price_cents,
    ).toBe(26128);
    expect(
      mergeManualHistoryPrices(
        { loose_price_cents: 100, manual_only_price_cents: 275000 },
        patch,
      ).manual_only_price_cents,
    ).toBe(275000);
  });

  it('rejects an empty form, a negative price, and an unknown column', () => {
    expect(() => manualHistoryPricePatch({})).toThrow(/at least one price/);
    expect(() => manualHistoryPricePatch({ loose_price_cents: '-1' })).toThrow(
      /cannot be negative/,
    );
    expect(() => manualHistoryPricePatch({ not_a_column: '1' })).toThrow(
      /Unknown price column/,
    );
  });
});

describe('pricecharting csv', () => {
  it('parses dollar strings into cents', () => {
    expect(usdToCents('$139.98')).toBe(13998);
    expect(usdToCents('$2,750.00')).toBe(275000);
    expect(usdToCents('')).toBeNull();
    expect(usdToCents('$33477255.00')).toBeNull();
  });

  it('parses a tab-separated price list and skips blank ids', () => {
    const parsed = parsePricechartingCsv(SAMPLE);
    expect(parsed.skipped).toBe(1);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toMatchObject({
      id: '7569343',
      consoleName: 'Pokemon 1998 KFC',
      productName: 'Charizard #6',
      genre: 'Pokemon Card',
      releaseDate: '1998-06-01',
    });
    expect(parsed.rows[0]!.prices.loose_price_cents).toBe(13998);
    expect(parsed.rows[0]!.prices.manual_only_price_cents).toBe(275000);
    expect(parsed.genres['Pokemon Card']).toBe(2);
  });

  it('parses quoted comma CSV', () => {
    const csv =
      'id,product-name,console-name,loose-price\n' +
      '10,"Jordan, Michael #57",Basketball Cards 1986 Fleer,"$4,138.00"\n';
    const parsed = parsePricechartingCsv(csv);
    expect(parsed.rows[0]?.productName).toBe('Jordan, Michael #57');
    expect(parsed.rows[0]?.prices.loose_price_cents).toBe(413800);
  });
});