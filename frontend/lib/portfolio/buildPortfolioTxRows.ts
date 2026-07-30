import type { OrderListItem } from "@/lib/core";
import { extractCategory } from "@/lib/portfolio/portfolioAssetMeta";
import type { OwnedAsset, TxRow } from "@/lib/portfolio/portfolioTypes";
import { PORTFOLIO_USDC_DECIMALS } from "@/lib/portfolio/buildPortfolioPricedRows";

function usdcFromMicros(raw: string | undefined): number {
  try {
    return Number(String(raw ?? "0").trim() || "0") / PORTFOLIO_USDC_DECIMALS;
  } catch {
    return 0;
  }
}

/**
 * Build portfolio transaction rows from portfolio-activity orders.
 * One row per settlement: seller sees SELL on their ask; buyer sees BUY on their
 * bid (sell-into-bid) or on an ask they filled — never both ask+bid as two buys.
 */
export function buildPortfolioTxRows(
  fulfilledOrders: OrderListItem[],
  address: string,
  assets: OwnedAsset[],
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

  for (const o of fulfilledOrders) {
    if (o.status !== "fulfilled") continue;
    const offerer = o.offerer?.trim().toLowerCase() ?? "";
    const filledBy = o.filledByBuyer?.trim().toLowerCase() ?? "";
    const matched = o.matchedOrderHash?.trim().toLowerCase() ?? "";
    const price = usdcFromMicros(o.settlementPrice || o.price);
    const tokenId = Number(o.tokenId);
    const asset = assets.find((a) => a.tokenId === tokenId);

    let type: "SELL" | "BUY" | null = null;
    let dedupeKey = o.orderHash.toLowerCase();

    if (o.side === "ask" && offerer === w) {
      type = "SELL";
      dedupeKey = matched ? `sell:${matched}` : `sell:${o.orderHash.toLowerCase()}`;
    } else if (o.side === "bid" && offerer === w) {
      type = "BUY";
      dedupeKey = matched ? `buy:${matched}` : `buy:${o.orderHash.toLowerCase()}`;
    } else if (o.side === "ask" && filledBy === w) {
      // Buy-the-ask. If sell-into-bid also returned my bid, skip this ask row.
      if (matched && myFulfilledBidHashes.has(matched)) continue;
      type = "BUY";
      dedupeKey = matched ? `buy:${matched}` : `buy:${o.orderHash.toLowerCase()}`;
    }

    if (!type || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    rows.push({
      type,
      asset: asset?.metadata?.name ?? `RWA #${o.tokenId}`,
      category: asset ? extractCategory(asset.metadata) : null,
      amount: 1,
      price,
      date: new Date(o.updatedAt ?? o.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      orderHash: o.orderHash,
    });
  }

  return rows.sort((a, b) => {
    // Keep API order roughly; stable by orderHash
    return a.orderHash.localeCompare(b.orderHash);
  });
}
