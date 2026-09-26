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

export type RedeemShipToFields = {
  name?: string | null;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  region?: string | null;
  postal?: string | null;
  country?: string | null;
};

/** Normalized ship-to fingerprint — one partner shipment per batch + destination. */
export function redeemShipToFingerprint(shipTo: RedeemShipToFields): string {
  return [
    shipTo.name,
    shipTo.line1,
    shipTo.line2,
    shipTo.city,
    shipTo.region,
    shipTo.postal,
    shipTo.country,
  ]
    .map((v) => (v ?? '').trim().toLowerCase())
    .join('|');
}

/** Tracking write scope — never merge across batches or ship-to destinations. */
export function redeemTrackingGroupKey(input: {
  paymentBatchId: string | null;
  shipmentKey: string;
  shipTo: RedeemShipToFields;
}): string {
  const batch = input.paymentBatchId?.trim() ?? '';
  return `${batch}::${input.shipmentKey}::${redeemShipToFingerprint(input.shipTo)}`;
}

export const TERMINAL_REDEEM_STATUSES = new Set([
  'completed',
  'cancelled',
  'refunded',
  'failed',
]);

export function isActiveRedeemShipmentStatus(status: string): boolean {
  return !TERMINAL_REDEEM_STATUSES.has(status);
}

export function isPartnerRedeemShipmentKey(key: string): boolean {
  return key.startsWith('partner:');
}

export function partnerIdFromRedeemShipmentKey(key: string): string | null {
  if (!key.startsWith('partner:')) return null;
  const id = key.slice('partner:'.length).trim();
  return id && id !== 'unknown' ? id : null;
}
