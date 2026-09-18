import {
  marketHistoryTierFromPsaGradeInput,
  psaGradePolicyInputFromComponents,
} from './psa-grade-policy.util';

/**
 * Cardhedger history tier from marketplace `components`.
 * PSA numeric slabs → PSA_1 … PSA_10; PSA AUTH / no numeric grade → PSA_AUTH.
 */
export function marketHistoryTierFromComponents(
  components: Record<string, unknown> | null | undefined,
): string {
  return marketHistoryTierFromPsaGradeInput(
    psaGradePolicyInputFromComponents(components),
  );
}
