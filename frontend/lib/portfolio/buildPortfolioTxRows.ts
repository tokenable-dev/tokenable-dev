import type { OrderListItem } from "@/lib/core";
import { extractCategory } from "@/lib/portfolio/portfolioAssetMeta";
import { isPortfolioSellFill } from "@/lib/portfolio/portfolioTrades.util";
import type { OwnedAsset, TxRow } from "@/lib/portfolio/portfolioTypes";
import { PORTFOLIO_USDC_DECIMALS } from "@/lib/portfolio/buildPortfolioPricedRows";

export function buildPortfolioTxRows(
  fulfilledOrders: OrderListItem[],
  address: string,
  assets: OwnedAsset[],
): TxRow[] {
  return fulfilledOrders.map((o) => {
    const isSeller = isPortfolioSellFill(o, address);
    const asset = assets.find((a) => a.tokenId === Number(o.tokenId));
    return {
      type: isSeller ? "SELL" : "BUY",
      asset: asset?.metadata?.name ?? `RWA #${o.tokenId}`,
      category: asset ? extractCategory(asset.metadata) : null,
      amount: 1,
      price: Number(o.price) / PORTFOLIO_USDC_DECIMALS,
      date: new Date(o.updatedAt ?? o.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      orderHash: o.orderHash,
    };
  });
}
