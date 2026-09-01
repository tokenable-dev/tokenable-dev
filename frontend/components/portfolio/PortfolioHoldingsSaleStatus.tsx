import {
  holdingsSaleKind,
  holdingsSaleStatusLabel,
  type HoldingsSaleKind,
} from "@/lib/portfolio/portfolioHoldingsSaleStatus";
import type { RedeemSurfaceBadge } from "@/lib/portfolio/redeemDraft";

const KIND_CLASS: Record<HoldingsSaleKind, string> = {
  not_listed: "pf-sale-status--neutral",
  listed: "pf-sale-status--listed",
  redeeming: "pf-sale-status--redeeming",
};

/** Dot + label only — no subtext (shipping copy lives behind Track). */
export function PortfolioHoldingsSaleStatus({
  isListed,
  listPriceUsd,
  redeemStatus,
}: {
  isListed: boolean;
  listPriceUsd: number | null;
  redeemStatus: RedeemSurfaceBadge | null;
}) {
  const kind = holdingsSaleKind(isListed, redeemStatus);
  const label = holdingsSaleStatusLabel(kind, listPriceUsd);
  return (
    <span className={`pf-sale-status ${KIND_CLASS[kind]}`}>
      <span className="pf-sale-status__dot" aria-hidden />
      {label}
    </span>
  );
}
