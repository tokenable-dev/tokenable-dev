"use client";

import type { ReactNode } from "react";

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

function TradesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" aria-hidden>
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
    </svg>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="pf-stat-card">
      <div className="pf-stat-card__label">
        {icon}
        <span>{label}</span>
      </div>
      <div className="pf-stat-card__value">{value}</div>
    </div>
  );
}

export function PortfolioStatGrid({
  assetsCount,
  tradesCount,
}: {
  assetsCount: number;
  tradesCount: number;
}) {
  return (
    <div className="pf-stat-grid" role="group" aria-label="Portfolio summary">
      <StatCard icon={<GridIcon />} label="Assets" value={String(assetsCount)} />
      <StatCard icon={<TradesIcon />} label="Trades" value={String(tradesCount)} />
    </div>
  );
}
