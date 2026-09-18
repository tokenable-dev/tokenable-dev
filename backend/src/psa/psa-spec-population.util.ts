/** PSA spec population breakdown — keys `"1"`…`"10"`. */
export type PsaPopulationByGrade = Partial<
  Record<'1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10', number>
>;

export interface PsaSpecPopSummary {
  total: number | null;
  grade10: number | null;
  byGrade: PsaPopulationByGrade;
}

const PSA_GRADE_KEYS = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
] as const;

export { PSA_GRADE_KEYS };

function floorPop(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return null;
  return Math.floor(v);
}

/** Parse PSA Public API `PSASpecPopulationModel.PSAPop` grade breakdown. */
export function parsePsaSpecPopulationBody(body: unknown): PsaSpecPopSummary {
  if (!body || typeof body !== 'object') {
    return { total: null, grade10: null, byGrade: {} };
  }
  const pop = (body as { PSAPop?: Record<string, unknown> }).PSAPop;
  if (!pop || typeof pop !== 'object') {
    return { total: null, grade10: null, byGrade: {} };
  }

  const byGrade: PsaPopulationByGrade = {};
  for (const key of PSA_GRADE_KEYS) {
    const field = key === '10' ? 'Grade10' : (`Grade${key}` as const);
    const n = floorPop(pop[field]);
    if (n != null) byGrade[key] = n;
  }

  const grade10 = byGrade['10'] ?? floorPop(pop.Grade10);
  const total = floorPop(pop.Total);

  return {
    total,
    grade10,
    byGrade,
  };
}

export function isCompletePsaPopByGradeMap(
  byGrade: PsaPopulationByGrade | null | undefined,
): boolean {
  if (!byGrade || typeof byGrade !== 'object') return false;
  for (const key of PSA_GRADE_KEYS) {
    const n = byGrade[key];
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return false;
  }
  return true;
}

/** Persist Grade1–10 counts; returns null when `byGrade` is empty or incomplete. */
export function psaPopulationByGradeRecord(
  byGrade: PsaPopulationByGrade | null | undefined,
): Record<string, number> | null {
  if (!byGrade || typeof byGrade !== 'object') return null;
  if (!isCompletePsaPopByGradeMap(byGrade)) return null;
  const out: Record<string, number> = {};
  for (const key of PSA_GRADE_KEYS) {
    out[key] = Math.floor(byGrade[key] as number);
  }
  return out;
}

export function hasCompletePsaPopulationByGrade(
  comp: Record<string, unknown> | null | undefined,
): boolean {
  const raw = comp?.psaPopulationByGrade;
  if (!raw || typeof raw !== 'object') return false;
  const map = raw as Record<string, unknown>;
  const byGrade: PsaPopulationByGrade = {};
  for (const key of PSA_GRADE_KEYS) {
    const v = map[key];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return false;
    byGrade[key] = Math.floor(v);
  }
  return isCompletePsaPopByGradeMap(byGrade);
}
