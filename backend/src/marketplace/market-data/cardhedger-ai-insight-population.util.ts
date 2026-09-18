import type { AiInsightPopulationContext } from './cardhedger-ai-insight.types';

export type AiInsightPopulationBase = Omit<
  AiInsightPopulationContext,
  'hasCompleteByGrade'
>;

export function parsePopulationContext(
  components: Record<string, unknown>,
  statsPsa10Pop: number | null,
): AiInsightPopulationBase {
  const readNum = (k: string): number | null => {
    const raw = components[k];
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
      return Math.floor(raw);
    }
    return null;
  };
  const byGradeRaw = components.psaPopulationByGrade;
  let byGrade: Record<string, number> | null = null;
  if (byGradeRaw && typeof byGradeRaw === 'object') {
    byGrade = {};
    for (const [k, v] of Object.entries(byGradeRaw as Record<string, unknown>)) {
      if (typeof v === 'number' && v > 0) byGrade[k] = Math.floor(v);
    }
    if (Object.keys(byGrade).length === 0) byGrade = null;
  }
  return {
    psa10:
      statsPsa10Pop ??
      readNum('psaGrade10Population') ??
      readNum('psaTotalPopulation'),
    psa9: byGrade?.['9'] ?? null,
    specTotal: readNum('psaSpecTotalPopulation'),
    byGrade,
  };
}
