/** PSA numeric grades exposed in the collection detail grade chart picker (10 → 1). */
export const PSA_CHART_GRADE_LABELS = [
  "PSA 10",
  "PSA 9",
  "PSA 8",
  "PSA 7",
  "PSA 6",
  "PSA 5",
  "PSA 4",
  "PSA 3",
  "PSA 2",
  "PSA 1",
] as const;

export type PsaChartGradeLabel = (typeof PSA_CHART_GRADE_LABELS)[number];

const PSA_CHART_GRADE_SET = new Set(
  PSA_CHART_GRADE_LABELS.map((g) => g.toLowerCase()),
);

export function normalizePsaChartGradeLabel(
  raw: string | null | undefined,
): string {
  return String(raw ?? "").trim();
}

export function isPsaChartGradeLabel(raw: string | null | undefined): boolean {
  const t = normalizePsaChartGradeLabel(raw);
  if (!t) return false;
  return PSA_CHART_GRADE_SET.has(t.toLowerCase());
}

/** Map PSA chart label → numeric score 1–10, or null. */
export function psaChartGradeScoreFromLabel(
  raw: string | null | undefined,
): number | null {
  const t = normalizePsaChartGradeLabel(raw);
  const m = /^PSA\s+(10|[1-9])\b/i.exec(t);
  if (!m) return null;
  return Number(m[1]);
}

/** Coerce arbitrary grade text to a PSA 1–10 chart label when possible. */
export function coercePsaChartGradeLabel(
  raw: string | null | undefined,
): PsaChartGradeLabel | null {
  const score = psaChartGradeScoreFromLabel(raw);
  if (score == null || score < 1 || score > 10) return null;
  return `PSA ${score}` as PsaChartGradeLabel;
}

/**
 * Chart picker options — always PSA 10…1 (Cardhedger catalog may include BGS/SGC etc.).
 * Ensures the collection slab grade appears when it is a valid PSA numeric grade.
 */
export function buildPsaChartGradeOptions(slabGrade: string): PsaChartGradeLabel[] {
  const slab = coercePsaChartGradeLabel(slabGrade);
  if (slab && !PSA_CHART_GRADE_LABELS.includes(slab)) {
    return [slab, ...PSA_CHART_GRADE_LABELS];
  }
  return [...PSA_CHART_GRADE_LABELS];
}
