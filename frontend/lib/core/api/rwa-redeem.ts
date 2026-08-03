import { backendFetch, getApiUrl } from "./client";
import { CHAIN_ID_HEADER } from "@/lib/chains/apiHeader";
import type { SupportedChainId } from "@/lib/chains/types";

export type RedeemShipTo = {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postal: string;
  country: "us" | "ca" | "intl";
  phone: string;
};

export type RedeemRequestResult = {
  id: string;
  status: string;
  vaultCycleId?: string;
};

export type MyRedemptionRow = {
  redemptionId: string;
  tokenId: string;
  tokenContract: string;
  status: string;
  vaultCycleStatus: string | null;
  requestedAt: string;
  vaultReleasedAt: string | null;
};

export type RedeemEstimate = {
  currency: "USD";
  country: "us" | "ca" | "intl";
  cardCount: number;
  shippingUsd: number;
  withdrawFeePerCardUsd: number;
  withdrawFeeTotalUsd: number;
  totalUsd: number;
  source: string;
};

function moneyUsd(n: number): string {
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export { moneyUsd as formatRedeemUsd };

export async function getRedeemEstimate(input: {
  country: RedeemShipTo["country"];
  cardCount: number;
}): Promise<RedeemEstimate> {
  const q = new URLSearchParams({
    country: input.country,
    cardCount: String(Math.max(1, input.cardCount)),
  });
  const res = await backendFetch(
    `${getApiUrl()}/rwa/redeem/estimate?${q.toString()}`,
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? "Failed to load redeem estimate",
    );
  }
  return res.json() as Promise<RedeemEstimate>;
}

export async function postRedeemRequest(input: {
  tokenId: number;
  chainId: SupportedChainId;
  shipTo: RedeemShipTo;
}): Promise<RedeemRequestResult> {
  const { chainId, ...body } = input;
  const res = await backendFetch(`${getApiUrl()}/rwa/redeem-request`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [CHAIN_ID_HEADER]: String(chainId),
    },
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? "Redeem request failed",
    );
  }
  return res.json() as Promise<RedeemRequestResult>;
}

export async function getMyRedemptions(
  tokenIds?: number[],
): Promise<MyRedemptionRow[]> {
  const q =
    tokenIds && tokenIds.length > 0
      ? `?tokenIds=${encodeURIComponent(tokenIds.join(","))}`
      : "";
  const res = await backendFetch(`${getApiUrl()}/rwa/redemptions/mine${q}`, {
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? "Failed to load redemptions",
    );
  }
  const data = (await res.json()) as MyRedemptionRow[] | { items: MyRedemptionRow[] };
  return Array.isArray(data) ? data : data.items ?? [];
}
