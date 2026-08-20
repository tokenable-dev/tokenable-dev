"use client";

import Link from "next/link";

function PackageIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.3 7 12 12 20.7 7" />
    </svg>
  );
}

/** Partner-Portfolio.html page header — pf-hero copy + Redeem requests CTA. */
export function PartnerPortfolioHeader({ toShipCount }: { toShipCount: number }) {
  return (
    <header className="pf-hero partner-portfolio-header" aria-label="Partner portfolio">
      <div className="partner-portfolio-header__row">
        <div className="partner-portfolio-header__copy">
          <span className="pf-hero__eyebrow">Partner portfolio</span>
          <h1 className="pf-sec-title tkl-page-title">Your trading history</h1>
        </div>
        <Link
          href="/partner/shipments"
          className="partner-portfolio-header__cta tk-btn tk-btn--primary"
        >
          <PackageIcon />
          <span className="partner-portfolio-header__cta-text">
            <span className="partner-portfolio-header__cta-title">Redeem requests</span>
            <span className="partner-portfolio-header__cta-sub tkl-mono">
              Ship within 5 days
            </span>
          </span>
          <span
            className="partner-portfolio-header__badge tkl-mono"
            aria-label={`${toShipCount} to ship`}
          >
            {toShipCount}
          </span>
        </Link>
      </div>
    </header>
  );
}
