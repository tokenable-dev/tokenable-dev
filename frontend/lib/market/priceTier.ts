export function marketHistoryTierFromComponents(
  components: Record<string, unknown> | null | undefined,
): string {
  if (!components) return "PSA_10";
  const grader = String(components["gradingCompany"] ?? "")
    .trim()
    .toUpperCase();
  const raw = components["gradeScore"];
  const score =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? parseFloat(String(raw).replace(",", "."))
        : NaN;
  if (!Number.isFinite(score)) return "PSA_10";
  const r = Math.round(score);
  const psaLike = grader === "PSA" || grader === "";
  if (psaLike) {
    if (r >= 10) return "PSA_10";
    if (r === 9) return "PSA_9";
  }
  return "PSA_10";
}

export function marketHistoryTierFromRwaMetadata(
  metadata: { properties?: unknown } | null | undefined,
): string {
  const props = metadata?.properties as Record<string, unknown> | undefined;
  const graded = props?.graded as Record<string, unknown> | undefined;
  if (!graded || typeof graded !== "object") return "PSA_10";
  const psa = graded.psa as { gradeScore?: number } | undefined;
  const grade = graded.grade as { score?: number } | undefined;
  const gradingCompany =
    typeof graded.gradingCompany === "string" && graded.gradingCompany.trim()
      ? String(graded.gradingCompany).trim()
      : psa != null
        ? "PSA"
        : undefined;
  const score = psa?.gradeScore ?? grade?.score;
  return marketHistoryTierFromComponents({
    gradingCompany,
    gradeScore: score != null && Number.isFinite(Number(score)) ? String(score) : undefined,
  });
}

export function marketTierDisplayLabel(tier: string): string {
  const m = /^PSA_(\d+)$/.exec(String(tier).trim());
  if (m) return `PSA ${m[1]}`;
  return "PSA 10";
}

