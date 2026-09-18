import type { OrderListItem, RwaMetadata } from "@/lib/core";
import type { MyRedemptionRow } from "@/lib/core/api/rwa-redeem";
import { listPriceSheetIdentity } from "@/lib/portfolio/portfolioTableHelpers";
import {
  extractCategory,
  formatPortfolioGradeLabel,
} from "@/lib/portfolio/portfolioAssetMeta";
import {
  certNumberFromMetadata,
  isRedeemInFlight,
} from "@/lib/portfolio/redeemDraft";
import type { TxKind, TxLifecycle, TxRow } from "@/lib/portfolio/portfolioTypes";
import { PORTFOLIO_USDC_DECIMALS } from "@/lib/portfolio/buildPortfolioPricedRows";

function usdcFromMicros(raw: string | undefined): number {
  try {
    return Number(String(raw ?? "0").trim() || "0") / PORTFOLIO_USDC_DECIMALS;
  } catch {
    return 0;
  }
}

function formatTxDateTime(when: Date): string {
  const date = when.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = when.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  });
  return `${date} ${time}`;
}

function formatTxTableDate(when: Date): string {
  const y = when.getFullYear();
  const m = String(when.getMonth() + 1).padStart(2, "0");
  const d = String(when.getDate()).padStart(2, "0");
  const hh = String(when.getHours()).padStart(2, "0");
  const mm = String(when.getMinutes()).padStart(2, "0");
  const ss = String(when.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

export function portfolioTxAssetIdentity(
  metadata: RwaMetadata | null | undefined,
  tokenId: number,
): { line1: string; hover: string } {
  const identity = listPriceSheetIdentity(metadata, tokenId);
  return { line1: identity.line1, hover: identity.hover };
}

/** Same headline rule as My Assets: Name · Number · Grade. */
export function portfolioTxAssetDisplayName(
  metadata: RwaMetadata | null | undefined,
  tokenId: number,
): string {
  return portfolioTxAssetIdentity(metadata, tokenId).line1;
}

export const TX_KIND_LABEL: Record<TxKind, string> = {
  BUY: "Buy",
  SELL: "Sell",
  MINT: "Mint",
  REDEEM: "Redeem",
  TRANSFER: "Transfer",
};

export function txKindLabel(tx: Pick<TxRow, "type">): string {
  return TX_KIND_LABEL[tx.type];
}

export function txKindClass(tx: Pick<TxRow, "type">): string {
  if (tx.type === "BUY") return "pf-table-type--buy";
  if (tx.type === "SELL") return "pf-table-type--sell";
  if (tx.type === "MINT") return "pf-table-type--mint";
  if (tx.type === "REDEEM") return "pf-table-type--redeem";
  return "pf-table-type--transfer";
}

export function txAmountIsNonTrade(tx: Pick<TxRow, "type">): boolean {
  return tx.type === "MINT" || tx.type === "REDEEM" || tx.type === "TRANSFER";
}

export function txLifecycleLabel(status: TxLifecycle): string {
  if (status === "in_progress") return "In progress";
  if (status === "failed") return "Failed";
  if (status === "canceled") return "Canceled";
  return "Completed";
}

function redeemLifecycle(row: MyRedemptionRow): TxLifecycle {
  const refund = (row.refundStatus ?? "").toLowerCase();
  if (refund === "refunded" || refund === "failed") return "failed";
  if (refund === "canceled" || refund === "cancelled") return "canceled";
  if (row.status === "completed") return "completed";
  if (isRedeemInFlight(row.status)) return "in_progress";
  return "in_progress";
}

function cardFields(
  metadata: RwaMetadata | null,
  tokenId: number,
  imageByTokenId?: Map<number, string | null>,
) {
  const identity = portfolioTxAssetIdentity(metadata, tokenId);
  return {
    asset: identity.line1,
    assetHover: identity.hover,
    category: extractCategory(metadata),
    gradeLabel: formatPortfolioGradeLabel(metadata),
    certNumber: certNumberFromMetadata(metadata),
    imageUrl: Number.isFinite(tokenId)
      ? imageByTokenId?.get(tokenId) ?? null
      : null,
  };
}

export type PortfolioTxExtras = {
  redemptions?: MyRedemptionRow[];
  /** Owned tokens with no matching BUY — vaulting / mint. */
  ownedMints?: Array<{ tokenId: number; dateMs: number }>;
};

/**
 * Buy/Sell from fulfilled orders, plus Redeem (mine) and Mint (owned, no buy).
 */
export function buildPortfolioTxRows(
  fulfilledOrders: OrderListItem[],
  address: string,
  metadataByTokenId: Map<number, RwaMetadata | null>,
  imageByTokenId?: Map<number, string | null>,
  extras?: PortfolioTxExtras,
): TxRow[] {
  const w = address.trim().toLowerCase();
  if (!w) return [];

  const myFulfilledBidHashes = new Set(
    fulfilledOrders
      .filter(
        (o) =>
          o.status === "fulfilled" &&
          o.side === "bid" &&
          (o.offerer?.trim().toLowerCase() ?? "") === w,
      )
      .map((o) => o.orderHash.toLowerCase()),
  );

  const rows: TxRow[] = [];
  const seen = new Set<string>();
  const boughtTokenIds = new Set<number>();

  for (const o of fulfilledOrders) {
    if (o.status !== "fulfilled") continue;
    const offerer = o.offerer?.trim().toLowerCase() ?? "";
    const filledBy = o.filledByBuyer?.trim().toLowerCase() ?? "";
    const matched = o.matchedOrderHash?.trim().toLowerCase() ?? "";
    const price = usdcFromMicros(o.settlementPrice || o.price);
    const tokenId = Number(o.tokenId);
    const metadata = Number.isFinite(tokenId)
      ? metadataByTokenId.get(tokenId) ?? null
      : null;

    let type: "SELL" | "BUY" | null = null;
    let dedupeKey = o.orderHash.toLowerCase();

    if (o.side === "ask" && offerer === w) {
      type = "SELL";
      dedupeKey = matched ? `sell:${matched}` : `sell:${o.orderHash.toLowerCase()}`;
    } else if (o.side === "bid" && offerer === w) {
      type = "BUY";
      dedupeKey = matched ? `buy:${matched}` : `buy:${o.orderHash.toLowerCase()}`;
    } else if (o.side === "ask" && filledBy === w) {
      if (matched && myFulfilledBidHashes.has(matched)) continue;
      type = "BUY";
      dedupeKey = matched ? `buy:${matched}` : `buy:${o.orderHash.toLowerCase()}`;
    }

    if (!type || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    if (type === "BUY" && Number.isFinite(tokenId)) boughtTokenIds.add(tokenId);

    const when = new Date(o.updatedAt ?? o.createdAt);
    const dateMs = when.getTime();
    const wallets =
      type === "SELL"
        ? {
            sellerWallet: o.offerer || null,
            buyerWallet: o.filledByBuyer || null,
          }
        : o.side === "bid"
          ? {
              sellerWallet: null,
              buyerWallet: o.offerer || null,
            }
          : {
              sellerWallet: o.offerer || null,
              buyerWallet: o.filledByBuyer || null,
            };

    rows.push({
      type,
      status: "completed",
      ...cardFields(metadata, tokenId, imageByTokenId),
      amount: 1,
      price,
      date: formatTxTableDate(when),
      dateTimeLabel: formatTxDateTime(when),
      dateMs,
      orderHash: o.orderHash,
      tokenId: Number.isFinite(tokenId) ? tokenId : undefined,
      tokenContract: o.tokenContract ?? null,
      considerationToken: o.considerationToken ?? null,
      ...wallets,
    });
  }

  for (const row of extras?.redemptions ?? []) {
    const tokenId = Number(row.tokenId);
    const key = `redeem:${row.redemptionId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const metadata = Number.isFinite(tokenId)
      ? metadataByTokenId.get(tokenId) ?? null
      : null;
    const when = new Date(
      row.vaultReleasedAt || row.requestedAt || Date.now(),
    );
    const dateMs = when.getTime();
    const chainTxs: Array<{ label: string; hash: string }> = [];
    const payment = row.paymentTxHash?.trim();
    const custody = row.custodyTxHash?.trim();
    if (payment) chainTxs.push({ label: "Payment", hash: payment });
    if (custody) chainTxs.push({ label: "Custody transfer", hash: custody });
    rows.push({
      type: "REDEEM",
      status: redeemLifecycle(row),
      ...cardFields(metadata, tokenId, imageByTokenId),
      amount: 1,
      price: 0,
      date: formatTxTableDate(when),
      dateTimeLabel: formatTxDateTime(when),
      dateMs,
      orderHash: row.redemptionId,
      tokenId: Number.isFinite(tokenId) ? tokenId : undefined,
      tokenContract: row.tokenContract || null,
      chainTxs,
    });
  }

  for (const mint of extras?.ownedMints ?? []) {
    if (boughtTokenIds.has(mint.tokenId)) continue;
    const key = `mint:${mint.tokenId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const metadata = metadataByTokenId.get(mint.tokenId) ?? null;
    const when = new Date(mint.dateMs);
    rows.push({
      type: "MINT",
      status: "completed",
      ...cardFields(metadata, mint.tokenId, imageByTokenId),
      amount: 1,
      price: 0,
      date: formatTxTableDate(when),
      dateTimeLabel: formatTxDateTime(when),
      dateMs: mint.dateMs,
      orderHash: key,
      tokenId: mint.tokenId,
    });
  }

  rows.sort((a, b) => b.dateMs - a.dateMs);
  return rows;
}
