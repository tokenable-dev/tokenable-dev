"use client";

import { formatUsdCompact } from "@/lib/market";
import { WalletAddressCompact } from "@/components/wallet/WalletAddressCompact";
import { PortfolioStatGrid } from "./PortfolioStatGrid";

export function PortfolioSummaryBar({
  walletAddress,
  holdingsCount,
  bidsCount,
  watchlistCount,
  totalValue,
  dailyPnlPct,
  chartTotalsPending,
  hasDailyPnl,
  dailyPnlUsd,
}: {
  walletAddress: string | undefined;
  holdingsCount: number;
  bidsCount: number;
  watchlistCount: number;
  totalValue: number;
  dailyPnlPct: number | null;
  chartTotalsPending: boolean;
  hasDailyPnl: boolean;
  dailyPnlUsd: number | null;
}) {
  const changePositive = dailyPnlPct != null && dailyPnlPct >= 0;
  const showChange =
    !chartTotalsPending && dailyPnlPct != null && dailyPnlPct !== 0 && hasDailyPnl;

  return (
    <header className="pf-hero" aria-label="Portfolio summary">
      <div className="pf-hero__top">
        <span className="pf-hero__eyebrow">Portfolio value</span>
        {walletAddress ? (
          <span className="pf-wallet-chip">
            <span className="pf-wallet-chip__dot" aria-hidden />
            <WalletAddressCompact address={walletAddress} />
          </span>
        ) : null}
      </div>

      <div className="pf-hero__value-row">
        {chartTotalsPending ? (
          <span
            className="inline-block h-10 w-36 animate-pulse rounded-lg bg-white/10 sm:h-12 sm:w-44"
            aria-hidden
          />
        ) : (
          <span className="pf-hero__value">{formatUsdCompact(totalValue)}</span>
        )}
        {showChange ? (
          <span className="pf-hero__metric-group">
            <span
              className={`pf-hero__change-chip ${
                changePositive ? "pf-hero__change-chip--pos" : "pf-hero__change-chip--neg"
              }`}
            >
              {changePositive ? "▲" : "▼"}{" "}
              {(() => {
                const n = dailyPnlUsd!;
                const sign = n >= 0 ? "+" : "-";
                const abs = Math.abs(n);
                const body =
                  abs >= 1000
                    ? abs.toLocaleString("en-US", { maximumFractionDigits: 0 })
                    : abs.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      });
                return `${sign}$${body}`;
              })()}{" "}
              ({dailyPnlPct! >= 0 ? "+" : ""}
              {dailyPnlPct!.toFixed(2)}%)
            </span>
            <span className="pf-hero__period-label">24h</span>
          </span>
        ) : null}
      </div>

      <PortfolioStatGrid
        assetsCount={holdingsCount}
        bidsCount={bidsCount}
        watchlistCount={watchlistCount}
      />
    </header>
  );
}
