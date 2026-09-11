/** Thin carrier Rate abstraction — Partner Self vault only (PSA uses fixed schedule). */
import type { RedeemCountry } from '../redeem-fee.types';

export type ShippingRateAddress = {
  companyName?: string;
  contactName?: string;
  phone?: string;
  /** ISO-3166 alpha-2 — required for live FedEx Rate. */
  country: string;
  city: string;
  region: string | null;
  postal: string;
  line1: string;
  line2?: string | null;
  residential: boolean;
};

export type ShippingRateQuoteInput = {
  origin: ShippingRateAddress;
  destination: ShippingRateAddress;
  /** Redeem fee-schedule country bucket (us|ca|intl). Live FedEx uses destination.country ISO. */
  destinationBucket: RedeemCountry;
  packageCount: number;
};

export type ShippingRateQuote = {
  shippingUsd: number;
  carrier: 'fedex';
  serviceType: string | null;
  quoteId: string | null;
  /** ACCOUNT preferred over LIST when FedEx returns both. */
  rateType: 'ACCOUNT' | 'LIST' | null;
  source: 'fedex_rate' | 'fedex_stub';
  /** ISO-8601 — quote validity for UI display (default 15m). */
  expiresAt: string;
};

export interface ShippingRateClient {
  readonly carrier: ShippingRateQuote['carrier'];
  quote(input: ShippingRateQuoteInput): Promise<ShippingRateQuote>;
}
