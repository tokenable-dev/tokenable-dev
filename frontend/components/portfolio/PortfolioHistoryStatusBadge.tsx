/** Transaction history status — Portfolio.html `hbadge` outline chips. */
export function PortfolioHistoryStatusBadge({
  status = "settled",
}: {
  status?: "settled" | "pending" | "failed" | "vaulted";
}) {
  if (status === "pending") {
    return (
      <span className="pf-hbadge pf-hbadge--pending">
        <span className="pf-hbadge__dot" aria-hidden />
        Pending
      </span>
    );
  }

  const label =
    status === "failed" ? "Failed" : status === "vaulted" ? "Vaulted" : "Settled";

  return <span className={`pf-hbadge pf-hbadge--${status}`}>{label}</span>;
}
