import { ECB_QUOTE_CURRENCIES } from './supported-currencies';

export const FRANKFURTER_ECB_SOURCE = 'frankfurter-ecb';

const DEFAULT_ECB_URL =
  'https://api.frankfurter.dev/v2/providers/ecb/rates?base=USD&quotes=' +
  ECB_QUOTE_CURRENCIES.join(',');

export type EcbRateRow = {
  date: string;
  base: string;
  quote: string;
  rate: number;
};

export type ParsedEcbRates = {
  observationDate: string;
  /** Foreign units per 1 USD. USD is always 1 and is not in this map. */
  quotePerUsd: Record<string, number>;
};

/**
 * ECB does not publish VND. Bank Negara Malaysia does, and Frankfurter
 * returns it as dong per 1 USD. A failed VND fetch must not drop the ECB set.
 */
export const FRANKFURTER_VND_URL =
  'https://api.frankfurter.dev/v2/providers/bnm/rates?base=USD&quotes=VND';

export function frankfurterEcbRatesUrl(): string {
  const override = process.env.FX_PROVIDER_URL?.trim();
  return override || DEFAULT_ECB_URL;
}

export type StoredFxRateRow = {
  currency: string;
  quotePerUsd: string | number;
  observationDate: string | Date;
  fetchedAt: Date;
};

/**
 * One published snapshot. Every quote shares one observation date, and every
 * allowlisted currency is present. A newer partial set is skipped in favor of
 * the newest complete set. Null means nothing publishable — keep the last good
 * snapshot.
 */
export function publishableFxSnapshot(rows: StoredFxRateRow[]): {
  observationDate: string;
  fetchedAt: Date;
  quotePerUsd: Record<string, number>;
} | null {
  const byDate = new Map<string, { rates: Record<string, number>; fetchedAt: Date }>();
  for (const row of rows) {
    const n = typeof row.quotePerUsd === 'number' ? row.quotePerUsd : Number(row.quotePerUsd);
    if (!Number.isFinite(n) || n <= 0) continue;
    if (!(ECB_QUOTE_CURRENCIES as readonly string[]).includes(row.currency)) continue;
    const observed = dateOnly(row.observationDate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(observed)) continue;
    const bucket = byDate.get(observed) ?? { rates: {}, fetchedAt: row.fetchedAt };
    bucket.rates[row.currency] = n;
    if (row.fetchedAt > bucket.fetchedAt) bucket.fetchedAt = row.fetchedAt;
    byDate.set(observed, bucket);
  }
  const dates = [...byDate.keys()].sort();
  for (let i = dates.length - 1; i >= 0; i--) {
    const date = dates[i]!;
    const bucket = byDate.get(date)!;
    if (ECB_QUOTE_CURRENCIES.every((code) => bucket.rates[code] != null)) {
      return { observationDate: date, fetchedAt: bucket.fetchedAt, quotePerUsd: bucket.rates };
    }
  }
  return null;
}

/** One positive USD quote. An empty provider payload means that quote is absent. */
export function parseUsdQuote(
  body: unknown,
  quote: string,
): { date: string; rate: number } | null {
  if (!Array.isArray(body) || body.length === 0) return null;
  for (const row of body) {
    if (!row || typeof row !== 'object') return null;
    const rec = row as Partial<EcbRateRow>;
    if (rec.base !== 'USD' || rec.quote !== quote) continue;
    if (typeof rec.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(rec.date)) return null;
    if (typeof rec.rate !== 'number' || !Number.isFinite(rec.rate) || rec.rate <= 0) return null;
    return { date: rec.date, rate: rec.rate };
  }
  return null;
}

export function supplementaryVndRate(rows: StoredFxRateRow[]): number | null {
  const row = rows.find((item) => item.currency === 'VND');
  if (!row) return null;
  const n = typeof row.quotePerUsd === 'number' ? row.quotePerUsd : Number(row.quotePerUsd);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function dateOnly(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export function isObservationStale(
  observationDate: string | null,
  now: Date = new Date(),
): boolean {
  if (!observationDate || !/^\d{4}-\d{2}-\d{2}$/.test(observationDate)) {
    return true;
  }
  const observed = Date.parse(`${observationDate}T00:00:00Z`);
  if (!Number.isFinite(observed)) return true;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const ageDays = (today - observed) / 86_400_000;
  // Friday's rate is still current on Monday. Longer than a long weekend is stale.
  return ageDays > 5;
}

/**
 * Frankfurter ECB list payload: `[{ date, base, quote, rate }, ...]`.
 * A non-publication day returns the previous observation date, not 404.
 * Rejects a partial or malformed payload so the last good rows stay in place.
 */
export function parseEcbRatesPayload(body: unknown): ParsedEcbRates {
  if (!Array.isArray(body) || body.length === 0) {
    throw new Error('ECB payload is not a rate list');
  }
  const quotePerUsd: Record<string, number> = {};
  let observationDate: string | null = null;
  for (const row of body) {
    if (!row || typeof row !== 'object') {
      throw new Error('ECB row is not an object');
    }
    const rec = row as Partial<EcbRateRow>;
    if (rec.base !== 'USD') throw new Error('ECB base is not USD');
    if (typeof rec.quote !== 'string' || !/^[A-Z]{3}$/.test(rec.quote)) {
      throw new Error('ECB quote is invalid');
    }
    if (typeof rec.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(rec.date)) {
      throw new Error('ECB observation date is invalid');
    }
    if (typeof rec.rate !== 'number' || !Number.isFinite(rec.rate) || rec.rate <= 0) {
      throw new Error(`ECB rate for ${rec.quote} is invalid`);
    }
    if (observationDate == null) observationDate = rec.date;
    else if (observationDate !== rec.date) {
      throw new Error('ECB rows do not share one observation date');
    }
    quotePerUsd[rec.quote] = rec.rate;
  }
  for (const code of ECB_QUOTE_CURRENCIES) {
    if (quotePerUsd[code] == null) {
      throw new Error(`ECB payload is missing ${code}`);
    }
  }
  if (!observationDate) throw new Error('ECB observation date is missing');
  return { observationDate, quotePerUsd };
}
