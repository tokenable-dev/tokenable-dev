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
  /** Null when no holding has a resolvable mark yet (avoid hero `$0` flash). */
  totalValue: number | null;
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
        <div className="pf-value-hero__eyebrow">Collection value</div>
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
                  className={`pf-value-hero__chip pf-value-hero__chip--${changeState}`}
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
      </div>
      {redeemHref ? (
        <Link
          id="pf-redeem-link"
          href={redeemHref}
          className="tk-btn tk-btn--primary pf-value-hero__redeem"
        >
          <span className="pf-value-hero__redeem-label">Redeem requests</span>
          {toShipCount > 0 ? (
            <span id="pf-redeem-n" className="tkl-mono pf-value-hero__redeem-count">
              ({toShipCount})
            </span>
          ) : null}
        </Link>
      ) : null}
    </header>
  );
}
