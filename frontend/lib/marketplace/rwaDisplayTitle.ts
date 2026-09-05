/**
 * MintForm historically auto-filled NFT `metadata.name` as `{cardNameHint} PSA {grade}`.
 * Grade already appears in badges / graded.* — strip redundant trailing suffix for display.
 */
export function stripGradeQualifierFromDisplayName(raw: string): string {
  let s = raw.trim();
  if (!s) return s;
  const qualifier =
    String.raw`(?:PSA\s+)?(?:GEM\s*MINT|GEM\s*MT|MINT|NM\s*-?\s*MT|NEAR\s*MINT)(?:\s+\d+(?:\.\d+)?)?`;
  s = s.replace(new RegExp(`[\\s·•,]+${qualifier}\\s*$`, "i"), "").trim();
  s = s.replace(/\s+PSA\s+\d+(?:\.\d+)?\s*$/i, "").trim();
  s = s.replace(new RegExp(`[\\s·•]+PSA\\s+\\d+(?:\\.\\d+)?\\s*$`, "i"), "").trim();
  return s.length > 0 ? s : raw.trim();
}

export function displayAssetNameFromMetadata(
  meta: { name?: string; properties?: unknown; graded?: unknown } | null | undefined,
  fallback: string,
): string {
  const raw = typeof meta?.name === "string" ? meta.name.trim() : "";
  if (!raw) return fallback;

  const props = meta?.properties as Record<string, unknown> | undefined;
  const graded =
    (props?.graded ?? meta?.graded) as Record<string, unknown> | undefined;
  if (!graded || typeof graded !== "object") {
    return stripGradeQualifierFromDisplayName(raw) || fallback;
  }

  const psa = graded.psa as Record<string, unknown> | undefined;
  const grade = graded.grade as Record<string, unknown> | undefined;
  const hasStructuredGrade =
    (typeof psa?.gradeLabel === "string" && psa.gradeLabel.trim().length > 0) ||
    (typeof psa?.gradeScore === "number" && Number.isFinite(psa.gradeScore)) ||
    (typeof grade?.score === "number" && Number.isFinite(grade.score));

  if (!hasStructuredGrade) {
    return stripGradeQualifierFromDisplayName(raw) || fallback;
  }

  let s = raw;
  s = s.replace(/\s+PSA\s+GEM\s*MT\s*\d+(?:\.\d+)?\s*$/i, "").trim();
  s = s.replace(/\s+PSA\s+MINT\s*\d+(?:\.\d+)?\s*$/i, "").trim();
  s = s.replace(/\s+PSA\s*NM\s*[- ]?\s*MT\s*\d+\s*$/i, "").trim();
  s = s.replace(/\s+PSA\s*\d+(?:\.\d+)?\s*$/i, "").trim();
  s = stripGradeQualifierFromDisplayName(s);

  return s.length > 0 ? s : raw;
}
