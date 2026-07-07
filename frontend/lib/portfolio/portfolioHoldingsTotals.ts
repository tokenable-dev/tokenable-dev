import type { AssetRow } from "@/lib/portfolio/portfolioTypes";

export type PortfolioHoldingsTotals = {
  visibleCount: number;
  totalValueUsd: number;
  totalCostBasisUsd: number | null;
  unrealizedPnlUsd: number | null;
  unrealizedPnlPct: number | null;
  costBasisCoverage: number;
};

/** Visible (non-hidden) holdings — aligns with backend daily snapshot totals. */
export function computePortfolioHoldingsTotals(
  assetRows: AssetRow[],
  hiddenSet: Set<number>,
  costBasisByTokenId: Map<number, number>,
): PortfolioHoldingsTotals {
  const visible = assetRows.filter((row) => !hiddenSet.has(row.tokenId));
  let totalValueUsd = 0;
  let totalCostBasisUsd = 0;
  let costBasisCoverage = 0;

  for (const row of visible) {
    const value = row.currentPrice;
    if (value != null && Number.isFinite(value)) {
      totalValueUsd += value;
    }
    const cost = costBasisByTokenId.get(row.tokenId);
    if (cost != null && Number.isFinite(cost) && cost > 0) {
      totalCostBasisUsd += cost;
      costBasisCoverage += 1;
    }
  }

  const hasCostBasis = costBasisCoverage > 0;
  const unrealizedPnlUsd = hasCostBasis
    ? totalValueUsd - totalCostBasisUsd
    : null;
  const unrealizedPnlPct =
    hasCostBasis && totalCostBasisUsd > 0
      ? (unrealizedPnlUsd! / totalCostBasisUsd) * 100
      : null;

  return {
    visibleCount: visible.length,
    totalValueUsd,
    totalCostBasisUsd: hasCostBasis ? totalCostBasisUsd : null,
    unrealizedPnlUsd,
    unrealizedPnlPct,
    costBasisCoverage,
  };
}
