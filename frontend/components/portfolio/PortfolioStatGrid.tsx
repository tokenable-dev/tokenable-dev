"use client";

import type { ReactNode } from "react";
import Link from "next/link";

function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

function BidsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" aria-hidden>
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
    </svg>
  );
}

function WatchlistIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function StatCard({
  icon,
  label,
  value,
  href,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  href?: string;
}) {
  const inner = (
    <>
      <div className="pf-stat-card__label">
        {icon}
        <span>{label}</span>
      </div>
      <div className="pf-stat-card__value">{value}</div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className="pf-stat-card pf-stat-card--link">
        {inner}
      </Link>
    );
  }

  return <div className="pf-stat-card">{inner}</div>;
}

export function PortfolioStatGrid({
  assetsCount,
  bidsCount,
  watchlistCount,
}: {
  assetsCount: number;
  bidsCount: number;
  watchlistCount: number;
}) {
  return (
    <div className="pf-stat-grid" role="group" aria-label="Portfolio summary">
      <StatCard icon={<GridIcon />} label="Assets" value={String(assetsCount)} />
      <StatCard icon={<BidsIcon />} label="Bids" value={String(bidsCount)} />
      <StatCard
        icon={<WatchlistIcon />}
        label="Watchlist"
        value={String(watchlistCount)}
        href="/watchlist"
      />
    </div>
  );
}
