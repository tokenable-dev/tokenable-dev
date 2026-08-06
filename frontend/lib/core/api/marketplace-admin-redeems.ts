import { backendFetch, getApiUrl } from "./client";

export type AdminRedeemPaymentStatus = "unpaid" | "paid" | "refunded";
export type AdminRedeemCustodyStatus =
  | "pending"
  | "in_custody"
  | "returned"
  | "n/a";
export type AdminRedeemShippingStatus = "pending" | "tracked" | "released";
export type AdminRedeemRefundStatus =
  | "none"
  | "usdc_refunded"
  | "nft_returned"
  | "fully_refunded";

export type AdminRedeemRow = {
  id: string;
  status: string;
  refundStatus: AdminRedeemRefundStatus;
  paymentStatus: AdminRedeemPaymentStatus;
  custodyStatus: AdminRedeemCustodyStatus;
  shippingStatus: AdminRedeemShippingStatus;
  paymentBatchId: string | null;
  paymentTxHash: string | null;
  paidAt: string | null;
  paymentReceivedUsdcMicros: string | null;
  refundTxHash: string | null;
  refundedUsdcMicros: string | null;
  refundedAt: string | null;
  chainId: number | null;
  ownerWalletAddress: string;
  custodyTxHash: string | null;
  custodyAt: string | null;
  custodyReturnTxHash: string | null;
  custodyReturnedAt: string | null;
  trackingNumber: string | null;
  trackingCarrier: string | null;
  trackingSetAt: string | null;
  adminMemo: string | null;
  shipTo: {
    name: string | null;
    line1: string | null;
    line2: string | null;
    city: string | null;
    region: string | null;
    postal: string | null;
    country: string | null;
    phone: string | null;
  };
  fees: {
    retrievalUsd: string | null;
    earlyWithdrawalUsd: string | null;
    shippingUsd: string | null;
    totalUsd: string | null;
  };
  tokenId: string | null;
  tokenContract: string | null;
  certNumber: string | null;
  displayName: string | null;
  vaultCycleId: string;
  vaultCycleStatus: string | null;
  requestedByUserId: string | null;
  userEmail: string | null;
  requestedAt: string;
  ownershipVerifiedAt: string | null;
  burnedAt: string | null;
  burnTxHash: string | null;
  vaultReleasedAt: string | null;
  vaultedAt: string | null;
  earlyWithdrawal: boolean | null;
  settlementPolicy: "standard" | "self_vault_hold" | null;
  vaultPartnerId: string | null;
  shipmentKey: string;
  vaultLabel: string;
  updatedAt: string;
};

function adminErrorMessage(body: unknown, fallback: string): string {
  const msg = (body as { message?: string | string[] } | null)?.message;
  if (Array.isArray(msg)) return msg.join(", ");
  if (typeof msg === "string" && msg.trim()) return msg;
  return fallback;
}

export async function listAdminRedeems(params?: {
  status?: string;
  paymentBatchId?: string;
  limit?: number;
}): Promise<{ items: AdminRedeemRow[] }> {
  const sp = new URLSearchParams();
  if (params?.status) sp.set("status", params.status);
  if (params?.paymentBatchId) sp.set("paymentBatchId", params.paymentBatchId);
  if (params?.limit != null) sp.set("limit", String(params.limit));
  const q = sp.toString();
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/redeems${q ? `?${q}` : ""}`,
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(adminErrorMessage(body, "Failed to load redeems"));
  }
  return res.json() as Promise<{ items: AdminRedeemRow[] }>;
}

export async function adminUpdateRedeemMemo(
  id: string,
  memo: string,
): Promise<AdminRedeemRow> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/redeems/${encodeURIComponent(id)}/memo`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memo }),
    },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(adminErrorMessage(body, "Failed to update memo"));
  }
  return res.json() as Promise<AdminRedeemRow>;
}

export async function adminUpdateRedeemMemoBatch(
  batchId: string,
  memo: string,
): Promise<{ paymentBatchId: string; items: AdminRedeemRow[] }> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/redeems/batches/${encodeURIComponent(batchId)}/memo`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memo }),
    },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(adminErrorMessage(body, "Failed to update batch memo"));
  }
  return res.json();
}

export async function adminUpdateRedeemTracking(
  id: string,
  input: { trackingNumber: string; trackingCarrier?: string },
): Promise<AdminRedeemRow> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/redeems/${encodeURIComponent(id)}/tracking`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(adminErrorMessage(body, "Failed to set tracking"));
  }
  return res.json() as Promise<AdminRedeemRow>;
}

export async function adminUpdateRedeemTrackingBatch(
  batchId: string,
  input: {
    shipmentKey: string;
    trackingNumber: string;
    trackingCarrier?: string;
  },
): Promise<{
  paymentBatchId: string;
  shipmentKey: string;
  items: AdminRedeemRow[];
}> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/redeems/batches/${encodeURIComponent(batchId)}/tracking`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(adminErrorMessage(body, "Failed to set batch tracking"));
  }
  return res.json();
}

export async function adminRefundRedeemUsdc(batchId: string): Promise<{
  paymentBatchId: string;
  txHash: string | null;
  alreadyRefunded: boolean;
  items: AdminRedeemRow[];
}> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/redeems/batches/${encodeURIComponent(batchId)}/refund-usdc`,
    { method: "POST" },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(adminErrorMessage(body, "Failed to refund USDC"));
  }
  return res.json();
}

export async function adminReturnRedeemNft(id: string): Promise<{
  alreadyReturned: boolean;
  txHash: string | null;
  item: AdminRedeemRow;
}> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/redeems/${encodeURIComponent(id)}/return-nft`,
    { method: "POST" },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(adminErrorMessage(body, "Failed to return NFT"));
  }
  return res.json();
}

export async function adminRefundRedeemFull(batchId: string): Promise<{
  paymentBatchId: string;
  usdc: { txHash: string | null; alreadyRefunded: boolean };
  nftReturns: Array<{
    redemptionId: string;
    txHash: string | null;
    alreadyReturned: boolean;
    skipped?: string;
  }>;
  items: AdminRedeemRow[];
}> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/redeems/batches/${encodeURIComponent(batchId)}/refund-full`,
    { method: "POST" },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(adminErrorMessage(body, "Failed to run full refund"));
  }
  return res.json();
}
