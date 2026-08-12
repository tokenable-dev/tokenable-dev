"use client";

import Link from "next/link";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { PARTNER_PORTFOLIO_PATH } from "@/lib/portfolio/portfolioPaths";

/** Partner-Add-Cards.html #done-overlay + #done-box */
export function SellFlowPartnerDoneModal({
  count,
  onAddMore,
}: {
  count: number;
  onAddMore: () => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const noun = count === 1 ? "card" : "cards";

  return createPortal(
    <div
      className="sell-flow-partner-done-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="partner-done-title"
    >
      <div className="sell-flow-partner-done-box">
        <div className="sell-flow-partner-done-icon" aria-hidden>
          <svg
            width="34"
            height="34"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--pos)"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div id="partner-done-title" className="sell-flow-partner-done-title">
          <span className="sell-flow-partner-done-n">{count}</span>{" "}
          <span className="sell-flow-partner-done-noun">{noun}</span> registered in your vault
        </div>
        <p className="sell-flow-partner-done-copy">
          They&rsquo;re now digital assets in your portfolio. Set a price to put them up for sale.
        </p>
        <div className="sell-flow-partner-done-actions">
          <Link
            href={PARTNER_PORTFOLIO_PATH}
            className="sell-flow-partner-modal-btn sell-flow-partner-modal-btn--primary"
          >
            Set prices in portfolio
          </Link>
          <button
            type="button"
            className="sell-flow-partner-modal-btn sell-flow-partner-modal-btn--ghost"
            onClick={onAddMore}
          >
            Add more cards
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
