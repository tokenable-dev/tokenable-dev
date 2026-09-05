import type { PsaAnalyzeResult } from "@/lib/core";
import {
  EMPTY_PSA_FIELD_LOCKS,
  type GradedCardFormState,
  type PsaFieldLocks,
} from "@/types/gradedCard";

export function normalizeCertDigits(v: string | undefined | null): string {
  return String(v ?? "").replace(/\D/g, "");
}

export function psaCertImageMatchesFormCert(
  analyze: PsaAnalyzeResult | null | undefined,
  formCert: string | undefined | null,
): boolean {
  if (!analyze?.psaCertImages?.front) return false;
  const a = normalizeCertDigits(analyze.psa.certNumber);
  const f = normalizeCertDigits(formCert);
  return Boolean(a && f && a === f);
}

export function computePsaLocksFromResult(
  r: PsaAnalyzeResult,
  prev: GradedCardFormState,
): PsaFieldLocks {
  const scoreStr =
    r.psa.gradeScore != null
      ? String(r.psa.gradeScore)
      : (r.psa.gradeLabel?.replace(/[^\d.]/g, "") ?? "");
  const hasScore =
    Boolean(scoreStr.trim()) || Boolean(r.psa.gradeLabel?.trim());
  return {
    certNumber: Boolean(r.psa.certNumber?.trim()),
    score: hasScore,
    cardName: Boolean(r.psa.cardNameHint?.trim()),
    player: false,
    year: Boolean(r.psa.year?.trim()),
    set: Boolean(r.psa.setHint?.trim()),
    number: Boolean(r.psa.cardNumberHint?.trim()),
    certUrl: Boolean(r.psa.certVerifyUrl?.trim()),
    assetName: Boolean(r.psa.cardNameHint?.trim()),
    labelType: Boolean(r.psa.labelType?.trim()),
    psaCategory: Boolean(r.psa.category?.trim()),
    autographGrade: Boolean(r.psa.autographGrade?.trim()),
    psaPopulation: r.psa.totalPopulation != null,
    psaPopHigher: r.psa.populationHigher != null,
    gradingCompany: true,
  };
}

export { EMPTY_PSA_FIELD_LOCKS };
