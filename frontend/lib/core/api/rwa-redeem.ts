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
  /** Fee-schedule bucket (PSA / stubs). */
  country: "us" | "ca" | "intl";
  /** ISO-3166 alpha-2 for FedEx Rate (required for intl Partner quotes). */
  countryCode?: string;
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
  paymentBatchId?: string | null;
  custodyTxHash?: string | null;
  custodyAt?: string | null;
  paymentTxHash?: string | null;
  trackingNumber?: string | null;
  trackingCarrier?: string | null;
  refundStatus?: string;
  settlementPolicy?: "standard" | "self_vault_hold" | null;
  vaultPartnerId?: string | null;
  feeRetrievalUsd?: string | null;
  feeEarlyWithdrawalUsd?: string | null;
  feeShippingUsd?: string | null;
  feeTotalUsd?: string | null;
  /** Batch-total USDC micros — same on sibling rows; do not sum. */
  paymentReceivedUsdcMicros?: string | null;
  earlyWithdrawal?: boolean | null;
};

export type RedeemCardFeeLine = {
  tokenId: number;
  vaultedAt: string | null;
  earlyWithdrawal: boolean;
  retrievalUsd: number;
  earlyWithdrawalUsd: number;
  shippingUsd: number;
  totalUsd: number;
  shipmentKey?: string;
};

export type RedeemShipmentEstimate = {
  key: string;
  provider: "psa_vault" | "partner";
  vaultPartnerId: string | null;
  vaultLabel: string;
  cardCount: number;
  shippingUsd: number;
  retrievalFeeTotalUsd: number;
  earlyWithdrawalFeeTotalUsd: number;
  totalUsd: number;
  shippingSource: "psa_published" | "fedex_stub" | "fedex_rate";
  shippingServiceType?: string | null;
  shippingRateType?: "ACCOUNT" | "LIST" | null;
  shippingQuoteExpiresAt?: string | null;
  shippingDestinationCountry?: string | null;
  cards: RedeemCardFeeLine[];
};

export type RedeemEstimate = {
  currency: "USD";
  country: "us" | "ca" | "intl";
  cardCount: number;
  shippingUsd: number;
  retrievalFeePerCardUsd: number;
  earlyWithdrawalFeePerCardUsd: number;
  earlyWithdrawalDays: number;
  earlyWithdrawalCardCount: number;
  retrievalFeeTotalUsd: number;
  earlyWithdrawalFeeTotalUsd: number;
  /** Combined retrieval+early for legacy UI */
  withdrawFeePerCardUsd: number;
  withdrawFeeTotalUsd: number;
  totalUsd: number;
  totalUsdcMicros: string;
  payToAddress: string | null;
  cards: RedeemCardFeeLine[];
  shipments?: RedeemShipmentEstimate[];
  source: string;
  ageBasis: "deposited_at" | "unknown_assume_early";
  /** Earliest Partner FedEx quote expiry when present. */
  shippingQuoteExpiresAt?: string | null;
};

export type RedeemBatchResult = {
  paymentBatchId: string;
  paymentTxHash: string;
  paymentReceivedUsdcMicros?: string;
  custodyWalletAddress: string;
  chainId?: number;
  nextStep?: "transfer_nfts_to_custody";
  estimate: RedeemEstimate;
  redemptions: Array<RedeemRequestResult & { tokenId?: number }>;
};

export type RedeemCustodyResult = {
  paymentBatchId: string;
  allInCustody: boolean;
  custodyWalletAddress: string;
  alreadyInCustodyCount?: number;
  redemptions: Array<{
    id: string;
    status: string;
    custodyTxHash: string | null;
  }>;
};

function moneyUsd(n: number): string {
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export { moneyUsd as formatRedeemUsd };

/** Nest may return `message` as string or `{ code, category, message }`. */
export function parseRedeemApiError(body: unknown): {
  message: string;
  code?: string;
  category?: string;
} {
  const err = (body ?? {}) as {
    message?: unknown;
    code?: string;
    category?: string;
  };
  if (typeof err.message === "string") {
    return { message: err.message, code: err.code, category: err.category };
  }
  if (Array.isArray(err.message)) {
    return {
      message: err.message.join(", "),
      code: err.code,
      category: err.category,
    };
  }
  if (err.message && typeof err.message === "object") {
    const nested = err.message as {
      message?: string;
      code?: string;
      category?: string;
    };
    return {
      message:
        typeof nested.message === "string"
          ? nested.message
          : "Failed to load redeem estimate",
      code: nested.code ?? err.code,
      category: nested.category ?? err.category,
    };
  }
  return { message: "Failed to load redeem estimate", code: err.code };
}

export class RedeemApiError extends Error {
  code?: string;
  category?: string;
  constructor(parsed: { message: string; code?: string; category?: string }) {
    super(parsed.message);
    this.name = "RedeemApiError";
    this.code = parsed.code;
    this.category = parsed.category;
  }
}

export async function getRedeemEstimate(input: {
  country: RedeemShipTo["country"];
  cardCount: number;
  tokenIds?: number[];
  chainId?: SupportedChainId;
  /** When set, uses POST so Partner FedEx Rate can use the full address. */
  shipTo?: RedeemShipTo;
}): Promise<RedeemEstimate> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (input.chainId != null) {
    headers[CHAIN_ID_HEADER] = String(input.chainId);
  }

  if (input.shipTo) {
    const res = await backendFetch(`${getApiUrl()}/rwa/redeem/estimate`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        country: input.country,
        cardCount: Math.max(1, input.cardCount),
        tokenIds:
          input.tokenIds && input.tokenIds.length > 0
            ? input.tokenIds
            : undefined,
        shipTo: input.shipTo,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new RedeemApiError(parseRedeemApiError(err));
    }
    return res.json() as Promise<RedeemEstimate>;
  }

  const q = new URLSearchParams({
    country: input.country,
    cardCount: String(Math.max(1, input.cardCount)),
  });
  if (input.tokenIds && input.tokenIds.length > 0) {
    q.set("tokenIds", input.tokenIds.join(","));
  }
  const res = await backendFetch(
    `${getApiUrl()}/rwa/redeem/estimate?${q.toString()}`,
    { headers },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new RedeemApiError(parseRedeemApiError(err));
  }
  return res.json() as Promise<RedeemEstimate>;
}

export async function postRedeemBatch(input: {
  tokenIds: number[];
  chainId: SupportedChainId;
  shipTo: RedeemShipTo;
  paymentTxHash: string;
}): Promise<RedeemBatchResult> {
  const { chainId, ...body } = input;
  const res = await backendFetch(`${getApiUrl()}/rwa/redeem-batch`, {
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
    const msg = Array.isArray((err as { message?: unknown }).message)
      ? ((err as { message: string[] }).message).join(", ")
      : (err as { message?: string }).message;
    throw new Error(msg ?? "Redeem batch failed");
  }
  return res.json() as Promise<RedeemBatchResult>;
}

/** Confirm user-signed ERC-721 transfers into RWA custody for a paid batch. */
export async function postRedeemBatchCustody(input: {
  batchId: string;
  chainId: SupportedChainId;
  transfers: Array<{ tokenId: number; txHash: string }>;
}): Promise<RedeemCustodyResult> {
  const res = await backendFetch(
    `${getApiUrl()}/rwa/redeem-batch/${encodeURIComponent(input.batchId)}/custody`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [CHAIN_ID_HEADER]: String(input.chainId),
      },
      body: JSON.stringify({ transfers: input.transfers }),
      credentials: "include",
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = Array.isArray((err as { message?: unknown }).message)
      ? ((err as { message: string[] }).message).join(", ")
      : (err as { message?: string }).message;
    throw new Error(msg ?? "Custody confirmation failed");
  }
  return res.json() as Promise<RedeemCustodyResult>;
}

export type RedeemConfirmReceivedResult = {
  paymentBatchId: string;
  status: "completed";
  alreadyCompleted: boolean;
  redemptions: Array<{
    id: string;
    status: string;
    vaultReleasedAt: string | Date | null;
  }>;
};

/** User: I've received my cards → Done (all vault shipments must be tracked). */
export async function postRedeemBatchConfirmReceived(
  batchId: string,
): Promise<RedeemConfirmReceivedResult> {
  const res = await backendFetch(
    `${getApiUrl()}/rwa/redeem-batch/${encodeURIComponent(batchId)}/confirm-received`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = Array.isArray((err as { message?: unknown }).message)
      ? ((err as { message: string[] }).message).join(", ")
      : (err as { message?: string }).message;
    throw new Error(msg ?? "Could not confirm receipt");
  }
  return res.json() as Promise<RedeemConfirmReceivedResult>;
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

/** RWA custody wallet for user-signed NFT intake (chain header). */
export async function getRedeemCustodyWallet(
  chainId: SupportedChainId,
): Promise<{ custodyWalletAddress: string; chainId: number }> {
  const res = await backendFetch(`${getApiUrl()}/rwa/redeem/custody-wallet`, {
    headers: { [CHAIN_ID_HEADER]: String(chainId) },
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? "Failed to load custody wallet",
    );
  }
  return res.json() as Promise<{
    custodyWalletAddress: string;
    chainId: number;
  }>;
}

function parseUsdField(raw: string | null | undefined): number {
  if (raw == null || raw === "") return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Build a RedeemEstimate-shaped Paid breakdown from stored per-card fee snapshots.
 * `paymentReceivedUsdcMicros` is batch-total (do not sum sibling rows).
 */
export function paidEstimateFromMyRedemptions(
  rows: MyRedemptionRow[],
): RedeemEstimate | null {
  if (rows.length === 0) return null;
  const cardCount = rows.length;
  let shippingUsd = 0;
  let retrievalFeeTotalUsd = 0;
  let earlyWithdrawalFeeTotalUsd = 0;
  let earlyWithdrawalCardCount = 0;
  let feeTotalSum = 0;
  for (const r of rows) {
    shippingUsd += parseUsdField(r.feeShippingUsd);
    retrievalFeeTotalUsd += parseUsdField(r.feeRetrievalUsd);
    const early = parseUsdField(r.feeEarlyWithdrawalUsd);
    earlyWithdrawalFeeTotalUsd += early;
    if (r.earlyWithdrawal === true || early > 0) earlyWithdrawalCardCount += 1;
    feeTotalSum += parseUsdField(r.feeTotalUsd);
  }

  let totalUsd = feeTotalSum;
  const micros = rows.find((r) => r.paymentReceivedUsdcMicros?.trim())
    ?.paymentReceivedUsdcMicros;
  if (micros) {
    try {
      const fromMicros = Number(BigInt(micros)) / 1e6;
      if (Number.isFinite(fromMicros) && fromMicros > 0) totalUsd = fromMicros;
    } catch {
      /* keep fee sum */
    }
  } else if (totalUsd <= 0) {
    totalUsd = shippingUsd + retrievalFeeTotalUsd + earlyWithdrawalFeeTotalUsd;
  }

  const retrievalFeePerCardUsd =
    cardCount > 0 ? retrievalFeeTotalUsd / cardCount : 0;
  const earlyWithdrawalFeePerCardUsd =
    earlyWithdrawalCardCount > 0
      ? earlyWithdrawalFeeTotalUsd / earlyWithdrawalCardCount
      : 0;

  return {
    currency: "USD",
    country: "us",
    cardCount,
    shippingUsd,
    retrievalFeePerCardUsd,
    earlyWithdrawalFeePerCardUsd,
    earlyWithdrawalDays: 90,
    earlyWithdrawalCardCount,
    retrievalFeeTotalUsd,
    earlyWithdrawalFeeTotalUsd,
    withdrawFeePerCardUsd: retrievalFeePerCardUsd + earlyWithdrawalFeePerCardUsd,
    withdrawFeeTotalUsd: retrievalFeeTotalUsd + earlyWithdrawalFeeTotalUsd,
    totalUsd,
    totalUsdcMicros: micros?.trim() || String(Math.round(totalUsd * 1e6)),
    payToAddress: null,
    cards: rows.map((r) => ({
      tokenId: Number(r.tokenId),
      vaultedAt: null,
      earlyWithdrawal: r.earlyWithdrawal === true,
      retrievalUsd: parseUsdField(r.feeRetrievalUsd),
      earlyWithdrawalUsd: parseUsdField(r.feeEarlyWithdrawalUsd),
      shippingUsd: parseUsdField(r.feeShippingUsd),
      totalUsd: parseUsdField(r.feeTotalUsd),
    })),
    source: "payment_snapshot",
    ageBasis: "deposited_at",
  };
}
