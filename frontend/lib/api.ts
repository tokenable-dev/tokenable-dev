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

// ─── NFT Upload ───────────────────────────────────────────────────────────────

export interface UploadNftResult {
  tokenURI: string;
  imageURI: string;
  metadataCID: string;
}

export async function uploadNft(formData: FormData): Promise<UploadNftResult> {
  const res = await backendFetch(`${getApiUrl()}/nft/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Upload failed" }));
    throw new Error((error as { message: string }).message ?? "Asset upload failed");
  }
  return res.json() as Promise<UploadNftResult>;
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

// ─── Blockchain — Token (USDC) ────────────────────────────────────────────────

export interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
}

export async function getTokenInfo(): Promise<TokenInfo> {
  const res = await backendFetch(`${getApiUrl()}/blockchain/token/info`);
  if (!res.ok) throw new Error("Failed to fetch token info");
  return res.json() as Promise<TokenInfo>;
}

export async function getTokenSupply(): Promise<string> {
  const res = await backendFetch(`${getApiUrl()}/blockchain/token/supply`);
  if (!res.ok) throw new Error("Failed to fetch token supply");
  return res.json() as Promise<string>;
}

export async function getTokenBalance(address: string): Promise<string> {
  const res = await backendFetch(`${getApiUrl()}/blockchain/token/balance/${address}`);
  if (!res.ok) throw new Error("Failed to fetch token balance");
  return res.json() as Promise<string>;
}

// ─── Blockchain — NFT ─────────────────────────────────────────────────────────

export interface NftContractInfo {
  name: string;
  symbol: string;
  totalMinted: number;
}

export async function getNftContractInfo(): Promise<NftContractInfo> {
  const res = await backendFetch(`${getApiUrl()}/blockchain/nft/info`);
  if (!res.ok) throw new Error("Failed to fetch contract info");
  return res.json() as Promise<NftContractInfo>;
}

export async function getNftBalance(address: string): Promise<number> {
  const res = await backendFetch(`${getApiUrl()}/blockchain/nft/balance/${address}`);
  if (!res.ok) throw new Error("Failed to fetch asset balance");
  return res.json() as Promise<number>;
}

export async function getNftTokensByOwner(address: string): Promise<number[]> {
  const res = await backendFetch(`${getApiUrl()}/blockchain/nft/tokens/${address}`);
  if (!res.ok) throw new Error("Failed to fetch owned assets");
  return res.json() as Promise<number[]>;
}

export async function getNftTokenURI(tokenId: number): Promise<string> {
  const res = await backendFetch(`${getApiUrl()}/blockchain/nft/token-uri/${tokenId}`);
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
  /** 풀(컬렉션) 매수와 연결된 Seaport 입찰 */
  bucketBidId?: number | null;
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
  /** ask(기본) = 매도 리스팅, bid = 매수 입찰 */
  side?: "ask" | "bid";
  /** 풀 매수 입찰에서 온 token-특정 Seaport 입찰 */
  bucketBidId?: number;
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

/** tokenId로 해당 NFT의 활성 매도(ask) 리스팅 1건 조회 */
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

/** 활성 매수 입찰만 — 가격(USDC 최소단위) 내림차순 */
export async function getActiveBidsForToken(tokenId: number): Promise<Order[]> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/orders/bids/token/${tokenId}`
  );
  if (!res.ok) throw new Error("Failed to fetch bids");
  return res.json() as Promise<Order[]>;
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

// ── Pool bids (논리적 버킷 — 같은 카드·등급, Web2) ────────────────────────────

export interface MarketBucketComponents {
  gradingCompany: string;
  cardName: string;
  cardSet: string;
  gradeScore: string;
}

export interface BucketBid {
  id: number;
  bucketKey: string;
  tokenContract: string;
  buyerOfferer: string;
  considerationAmount: string;
  components: MarketBucketComponents;
  status: string;
  startTime: string;
  endTime: string;
  fulfilledTokenId: string | null;
  signature?: string | null;
  nonce?: string | null;
  createdAt: string;
  updatedAt: string;
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
  poolBids: BucketBid[];
  seaportBids: Order[];
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

export async function getBucketBidsByToken(tokenId: number): Promise<{
  bucketKey: string;
  components: MarketBucketComponents;
  bids: BucketBid[];
}> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/bucket-bids/by-token/${tokenId}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? "Failed to load pool bids"
    );
  }
  return res.json() as Promise<{
    bucketKey: string;
    components: MarketBucketComponents;
    bids: BucketBid[];
  }>;
}

export async function createPoolBid(payload: {
  tokenId?: string;
  bucketKey?: string;
  components?: Record<string, unknown>;
  considerationAmount: string;
  endTime: string;
  buyerOfferer: string;
  signature: string;
  nonce: string;
}): Promise<BucketBid> {
  const body: Record<string, unknown> = {
    considerationAmount: payload.considerationAmount,
    endTime: payload.endTime,
    buyerOfferer: payload.buyerOfferer,
    signature: payload.signature,
    nonce: payload.nonce,
  };
  if (payload.tokenId != null && payload.tokenId !== "") {
    body.tokenId = payload.tokenId;
  }
  if (payload.bucketKey != null && payload.components != null) {
    body.bucketKey = payload.bucketKey;
    body.components = payload.components;
  }
  const res = await backendFetch(`${getApiUrl()}/marketplace/bucket-bids`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Failed to create pool bid" }));
    throw new Error((err as { message?: string }).message ?? "Failed to create pool bid");
  }
  return res.json() as Promise<BucketBid>;
}

export async function cancelPoolBid(
  id: number,
  callerAddress: string
): Promise<BucketBid> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/bucket-bids/${id}/cancel?callerAddress=${encodeURIComponent(callerAddress)}`,
    { method: "PATCH" }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Failed to cancel pool bid");
  }
  return res.json() as Promise<BucketBid>;
}

export async function validatePoolBidSellerMatch(
  bidId: number,
  tokenId: number,
  sellerAddress: string
): Promise<{
  match: boolean;
  bucketBid: BucketBid;
  tokenOwner: string;
  message: string;
}> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/bucket-bids/${bidId}/validate-seller`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokenId: String(tokenId), sellerAddress }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Validation failed");
  }
  return res.json() as Promise<{
    match: boolean;
    bucketBid: BucketBid;
    tokenOwner: string;
    message: string;
  }>;
}

export async function preparePoolBidFulfillment(
  bidId: number,
  tokenId: number
): Promise<{
  match: boolean;
  bucketBid: BucketBid;
  tokenId: string;
  chainId: number;
  usdcAddress: string;
  nftContract: string;
  parametersDraft: Record<string, unknown>;
  buyerMessage: string;
}> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/bucket-bids/${bidId}/prepare-fulfill`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokenId: String(tokenId) }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? "Failed to prepare pool bid fulfillment"
    );
  }
  return res.json() as Promise<{
    match: boolean;
    bucketBid: BucketBid;
    tokenId: string;
    chainId: number;
    usdcAddress: string;
    nftContract: string;
    parametersDraft: Record<string, unknown>;
    buyerMessage: string;
  }>;
}

/** 구매 완료 처리 */
export async function fulfillOrderApi(orderHash: string): Promise<Order> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/orders/${orderHash}/fulfill`,
    { method: "PATCH" }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Failed to fulfill order" }));
    throw new Error((err as { message: string }).message ?? "Failed to fulfill order");
  }
  return res.json() as Promise<Order>;
}

// ─── IPFS / Pinata ────────────────────────────────────────────────────────────

export interface NftMetadata {
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

export async function fetchIpfsMetadata(tokenURI: string): Promise<NftMetadata> {
  const cid = tokenURI.replace("ipfs://", "");
  const url = buildPinataUrl(cid);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch metadata: ${url}`);
  return res.json() as Promise<NftMetadata>;
}

export function resolveIpfsImage(uri: string): string {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) {
    return buildPinataUrl(uri.replace("ipfs://", ""));
  }
  return uri;
}
