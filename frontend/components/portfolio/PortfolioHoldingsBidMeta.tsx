"use client";

import { formatPortfolioUsd } from "@/lib/portfolio/portfolioTableHelpers";

/** Row / card bid meta — Portfolio.html (design system-2). */
export function PortfolioHoldingsBidMeta({
  isListed,
  highestBidUsd,
}: {
  isListed: boolean;
  highestBidUsd: number | null | undefined;
}) {
  const hasBid = highestBidUsd != null && Number.isFinite(highestBidUsd) && highestBidUsd > 0;

  if (isListed) {
    return (
      <div className="pf-holdings-bid-meta">
        <span className="pf-holdings-bid-meta__listed">Listed</span>
        {hasBid ? (
          <>
            <span className="pf-holdings-bid-meta__dot" aria-hidden>
              ·
            </span>
            <span className="pf-holdings-bid-meta__label">
              Highest bid{" "}
              <span className="pf-holdings-bid-meta__bid">{formatPortfolioUsd(highestBidUsd)}</span>
            </span>
          </>
        ) : null}
      </div>
    );
  }

  if (hasBid) {
    return (
      <div className="pf-holdings-bid-meta">
        <span className="pf-holdings-bid-meta__label">
          Highest bid{" "}
          <span className="pf-holdings-bid-meta__bid">{formatPortfolioUsd(highestBidUsd)}</span>
        </span>
      </div>
    );
  }

  return (
    <div className="pf-holdings-bid-meta pf-holdings-bid-meta--empty">
      <span className="pf-holdings-bid-meta__label">No bids yet</span>
    </div>
  );
}
