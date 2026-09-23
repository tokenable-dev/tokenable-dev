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

/** Portfolio.html status pill — mono 10px chip (Not listed / Listed · $… / Redeeming). */
export function PortfolioHoldingsSaleStatus({
  isListed,
  redeemStatus,
  listPriceUsd = null,
}: {
  isListed: boolean;
  redeemStatus: RedeemSurfaceBadge | null;
  listPriceUsd?: number | null;
}) {
  const kind = holdingsSaleKind(isListed, redeemStatus);
  const label = holdingsSaleStatusLabel(kind, isListed ? listPriceUsd : null);
  return (
    <span className={`pf-sale-status ${KIND_CLASS[kind]}`}>{label}</span>
  );
}
