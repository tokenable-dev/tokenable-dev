import { backendFetch, getApiUrl } from "./client";

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
