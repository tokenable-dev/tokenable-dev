/** CSV/TSV from PriceCharting or SportsCardsPro price lists. */

export type PricechartingCsvRow = {
  id: string;
  consoleName: string;
  productName: string;
  prices: Record<string, number | null>;
  upc: string | null;
  salesVolume: number | null;
  genre: string | null;
  tcgId: string | null;
  asin: string | null;
  epid: string | null;
  releaseDate: string | null;
};

/** CSV header → cents column. PSA 10 is `manual-only-price`. */
export const PRICE_HEADER_TO_COLUMN: Record<string, string> = {
  'loose-price': 'loose_price_cents',
  'cib-price': 'cib_price_cents',
  'new-price': 'new_price_cents',
  'graded-price': 'graded_price_cents',
  'box-only-price': 'box_only_price_cents',
  'manual-only-price': 'manual_only_price_cents',
  'bgs-10-price': 'bgs_10_price_cents',
  'condition-9-price': 'condition_9_price_cents',
  'condition-10-price': 'condition_10_price_cents',
  'condition-13-price': 'condition_13_price_cents',
  'condition-14-price': 'condition_14_price_cents',
  'condition-15-price': 'condition_15_price_cents',
  'condition-16-price': 'condition_16_price_cents',
  'condition-17-price': 'condition_17_price_cents',
  'condition-18-price': 'condition_18_price_cents',
  'condition-19-price': 'condition_19_price_cents',
  'condition-20-price': 'condition_20_price_cents',
  'condition-21-price': 'condition_21_price_cents',
  'condition-22-price': 'condition_22_price_cents',
  'gamestop-price': 'gamestop_price_cents',
  'gamestop-trade-price': 'gamestop_trade_price_cents',
  'retail-loose-buy': 'retail_loose_buy_cents',
  'retail-loose-sell': 'retail_loose_sell_cents',
  'retail-cib-buy': 'retail_cib_buy_cents',
  'retail-cib-sell': 'retail_cib_sell_cents',
  'retail-new-buy': 'retail_new_buy_cents',
  'retail-new-sell': 'retail_new_sell_cents',
};

export const PRICE_COLUMNS = Object.values(PRICE_HEADER_TO_COLUMN);

/** Postgres integer. About $21.4M in cents; one bad upstream cell can exceed it. */
const PG_INT_MAX = 2_147_483_647;

/** `$139.98` / `1,234.50` / empty → integer cents. Out-of-range prices become null. */
export function usdToCents(raw: string | undefined): number | null {
  const s = (raw ?? '').trim();
  if (!s || s === '-' || s === '—') return null;
  const n = Number(s.replace(/[$,\s]/g, ''));
  if (!Number.isFinite(n)) return null;
  const cents = Math.round(n * 100);
  if (cents > PG_INT_MAX || cents < -PG_INT_MAX - 1) return null;
  return cents;
}

function detectDelimiter(headerLine: string): '\t' | ',' {
  const tabs = headerLine.split('\t').length;
  let commas = 0;
  let inQuotes = false;
  for (const ch of headerLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ',' && !inQuotes) commas += 1;
  }
  return tabs > commas + 1 ? '\t' : ',';
}

/** RFC-style split. Handles quotes and either comma or tab. */
export function splitDelimitedLine(line: string, delimiter: '\t' | ','): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === delimiter) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function blankToNull(raw: string | undefined): string | null {
  const s = (raw ?? '').trim();
  return s ? s : null;
}

function intOrNull(raw: string | undefined): number | null {
  const s = (raw ?? '').trim().replace(/,/g, '');
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const value = Math.trunc(n);
  if (value > PG_INT_MAX || value < -PG_INT_MAX - 1) return null;
  return value;
}

function dateOrNull(raw: string | undefined): string | null {
  const s = (raw ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

export type ParsedPricechartingCsv = {
  rows: PricechartingCsvRow[];
  skipped: number;
  genres: Record<string, number>;
};

/**
 * Parse a PriceCharting / SportsCardsPro price-list file.
 * Duplicate ids in one file: last row wins.
 */
export function parsePricechartingCsv(text: string): ParsedPricechartingCsv {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n').filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return { rows: [], skipped: 0, genres: {} };
  }

  const delimiter = detectDelimiter(lines[0]!);
  const headers = splitDelimitedLine(lines[0]!, delimiter).map((h) =>
    h.trim().toLowerCase(),
  );
  const index = new Map<string, number>();
  headers.forEach((h, i) => {
    if (h) index.set(h, i);
  });
  if (!index.has('id') || !index.has('product-name')) {
    throw new Error('CSV header must include id and product-name');
  }

  const cell = (cols: string[], header: string): string => {
    const i = index.get(header);
    return i == null ? '' : (cols[i] ?? '');
  };

  const byId = new Map<string, PricechartingCsvRow>();
  let skipped = 0;

  for (let li = 1; li < lines.length; li += 1) {
    const cols = splitDelimitedLine(lines[li]!, delimiter);
    const id = cell(cols, 'id').trim();
    if (!/^\d+$/.test(id)) {
      skipped += 1;
      continue;
    }
    const prices: Record<string, number | null> = {};
    for (const [header, column] of Object.entries(PRICE_HEADER_TO_COLUMN)) {
      prices[column] = usdToCents(cell(cols, header));
    }
    byId.set(id, {
      id,
      consoleName: cell(cols, 'console-name').trim(),
      productName: cell(cols, 'product-name').trim(),
      prices,
      upc: blankToNull(cell(cols, 'upc')),
      salesVolume: intOrNull(cell(cols, 'sales-volume')),
      genre: blankToNull(cell(cols, 'genre')),
      tcgId: blankToNull(cell(cols, 'tcg-id')),
      asin: blankToNull(cell(cols, 'asin')),
      epid: blankToNull(cell(cols, 'epid')),
      releaseDate: dateOrNull(cell(cols, 'release-date')),
    });
  }

  const rows = [...byId.values()];
  const genres: Record<string, number> = {};
  for (const row of rows) {
    const key = row.genre ?? '(blank)';
    genres[key] = (genres[key] ?? 0) + 1;
  }
  return { rows, skipped, genres };
}
