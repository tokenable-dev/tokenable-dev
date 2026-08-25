"use client";

import { PortfolioStatGrid } from "./PortfolioStatGrid";

export function PortfolioSummaryBar({
  holdingsCount,
  tradesCount,
}: {
  holdingsCount: number;
  tradesCount: number;
}) {
  return (
    <header className="pf-hero" aria-label="Portfolio summary">
      <span className="pf-hero__eyebrow">Portfolio</span>
      <h1 className="pf-sec-title tkl-sec-title">Your trading history</h1>
      <PortfolioStatGrid assetsCount={holdingsCount} tradesCount={tradesCount} />
    </header>
  );
}
