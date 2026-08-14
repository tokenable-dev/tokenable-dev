/** UI label for partner self-vault custody (e.g. "Courtyard vault"). */
export function formatPartnerVaultLabel(displayName: string | null | undefined): string {
  const n = String(displayName ?? '').trim();
  if (!n) return 'Self vault';
  if (/vault$/i.test(n)) return n;
  return `${n} vault`;
}

export const PSA_VAULT_LABEL = 'PSA Vault';

export type VaultCustodyPolicy = 'standard' | 'self_vault_hold';

/** Token custody chip — never infer from seller partner status. */
export function vaultLabelForCustody(
  settlementPolicy: VaultCustodyPolicy,
  partnerDisplayName: string | null | undefined,
): string {
  if (settlementPolicy === 'self_vault_hold') {
    return formatPartnerVaultLabel(partnerDisplayName);
  }
  return PSA_VAULT_LABEL;
}
