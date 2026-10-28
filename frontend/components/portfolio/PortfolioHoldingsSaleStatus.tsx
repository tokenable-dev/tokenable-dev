"use client";

import { useTranslations } from "next-intl";
import { formatUsdcAmount } from "@/lib/market/displayMoney";
import {
  holdingsSaleKind,
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
  const t = useTranslations("Status");
  const kind = holdingsSaleKind(isListed, redeemStatus);
  const price = isListed ? listPriceUsd : null;
  const label =
    kind === "listed"
      ? price != null && Number.isFinite(price)
        ? t("listedAt", { price: formatUsdcAmount(price) })
        : t("listed")
      : kind === "redeeming"
        ? t("redeeming")
        : t("notListed");
  return (
    <span className={`pf-sale-status ${KIND_CLASS[kind]}`}>{label}</span>
  );
}
