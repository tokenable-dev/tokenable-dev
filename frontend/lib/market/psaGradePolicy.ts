/**
 * Mirrors `backend/src/marketplace/utils/psa-grade-policy.util.ts`.
 */
import type { CollectionComponents } from "@/lib/marketplace/collectionDetailComponents";

export type PsaGradePolicyClass =
  | "psa_10"
  | "psa_sub10"
  | "psa_qualifier"
  | "unknown";

export interface PsaGradePolicyInput {
  gradingCompany?: string | null;
  gradeScore?: unknown;
  gradeLabel?: string | null;
  gradeDescription?: string | null;
}

export function parseFiniteGradeScore(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t || t.toLowerCase() === "auth") return null;
    const n = parseFloat(t.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function parseGradeScoreFromLabelText(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const m = t.match(
    /\b(?:PSA\s*|GEM\s*MT\s*|MINT\s*|NM\s*-?\s*MT\s*)?(\d{1,2}(?:\.\d+)?)\b/i,
  );
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? n : null;
}

function effectiveGradeScore(input: PsaGradePolicyInput): number | null {
  const fromScore = parseFiniteGradeScore(input.gradeScore);
  if (fromScore != null) return fromScore;
  const text = [input.gradeLabel, input.gradeDescription]
    .map((s) => String(s ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return parseGradeScoreFromLabelText(text);
}

function psaQualifierText(input: PsaGradePolicyInput): string {
  return [input.gradeLabel, input.gradeDescription]
    .map((s) => String(s ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

export function isPsaQualifierGradeText(text: string): boolean {
  const u = text.trim().toUpperCase();
  if (!u) return false;
  if (/\b(?:GEM\s*MT|MINT|NM\s*-?\s*MT|PSA)\s*(?:[1-9])(?:\.\d)?\b/.test(u)) {
    return false;
  }
  if (/\bAA\s*:\s*AUTHENTIC\b/.test(u)) return true;
  if (/\bAUTHENTIC\s+ALTERED\b/.test(u)) return true;
  if (/\bAUTH(?:ENTIC)?(?:\s+ALTERED)?\b/.test(u)) return true;
  return false;
}

export function classifyPsaGradePolicy(
  input: PsaGradePolicyInput,
): PsaGradePolicyClass {
  const score = effectiveGradeScore(input);
  if (score != null) {
    const floor = Math.floor(score);
    if (floor === 10) return "psa_10";
    if (floor >= 1 && floor <= 9) return "psa_sub10";
  }
  if (isPsaQualifierGradeText(psaQualifierText(input))) return "psa_qualifier";
  return "unknown";
}

export function isMintEligiblePsaGrade(input: PsaGradePolicyInput): boolean {
  const c = classifyPsaGradePolicy(input);
  return c === "psa_10" || c === "psa_sub10" || c === "psa_qualifier";
}

function numericPsaHistoryTier(score: number): string | null {
  const floor = Math.floor(score);
  if (floor >= 1 && floor <= 10) return `PSA_${floor}`;
  return null;
}

export function marketHistoryTierFromPsaGradeInput(
  input: PsaGradePolicyInput,
): string {
  const rawScore = input.gradeScore;
  if (
    typeof rawScore === "string" &&
    rawScore.trim().toLowerCase() === "auth"
  ) {
    return "PSA_AUTH";
  }
  const c = classifyPsaGradePolicy(input);
  if (c === "psa_qualifier") return "PSA_AUTH";
  const score = effectiveGradeScore(input);
  if (score != null) {
    const tier = numericPsaHistoryTier(score);
    if (tier) return tier;
  }
  return "PSA_10";
}

export function psaGradePolicyInputFromComponents(
  components: CollectionComponents | null | undefined,
): PsaGradePolicyInput {
  if (!components) return { gradingCompany: "PSA" };
  return {
    gradingCompany: String(components.gradingCompany ?? "psa"),
    gradeScore: components.gradeScore,
    gradeLabel:
      typeof components.psaGradeLabel === "string"
        ? components.psaGradeLabel
        : undefined,
    gradeDescription:
      typeof components.psaGradeDescription === "string"
        ? components.psaGradeDescription
        : undefined,
  };
}

export function bucketGradeScoreFromPsaGradeInput(
  input: PsaGradePolicyInput,
): string | null {
  const c = classifyPsaGradePolicy(input);
  if (c === "psa_10" || c === "psa_sub10") {
    const score = effectiveGradeScore(input);
    if (score == null) return c === "psa_10" ? "10" : null;
    const floor = Math.floor(score);
    if (floor >= 1 && floor <= 10) return String(floor);
    return null;
  }
  if (c === "psa_qualifier") return "auth";
  return null;
}

export function psaGradePolicyInputFromGraded(
  graded: Record<string, unknown>,
): PsaGradePolicyInput {
  const psa = graded.psa as Record<string, unknown> | undefined;
  const grade = graded.grade as Record<string, unknown> | undefined;
  return {
    gradingCompany: String(graded.gradingCompany ?? "PSA"),
    gradeScore: psa?.gradeScore ?? grade?.score ?? graded.gradeScore,
    gradeLabel:
      typeof psa?.gradeLabel === "string"
        ? psa.gradeLabel
        : typeof grade?.label === "string"
          ? grade.label
          : undefined,
    gradeDescription:
      typeof psa?.gradeDescription === "string"
        ? psa.gradeDescription
        : undefined,
  };
}
