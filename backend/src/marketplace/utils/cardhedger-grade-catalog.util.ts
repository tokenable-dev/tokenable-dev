import { cardhedgerGradeFromHistoryTier } from './psa-grade-policy.util';

/** One grade slot from Cardhedger `all-prices-by-card` or snapshot `pricesByGrade`. */
export type CollectionGradeCatalogEntry = {
  grade: string;
  priceUsd: number | null;
  grader: string | null;
  displayOrder: number;
};

const GRADER_SORT_ORDER = [
  'PSA',
  'BGS',
  'SGC',
  'CGC',
  'CSG',
  'HGA',
] as const;

export function parseGraderFromGradeLabel(grade: string): string | null {
  const t = String(grade ?? '').trim();
  if (!t) return null;
  const m = /^(PSA|BGS|SGC|CGC|CSG|HGA)\b/i.exec(t);
  return m ? m[1]!.toUpperCase() : null;
}

function finitePositive(n: unknown): number | null {
  const v = typeof n === 'number' ? n : typeof n === 'string' ? parseFloat(n) : NaN;
  if (!Number.isFinite(v) || v <= 0) return null;
  return v;
}

/** Fallback sort when Cardhedger `display_order` is missing (snapshot map only). */
export function gradeCatalogSortKey(grade: string): number {
  const g = String(grade ?? '').trim();
  const upper = g.toUpperCase();
  if (/^(RAW|UNGRADED|NEAR MINT|NM)\b/.test(upper)) return 9000;
  const grader = parseGraderFromGradeLabel(g);
  const graderIdx = grader
    ? GRADER_SORT_ORDER.indexOf(grader as (typeof GRADER_SORT_ORDER)[number])
    : 50;
  const numMatch = g.match(/(\d+(?:\.\d+)?)/);
  const num = numMatch ? parseFloat(numMatch[1]!) : 0;
  const graderBase = graderIdx >= 0 ? graderIdx : 50;
  return graderBase * 1000 - Math.round(num * 10);
}

function sortCatalogEntries(
  entries: CollectionGradeCatalogEntry[],
): CollectionGradeCatalogEntry[] {
  return [...entries].sort((a, b) => {
    if (a.displayOrder !== b.displayOrder) {
      return a.displayOrder - b.displayOrder;
    }
    return gradeCatalogSortKey(a.grade) - gradeCatalogSortKey(b.grade);
  });
}

/** Build catalog rows from Cardhedger `all-prices-by-card` payload rows. */
export function catalogFromAllPricesRows(
  rows: Array<Record<string, unknown>>,
): CollectionGradeCatalogEntry[] {
  const out: CollectionGradeCatalogEntry[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') continue;
    const grade = String(raw.grade ?? raw.Grade ?? '').trim();
    if (!grade) continue;
    const displayOrderRaw = raw.display_order ?? raw.displayOrder;
    const displayOrder = Number.isFinite(Number(displayOrderRaw))
      ? Math.floor(Number(displayOrderRaw))
      : gradeCatalogSortKey(grade);
    out.push({
      grade,
      priceUsd: finitePositive(raw.price),
      grader: parseGraderFromGradeLabel(grade),
      displayOrder,
    });
  }
  return sortCatalogEntries(out);
}

/** Build catalog rows from snapshot preview `pricesByGrade` map. */
export function catalogFromPricesByGradeMap(
  map: Record<string, number> | null | undefined,
): CollectionGradeCatalogEntry[] {
  if (!map || typeof map !== 'object') return [];
  const entries: CollectionGradeCatalogEntry[] = [];
  for (const [grade, price] of Object.entries(map)) {
    const label = String(grade ?? '').trim();
    if (!label) continue;
    entries.push({
      grade: label,
      priceUsd: finitePositive(price),
      grader: parseGraderFromGradeLabel(label),
      displayOrder: gradeCatalogSortKey(label),
    });
  }
  return sortCatalogEntries(entries);
}

export function collectionGradeLabelFromHistoryTier(
  historyTier: string | null | undefined,
): string | null {
  const tier = String(historyTier ?? '').trim();
  if (!tier) return null;
  return cardhedgerGradeFromHistoryTier(tier);
}
