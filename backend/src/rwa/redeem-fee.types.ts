export type RedeemCountry = 'us' | 'ca' | 'intl';

export type RedeemShippingProvider = 'psa_vault' | 'partner';

export type RedeemCardFeeLine = {
  tokenId: number;
  vaultedAt: string | null;
  earlyWithdrawal: boolean;
  retrievalUsd: number;
  earlyWithdrawalUsd: number;
  shippingUsd: number;
  totalUsd: number;
  /** Which shipment this card rolls into */
  shipmentKey: string;
};

export type RedeemShipmentEstimate = {
  key: string;
  provider: RedeemShippingProvider;
  vaultPartnerId: string | null;
  vaultLabel: string;
  cardCount: number;
  shippingUsd: number;
  retrievalFeeTotalUsd: number;
  earlyWithdrawalFeeTotalUsd: number;
  totalUsd: number;
  shippingSource: 'psa_published' | 'fedex_stub' | 'fedex_rate';
  /** Partner FedEx quote metadata — omitted for PSA published schedule. */
  shippingServiceType?: string | null;
  shippingRateType?: 'ACCOUNT' | 'LIST' | null;
  shippingQuoteExpiresAt?: string | null;
  shippingDestinationCountry?: string | null;
  cards: RedeemCardFeeLine[];
};

export type RedeemEstimate = {
  currency: 'USD';
  country: RedeemCountry;
  cardCount: number;
  /** Sum of per-shipment shipping */
  shippingUsd: number;
  retrievalFeePerCardUsd: number;
  earlyWithdrawalFeePerCardUsd: number;
  earlyWithdrawalDays: number;
  earlyWithdrawalCardCount: number;
  retrievalFeeTotalUsd: number;
  earlyWithdrawalFeeTotalUsd: number;
  /** @deprecated use retrieval + early; kept for older FE lines */
  withdrawFeePerCardUsd: number;
  withdrawFeeTotalUsd: number;
  totalUsd: number;
  totalUsdcMicros: string;
  payToAddress: string | null;
  cards: RedeemCardFeeLine[];
  /** One row per physical shipment (PSA package and/or each Partner Origin) */
  shipments: RedeemShipmentEstimate[];
  source: string;
  ageBasis: 'deposited_at' | 'unknown_assume_early';
  /**
   * Earliest Partner FedEx quote expiry in this estimate (ISO-8601).
   * Null when no live/stub FedEx quote was used (PSA-only).
   */
  shippingQuoteExpiresAt?: string | null;
};

export function roundUsd(n: number): number {
  return Math.round(n * 100) / 100;
}

export function usdToUsdcMicros(usd: number): bigint {
  return BigInt(Math.round(roundUsd(usd) * 1_000_000));
}
