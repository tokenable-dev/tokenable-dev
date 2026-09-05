/** Max certs per bulk mint job (API + Excel). */
export const BULK_MINT_MAX_ITEMS = 500;

/** On-chain mintBatch size — matches TokenableRWA.MAX_BATCH_SIZE. */
export const BULK_MINT_ON_CHAIN_CHUNK = 50;

const CERT_HEADER_RE =
  /^(cert|certnumber|cert_number|psa\s*cert|psa\s*cert\s*number|cert\s*#)$/i;
const PRICE_HEADER_RE =
  /^(price|listprice|list_price|list\s*price|ask|usdc|sale\s*price)$/i;

export type BulkMintCertPriceRow = {
  certNumber: string;
  /** Human USDC amount, e.g. "1250" or "1250.50" */
  priceUsdc: string;
};

/**
 * Normalize a PSA cert cell to digits (7–10). Returns null if invalid.
 */
export function normalizeBulkMintCert(raw: string): string | null {
  const digits = String(raw ?? '')
    .replace(/\D/g, '')
    .trim();
  if (digits.length < 7 || digits.length > 10) return null;
  return digits;
}

/**
 * Normalize list price — must be a positive finite number (USDC human units).
 */
export function normalizeBulkMintPrice(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim().replace(/[$,]/g, '');
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  // Keep a compact decimal string (avoid scientific notation for typical prices)
  if (n > 1_000_000_000) return null;
  const fixed = s.includes('.') ? String(n) : String(Math.round(n * 1e6) / 1e6);
  // Prefer original if it's a clean decimal
  if (/^\d+(\.\d{1,6})?$/.test(s)) return s;
  return fixed;
}

function pushUniqueRow(
  out: BulkMintCertPriceRow[],
  seen: Set<string>,
  cert: string | null,
  price: string | null,
): void {
  if (!cert || !price || seen.has(cert)) return;
  seen.add(cert);
  out.push({ certNumber: cert, priceUsdc: price });
}

/**
 * Parse CSV / TSV with certNumber + price columns (header preferred).
 * Without header: first column = cert, second = price.
 */
export function parseCertPriceRowsFromCsvText(text: string): BulkMintCertPriceRow[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const firstCells = splitCsvLine(lines[0]!);
  let certIdx = 0;
  let priceIdx = 1;
  let startRow = 0;
  const certHit = firstCells.findIndex((c) => CERT_HEADER_RE.test(c.trim()));
  const priceHit = firstCells.findIndex((c) => PRICE_HEADER_RE.test(c.trim()));
  if (certHit >= 0 || priceHit >= 0) {
    if (certHit >= 0) certIdx = certHit;
    if (priceHit >= 0) priceIdx = priceHit;
    startRow = 1;
  }

  const out: BulkMintCertPriceRow[] = [];
  const seen = new Set<string>();
  for (let i = startRow; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]!);
    const cert = normalizeBulkMintCert(cells[certIdx] ?? cells[0] ?? '');
    const price = normalizeBulkMintPrice(cells[priceIdx] ?? cells[1] ?? '');
    pushUniqueRow(out, seen, cert, price);
  }
  return out;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if ((ch === ',' || ch === '\t' || ch === ';') && !inQuotes) {
      cells.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

/**
 * Parse .xlsx buffer — first sheet; cert + price by header or col 0/1.
 */
export function parseCertPriceRowsFromXlsxBuffer(buf: Buffer): BulkMintCertPriceRow[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx') as typeof import('xlsx');
  const wb = XLSX.read(buf, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });
  if (!rows.length) {
    const aoa = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
    });
    const out: BulkMintCertPriceRow[] = [];
    const seen = new Set<string>();
    for (const row of aoa) {
      if (!Array.isArray(row) || row.length < 2) continue;
      const cert = normalizeBulkMintCert(String(row[0] ?? ''));
      const price = normalizeBulkMintPrice(row[1]);
      pushUniqueRow(out, seen, cert, price);
    }
    return out;
  }

  const keys = Object.keys(rows[0]!);
  const certKey =
    keys.find((k) => CERT_HEADER_RE.test(k.trim())) ?? keys[0] ?? null;
  const priceKey =
    keys.find((k) => PRICE_HEADER_RE.test(k.trim())) ??
    keys.find((k) => k !== certKey) ??
    null;
  if (!certKey || !priceKey) return [];

  const out: BulkMintCertPriceRow[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const cert = normalizeBulkMintCert(String(row[certKey] ?? ''));
    const price = normalizeBulkMintPrice(row[priceKey]);
    pushUniqueRow(out, seen, cert, price);
  }
  return out;
}

export function parseCertPriceRowsFromUpload(params: {
  filename?: string;
  buffer?: Buffer;
  text?: string;
  items?: Array<{ certNumber: string; price: string }>;
}): BulkMintCertPriceRow[] {
  if (params.items?.length) {
    const out: BulkMintCertPriceRow[] = [];
    const seen = new Set<string>();
    for (const it of params.items) {
      const cert = normalizeBulkMintCert(it.certNumber);
      const price = normalizeBulkMintPrice(it.price);
      pushUniqueRow(out, seen, cert, price);
    }
    return out;
  }

  const name = (params.filename ?? '').toLowerCase();
  if (params.buffer?.length && (name.endsWith('.xlsx') || name.endsWith('.xls'))) {
    return parseCertPriceRowsFromXlsxBuffer(params.buffer);
  }
  if (params.buffer?.length && (name.endsWith('.csv') || name.endsWith('.txt'))) {
    return parseCertPriceRowsFromCsvText(params.buffer.toString('utf8'));
  }
  if (params.text?.trim()) {
    return parseCertPriceRowsFromCsvText(params.text);
  }
  if (params.buffer?.length) {
    const asText = params.buffer.toString('utf8');
    if (!asText.includes('\0')) {
      return parseCertPriceRowsFromCsvText(asText);
    }
    return parseCertPriceRowsFromXlsxBuffer(params.buffer);
  }
  return [];
}
