import { backendFetch, getApiUrl } from "./client";

export interface CollectionUsdPoint {
  t: number;
  v: number;
}

export interface CollectionGradePrices {
  psa10: number | null;
  psa9: number | null;
  raw: number | null;
}

/** One Cardhedger grade slot (PSA, BGS, SGC, …) for collection chart picker. */
export interface CollectionGradeCatalogEntry {
  grade: string;
  priceUsd: number | null;
  grader: string | null;
  displayOrder: number;
}

/** Full dual-series bundle for collection detail chart */
export interface CollectionMarketSeries {
  collectionKey: string;
  categoryLabel: string | null;
  marketChangePct: number | null;
  /** Present when served by a recent backend (exchange list uses same bundle fields) */
  marketChangeWindow?: "7d" | "30d" | "90d" | "180d" | "365d" | "24h";
  marketChangeIsFullYear?: boolean;
  marketChangeSpanSec?: number;
  marketChangeRefUsd?: number | null;
  marketChangeRefAtSec?: number | null;
  marketChangeSource?:
    | "cardhedger_nm"
    | "cardhedger_graded"
    | "none"
    | null;
  gradePrices: CollectionGradePrices;
  /** Materialized snapshot spot basis (`psa_estimate` when Cardhedger is unmatched). */
  spotPriceBasis?: string | null;
  /** All graders/grades from Cardhedger catalog (snapshot or live). */
  allGradePrices?: CollectionGradeCatalogEntry[];
  /** This collection slab grade label (e.g. PSA 8). */
  collectionGrade?: string | null;
  historyTier?: string | null;
  externalUsd: CollectionUsdPoint[];
  platformUsd: CollectionUsdPoint[];
  /**
   * Same Cardhedger preview as used for {@link gradePrices} / chart merge (avoid a second
   * `GET …/cardhedger` for collection detail).
   */
  cardhedgerPreview?: CollectionMarketPreview;
  /** Additive — materialized snapshot freshness (when served from DB). */
  snapshotStale?: boolean;
  syncedAt?: string;
  reliabilityScore?: number;
}

/** Cardhedger-backed market series — `priceHistoryDuration` caps external reference history in `externalUsd`. */
export async function getCollectionMarketSeries(
  collectionKey: string,
  priceHistoryDuration:
    | "7d"
    | "30d"
    | "90d"
    | "180d"
    | "365d"
    | "max" = "30d",
): Promise<CollectionMarketSeries> {
  const enc = encodeURIComponent(collectionKey);
  const sp = new URLSearchParams();
  sp.set("priceHistoryDuration", priceHistoryDuration);
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/collections/${enc}/market-series?${sp.toString()}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? "Failed to load market series"
    );
  }
  return res.json() as Promise<CollectionMarketSeries>;
}

export interface CollectionGradeCatalogResponse {
  collectionKey: string;
  cardhedgerCardId: string | null;
  collectionGrade: string | null;
  historyTier: string | null;
  grades: CollectionGradeCatalogEntry[];
  source: "snapshot" | "live";
}

export interface CollectionGradePriceSeries {
  collectionKey: string;
  grade: string;
  cardhedgerCardId: string | null;
  points: CollectionUsdPoint[];
  days: number;
}

export async function getCollectionGradeCatalog(
  collectionKey: string,
  opts?: { live?: boolean; signal?: AbortSignal },
): Promise<CollectionGradeCatalogResponse> {
  const enc = encodeURIComponent(collectionKey);
  const sp = new URLSearchParams();
  if (opts?.live) sp.set("live", "1");
  const qs = sp.toString();
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/collections/${enc}/grade-catalog${qs ? `?${qs}` : ""}`,
    { signal: opts?.signal },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? "Failed to load grade catalog",
    );
  }
  return res.json() as Promise<CollectionGradeCatalogResponse>;
}

export async function getCollectionGradePriceSeries(
  collectionKey: string,
  grade: string,
  days = 365,
  opts?: { signal?: AbortSignal },
): Promise<CollectionGradePriceSeries> {
  const enc = encodeURIComponent(collectionKey);
  const sp = new URLSearchParams();
  sp.set("grade", grade);
  sp.set("days", String(days));
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/collections/${enc}/grade-series?${sp.toString()}`,
    { signal: opts?.signal },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? "Failed to load grade price series",
    );
  }
  return res.json() as Promise<CollectionGradePriceSeries>;
}

/** Listing-pool statistics for a collection (same contract as GET …/collections/:key/stats). */
export interface CollectionMarketStats {
  collectionKey: string;
  floor: number | null;
  median: number | null;
  p25: number | null;
  p75: number | null;
  band: { low: number | null; high: number | null };
  volatility: number | null;
  sampleSize: number;
  isReliable: boolean;
  dataQuality: {
    sampleSize: number;
    trimmed: boolean;
    currency: "USDC";
  };
  sources: { listings: boolean; trades?: boolean };
  reference?: { cardhedgerCardId: string | null };
}

export interface MarketPriceBand {
  avg: number | null;
  low: number | null;
  high: number | null;
  lastUpdated: string | null;
  saleCount: number | null;
  approxSaleCount: boolean | null;
  avg1d?: number | null;
  avg7d?: number | null;
  avg30d?: number | null;
  median3d?: number | null;
  median7d?: number | null;
  median30d?: number | null;
}

export interface CollectionMarketPreview {
  enabled: boolean;
  searchQuery: string;
  matched: boolean;
  message?: string;
  /** Strict verified catalog id vs relaxed approximate reference (charts / NM). */
  matchConfidence?: "verified" | "approximate";
  card: null | {
    id: string;
    name: string;
    cardNumber: string;
    setName: string;
    variant?: string | null;
    setType?: string | null;
    category?: string | null;
    categoryGroup?: string | null;
    setSlug: string | null;
    image: string | null;
    tcgplayerId: string | null;
    currency: string | null;
    market: string | null;
    lastUpdated: string | null;
    topPrice: number | null;
    totalSaleCount: number | null;
    hasGraded: boolean;
    gradedTiersAvailable: string[];
    pricesByGrade?: Record<string, number>;
    sales7d?: number | null;
    sales30d?: number | null;
    gainPct7d?: number | null;
    gainPct30d?: number | null;
    priceReliability?: "high" | "low";
    pricingSuppressedReason?: string | null;
    /** Backend: comps vs history point vs catalog PSA 10 slot. */
    spotPriceBasis?: "comps" | "latest_sale" | "sparse_sale_avg" | "catalog" | "comps_median" | "psa_estimate" | null;
    /** Unix seconds — comps newest sale or history observation when applicable. */
    latestSaleAt?: number | null;
    ebayNearMint: MarketPriceBand | null;
    tcgplayerNearMint: MarketPriceBand | null;
    ebayPsa10?: MarketPriceBand | null;
    ebayPsa9?: MarketPriceBand | null;
    /** eBay PSA tier bands keyed as `PSA_1` … `PSA_10` when upstream sends them */
    ebayPsaTiers?: Record<string, MarketPriceBand | null>;
  };
  /** Additive — snapshot served from materialized store */
  snapshotStale?: boolean;
  syncedAt?: string;
  reliabilityScore?: number;
}

/** Matches `MintPreviewsByTokenIdsDto` `@ArrayMaxSize(32)` in the Nest controller. */
const MINT_MARKET_PREVIEW_MAX_BATCH = 32;

/** Cardhedger batch — 서버가 tokenId별 메타데이터를 조회 (요청은 id 목록만) */
export async function postBatchMintMarketPreviews(
  tokenIds: number[],
): Promise<Record<number, CollectionMarketPreview>> {
  const unique = [...new Set(tokenIds.map((n) => Math.floor(Number(n))))].filter(
    (n) => Number.isFinite(n) && n >= 0,
  );
  const out: Record<number, CollectionMarketPreview> = {};

  for (let i = 0; i < unique.length; i += MINT_MARKET_PREVIEW_MAX_BATCH) {
    const chunk = unique.slice(i, i + MINT_MARKET_PREVIEW_MAX_BATCH);
    const res = await backendFetch(`${getApiUrl()}/marketplace/cardhedger/mint-previews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokenIds: chunk }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        (err as { message?: string }).message ?? "Failed to load Cardhedger mint previews",
      );
    }
    const raw = (await res.json()) as Record<string, CollectionMarketPreview>;
    for (const [k, v] of Object.entries(raw)) {
      const id = Number(k);
      if (Number.isFinite(id)) out[id] = v;
    }
  }

  return out;
}

export type CollectionTapeFillSource = "platform" | "cardhedger";

/** Trades tape row — platform fills and/or Cardhedger comps. */
export interface CollectionPlatformTapeFill {
  t: number;
  priceUsdc: number;
  tokenId: string;
  orderHash: string;
  /** buy = instant take of listing; sell = matched listing to collection bid. */
  tapeAggressor?: "buy" | "sell";
  source?: CollectionTapeFillSource;
  /** Cardhedger comps sale_type (Auction, Best Offer, …) — not buy/sell aggressor. */
  externalSaleType?: string | null;
  /** Inferred marketplace (e.g. eBay) from Cardhedger sale_url / price_source. */
  externalSalePlatform?: string | null;
  /** Cardhedger comps sale_url — sold listing link when available. */
  externalSaleUrl?: string | null;
}

export interface TradesVolumeWindowStats {
  notionalUsdc: number;
  tradeCount: number;
  platformCount: number;
  cardhedgerCount: number;
}

export interface CollectionTradesVolumeStats {
  windows: {
    "7d": TradesVolumeWindowStats;
    "30d": TradesVolumeWindowStats;
    "90d": TradesVolumeWindowStats;
    "180d": TradesVolumeWindowStats;
    "365d": TradesVolumeWindowStats;
  };
  total: TradesVolumeWindowStats;
}

/** Platform chart points + merged trades tape + volume stats. */
export async function getCollectionPlatformTrades(
  collectionKey: string,
  opts?: { bootstrapTokenId?: number; grade?: string },
): Promise<{
  platformUsd: CollectionUsdPoint[];
  trades: CollectionPlatformTapeFill[];
  volume: CollectionTradesVolumeStats;
}> {
  const enc = encodeURIComponent(collectionKey);
  const qs = new URLSearchParams();
  if (opts?.bootstrapTokenId != null && Number.isFinite(opts.bootstrapTokenId)) {
    qs.set("bootstrapTokenId", String(Math.floor(opts.bootstrapTokenId)));
  }
  const grade = opts?.grade?.trim();
  if (grade) qs.set("grade", grade);
  const query = qs.toString();
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/collections/${enc}/platform-trades${query ? `?${query}` : ""}`,
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? "Failed to load platform trades"
    );
  }
  return res.json() as Promise<{
    platformUsd: CollectionUsdPoint[];
    trades: CollectionPlatformTapeFill[];
    volume: CollectionTradesVolumeStats;
  }>;
}

export interface CollectionListMarketSnapshot {
  collectionKey: string;
  categoryLabel: string | null;
  marketChangePct: number | null;
  /** Window label for bundle metadata */
  marketChangeWindow?: "7d" | "30d" | "90d" | "180d" | "365d" | "24h";
  marketChangeIsFullYear?: boolean;
  marketChangeSpanSec?: number;
  marketChangeRefUsd?: number | null;
  marketChangeRefAtSec?: number | null;
  marketChangeSource?:
    | "cardhedger_nm"
    | "cardhedger_graded"
    | "none"
    | null;
  gradePrices: CollectionGradePrices;
  spotPriceBasis?: string | null;
  sparklineUsd: CollectionUsdPoint[];
  /** Pool stats (listing-derived); same contract as collection stats endpoint */
  marketStats?: CollectionMarketStats | null;
  /** Most recent fulfilled listing price (USDC) on Tokenable — list batch snapshots */
  lastTokenableTradeUsdc?: number | null;
  /** Unix seconds for {@link lastTokenableTradeUsdc} */
  lastTokenableTradeAtSec?: number | null;
  /** Additive — materialized snapshot metadata */
  snapshotStale?: boolean;
  syncedAt?: string;
  reliabilityScore?: number;
}

/** Must match backend `BatchMarketSnapshotsDto` @ArrayMaxSize */
export const MARKETPLACE_COLLECTION_SNAPSHOTS_MAX_KEYS = 60;

export async function postMarketplaceCollectionSnapshots(body: {
  collectionKeys: string[];
  priceHistoryDuration?: "7d" | "30d" | "90d" | "180d" | "365d" | "max";
}): Promise<{ items: CollectionListMarketSnapshot[] }> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/collections/market-snapshots`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? "Failed to load collection snapshots"
    );
  }
  return res.json() as Promise<{ items: CollectionListMarketSnapshot[] }>;
}

/**
 * Fetches market snapshots for any number of keys by chunking POST bodies
 * (backend validates max {@link MARKETPLACE_COLLECTION_SNAPSHOTS_MAX_KEYS} per request).
 */
export async function postMarketplaceCollectionSnapshotsBatched(
  collectionKeys: string[],
  priceHistoryDuration: "7d" | "30d" | "90d" | "180d" | "365d" | "max" = "max",
): Promise<{ items: CollectionListMarketSnapshot[] }> {
  const max = MARKETPLACE_COLLECTION_SNAPSHOTS_MAX_KEYS;
  if (collectionKeys.length === 0) return { items: [] };
  const items: CollectionListMarketSnapshot[] = [];
  for (let i = 0; i < collectionKeys.length; i += max) {
    const chunk = collectionKeys.slice(i, i + max);
    const pack = await postMarketplaceCollectionSnapshots({
      collectionKeys: chunk,
      priceHistoryDuration,
    });
    items.push(...pack.items);
  }
  return { items };
}
