import { ConfigService } from '@nestjs/config';
import type { RedeemCountry } from './redeem-fee.types';
import { roundUsd } from './redeem-fee.types';

const DEFAULT_SHIPPING_USD = {
  us: 5.99,
  ca: 24.99,
  intl: 31.99,
} as const;

const DEFAULT_RETRIEVAL_FEE_USD = 1.99;
const DEFAULT_EARLY_FEE_USD = 4.99;
const DEFAULT_EARLY_DAYS = 90;
const DEFAULT_MAX_ITEMS = 50;

function envNum(
  config: ConfigService,
  key: string,
  fallback: number,
): number {
  const raw = config.get<string>(key);
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export type PsaVaultFeeConfig = {
  shipping: { us: number; ca: number; intl: number };
  retrievalUsd: number;
  earlyUsd: number;
  earlyDays: number;
  maxItems: number;
};

/** PSA Vault published fee schedule (env-overridable). */
export function loadPsaVaultFeeConfig(config: ConfigService): PsaVaultFeeConfig {
  const legacy = config.get<string>('PSA_VAULT_WITHDRAW_FEE_USD');
  const retrievalRaw = config.get<string>('PSA_VAULT_RETRIEVAL_FEE_USD');
  let retrieval = DEFAULT_RETRIEVAL_FEE_USD;
  if (retrievalRaw != null && retrievalRaw !== '') {
    retrieval = envNum(config, 'PSA_VAULT_RETRIEVAL_FEE_USD', DEFAULT_RETRIEVAL_FEE_USD);
  } else if (legacy != null && legacy !== '' && Number(legacy) === 1.99) {
    retrieval = 1.99;
  }

  return {
    shipping: {
      us: envNum(config, 'PSA_VAULT_SHIPPING_US_USD', DEFAULT_SHIPPING_USD.us),
      ca: envNum(config, 'PSA_VAULT_SHIPPING_CA_USD', DEFAULT_SHIPPING_USD.ca),
      intl: envNum(config, 'PSA_VAULT_SHIPPING_INTL_USD', DEFAULT_SHIPPING_USD.intl),
    },
    retrievalUsd: retrieval,
    earlyUsd: envNum(
      config,
      'PSA_VAULT_EARLY_WITHDRAWAL_FEE_USD',
      DEFAULT_EARLY_FEE_USD,
    ),
    earlyDays: Math.floor(
      envNum(config, 'PSA_VAULT_EARLY_WITHDRAWAL_DAYS', DEFAULT_EARLY_DAYS),
    ),
    maxItems: Math.floor(
      envNum(config, 'PSA_VAULT_MAX_ITEMS_PER_SHIPMENT', DEFAULT_MAX_ITEMS),
    ),
  };
}

export function isPsaEarlyWithdrawal(
  depositedAt: Date | null | undefined,
  earlyDays: number,
  now = new Date(),
): boolean {
  if (!depositedAt) return true;
  const ms = now.getTime() - depositedAt.getTime();
  return ms < earlyDays * 24 * 60 * 60 * 1000;
}

export function psaShippingUsd(
  cfg: PsaVaultFeeConfig,
  country: RedeemCountry,
): number {
  return cfg.shipping[country];
}

export function psaCardFees(params: {
  cfg: PsaVaultFeeConfig;
  country: RedeemCountry;
  vaultedAt: Date | null;
  isFirstInShipment: boolean;
}): {
  earlyWithdrawal: boolean;
  retrievalUsd: number;
  earlyWithdrawalUsd: number;
  shippingUsd: number;
  totalUsd: number;
} {
  const early = isPsaEarlyWithdrawal(params.vaultedAt, params.cfg.earlyDays);
  const retrievalUsd = params.cfg.retrievalUsd;
  const earlyWithdrawalUsd = early ? params.cfg.earlyUsd : 0;
  const shippingUsd = params.isFirstInShipment
    ? psaShippingUsd(params.cfg, params.country)
    : 0;
  return {
    earlyWithdrawal: early,
    retrievalUsd,
    earlyWithdrawalUsd,
    shippingUsd,
    totalUsd: roundUsd(retrievalUsd + earlyWithdrawalUsd + shippingUsd),
  };
}
