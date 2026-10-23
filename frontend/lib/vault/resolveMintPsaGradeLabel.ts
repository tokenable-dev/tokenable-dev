import { bucketGradeScoreFromPsaGradeInput } from "@/lib/market/psaGradePolicy";
import { isCardDisplayRawGrade } from "@/lib/marketplace/cardDisplayName";

/**
 * PSA grade for mint Line 1 / display_name.
 * Never returns `Raw` — null means omit the grade segment.
 */
export function resolveMintPsaGradeLabel(input: {
  score?: string | number | null;
  gradeLabel?: string | null;
  gradeDescription?: string | null;
}): string | null {
  const scoreRaw = String(input.score ?? "").trim();
  if (scoreRaw && !isCardDisplayRawGrade(scoreRaw)) {
    if (/^auth$/i.test(scoreRaw)) return "PSA AUTH";
    if (/^psa\b/i.test(scoreRaw)) return scoreRaw.replace(/\s+/g, " ");
    if (/^\d{1,2}(?:\.\d+)?$/.test(scoreRaw)) {
      return `PSA ${scoreRaw.replace(/\.0$/, "")}`;
    }
  }

  const fromPolicy = bucketGradeScoreFromPsaGradeInput({
    gradingCompany: "PSA",
    gradeScore: input.score,
    gradeLabel: input.gradeLabel,
    gradeDescription: input.gradeDescription,
  });
  if (fromPolicy === "auth") return "PSA AUTH";
  if (fromPolicy) return `PSA ${fromPolicy}`;

  const text = [input.gradeLabel, input.gradeDescription]
    .map((s) => String(s ?? "").trim())
    .filter(Boolean)
    .join(" ");
  if (!text || isCardDisplayRawGrade(text)) return null;
  if (/^psa\b/i.test(text)) {
    const score = bucketGradeScoreFromPsaGradeInput({
      gradingCompany: "PSA",
      gradeLabel: text,
    });
    if (score === "auth") return "PSA AUTH";
    if (score) return `PSA ${score}`;
  }
  const m = text.match(/\b(\d{1,2}(?:\.\d+)?)\b/);
  if (m?.[1]) return `PSA ${m[1]}`;
  if (/\bauth/i.test(text)) return "PSA AUTH";
  return null;
}

/** Fill empty `form.grade.score` from PSA analyze so IPFS metadata never omits Grade. */
export function ensureMintFormHasPsaScore<
  T extends { grade: { score: string } },
>(
  form: T,
  analyze?: {
    psa?: {
      gradeScore?: number | null;
      gradeLabel?: string | null;
      gradeDescription?: string | null;
    };
  } | null,
): T {
  if (form.grade.score?.trim()) return form;
  const label = resolveMintPsaGradeLabel({
    score: analyze?.psa?.gradeScore,
    gradeLabel: analyze?.psa?.gradeLabel,
    gradeDescription: analyze?.psa?.gradeDescription,
  });
  if (!label) return form;
  const score = label.replace(/^PSA\s+/i, "").trim();
  if (!score) return form;
  return {
    ...form,
    grade: { ...form.grade, score },
  };
}
