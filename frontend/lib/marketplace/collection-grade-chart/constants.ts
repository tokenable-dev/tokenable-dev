/** Collection detail grade chart — Card.html `.tk-period` (1M / 3M / 6M / 1Y / All). */
export const COLLECTION_GRADE_CHART_ALL_DAYS = 99999;

export const COLLECTION_GRADE_CHART_DAYS_OPTIONS = [
  30,
  90,
  180,
  365,
  COLLECTION_GRADE_CHART_ALL_DAYS,
] as const;

export type CollectionGradeChartDays =
  (typeof COLLECTION_GRADE_CHART_DAYS_OPTIONS)[number];

export const COLLECTION_GRADE_CHART_DEFAULT_DAYS: CollectionGradeChartDays = 365;

const SEC_PER_DAY = 86_400;

/** Cardhedger `days` is capped at 365; All uses the full stored series. */
export function gradeSeriesRequestDays(days: number): number {
  if (days >= COLLECTION_GRADE_CHART_ALL_DAYS) return 365;
  return Math.min(365, Math.max(1, Math.floor(days)));
}

export function filterCollectionUsdPointsByDays(
  points: ReadonlyArray<{ t: number; v: number }>,
  days: number,
): Array<{ t: number; v: number }> {
  if (points.length === 0) return [];
  const valid = points.filter(
    (p) => Number.isFinite(p.t) && Number.isFinite(p.v) && p.v > 0,
  );
  if (days >= COLLECTION_GRADE_CHART_ALL_DAYS) return valid;
  const d = Math.max(1, Math.floor(days));
  const cutoff = Math.floor(Date.now() / 1000) - d * SEC_PER_DAY;
  return valid.filter((p) => p.t >= cutoff);
}
