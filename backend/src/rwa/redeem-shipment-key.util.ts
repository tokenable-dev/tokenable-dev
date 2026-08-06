/** Matches RedeemShippingFeeCalculator shipment grouping. */
export function redeemShipmentKey(input: {
  settlementPolicy?: string | null;
  vaultPartnerId?: string | null;
}): string {
  if (input.settlementPolicy === 'self_vault_hold') {
    return `partner:${input.vaultPartnerId?.trim() || 'unknown'}`;
  }
  return 'psa_vault';
}

export function isPartnerRedeemShipmentKey(key: string): boolean {
  return key.startsWith('partner:');
}

export function partnerIdFromRedeemShipmentKey(key: string): string | null {
  if (!key.startsWith('partner:')) return null;
  const id = key.slice('partner:'.length).trim();
  return id && id !== 'unknown' ? id : null;
}
