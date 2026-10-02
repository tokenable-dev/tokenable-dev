import type { ConfigService } from '@nestjs/config';
import { RWA_SETTLEMENT_POLICY, type RwaSettlementPolicy } from './rwa-settlement-policy';

/** Partner / self-vault marketplace fee — default 10% (1000 bps). */
export const SELF_VAULT_PLATFORM_FEE_BPS_DEFAULT = 1000;

export function readPlatformFeeBps(config: ConfigService): number {
  const raw = Number(config.get<string>('PLATFORM_FEE_BPS') ?? '500');
  if (!Number.isFinite(raw) || raw < 0) return 500;
  return Math.min(Math.floor(raw), 10_000);
}

export function readSelfVaultPlatformFeeBps(config: ConfigService): number {
  const raw = Number(
    config.get<string>('SELF_VAULT_PLATFORM_FEE_BPS') ??
      String(SELF_VAULT_PLATFORM_FEE_BPS_DEFAULT),
  );
  if (!Number.isFinite(raw) || raw < 0) {
    return SELF_VAULT_PLATFORM_FEE_BPS_DEFAULT;
  }
  return Math.min(Math.floor(raw), 10_000);
}

export function feeBpsForSettlementPolicy(
  config: ConfigService,
  policy: RwaSettlementPolicy | string | null | undefined,
): number {
  const p = String(policy ?? '').trim();
  if (p === RWA_SETTLEMENT_POLICY.SELF_VAULT_HOLD) {
    return readSelfVaultPlatformFeeBps(config);
  }
  return readPlatformFeeBps(config);
}

export function splitGrossUsdcMicros(
  grossMicros: bigint,
  feeBps: number,
): { sellerMicros: bigint; feeMicros: bigint } {
  const bps = BigInt(Math.max(0, Math.min(feeBps, 10_000)));
  const feeMicros = (grossMicros * bps) / BigInt(10_000);
  const sellerMicros = grossMicros - feeMicros;
  return { sellerMicros, feeMicros };
}
