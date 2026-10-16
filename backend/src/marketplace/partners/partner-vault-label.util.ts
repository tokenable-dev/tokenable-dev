/**
 * Partner-internal / admin label (e.g. "ORP Vault").
 * Never use this on buyer-facing marketplace surfaces.
 */
export function formatPartnerVaultLabel(displayName: string | null | undefined): string {
  const n = String(displayName ?? '').trim();
  if (!n) return 'Self Vault';
  if (/vault$/i.test(n)) {
    return n.replace(/vault$/i, 'Vault');
  }
  return `${n} Vault`;
}

export const PSA_VAULT_LABEL = 'PSA Vault';

/** Buyer-facing self-vault / partner-custody chip (matches sell-flow "Tokenable Vault"). */
export const PUBLIC_SELF_VAULT_LABEL = 'Tokenable Vault';

export type VaultCustodyPolicy = 'standard' | 'self_vault_hold';

/** Public token custody chip — partner company name is admin-only. */
export function vaultLabelForCustody(
  settlementPolicy: VaultCustodyPolicy,
  _partnerDisplayName?: string | null,
): string {
  if (settlementPolicy === 'self_vault_hold') {
    return PUBLIC_SELF_VAULT_LABEL;
  }
  return PSA_VAULT_LABEL;
}
