"use client";

import { useTranslations } from "next-intl";
import type { TxLifecycle } from "@/lib/portfolio/portfolioTypes";

const LIFE_KEY = {
  in_progress: "inProgress",
  failed: "failed",
  canceled: "canceled",
  completed: "completed",
} as const;

/** Lifecycle chips — In progress amber · Completed green · Failed red · Canceled gray. */
export function PortfolioHistoryStatusBadge({
  status = "completed",
}: {
  status?: TxLifecycle;
}) {
  const t = useTranslations("Status");
  const label = t(LIFE_KEY[status]);
  if (status === "in_progress") {
    return (
      <span className="pf-hbadge pf-hbadge--pending">
        <span className="pf-hbadge__dot" aria-hidden />
        {label}
      </span>
    );
  }
  if (status === "failed") {
    return <span className="pf-hbadge pf-hbadge--failed">{label}</span>;
  }
  if (status === "canceled") {
    return <span className="pf-hbadge pf-hbadge--canceled">{label}</span>;
  }
  return <span className="pf-hbadge pf-hbadge--settled">{label}</span>;
}
