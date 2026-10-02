/**
 * Platform PSA grade policy:
 * - PSA 1–10 (numeric) — mint allowed; Cardhedger tier PSA_1 … PSA_10
 * - PSA qualifier slabs (AUTH / AUTHENTIC / …, no numeric grade) — mint allowed + PSA_AUTH pricing
 */

export type PsaGradePolicyClass =
  | 'psa_10'
  | 'psa_sub10'
  | 'psa_qualifier'
  | 'unknown';

export interface PsaGradePolicyInput {
  gradingCompany?: string | null;
  gradeScore?: unknown;
  gradeLabel?: string | null;
  gradeDescription?: string | null;
}

export function normalizePsaGradingCompany(raw: unknown): 'PSA' | null {
  if (typeof raw !== 'string') return null;
  const norm = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (norm === 'PSA' || norm === 'PSA/DNA' || norm === 'PSADNA') return 'PSA';
  return null;
}

export function parseFiniteGradeScore(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t || t.toLowerCase() === 'auth') return null;
    const n = parseFloat(t.replace(',', '.'));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Parse numeric PSA grade from label/description when `gradeScore` is absent. */
export function parseGradeScoreFromLabelText(text: string): number | null {
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
    .map((s) => String(s ?? '').trim())
    .filter(Boolean)
    .join(' ');
  return parseGradeScoreFromLabelText(text);
}

function psaQualifierText(input: PsaGradePolicyInput): string {
  return [input.gradeLabel, input.gradeDescription]
    .map((s) => String(s ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

/** True when PSA assigned AUTH / AUTHENTIC (incl. altered) without a numeric 1–10 grade. */
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
    if (floor === 10) return 'psa_10';
    if (floor >= 1 && floor <= 9) return 'psa_sub10';
  }
  if (isPsaQualifierGradeText(psaQualifierText(input))) return 'psa_qualifier';
  return 'unknown';
}

export function isMintEligiblePsaGrade(input: PsaGradePolicyInput): boolean {
  const c = classifyPsaGradePolicy(input);
  return c === 'psa_10' || c === 'psa_sub10' || c === 'psa_qualifier';
}

export function mintRejectionMessage(input: PsaGradePolicyInput): string | null {
  if (isMintEligiblePsaGrade(input)) return null;
  const label =
    [input.gradeLabel, input.gradeDescription]
      .map((s) => String(s ?? '').trim())
      .filter(Boolean)
      .join(' ') ||
    String(input.gradeScore ?? '').trim() ||
    'unknown';
  return `PSA 1–10 또는 PSA 인증(등급 없음) 슬랩만 mint 가능합니다. 현재 등급: ${label}`;
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
    typeof rawScore === 'string' &&
    rawScore.trim().toLowerCase() === 'auth'
  ) {
    return 'PSA_AUTH';
  }
  const c = classifyPsaGradePolicy(input);
  if (c === 'psa_qualifier') return 'PSA_AUTH';
  const score = effectiveGradeScore(input);
  if (score != null) {
    const tier = numericPsaHistoryTier(score);
    if (tier) return tier;
  }
  return 'PSA_10';
}

export function cardhedgerGradeFromHistoryTier(tier: string): string {
  const t = String(tier ?? '')
    .trim()
    .toUpperCase();
  if (t === 'PSA_10') return 'PSA 10';
  if (t === 'PSA_AUTH') return 'PSA AUTH';
  return t.replace(/_/g, ' ');
}

/** Bucket hash grade key — `"1"`…`"10"` or `"auth"` for qualifier slabs. */
export function bucketGradeScoreFromPsaGradeInput(
  input: PsaGradePolicyInput,
): string | null {
  const c = classifyPsaGradePolicy(input);
  if (c === 'psa_10' || c === 'psa_sub10') {
    const score = effectiveGradeScore(input);
    if (score == null) return c === 'psa_10' ? '10' : null;
    const floor = Math.floor(score);
    if (floor >= 1 && floor <= 10) return String(floor);
    return null;
  }
  if (c === 'psa_qualifier') return 'auth';
  return null;
}

export function psaGradePolicyInputFromGraded(
  graded: Record<string, unknown>,
): PsaGradePolicyInput {
  const psa = graded.psa as Record<string, unknown> | undefined;
  const grade = graded.grade as Record<string, unknown> | undefined;
  return {
    gradingCompany: String(graded.gradingCompany ?? 'PSA'),
    gradeScore: psa?.gradeScore ?? grade?.score ?? graded.gradeScore,
    gradeLabel:
      typeof psa?.gradeLabel === 'string'
        ? psa.gradeLabel
        : typeof grade?.label === 'string'
          ? grade.label
          : undefined,
    gradeDescription:
      typeof psa?.gradeDescription === 'string'
        ? psa.gradeDescription
        : undefined,
  };
}

export function psaGradePolicyInputFromComponents(
  components: Record<string, unknown> | null | undefined,
): PsaGradePolicyInput {
  if (!components) return { gradingCompany: 'PSA' };
  return {
    gradingCompany: String(components.gradingCompany ?? 'psa'),
    gradeScore: components.gradeScore,
    gradeLabel:
      typeof components.psaGradeLabel === 'string'
        ? components.psaGradeLabel
        : undefined,
    gradeDescription:
      typeof components.psaGradeDescription === 'string'
        ? components.psaGradeDescription
        : undefined,
  };
}
