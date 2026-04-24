/**
 * PokeTrace `GET …/prices/{tier}/history` path segment from marketplace `components`
 * (IPFS / DB `gradingCompany` + `gradeScore`). PSA면 `PSA_{등급}`; 비PSA·무등급은 NEAR_MINT.
 */
export function poketraceHistoryTierFromComponents(
  components: Record<string, unknown> | null | undefined,
): string {
  if (!components) return 'NEAR_MINT';
  const grader = String(components['gradingCompany'] ?? '')
    .trim()
    .toUpperCase();
  const raw = components['gradeScore'];
  const score =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string'
        ? parseFloat(raw)
        : NaN;
  if (grader === 'PSA' && Number.isFinite(score)) {
    const r = Math.round(score);
    if (r >= 1 && r <= 10) return `PSA_${r}`;
  }
  return 'NEAR_MINT';
}
