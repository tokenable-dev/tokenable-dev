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
    throw new Error((error as { message: string }).message ?? "NFT upload failed");
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
}

/** 슬랩 앞면 필수, 뒷면 선택 — OCR 후 JustTCG(Pokemon) 검색 */
export async function analyzePsaSlab(
  slabFront: File,
  slabBack?: File | null
): Promise<PsaAnalyzeResult> {
  const fd = new FormData();
  fd.append("slabFront", slabFront);
  if (slabBack) fd.append("slabBack", slabBack);
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
  if (!res.ok) throw new Error("Failed to fetch NFT contract info");
  return res.json() as Promise<NftContractInfo>;
}

export async function getNftBalance(address: string): Promise<number> {
  const res = await backendFetch(`${getApiUrl()}/blockchain/nft/balance/${address}`);
  if (!res.ok) throw new Error("Failed to fetch NFT balance");
  return res.json() as Promise<number>;
}

export async function getNftTokensByOwner(address: string): Promise<number[]> {
  const res = await backendFetch(`${getApiUrl()}/blockchain/nft/tokens/${address}`);
  if (!res.ok) throw new Error("Failed to fetch owned NFTs");
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
}

/** 활성 주문 목록 */
export async function getActiveOrders(): Promise<Order[]> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/orders`);
  if (!res.ok) throw new Error("Failed to fetch orders");
  return res.json() as Promise<Order[]>;
}

/** tokenId로 해당 NFT의 active 주문 1건 조회 */
export async function getOrderByTokenId(tokenId: number): Promise<Order | null> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/orders`);
  if (!res.ok) throw new Error("Failed to fetch orders");
  const orders = (await res.json()) as Order[];
  return (
    orders.find(
      (o) => o.tokenId === String(tokenId) && o.status === "active"
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
