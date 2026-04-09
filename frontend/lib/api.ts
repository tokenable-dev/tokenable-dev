import type { PublicClient } from "viem";
import { TOKENABLE_RWA_ADDRESS, TOKENABLE_RWA_READ_ABI } from "@/constants/contracts";

/**
 * 브라우저: Next rewrites로 동일 출처 `/api` → 백엔드 (httpOnly 쿠키 인증).
 * 서버/빌드: INTERNAL_API_URL 또는 직접 백엔드 URL.
 * NEXT_PUBLIC_API_URL 이 있으면 그대로 사용 (별도 도메인 API).
 */
export function getApiUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
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

// ─── JustTCG — market stats (via backend /price/*) ─────────────────────────────

/** One row from `GET /price/games` (JustTCG `data[]`). */
export interface JustTcgGameSummary {
  id: string;
  name: string;
  cards_count?: number;
  game_value_usd: number;
  game_value_change_7d_pct: number;
  game_value_change_30d_pct?: number;
  game_value_change_90d_pct?: number;
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

/** 활성 주문 목록 */
export async function getActiveOrders(): Promise<Order[]> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/orders`);
  if (!res.ok) throw new Error("Failed to fetch orders");
  return res.json() as Promise<Order[]>;
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

/** graded/JustTCG 기준 컬렉션 요약 (활성 매도 개수 포함) */
export async function getMarketplaceCollections(): Promise<
  MarketplaceCollectionSummary[]
> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/collections`);
  if (!res.ok) throw new Error("Failed to fetch collections");
  return res.json() as Promise<MarketplaceCollectionSummary[]>;
}

/** tokenId로 해당 RWA의 활성 매도(ask) 리스팅 1건 조회 */
export async function getOrderByTokenId(tokenId: number): Promise<Order | null> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/orders`);
  if (!res.ok) throw new Error("Failed to fetch orders");
  const orders = (await res.json()) as Order[];
  return (
    orders.find(
      (o) =>
        o.tokenId === String(tokenId) &&
        o.status === "active" &&
        (o.side === "ask" || o.side == null)
    ) ?? null
  );
}

/** tokenId로 전체 주문 이력 조회 (active/fulfilled/cancelled/expired 모두) */
export async function getOrderHistoryByTokenId(tokenId: number): Promise<Order[]> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/orders/token/${tokenId}`);
  if (!res.ok) throw new Error("Failed to fetch order history");
  return res.json() as Promise<Order[]>;
}

/** orderHash로 단건 조회 */
export async function getOrderByHash(orderHash: string): Promise<Order> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/orders/${orderHash}`);
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
  collection: {
    collectionKey: string;
    displayLabel: string;
    queryUsed: string | null;
    components: Record<string, unknown>;
    createdAt: string;
  };
  listings: Order[];
  /** ERC721_WITH_CRITERIA collection bids */
  collectionBids: Order[];
  /** JustTCG topMatch 카드 이미지(슬랩 사진 아님); 없으면 null */
  representativeImageUrl: string | null;
}

export async function getMarketplaceCollectionDetail(
  collectionKey: string
): Promise<MarketplaceCollectionDetail> {
  const enc = encodeURIComponent(collectionKey);
  const res = await backendFetch(`${getApiUrl()}/marketplace/collections/${enc}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? "Failed to load collection"
    );
  }
  return res.json() as Promise<MarketplaceCollectionDetail>;
}

/** Merkle leaf set — active listing token IDs in this collection */
export async function getMerkleEligibleTokenIds(
  collectionKey: string
): Promise<{ tokenIds: string[] }> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/collections/${encodeURIComponent(collectionKey)}/merkle-set`
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
export async function fulfillMatchedPairApi(body: {
  bidOrderHash: string;
  askOrderHash: string;
}): Promise<{ ask: Order; bid: Order }> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/orders/fulfill-matched-pair`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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

// ─── IPFS / Pinata ────────────────────────────────────────────────────────────

export interface RwaMetadata {
  name?: string;
  description?: string;
  image?: string;
  attributes?: Array<{ trait_type: string; value: string }>;
  /** OpenSea-style — 민팅 시 graded PSA 등이 여기 포함 */
  properties?: Record<string, unknown>;
  external_url?: string;
}

const PINATA_GATEWAY =
  process.env.NEXT_PUBLIC_PINATA_GATEWAY ??
  "chocolate-voluntary-raccoon-677.mypinata.cloud";

function buildPinataUrl(cid: string): string {
  return `https://${PINATA_GATEWAY}/ipfs/${cid}`;
}

export async function fetchIpfsMetadata(tokenURI: string): Promise<RwaMetadata> {
  const cid = tokenURI.replace("ipfs://", "");
  const url = buildPinataUrl(cid);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch metadata: ${url}`);
  return res.json() as Promise<RwaMetadata>;
}

export function resolveIpfsImage(uri: string): string {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) {
    return buildPinataUrl(uri.replace("ipfs://", ""));
  }
  return uri;
}
