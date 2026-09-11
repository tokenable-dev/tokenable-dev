/** Buyer-facing custody labels (match backend partner-vault-label.util). */
export const PSA_VAULT_LABEL = "PSA Vault";
export const TOKENABLE_VAULT_LABEL = "Tokenable Vault";

export type VaultCustodyPolicy = "standard" | "self_vault_hold";

export type VaultCustodyDisplay = {
  settlementPolicy?: VaultCustodyPolicy | null;
  vaultLabel?: string | null;
  known?: boolean;
};

/** Resolve label from API fields — never guess PSA when policy is unknown. */
export function vaultLabelFromPolicy(
  policy: VaultCustodyPolicy | null | undefined,
  explicitLabel?: string | null,
): string | null {
  const label = explicitLabel?.trim();
  if (label) return label;
  if (policy === "self_vault_hold") return TOKENABLE_VAULT_LABEL;
  if (policy === "standard") return PSA_VAULT_LABEL;
  return null;
}

export function formatVaultCustodyLabel(
  data: VaultCustodyDisplay | null | undefined,
): string | null {
  if (!data) return null;
  if (data.known === false) return null;
  return vaultLabelFromPolicy(data.settlementPolicy, data.vaultLabel);
}

/** Gallery / table chip: drop trailing " Vault" (PSA Vault → PSA, Tokenable Vault → Tokenable). */
export function shortVaultChipLabel(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  return s.replace(/\s+vault$/i, "").trim() || s;
}

export function vaultChipTone(shortLabel: string): "psa" | "partner" {
  return shortLabel.toUpperCase() === "PSA" ? "psa" : "partner";
}
