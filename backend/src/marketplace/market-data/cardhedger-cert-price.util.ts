import type { CardhedgerCardRow } from './cardhedger-market-data.types';
import {
  cardhedgerFmvMapKey,
  chunkFmvBatchItems,
  parseCardhedgerFmvRecord,
  type CardhedgerFmvBatchItem,
  type CardhedgerFmvResult,
} from './cardhedger-fmv.util';

export const CARDHEDGER_CERT_PRICE_BATCH_MAX = 100;

export type CardhedgerCertInfo = {
  cert: string;
  grade: string | null;
  description: string | null;
};

/** Parsed row from `POST /v1/cards/batch-prices-by-cert`. */
export type CardhedgerCertPriceResult = {
  cert: string;
  card: CardhedgerCardRow | null;
  certInfo: CardhedgerCertInfo | null;
  price: number | null;
  price_low: number | null;
  price_high: number | null;
  confidence: number | null;
  method: string | null;
  card_source: string | null;
  match_confidence: number | null;
};

function parseUsd(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseAnyNum(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function normalizeCertDigits(cert: string | undefined): string {
  const d = String(cert ?? '').replace(/\D/g, '');
  return d.length >= 7 ? d : '';
}

export function chunkCertBatch(certs: readonly string[]): string[][] {
  const cap = CARDHEDGER_CERT_PRICE_BATCH_MAX;
  const out: string[][] = [];
  for (let i = 0; i < certs.length; i += cap) {
    out.push(certs.slice(i, i + cap));
  }
  return out;
}

export function parseCertPriceResult(
  raw: unknown,
  certFallback?: string,
): CardhedgerCertPriceResult | null {
  if (typeof raw !== 'object' || raw == null) return null;
  const row = raw as Record<string, unknown>;
  const certInfoRaw = row.cert_info as Record<string, unknown> | undefined;
  const certDigits = normalizeCertDigits(
    String(certInfoRaw?.cert ?? row.cert ?? certFallback ?? ''),
  );
  if (!certDigits) return null;

  const card =
    row.card != null && typeof row.card === 'object'
      ? (row.card as CardhedgerCardRow)
      : null;
  const estimate =
    row.estimate != null && typeof row.estimate === 'object'
      ? (row.estimate as Record<string, unknown>)
      : null;

  const price =
    parseUsd(row.price) ??
    parseUsd(estimate?.price) ??
    (Array.isArray(row.prices) && row.prices.length > 0
      ? parseUsd(
          (row.prices[row.prices.length - 1] as { price?: unknown })?.price,
        )
      : null);

  const certInfo: CardhedgerCertInfo = {
    cert: certDigits,
    grade:
      typeof certInfoRaw?.grade === 'string' && certInfoRaw.grade.trim()
        ? certInfoRaw.grade.trim()
        : typeof row.grade === 'string' && row.grade.trim()
          ? row.grade.trim()
          : null,
    description:
      typeof certInfoRaw?.description === 'string' &&
      certInfoRaw.description.trim()
        ? certInfoRaw.description.trim()
        : null,
  };

  return {
    cert: certDigits,
    card,
    certInfo,
    price,
    price_low: parseUsd(row.price_low) ?? parseUsd(estimate?.price_low),
    price_high: parseUsd(row.price_high) ?? parseUsd(estimate?.price_high),
    confidence: parseAnyNum(row.confidence) ?? parseAnyNum(estimate?.confidence),
    method:
      typeof row.method === 'string' && row.method.trim()
        ? row.method.trim()
        : typeof estimate?.method === 'string' && estimate.method.trim()
          ? estimate.method.trim()
          : null,
    card_source:
      typeof row.card_source === 'string' && row.card_source.trim()
        ? row.card_source.trim()
        : null,
    match_confidence: parseAnyNum(row.match_confidence),
  };
}

export function certPriceDiffPct(
  newUsd: number | null,
  oldUsd: number | null,
): number | null {
  if (newUsd == null || oldUsd == null || !(oldUsd > 0) || !(newUsd > 0)) {
    return null;
  }
  return Math.round(((newUsd - oldUsd) / oldUsd) * 1000) / 10;
}

export {
  cardhedgerFmvMapKey,
  chunkFmvBatchItems,
  parseCardhedgerFmvRecord,
  type CardhedgerFmvBatchItem,
  type CardhedgerFmvResult,
};
