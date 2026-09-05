/** Collection detail grade chart — aligned with Top 100 detail periods. */
export const COLLECTION_GRADE_CHART_DAYS_OPTIONS = [30, 90, 180, 365] as const;

export type CollectionGradeChartDays =
  (typeof COLLECTION_GRADE_CHART_DAYS_OPTIONS)[number];

export const COLLECTION_GRADE_CHART_DEFAULT_DAYS: CollectionGradeChartDays = 365;

const SEC_PER_DAY = 86_400;

export function filterCollectionUsdPointsByDays(
  points: ReadonlyArray<{ t: number; v: number }>,
  days: number,
): Array<{ t: number; v: number }> {
  if (points.length === 0) return [];
  const d = Math.max(1, Math.floor(days));
  const cutoff = Math.floor(Date.now() / 1000) - d * SEC_PER_DAY;
  return points.filter(
    (p) => Number.isFinite(p.t) && Number.isFinite(p.v) && p.v > 0 && p.t >= cutoff,
  );
}
