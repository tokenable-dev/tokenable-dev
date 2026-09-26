import {
  isSelfVaultHoldPolicy,
  normalizeRwaSettlementPolicy,
  RWA_SETTLEMENT_POLICY,
} from './rwa-settlement-policy';

describe('rwa-settlement-policy', () => {
  it('normalizes self_vault_hold', () => {
    expect(isSelfVaultHoldPolicy('self_vault_hold')).toBe(true);
    expect(normalizeRwaSettlementPolicy('self_vault_hold')).toBe(
      RWA_SETTLEMENT_POLICY.SELF_VAULT_HOLD,
    );
    expect(normalizeRwaSettlementPolicy(null)).toBe(
      RWA_SETTLEMENT_POLICY.STANDARD,
    );
  });
});
