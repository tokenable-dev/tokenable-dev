import type { TxLifecycle } from "@/lib/portfolio/portfolioTypes";
import { txLifecycleLabel } from "@/lib/portfolio/buildPortfolioTxRows";

/** Lifecycle chips — In progress amber · Completed green · Failed red · Canceled gray. */
export function PortfolioHistoryStatusBadge({
  status = "completed",
}: {
  status?: TxLifecycle;
}) {
  const label = txLifecycleLabel(status);
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
