import type { PublicClient } from "viem";
import { TOKENABLE_RWA_ADDRESS, TOKENABLE_RWA_READ_ABI } from "@/constants/contracts";

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

// ─── PSA slab OCR + JustTCG ───────────────────────────────────────────────────

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
    /** PSA Public API PSACert 병합 여부 */
    enrichedFromOfficialApi?: boolean;
  };
  psaApi: {
    lookup: PsaPublicApiLookup;
  };
  justtcg: {
    queryUsed: string;
    topMatch: unknown | null;
    rawResponse: unknown;
  };
  /** PokeTrace catalog id — persist as graded.poketrace on mint */
  poketraceMint?: {
    matchConfidence: "verified" | "approximate";
    cardId?: string;
    searchQuery?: string;
    approximateCardId?: string;
    approximateSearchQuery?: string;
  };
  /** PSA cert-images 등 — 앞면 URL은 민팅 시 imageUrl로 쓸 수 있음 */
  psaCertImages?: { front?: string; back?: string };
  /** 백엔드가 부분 실복구 시 단계별 안내 */
  warnings?: string[];
}

/** 슬랩 앞면 필수 — OCR 후 JustTCG(Pokemon) 검색 */
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

/** 슬랩 사진 없이 Cert 번호(또는 psacard.com/cert/ URL)만으로 PSA + JustTCG 조회 */
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

// ─── JustTCG — market stats (via backend /price/*) ─────────────────────────────

/** One row from `GET /price/games` (JustTCG `data[]`). */
export interface JustTcgGameSummary {
  id: string;
  name: string;
  cards_count?: number;
  /**
   * JustTCG aggregate catalog value for the game in USD (sum over cards of each
   * card’s highest variant price). See JustTCG `/games` — `game_value_usd`.
   */
  game_value_usd: number;
  game_value_change_7d_pct: number;
  game_value_change_30d_pct?: number;
  game_value_change_90d_pct?: number;
  /** When present on JustTCG `GET /games`, use for true 180d aggregate index change. */
  game_value_change_180d_pct?: number;
}

export interface JustTcgGamesResponse {
  data: JustTcgGameSummary[];
  _metadata?: unknown;
}

/** Full TCG market list + aggregate stats — requires backend `TCG_API_KEY`. */
export async function getPriceGames(): Promise<JustTcgGamesResponse> {
  const res = await backendFetch(`${getApiUrl()}/price/games`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg =
      typeof (err as { error?: unknown }).error === "string"
        ? (err as { error: string }).error
        : (err as { message?: string }).message;
    throw new Error(msg ?? "Failed to load market indexes");
  }
  return res.json() as Promise<JustTcgGamesResponse>;
}

/** JustTCG variant price sample — used for landing sparklines */
export interface JustTcgPriceHistoryPoint {
  p: number;
  t: number;
}

export interface JustTcgCardVariant {
  priceHistory?: JustTcgPriceHistoryPoint[] | null;
}

export interface JustTcgCardRow {
  id?: string;
  name?: string;
  variants?: JustTcgCardVariant[] | null;
}

export interface JustTcgCardsListResponse {
  data: JustTcgCardRow[];
  meta?: { total?: number; limit?: number; offset?: number; hasMore?: boolean };
}

/**
 * Search cards in a game with price history (first pages) — for charts.
 * Picks first variant with `priceHistory` of length ≥ 2 on the client.
 */
export async function searchCardsWithPriceHistory(params: {
  game: string;
  /** Scan more rows if early hits lack history (default 24) */
  limit?: number;
  priceHistoryDuration?: "7d" | "30d" | "90d" | "180d";
  /** Omit to search all conditions (often needed for priceHistory on list API). */
  condition?: string;
}): Promise<JustTcgCardsListResponse> {
  const sp = new URLSearchParams();
  sp.set("game", params.game);
  sp.set("limit", String(params.limit ?? 24));
  sp.set("include_price_history", "true");
  sp.set("priceHistoryDuration", params.priceHistoryDuration ?? "30d");
  if (params.condition !== undefined && params.condition !== "") {
    sp.set("condition", params.condition);
  }
  const res = await backendFetch(
    `${getApiUrl()}/price/cards?${sp.toString()}`,
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg =
      typeof (err as { error?: unknown }).error === "string"
        ? (err as { error: string }).error
        : (err as { message?: string }).message;
    throw new Error(msg ?? "Failed to load price history");
  }
  return res.json() as Promise<JustTcgCardsListResponse>;
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

export async function getRwaTokenURI(tokenId: number): Promise<string> {
  const res = await backendFetch(`${getApiUrl()}/blockchain/rwa/token-uri/${tokenId}`);
  /** 404 = tokenId not minted on current contract (e.g. after redeploy / address change) */
  if (res.status === 404) return "";
  if (!res.ok) throw new Error("Failed to fetch token URI");
  const text = await res.text();
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === "string" ? parsed : parsed?.tokenURI ?? String(parsed);
  } catch {
    return text.trim();
  }
}

/**
 * 메타데이터용 tokenURI: API 우선, 404/빈 값이면 지갑과 동일한 프론트 컨트랙트에서 `tokenURI` 읽기
 * (백엔드 RWA 주소·RPC가 프론트와 다를 때 카드 이미지 복구).
 */
export async function resolveRwaTokenUri(
  tokenId: number,
  publicClient?: PublicClient | null,
): Promise<string> {
  const fromApi = await getRwaTokenURI(tokenId).catch(() => "");
  if (fromApi) return fromApi;
  if (!publicClient) return "";
  try {
    const uri = await publicClient.readContract({
      address: TOKENABLE_RWA_ADDRESS,
      abi: TOKENABLE_RWA_READ_ABI,
      functionName: "tokenURI",
      args: [BigInt(tokenId)],
    });
    return typeof uri === "string" ? uri : "";
  } catch {
    return "";
  }
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
  /** JustTCG 카드 아트 (cert/슬랩 아님); 없을 수 있음 */
  coverImageUrl?: string | null;
}

/** graded/JustTCG 기준 컬렉션 요약 페이지 (커서 기반) */
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

/** 검색/레거시 호환: 모든 페이지를 순차 로드 (캡 30페이지) */
export async function fetchAllMarketplaceCollectionSummaries(): Promise<
  MarketplaceCollectionSummary[]
> {
  const out: MarketplaceCollectionSummary[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < 30; i++) {
    const page = await getMarketplaceCollectionsPage({ cursor, limit: 60 });
    out.push(...page.items);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return out;
}

/** tokenId로 전체 주문 이력 조회 (active/fulfilled/cancelled/expired 모두) */
export async function getOrderHistoryByTokenId(tokenId: number): Promise<Order[]> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/orders/token/${tokenId}`);
  if (!res.ok) throw new Error("Failed to fetch order history");
  return res.json() as Promise<Order[]>;
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
  } | null;
  listings: Order[];
  /** ERC721_WITH_CRITERIA collection bids */
  collectionBids: Order[];
  /** JustTCG topMatch 카드 이미지(슬랩 사진 아님); 없으면 null */
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
  justtcgCardId: string | null;
  categoryLabel: string | null;
  marketChangePct: number | null;
  /** Present when served by a recent backend (exchange list uses same bundle fields) */
  marketChangeWindow?: "7d" | "30d" | "90d" | "180d";
  marketChangeSource?: "poketrace_nm_ebay" | "justtcg_card_history" | "none" | null;
  isMockExternalPrices?: boolean;
  gradePrices: CollectionGradePrices;
  externalUsd: CollectionUsdPoint[];
  platformUsd: CollectionUsdPoint[];
}

/** JustTCG allows at most `180d` for `priceHistoryDuration` (single request = max history). */
export async function getCollectionMarketSeries(
  collectionKey: string,
  priceHistoryDuration: "7d" | "30d" | "90d" | "180d" = "180d"
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
  reference?: { poketraceCardId: string | null };
}

export async function getCollectionMarketStats(
  collectionKey: string,
): Promise<CollectionMarketStats> {
  const enc = encodeURIComponent(collectionKey);
  const res = await backendFetch(`${getApiUrl()}/marketplace/collections/${enc}/stats`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? "Failed to load collection market stats",
    );
  }
  return res.json() as Promise<CollectionMarketStats>;
}

/** PokeTrace — raw (Near Mint) market bands; PSA tier $ amounts need PokeTrace Pro on their API */
export interface PoketracePriceBand {
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

export interface CollectionPoketracePreview {
  enabled: boolean;
  searchQuery: string;
  matched: boolean;
  message?: string;
  /** Strict verified catalog id vs relaxed approximate reference (charts / NM). */
  matchConfidence?: "verified" | "approximate";
  /** True when the backend used PokeTrace mock fallback (see POKETRACE_MOCK_ON_FAILURE) */
  isMockData?: boolean;
  card: null | {
    id: string;
    name: string;
    cardNumber: string;
    setName: string;
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
    ebayNearMint: PoketracePriceBand | null;
    tcgplayerNearMint: PoketracePriceBand | null;
  };
}

export async function getCollectionPoketracePreview(
  collectionKey: string
): Promise<CollectionPoketracePreview> {
  const enc = encodeURIComponent(collectionKey);
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/collections/${enc}/poketrace`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? "Failed to load PokeTrace preview"
    );
  }
  return res.json() as Promise<CollectionPoketracePreview>;
}

/** PokeTrace batch — 서버가 tokenId별 메타데이터를 조회 (요청은 id 목록만) */
export async function postBatchMintPoketracePreviews(
  tokenIds: number[],
): Promise<Record<number, CollectionPoketracePreview>> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/poketrace/mint-previews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tokenIds }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? "Failed to load PokeTrace mint previews"
    );
  }
  const raw = (await res.json()) as Record<string, CollectionPoketracePreview>;
  const out: Record<number, CollectionPoketracePreview> = {};
  for (const [k, v] of Object.entries(raw)) {
    const id = Number(k);
    if (Number.isFinite(id)) out[id] = v;
  }
  return out;
}

/** GET /cards/:id/prices/NEAR_MINT/history — server-trimmed to UTC days in window */
export interface CollectionPoketraceNmHistory {
  enabled: boolean;
  searchQuery: string;
  matched: boolean;
  message?: string;
  matchConfidence?: "verified" | "approximate";
  /** Present when the backend served synthetic NM history for testing */
  isMockData?: boolean;
  days: number;
  points: CollectionUsdPoint[];
  source: string;
  upstreamRequests: number;
}

export async function getCollectionPoketraceNmHistory(
  collectionKey: string,
  days = 90
): Promise<CollectionPoketraceNmHistory> {
  const enc = encodeURIComponent(collectionKey);
  const d = Math.min(365, Math.max(1, Math.floor(days)));
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/collections/${enc}/poketrace/nm-history?days=${d}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? "Failed to load PokeTrace NM history"
    );
  }
  return res.json() as Promise<CollectionPoketraceNmHistory>;
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

/** DB-only: chart points + tape rows — poll without re-calling JustTCG. */
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
  justtcgCardId: string | null;
  categoryLabel: string | null;
  /** Legacy bundle field; prefer {@link CollectionMarketStats} via `marketStats` or GET …/stats */
  marketChangePct: number | null;
  /** Window label for bundle metadata */
  marketChangeWindow?: "7d" | "30d" | "90d" | "180d";
  marketChangeSource?: "poketrace_nm_ebay" | "justtcg_card_history" | "none" | null;
  /** JustTCG path while server `TCG_USE_MOCK` is enabled */
  isMockExternalPrices?: boolean;
  gradePrices: CollectionGradePrices;
  sparklineUsd: CollectionUsdPoint[];
  /** Pool stats (listing-derived); same contract as {@link getCollectionMarketStats} */
  marketStats?: CollectionMarketStats | null;
}

/** Must match backend `BatchMarketSnapshotsDto` @ArrayMaxSize */
export const MARKETPLACE_COLLECTION_SNAPSHOTS_MAX_KEYS = 40;

export async function postMarketplaceCollectionSnapshots(body: {
  collectionKeys: string[];
  priceHistoryDuration?: "7d" | "30d" | "90d" | "180d";
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
  priceHistoryDuration: "7d" | "30d" | "90d" | "180d" = "30d",
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
