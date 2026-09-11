/** Parsed Cardhedger FMV slice (single or batch item). */
export type CardhedgerFmvResult = {
  price: number | null;
  price_low: number | null;
  price_high: number | null;
  confidence: number | null;
  confidence_grade: 'A' | 'B' | 'C' | 'D' | null;
  method: string | null;
  freshness_days: number | null;
};

export type CardhedgerFmvBatchItem = {
  card_id: string;
  grade: string;
};

export const CARDHEDGER_FMV_BATCH_MAX_ITEMS = 100;

export function cardhedgerFmvMapKey(cardId: string, grade: string): string {
  const id = String(cardId ?? '').trim();
  const g = String(grade ?? '').trim().toLowerCase();
  return `${id}:${g}`;
}

export function chunkFmvBatchItems<T>(
  items: readonly T[],
  max = CARDHEDGER_FMV_BATCH_MAX_ITEMS,
): T[][] {
  const cap = Math.max(1, Math.min(CARDHEDGER_FMV_BATCH_MAX_ITEMS, Math.floor(max)));
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += cap) {
    out.push(items.slice(i, i + cap));
  }
  return out;
}

export function parseCardhedgerFmvRecord(
  body: Record<string, unknown>,
): CardhedgerFmvResult | null {
  const parse = (v: unknown): number | null => {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const parseAny = (v: unknown): number | null => {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
    return Number.isFinite(n) ? n : null;
  };
  const cg = String(body.confidence_grade ?? '').trim().toUpperCase();
  return {
    price: parse(body.price),
    price_low: parse(body.price_low),
    price_high: parse(body.price_high),
    confidence: parseAny(body.confidence),
    confidence_grade: (['A', 'B', 'C', 'D'].includes(cg) ? cg : null) as
      | 'A'
      | 'B'
      | 'C'
      | 'D'
      | null,
    method:
      typeof body.method === 'string' && body.method.trim()
        ? body.method.trim()
        : null,
    freshness_days:
      typeof body.freshness_days === 'number' &&
      Number.isFinite(body.freshness_days)
        ? Math.floor(body.freshness_days)
        : null,
  };
}
