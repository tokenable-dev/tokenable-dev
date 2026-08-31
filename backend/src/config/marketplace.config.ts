import { registerAs } from '@nestjs/config';
import { readCardhedgerFeatureFlags } from './cardhedger-feature-flags.util';

export default registerAs('marketplace', () => {
  const adminUsername =
    process.env.MARKETPLACE_ADMIN_USERNAME?.trim() || 'skyand';
  const adminPassword =
    process.env.MARKETPLACE_ADMIN_PASSWORD?.trim() || '071725';
  const adminSessionSecret =
    process.env.MARKETPLACE_ADMIN_SESSION_SECRET?.trim() ||
    process.env.SITE_ACCESS_SECRET?.trim() ||
    '';
  const adminSessionSeconds = clampInt(
    process.env.MARKETPLACE_ADMIN_SESSION_SECONDS,
    28_800,
    300,
    86_400,
  );

  const activeOrdersMaxRaw = Number(
    process.env.MARKETPLACE_ACTIVE_ORDERS_MAX ?? '20000',
  );
  const activeOrdersMax =
    Number.isFinite(activeOrdersMaxRaw) && activeOrdersMaxRaw >= 1
      ? Math.min(Math.floor(activeOrdersMaxRaw), 50_000)
      : 20_000;

  const collectionActiveOrdersMax = clampInt(
    process.env.MARKETPLACE_COLLECTION_ACTIVE_ORDERS_MAX,
    2_000,
    1,
    10_000,
  );
  /** `0` = unlimited. Set `MARKETPLACE_MAX_ACTIVE_BIDS_PER_OFFERER=1` to restore the cap. */
  const maxActiveCollectionBidsPerOfferer = clampInt(
    process.env.MARKETPLACE_MAX_ACTIVE_BIDS_PER_OFFERER,
    0,
    0,
    20,
  );
  const platformTradesFulfilledScanMax = clampInt(
    process.env.MARKETPLACE_PLATFORM_TRADES_SCAN_MAX,
    500,
    80,
    5_000,
  );
  const marketStatsFulfilledScanMax = clampInt(
    process.env.MARKETPLACE_STATS_FULFILLED_SCAN_MAX,
    400,
    50,
    5_000,
  );
  const merkleSetCacheTtlMs = clampInt(
    process.env.MARKETPLACE_MERKLE_CACHE_TTL_MS,
    45_000,
    5_000,
    600_000,
  );
  const merkleScanConcurrency = clampInt(
    process.env.MARKETPLACE_MERKLE_SCAN_CONCURRENCY,
    4,
    1,
    16,
  );
  const merklePreferRegistry =
    process.env.MARKETPLACE_MERKLE_PREFER_REGISTRY !== '0' &&
    process.env.MARKETPLACE_MERKLE_PREFER_REGISTRY !== 'false';

  const cardhedgerMintPreviewConcurrency = clampInt(
    process.env.CARDHEDGER_MINT_PREVIEW_CONCURRENCY,
    4,
    1,
    16,
  );
  const cardhedgerMintPreviewUseCertBatch =
    process.env.CARDHEDGER_MINT_PREVIEW_CERT_BATCH !== '0' &&
    process.env.CARDHEDGER_MINT_PREVIEW_CERT_BATCH !== 'false';

  const cardhedgerFeatureFlags = readCardhedgerFeatureFlags(process.env);

  /** Phase 6 — per-resolve debug log for match-first A/B pilot (latency + path). */
  const cardhedgerResolveMatchFirstPilotLog =
    envTruthy(process.env.CARDHEDGER_RESOLVE_MATCH_FIRST_PILOT_LOG);

  return {
    adminUsername,
    adminPassword,
    adminSessionSecret,
    adminSessionSeconds,
    activeOrdersMax,
    collectionActiveOrdersMax,
    maxActiveCollectionBidsPerOfferer,
    platformTradesFulfilledScanMax,
    marketStatsFulfilledScanMax,
    merkleSetCacheTtlMs,
    merkleScanConcurrency,
    merklePreferRegistry,
    cardhedgerMintPreviewConcurrency,
    cardhedgerMintPreviewUseCertBatch,
    cardhedgerFeatureFlags,
    cardhedgerResolveMatchFirstPilotLog,
  };
});

function envTruthy(raw: string | undefined): boolean {
  const v = raw?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function clampInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = Number(raw ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}
