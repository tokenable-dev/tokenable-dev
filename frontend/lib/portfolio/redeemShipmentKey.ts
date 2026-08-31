/** Matches backend redeem-shipment-key.util / fee calculator grouping. */
export function redeemShipmentKey(input: {
  settlementPolicy?: string | null;
  vaultPartnerId?: string | null;
}): string {
  if (input.settlementPolicy === "self_vault_hold") {
    return `partner:${input.vaultPartnerId?.trim() || "unknown"}`;
  }
  return "psa_vault";
}

export function defaultVaultLabelForShipment(input: {
  shipmentKey: string;
  vaultLabel?: string | null;
}): string {
  const label = input.vaultLabel?.trim();
  if (label) return label;
  if (input.shipmentKey === "psa_vault") return "PSA Vault";
  return "TKB Vault";
}
