/**
 * Cardhedger history tier from marketplace `components`.
 * Platform policy: only PSA 10 is supported for market reference.
 */
export function marketHistoryTierFromComponents(
  components: Record<string, unknown> | null | undefined,
): string {
  if (!components) return 'PSA_10';
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
  if (grader === 'PSA' && Number.isFinite(score) && Math.round(score) === 10) {
    return 'PSA_10';
  }
  return 'PSA_10';
}
