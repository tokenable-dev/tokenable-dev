import type { CollectionComponents } from "@/lib/marketplace/collectionDetailComponents";
import {
  coercePsaChartGradeLabel,
  psaChartGradeScoreFromLabel,
} from "@/lib/marketplace/collection-grade-chart/psaChartGrades";
import { parseFiniteGradeScore } from "@/lib/market/psaGradePolicy";

export type PsaPopulationByGrade = Partial<
  Record<"1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10", number>
>;

function finitePop(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return null;
  return Math.floor(v);
}

export function parsePsaPopulationByGrade(
  raw: unknown,
): PsaPopulationByGrade | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const map = raw as Record<string, unknown>;
  const out: PsaPopulationByGrade = {};
  for (let g = 1; g <= 10; g++) {
    const key = String(g) as keyof PsaPopulationByGrade;
    const n = finitePop(map[String(g)]);
    if (n != null) out[key] = n;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** PSA numeric grade score (1–10) → population count from persisted spec report. */
export function psaPopForGradeScore(
  components: CollectionComponents,
  gradeScore: number,
): number | null {
  if (!Number.isFinite(gradeScore) || gradeScore < 1 || gradeScore > 10) {
    return null;
  }
  const key = String(Math.floor(gradeScore));
  const fromMap = finitePop(components.psaPopulationByGrade?.[key as keyof PsaPopulationByGrade]);
  if (fromMap != null) return fromMap;

  if (gradeScore === 10) {
    const g10 = finitePop(components.psaGrade10Population);
    if (g10 != null) return g10;
  }

  const slabScore = parseFiniteGradeScore(components.gradeScore);
  if (slabScore != null && slabScore === gradeScore) {
    const certLinePop = finitePop(components.psaTotalPopulation);
    if (certLinePop != null) return certLinePop;
  }

  return null;
}

export function psaPopForChartGradeLabel(
  components: CollectionComponents,
  gradeLabel: string | null | undefined,
): number | null {
  const score = psaChartGradeScoreFromLabel(gradeLabel);
  if (score == null) return null;
  return psaPopForGradeScore(components, score);
}

export function psaChartGradeLabelForScore(score: number): string {
  return `PSA ${Math.floor(score)}`;
}

function sumPsaPopulationByGrade(map: PsaPopulationByGrade): number {
  let sum = 0;
  for (let g = 1; g <= 10; g++) {
    const n = map[String(g) as keyof PsaPopulationByGrade];
    if (typeof n === "number" && Number.isFinite(n)) sum += n;
  }
  return sum;
}

/** Panel input: spec-grade breakdown + cert-line pop for the collection slab grade. */
export function resolveCollectionPsaPopulationPanelData(
  components: CollectionComponents,
): {
  byGrade?: PsaPopulationByGrade;
  totalPop: number | null;
} {
  const byGrade: PsaPopulationByGrade = {
    ...(parsePsaPopulationByGrade(components.psaPopulationByGrade) ?? {}),
  };

  const gradeScore = parseFiniteGradeScore(components.gradeScore);
  const certLinePop = finitePop(components.psaTotalPopulation);
  if (
    gradeScore != null &&
    certLinePop != null &&
    byGrade[String(gradeScore) as keyof PsaPopulationByGrade] == null
  ) {
    byGrade[String(gradeScore) as keyof PsaPopulationByGrade] = certLinePop;
  }

  const specTotal = finitePop(components.psaSpecTotalPopulation);
  const totalPop =
    specTotal ??
    (Object.keys(byGrade).length > 0 ? sumPsaPopulationByGrade(byGrade) : null);

  return {
    byGrade: Object.keys(byGrade).length > 0 ? byGrade : undefined,
    totalPop: totalPop != null && totalPop > 0 ? totalPop : null,
  };
}

export function resolveActivePsaChartGradeLabel(
  components: CollectionComponents,
  activeGradeLabel?: string | null,
): string {
  return (
    coercePsaChartGradeLabel(activeGradeLabel) ??
    coercePsaChartGradeLabel(
      components.gradeScore != null ? `PSA ${components.gradeScore}` : null,
    ) ??
    "PSA 10"
  );
}

export function formatPsaGradePopTileLabel(gradeLabel: string): string {
  const label = gradeLabel.trim() || "PSA 10";
  return `${label} / Pop`;
}

export function formatPsaGradePopPairTitle(
  gradeLabel: string,
  gradePop: number | null | undefined,
  totalPsaPop: number | null | undefined,
  formatCount: (n: number | null | undefined) => string,
): string | undefined {
  if (gradePop == null && totalPsaPop == null) return undefined;
  const parts: string[] = [];
  if (gradePop != null) parts.push(`${gradeLabel.trim()}: ${formatCount(gradePop)}`);
  if (totalPsaPop != null) parts.push(`Total: ${formatCount(totalPsaPop)}`);
  return parts.join(" · ");
}
