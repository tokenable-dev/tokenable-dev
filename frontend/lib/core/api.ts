/**
 * EC2+Nginx: leave NEXT_PUBLIC_API_URL unset so the browser uses
 * `window.location.origin + '/api'` (IP, http/https domain; avoids mixed content).
 * Set NEXT_PUBLIC_API_URL only when the API is on a different host.
 * Server/SSR: INTERNAL_API_URL or direct backend URL.
 */
export function getApiUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api`;
  }
  return (
    process.env.INTERNAL_API_URL?.replace(/\/$/, "") ?? "http://localhost:4000/api"
  );
}
 
function backendFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, credentials: "include" });
}

// ─── RWA metadata upload (IPFS) ────────────────────────────────────────────────

export interface UploadRwaResult {
  tokenURI: string;
  imageURI: string;
  metadataCID: string;
}

export async function uploadRwaMetadata(formData: FormData): Promise<UploadRwaResult> {
  const res = await backendFetch(`${getApiUrl()}/rwa/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Upload failed" }));
    throw new Error((error as { message: string }).message ?? "Asset upload failed");
  }
  return res.json() as Promise<UploadRwaResult>;
}

// ─── PSA slab OCR + official PSA metadata ─────────────────────────────────────

export type PsaPublicApiLookup =
  | { status: "disabled"; reason: "no_token" }
  | { status: "skipped"; reason: "no_cert" | "invalid_cert" }
  | { status: "success"; certNumber: string; raw: unknown }
  | {
      status: "error";
      certNumber: string;
      message: string;
      httpStatus?: number;
    };

export interface PsaAnalyzeResult {
  ocr: {
    combinedText: string;
    frontText?: string;
    backText?: string;
  };
  psa: {
    certNumber?: string;
    gradeLabel?: string;
    gradeScore?: number;
    gradeDescription?: string;
    year?: string;
    cardNameHint?: string;
    cardNumberHint?: string;
    setHint?: string;
    certVerifyUrl?: string;
    labelType?: string;
    category?: string;
    autographGrade?: string;
    totalPopulation?: number;
    populationHigher?: number;
    totalPopulationWithQualifier?: number;
    reverseBarcode?: boolean;
    specId?: number;
    /** PSA Public API — PSACert.Variety (parallel / insert line) */
    varietyHint?: string;
    /** PSA Public API PSACert 병합 여부 */
    enrichedFromOfficialApi?: boolean;
  };
  psaApi: {
    lookup: PsaPublicApiLookup;
  };
  /** Cardhedger catalog id — persist as graded.cardhedger on mint */
  cardhedgerMint?: {
    matchConfidence: "verified" | "approximate";
    cardId?: string;
    searchQuery?: string;
    imageUrl?: string;
  };
  /** PSA cert-images 등 — 앞면 URL은 민팅 시 imageUrl로 쓸 수 있음 */
  psaCertImages?: { front?: string; back?: string };
}

/** 슬랩 앞면 필수 — OCR 후 PSA 공식 메타 병합 */
export async function analyzePsaSlab(
  slabFront: File,
  slabBack?: File | null,
  /** OCR이 Cert를 못 읽을 때: 숫자 또는 psacard.com/cert/… URL (PSA API 조회 우선) */
  certHint?: string
): Promise<PsaAnalyzeResult> {
  const fd = new FormData();
  fd.append("slabFront", slabFront);
  if (slabBack) fd.append("slabBack", slabBack);
  if (certHint?.trim()) fd.append("certNumber", certHint.trim());
  const res = await backendFetch(`${getApiUrl()}/psa/analyze`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "PSA analyze failed" }));
    throw new Error(
      (err as { message?: string }).message ?? "PSA analyze failed"
    );
  }
  return res.json() as Promise<PsaAnalyzeResult>;
}

/** 슬랩 사진 없이 Cert 번호(또는 psacard.com/cert/ URL)만으로 PSA 조회 */
export async function analyzePsaByCertNumber(
  certNumberOrUrl: string
): Promise<PsaAnalyzeResult> {
  const res = await backendFetch(`${getApiUrl()}/psa/analyze-by-cert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ certNumber: certNumberOrUrl.trim() }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "PSA cert lookup failed" }));
    throw new Error(
      (err as { message?: string }).message ?? "PSA cert lookup failed"
    );
  }
  return res.json() as Promise<PsaAnalyzeResult>;
}

// ─── Blockchain — RWA (ERC-721) ───────────────────────────────────────────────

export async function getRwaTokensByOwner(address: string): Promise<number[]> {
  const res = await backendFetch(`${getApiUrl()}/blockchain/rwa/tokens/${address}`);
  if (!res.ok) throw new Error("Failed to fetch owned assets");
  return res.json() as Promise<number[]>;
}

/** 서버에서 tokenURI + metadata JSON + 브라우저용 imageUrl(https)까지 일괄 처리 (클라이언트는 IPFS에 직접 접속하지 않음) */
export async function postRwaMetadataBatch(body: {
  tokenIds: number[];
}): Promise<{
  items: Array<{
    tokenId: number;
    tokenURI: string | null;
    metadata: RwaMetadata | null;
    imageUrl: string | null;
  }>;
}> {
  const res = await backendFetch(`${getApiUrl()}/blockchain/rwa/metadata/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to batch-load RWA metadata");
  return res.json() as Promise<{
    items: Array<{
      tokenId: number;
      tokenURI: string | null;
      metadata: RwaMetadata | null;
      imageUrl: string | null;
    }>;
  }>;
}

export type ResolvedRwaAsset = {
  tokenId: number;
  tokenURI: string;
  metadata: RwaMetadata | null;
  imageUrl: string | null;
};

/** 단일 토큰: tokenURI → metadata → imageUrl 전부 서버 게이트웨이·캐시 */
export async function getResolvedRwaAsset(tokenId: number): Promise<ResolvedRwaAsset> {
  const res = await backendFetch(`${getApiUrl()}/blockchain/rwa/asset/${tokenId}`);
  if (res.status === 404) {
    return { tokenId, tokenURI: "", metadata: null, imageUrl: null };
  }
  if (!res.ok) throw new Error("Failed to load resolved RWA asset");
  return res.json() as Promise<ResolvedRwaAsset>;
}

/** 컬렉션 커버 등 임의 URI → 서버가 선택한 https URL (게이트웨이 폴백) */
export async function postResolveMediaUrls(uris: string[]): Promise<{
  items: Array<{ uri: string; httpsUrl: string | null }>;
}> {
  const res = await backendFetch(`${getApiUrl()}/blockchain/media/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uris }),
  });
  if (!res.ok) throw new Error("Failed to resolve media URLs");
  return res.json() as Promise<{ items: Array<{ uri: string; httpsUrl: string | null }> }>;
}

// ─── Marketplace Orders (오프체인 Seaport 주문) ───────────────────────────────

export type OrderStatus = "active" | "fulfilled" | "cancelled" | "expired";

export interface SeaportOfferItem {
  itemType: number;
  token: string;
  identifierOrCriteria: string;
  startAmount: string;
  endAmount: string;
}

export interface SeaportConsiderationItem {
  itemType: number;
  token: string;
  identifierOrCriteria: string;
  startAmount: string;
  endAmount: string;
  recipient: string;
}

export interface SeaportOrderParameters {
  offerer: string;
  zone: string;
  zoneHash: string;
  startTime: string;
  endTime: string;
  orderType: number;
  offer: SeaportOfferItem[];
  consideration: SeaportConsiderationItem[];
  totalOriginalConsiderationItems: number;
  salt: string;
  conduitKey: string;
  counter: string;
}

export interface Order {
  id: number;
  orderHash: string;
  offerer: string;
  /** ask = 매도 리스팅, bid = 매수 입찰 (없으면 레거시 ask로 간주) */
  side?: "ask" | "bid";
  /** graded 메타 기준 컬렉션 (매도 ask) */
  collectionKey?: string | null;
  tokenContract: string;
  tokenId: string;
  considerationToken: string;
  considerationAmount: string;
  parameters: SeaportOrderParameters;
  signature: string;
  status: OrderStatus;
  startTime: string;
  endTime: string;
  createdAt: string;
  /** 마지막 갱신(판매·취소 등). 없으면 createdAt으로 정렬 */
  updatedAt?: string;
}

/** `GET /marketplace/orders` — no Seaport parameters / signature */
export interface OrderListItem {
  id: number;
  orderHash: string;
  tokenId: string;
  collectionKey: string | null;
  /** USDC micros (same as DB consideration_amount) */
  price: string;
  side: "ask" | "bid";
  status: OrderStatus;
  createdAt: string;
  updatedAt?: string;
  offerer: string;
  considerationRecipients: string[];
}

export interface CreateOrderPayload {
  parameters: SeaportOrderParameters;
  signature: string;
  tokenContract: string;
  tokenId: string;
  considerationToken: string;
  considerationAmount: string;
  /** ask = listing, bid = buy (FULL ERC721 or ERC721_WITH_CRITERIA) */
  side?: "ask" | "bid";
  /** Required for criteria (collection) bids */
  collectionKey?: string;
}

/** 활성 매도(ask) 주문 — 경량 리스트 */
export async function getActiveOrders(): Promise<OrderListItem[]> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/orders`);
  if (!res.ok) throw new Error("Failed to fetch orders");
  const raw = (await res.json()) as OrderListItem[];
  return raw.map((o) => ({
    ...o,
    considerationRecipients: Array.isArray(o.considerationRecipients)
      ? o.considerationRecipients
      : [],
  }));
}

/** 단일 토큰의 활성 ask (Seaport parameters 포함 — fulfill UI용) */
export async function getActiveOrderForToken(
  tokenId: number,
  opts?: { signal?: AbortSignal },
): Promise<Order | null> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/orders/token/${encodeURIComponent(String(tokenId))}?activeOnly=true`,
    { signal: opts?.signal },
  );
  if (!res.ok) throw new Error("Failed to fetch order for token");
  /** Nest often responds with 204 or empty body when there is no active ask — avoid `res.json()` on empty. */
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text.trim()) return null;
  const j: unknown = JSON.parse(text) as unknown;
  if (j == null) return null;
  return j as Order;
}

/** 여러 tokenId의 주문 이력을 한 번에 (경량 행) */
export async function postOrdersBatchByToken(tokenIds: number[]): Promise<
  Record<string, OrderListItem[]>
> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/orders/batch-by-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tokenIds }),
  });
  if (!res.ok) throw new Error("Failed to fetch order batch");
  return res.json() as Promise<Record<string, OrderListItem[]>>;
}

export interface MarketplaceCollectionSummary {
  collectionKey: string;
  displayLabel: string;
  queryUsed: string | null;
  components: Record<string, unknown>;
  createdAt: string;
  activeListingCount: number;
  /** Collection representative image (card art/cert source); may be null. */
  coverImageUrl?: string | null;
}

/** Graded metadata-based collection summaries (cursor pagination). */
export async function getMarketplaceCollectionsPage(opts?: {
  cursor?: string | null;
  limit?: number;
}): Promise<{
  items: MarketplaceCollectionSummary[];
  nextCursor: string | null;
}> {
  const sp = new URLSearchParams();
  if (opts?.cursor) sp.set("cursor", opts.cursor);
  if (opts?.limit != null) sp.set("limit", String(opts.limit));
  const q = sp.toString();
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/collections${q ? `?${q}` : ""}`,
  );
  if (!res.ok) throw new Error("Failed to fetch collections");
  return res.json() as Promise<{
    items: MarketplaceCollectionSummary[];
    nextCursor: string | null;
  }>;
}

/** orderHash로 단건 조회 */
export async function getOrderByHash(
  orderHash: string,
  opts?: { signal?: AbortSignal },
): Promise<Order> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/orders/${orderHash}`, {
    signal: opts?.signal,
  });
  if (!res.ok) throw new Error("Failed to fetch order");
  return res.json() as Promise<Order>;
}

/** 판매 주문 등록 */
export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Failed to create order" }));
    throw new Error((err as { message: string }).message ?? "Failed to create order");
  }
  return res.json() as Promise<Order>;
}

/** 판매 취소 */
export async function cancelOrder(
  orderHash: string,
  callerAddress: string
): Promise<Order> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/orders/${orderHash}/cancel?callerAddress=${callerAddress}`,
    { method: "PATCH" }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Failed to cancel order" }));
    throw new Error((err as { message: string }).message ?? "Failed to cancel order");
  }
  return res.json() as Promise<Order>;
}

export interface MarketplaceCollectionDetail {
  /** Null until first listing (or other flow) creates `marketplace_collections` for this key. */
  collection: {
    collectionKey: string;
    displayLabel: string;
    queryUsed: string | null;
    components: Record<string, unknown>;
    createdAt: string;
    /** Persisted cover; stable once set. Prefer this over recomputed fallback in UI when present. */
    coverImageUrl?: string | null;
  } | null;
  listings: Order[];
  /** ERC721_WITH_CRITERIA collection bids */
  collectionBids: Order[];
  /** Collection representative image (not guaranteed). */
  representativeImageUrl: string | null;
}

export async function getMarketplaceCollectionDetail(
  collectionKey: string,
  opts?: { bypassCache?: boolean; signal?: AbortSignal },
): Promise<MarketplaceCollectionDetail> {
  const enc = encodeURIComponent(collectionKey);
  const qs = opts?.bypassCache ? `?nocache=${Date.now()}` : "";
  const res = await backendFetch(`${getApiUrl()}/marketplace/collections/${enc}${qs}`, {
    ...(opts?.bypassCache ? { cache: "no-store" as RequestCache } : {}),
    signal: opts?.signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? "Failed to load collection"
    );
  }
  return res.json() as Promise<MarketplaceCollectionDetail>;
}

/**
 * Same payload as {@link getMarketplaceCollectionDetail} but returns `null` when the bucket has no
 * `marketplace_collections` row yet (`collection` is null). HTTP is always 200 from the detail endpoint.
 */
export async function getMarketplaceCollectionDetailOrNull(
  collectionKey: string,
  opts?: { bypassCache?: boolean; signal?: AbortSignal },
): Promise<MarketplaceCollectionDetail | null> {
  const d = await getMarketplaceCollectionDetail(collectionKey, opts);
  return d.collection ? d : null;
}

export interface CollectionUsdPoint {
  t: number;
  v: number;
}

export interface CollectionGradePrices {
  psa10: number | null;
  psa9: number | null;
  raw: number | null;
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

/** Portfolio batch — same shapes as {@link CollectionMarketStats} + {@link getCollectionMarketSeries}. */
export interface PortfolioMarketBatchItem {
  collectionKey: string;
  stats: CollectionMarketStats | null;
  series: CollectionMarketSeries | null;
}

export async function postPortfolioCollectionMarketBatch(body: {
  collectionKeys: string[];
  priceHistoryDuration?: "7d" | "30d" | "90d" | "180d" | "365d";
}): Promise<{ items: PortfolioMarketBatchItem[] }> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/collections/portfolio-market-batch`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        collectionKeys: body.collectionKeys,
        priceHistoryDuration: body.priceHistoryDuration ?? "365d",
      }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ??
        "Failed to load portfolio market batch",
    );
  }
  return res.json() as Promise<{ items: PortfolioMarketBatchItem[] }>;
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
    spotPriceBasis?: "comps" | "latest_sale" | "sparse_sale_avg" | "catalog" | "comps_median" | null;
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

/** Fulfilled listing fill for collection tape (same source as chart platform series). */
export interface CollectionPlatformTapeFill {
  t: number;
  priceUsdc: number;
  tokenId: string;
  orderHash: string;
  /** buy = instant take of listing; sell = matched listing to collection bid (new fills only). */
  tapeAggressor?: "buy" | "sell";
}

/** DB-only: chart points + tape rows. */
export async function getCollectionPlatformTrades(
  collectionKey: string
): Promise<{ platformUsd: CollectionUsdPoint[]; trades: CollectionPlatformTapeFill[] }> {
  const enc = encodeURIComponent(collectionKey);
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/collections/${enc}/platform-trades`
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
  sparklineUsd: CollectionUsdPoint[];
  /** Pool stats (listing-derived); same contract as {@link getCollectionMarketStats} */
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
  priceHistoryDuration?: "7d" | "30d" | "90d" | "180d" | "365d";
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
  priceHistoryDuration: "7d" | "30d" | "90d" | "180d" | "365d" = "365d",
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

/** Merkle leaf set — minted RWAs in this collection bucket (server metadata scan) */
export async function getMerkleEligibleTokenIds(
  collectionKey: string,
  opts?: { bypassCache?: boolean; signal?: AbortSignal },
): Promise<{ tokenIds: string[] }> {
  const sp = new URLSearchParams();
  if (opts?.bypassCache) sp.set("bypassCache", "1");
  const q = sp.toString();
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/collections/${encodeURIComponent(collectionKey)}/merkle-set${q ? `?${q}` : ""}`,
    { signal: opts?.signal },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? "Failed to load merkle set"
    );
  }
  return res.json() as Promise<{ tokenIds: string[] }>;
}

/** After on-chain matchAdvancedOrders */
export async function fulfillMatchedPairApi(
  body: {
    bidOrderHash: string;
    askOrderHash: string;
  },
  opts?: { signal?: AbortSignal },
): Promise<{ ask: Order; bid: Order }> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/orders/fulfill-matched-pair`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: opts?.signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Failed to record match" }));
    throw new Error((err as { message?: string }).message ?? "Failed to record match");
  }
  return res.json() as Promise<{ ask: Order; bid: Order }>;
}

/** Cancel + insert new ask in one DB transaction (keeps Merkle token IDs stable). */
export async function replaceListingApi(body: {
  callerAddress: string;
  oldOrderHash: string;
  order: CreateOrderPayload;
}): Promise<Order> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/orders/replace-listing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      message?: string | string[];
    };
    const msg = Array.isArray(err.message)
      ? err.message.join(" ")
      : err.message ?? "Failed to replace listing";
    throw new Error(msg);
  }
  return res.json() as Promise<Order>;
}

/** 구매 완료 처리 (리스팅 이행 등 단일 주문) */
export async function fulfillOrderApi(orderHash: string): Promise<Order> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/orders/${orderHash}/fulfill`, {
    method: "PATCH",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Failed to fulfill order" }));
    throw new Error((err as { message: string }).message ?? "Failed to fulfill order");
  }
  return res.json() as Promise<Order>;
}

// ─── RWA metadata shape (IPFS fetch는 백엔드만 수행 — `postRwaMetadataBatch` / `getResolvedRwaAsset` / `postResolveMediaUrls`) ─

export interface RwaMetadata {
  name?: string;
  description?: string;
  image?: string;
  attributes?: Array<{ trait_type: string; value: string }>;
  /** OpenSea-style — 민팅 시 graded PSA 등이 여기 포함 */
  properties?: Record<string, unknown>;
  external_url?: string;
}
