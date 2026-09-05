import { backendFetch, getApiUrl } from "./client";
import { CHAIN_ID_HEADER } from "@/lib/chains/apiHeader";
import type { SupportedChainId } from "@/lib/chains/types";

export type P2pListing = {
  id: string;
  sellerUserId: string;
  certNumber: string;
  vaultRef: string;
  tokenContract: string;
  tokenId: string;
  tokenUri: string | null;
  mintTxHash: string | null;
  chainId: number;
  priceUsdc: string;
  sellerWallet: string;
  status: string;
  displayName: string | null;
  imageUrl: string | null;
  createdAt: string;
};

export type P2pOrder = {
  id: string;
  listingId: string;
  buyerUserId: string;
  buyerWallet: string;
  sellerUserId: string;
  sellerWallet: string;
  tokenId: string;
  priceUsdc: string;
  chainId: number;
  escrowOrderId: string;
  escrowAddress?: string | null;
  depositTxHash: string | null;
  releaseTxHash: string | null;
  autoReleaseAt: string;
  shipByAt: string;
  trackingNumber: string | null;
  carrier: string | null;
  shipToLine1: string | null;
  shipToCity: string | null;
  shipToPostal: string | null;
  shipToCountry: string | null;
  status: string;
  burnTxHash: string | null;
};

export type P2pPrepareBuy = {
  listing: P2pListing;
  escrowAddress: string;
  escrowOrderId: string;
  autoReleaseAt: number;
  usdcAddress: string;
  chainId: number;
  priceUsdc: string;
  sellerWallet: string;
  alreadyFunded: boolean;
  fundedBy: string | null;
};

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function listP2pListings(): Promise<P2pListing[]> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/p2p/listings`);
  return parseJson(res);
}

export async function getP2pListing(id: string): Promise<P2pListing> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/p2p/listings/${id}`);
  return parseJson(res);
}

export async function createP2pListing(
  body: {
    certNumber: string;
    tokenURI: string;
    priceUsdc: string;
    sellerWallet: string;
    authenticityAccepted: true;
    displayName?: string;
    imageUrl?: string;
  },
  chainId: SupportedChainId,
): Promise<{ listing: P2pListing; escrowAddress: string; chainId: number }> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/p2p/listings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [CHAIN_ID_HEADER]: String(chainId),
    },
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function cancelP2pListing(id: string): Promise<P2pListing> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/p2p/listings/${id}/cancel`,
    { method: "POST" },
  );
  return parseJson(res);
}

export async function prepareP2pBuy(listingId: string): Promise<P2pPrepareBuy> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/p2p/listings/${listingId}/prepare-buy`,
  );
  return parseJson(res);
}

export async function recordP2pDeposit(
  listingId: string,
  body: {
    buyerWallet: string;
    depositTxHash?: string;
    shipToName?: string;
    shipToLine1: string;
    shipToLine2?: string;
    shipToCity: string;
    shipToRegion?: string;
    shipToPostal: string;
    shipToCountry: string;
  },
): Promise<P2pOrder> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/p2p/listings/${listingId}/deposit`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return parseJson(res);
}

export async function getP2pOrder(id: string): Promise<P2pOrder> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/p2p/orders/${id}`);
  return parseJson(res);
}

export async function recordP2pSettlement(
  orderId: string,
  body: { releaseTxHash: string; source?: "confirm" | "timeout" },
): Promise<P2pOrder> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/p2p/orders/${orderId}/settle`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return parseJson(res);
}

export async function setP2pTracking(
  orderId: string,
  body: { carrier: "FedEx" | "DHL" | "UPS"; trackingNumber: string },
): Promise<P2pOrder> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/p2p/orders/${orderId}/tracking`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return parseJson(res);
}

export async function listMyP2pListings(): Promise<P2pListing[]> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/p2p/me/listings`);
  return parseJson(res);
}

export async function listMyP2pOrders(role: "buyer" | "seller" = "buyer"): Promise<P2pOrder[]> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/p2p/me/orders?role=${role}`,
  );
  return parseJson(res);
}

export async function adminListP2pOrders(status?: string): Promise<P2pOrder[]> {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  const res = await backendFetch(`${getApiUrl()}/marketplace/admin/p2p/orders${q}`, {
    credentials: "include",
  });
  return parseJson(res);
}

export async function adminRefundP2pOrder(id: string): Promise<P2pOrder> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/p2p/orders/${id}/refund`,
    { method: "POST", credentials: "include" },
  );
  return parseJson(res);
}
