import { registerAs } from '@nestjs/config';

export const DEFAULT_MARKETPLACE_ADMIN_WALLET =
  '0xd5abdd307414718c59949ac5465930a1f8a52691';

export default registerAs('marketplace', () => {
  const adminRaw =
    process.env.MARKETPLACE_ADMIN_WALLETS?.trim() ||
    DEFAULT_MARKETPLACE_ADMIN_WALLET;
  const adminWallets = adminRaw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^0x[a-f0-9]{40}$/.test(s));

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
  const maxActiveCollectionBidsPerOfferer = clampInt(
    process.env.MARKETPLACE_MAX_ACTIVE_BIDS_PER_OFFERER,
    3,
    1,
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

  return {
    adminWallets,
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
  };
});

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
