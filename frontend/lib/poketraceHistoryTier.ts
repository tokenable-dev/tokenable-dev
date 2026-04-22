/**
 * PokeTrace price-history tier (path segment) from collection `components` or IPFS metadata fields.
 * PSA slabs: `PSA_{rounded grade}` (1–10). Otherwise catalog Near Mint reference.
 */
export function poketraceHistoryTierFromComponents(
  components: Record<string, unknown> | null | undefined,
): string {
  if (!components) return "NEAR_MINT";
  const grader = String(components["gradingCompany"] ?? "")
    .trim()
    .toUpperCase();
  const raw = components["gradeScore"];
  const score =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? parseFloat(raw)
        : NaN;
  if (grader === "PSA" && Number.isFinite(score)) {
    const r = Math.round(score);
    if (r >= 1 && r <= 10) return `PSA_${r}`;
  }
  return "NEAR_MINT";
}

/** Tier string from wallet IPFS metadata (same rules as collection `components`). */
export function poketraceHistoryTierFromRwaMetadata(
  metadata: { properties?: unknown } | null | undefined,
): string {
  const props = metadata?.properties as Record<string, unknown> | undefined;
  const graded = props?.graded as Record<string, unknown> | undefined;
  if (!graded || typeof graded !== "object") return "NEAR_MINT";
  const psa = graded.psa as { gradeScore?: number } | undefined;
  const grade = graded.grade as { score?: number } | undefined;
  const gradingCompany =
    typeof graded.gradingCompany === "string" && graded.gradingCompany.trim()
      ? String(graded.gradingCompany).trim()
      : psa != null
        ? "PSA"
        : undefined;
  const score =
    psa?.gradeScore ?? grade?.score;
  return poketraceHistoryTierFromComponents({
    gradingCompany,
    gradeScore: score != null && Number.isFinite(Number(score)) ? String(score) : undefined,
  });
}

/** Short label for chart legend / UI (e.g. `PSA_9` → "PSA 9"). */
export function poketraceTierDisplayLabel(tier: string): string {
  if (tier === "NEAR_MINT") return "Near Mint";
  const m = /^PSA_(\d+)$/.exec(String(tier).trim());
  if (m) return `PSA ${m[1]}`;
  return String(tier).replace(/_/g, " ");
}
