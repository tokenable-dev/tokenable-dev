"use client";

import Link from "next/link";
import { formatUsdCompact } from "@/lib/market";

function formatSignedUsd(usd: number): string {
  const abs = Math.abs(usd).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
  return `${usd >= 0 ? "+" : "-"}$${abs}`;
}

/**
 * Portfolio.html Variant A — text value hero (chart removed).
 * Eyebrow + large value + 24h change chip.
 */
export function PortfolioValuePanel({
  totalsPending,
  totalValue,
  dailyPnlUsd,
  dailyPnlPct,
  partnerRedeemHref,
}: {
  totalsPending: boolean;
  totalValue: number;
  dailyPnlUsd: number | null;
  dailyPnlPct: number | null;
  /** Partner portfolio — Redeem requests lives in this value row. */
  partnerRedeemHref?: string | null;
}) {
  const showChange =
    dailyPnlUsd != null &&
    dailyPnlPct != null &&
    Number.isFinite(dailyPnlUsd) &&
    Number.isFinite(dailyPnlPct) &&
    (dailyPnlUsd !== 0 || dailyPnlPct !== 0);

  const changePositive = (dailyPnlUsd ?? 0) >= 0;
  const redeemHref = partnerRedeemHref?.trim() || "";

  return (
    <header className="pf-value-hero" aria-label="Portfolio value">
      <div className="pf-value-hero__main">
        <div className="pf-value-hero__eyebrow">Portfolio value</div>
        <div className="pf-value-hero__row">
          {totalsPending ? (
            <span
              className="pf-value-hero__skeleton"
              aria-hidden
            />
          ) : (
            <>
              <span className="pf-value-hero__amount">
                {formatUsdCompact(totalValue)}
              </span>
              {showChange ? (
                <span
                  id="pf-val-chip"
                  className={`tkl-mono pf-value-hero__chip ${
                    changePositive
                      ? "pf-value-hero__chip--pos"
                      : "pf-value-hero__chip--neg"
                  }`}
                >
                  <span aria-hidden>{changePositive ? "▲" : "▼"}</span>{" "}
                  {formatSignedUsd(dailyPnlUsd!)}
                  {" · "}
                  {dailyPnlPct! >= 0 ? "+" : ""}
                  {dailyPnlPct!.toFixed(0)}%
                </span>
              ) : null}
            </>
          )}
        </div>
      </div>
      {redeemHref ? (
        <Link href={redeemHref} className="tkl-view-all pf-value-hero__redeem">
          Redeem requests →
        </Link>
      ) : null}
    </header>
  );
}
