/** On-chain Seaport settlement policy for an RWA token (stored on `rwa_tokens`). */
export const RWA_SETTLEMENT_POLICY = {
  STANDARD: 'standard',
  SELF_VAULT_HOLD: 'self_vault_hold',
} as const;

export type RwaSettlementPolicy =
  (typeof RWA_SETTLEMENT_POLICY)[keyof typeof RWA_SETTLEMENT_POLICY];

export function isSelfVaultHoldPolicy(
  policy: string | null | undefined,
): boolean {
  return String(policy ?? '').trim() === RWA_SETTLEMENT_POLICY.SELF_VAULT_HOLD;
}

export function normalizeRwaSettlementPolicy(
  raw: string | null | undefined,
): RwaSettlementPolicy {
  return isSelfVaultHoldPolicy(raw)
    ? RWA_SETTLEMENT_POLICY.SELF_VAULT_HOLD
    : RWA_SETTLEMENT_POLICY.STANDARD;
}
