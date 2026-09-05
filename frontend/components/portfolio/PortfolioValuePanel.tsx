"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatUsdCompact } from "@/lib/market";
import { listPartnerRedeems, rq } from "@/lib/core";
import { groupPartnerRedeems } from "@/lib/partner/partnerRedeemGroups";
import {
  formatPortfolioValueChangeLabel,
  resolvePortfolioValueChangeState,
} from "@/lib/portfolio/portfolioValueChange";

function RedeemRequestsIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <polyline
        points="3.3 7 12 12 20.7 7"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

/**
 * Portfolio value hero — Portfolio.html + portfolio_value_states.html.
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
  const changeState = resolvePortfolioValueChangeState(dailyPnlUsd, dailyPnlPct);
  const changeLabel =
    changeState === "nodata" || dailyPnlUsd == null || dailyPnlPct == null
      ? null
      : formatPortfolioValueChangeLabel(changeState, dailyPnlUsd, dailyPnlPct);
  const redeemHref = partnerRedeemHref?.trim() || "";

  const partnerRedeemQuery = useQuery({
    queryKey: rq.partnerRedeems(),
    queryFn: () => listPartnerRedeems({ limit: 100 }),
    enabled: Boolean(redeemHref),
    staleTime: 10_000,
  });

  const toShipCount = useMemo(() => {
    if (!redeemHref) return 0;
    return groupPartnerRedeems(partnerRedeemQuery.data?.items ?? []).filter(
      (group) => group.tab === "to_ship",
    ).length;
  }, [redeemHref, partnerRedeemQuery.data?.items]);

  return (
    <header className="pf-value-hero" aria-label="Portfolio value">
      <div className="pf-value-hero__main">
        <div className="pf-value-hero__eyebrow">Portfolio value</div>
        <div className="pf-value-hero__row">
          {totalsPending ? (
            <span className="pf-value-hero__skeleton" aria-hidden />
          ) : (
            <>
              <span className="pf-value-hero__amount">
                {formatUsdCompact(totalValue)}
              </span>
              {changeState === "nodata" ? (
                <span className="tkl-mono pf-value-hero__chip pf-value-hero__chip--flat">
                  —
                </span>
              ) : changeLabel ? (
                <span
                  id="pf-val-chip"
                  className={`tkl-mono pf-value-hero__chip pf-value-hero__chip--${changeState}`}
                >
                  <span className="pf-value-hero__chip-dir" aria-hidden>
                    {changeLabel.arrow}
                  </span>
                  {changeLabel.usd}
                  <span className="pf-value-hero__chip-dot" aria-hidden>
                    {" · "}
                  </span>
                  {changeLabel.pct}
                </span>
              ) : null}
            </>
          )}
        </div>
        {!totalsPending && changeState === "nodata" ? (
          <p className="pf-value-hero__note">No change data yet</p>
        ) : null}
      </div>
      {redeemHref ? (
        <Link
          href={redeemHref}
          className="tk-btn tk-btn--primary pf-value-hero__redeem"
        >
          <span className="pf-value-hero__redeem-icon" aria-hidden>
            <RedeemRequestsIcon />
          </span>
          <span className="pf-value-hero__redeem-text">
            <span className="pf-value-hero__redeem-title">Redeem requests</span>
          </span>
          {toShipCount > 0 ? (
            <span
              className="tkl-mono pf-value-hero__redeem-badge"
              aria-label={`${toShipCount} to ship`}
            >
              {toShipCount}
            </span>
          ) : null}
        </Link>
      ) : null}
    </header>
  );
}
