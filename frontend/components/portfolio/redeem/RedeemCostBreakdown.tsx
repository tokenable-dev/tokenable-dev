"use client";

import { useTranslations } from "next-intl";
import { useDisplayFx } from "@/components/i18n/DisplayPreferencesProvider";
import {
  formatRedeemUsd,
  type RedeemEstimate,
  type RedeemShipmentEstimate,
} from "@/lib/core/api/rwa-redeem";
import { formatDisplayMoney } from "@/lib/market/displayMoney";

function shipmentGroups(
  est: RedeemEstimate,
  cardCount: number,
): Array<{
  key: string;
  vaultLabel: string;
  cardCount: number;
  shippingUsd: number;
  retrievalFeeTotalUsd: number;
  earlyWithdrawalFeeTotalUsd: number;
}> {
  if (est.shipments && est.shipments.length > 0) {
    return est.shipments.map((sh: RedeemShipmentEstimate) => ({
      key: sh.key,
      vaultLabel: sh.vaultLabel,
      cardCount: sh.cardCount,
      shippingUsd: sh.shippingUsd,
      retrievalFeeTotalUsd: sh.retrievalFeeTotalUsd,
      earlyWithdrawalFeeTotalUsd: sh.earlyWithdrawalFeeTotalUsd,
    }));
  }
  return [
    {
      key: "all",
      vaultLabel: "",
      cardCount,
      shippingUsd: est.shippingUsd,
      retrievalFeeTotalUsd: est.retrievalFeeTotalUsd,
      earlyWithdrawalFeeTotalUsd: est.earlyWithdrawalFeeTotalUsd,
    },
  ];
}

function feeEachUsd(total: number, count: number): number {
  return count > 0 ? total / count : 0;
}

/** Shared redeem fee lines — matches Ship-From-Vault.html `costHTML`. */
export function RedeemCostBreakdown({
  est,
  loading,
  cardCount,
  embed = false,
  title,
  totalLabel,
}: {
  est: RedeemEstimate | undefined;
  loading?: boolean;
  cardCount: number;
  /** When true, omit outer box (already inside Cost / Paid box). */
  embed?: boolean;
  title?: string | null;
  totalLabel?: string;
}) {
  const t = useTranslations("RedeemUi");
  const fx = useDisplayFx();
  const resolvedTitle = title === undefined ? t("totalCharged") : title;
  const resolvedTotal = totalLabel ?? t("total");
  const dash = loading ? "…" : "—";
  const wrapClass = embed ? "pf-redeem-cost__inner" : "pf-redeem-cost";

  const header =
    resolvedTitle != null ? (
      <div className="pf-redeem-cost__title">{resolvedTitle}</div>
    ) : null;

  if (est) {
    const groups = shipmentGroups(est, cardCount);
    return (
      <div className={wrapClass}>
        {header}
        <div className="pf-redeem-cost__lines">
          {groups.map((sh, idx) => (
            <div key={sh.key} className="pf-redeem-cost__shipment">
              <div className="pf-redeem-cost__shipment-title">
                {t("shipmentLine", {
                  index: idx + 1,
                  vault: sh.vaultLabel ? ` · ${sh.vaultLabel}` : "",
                  count: sh.cardCount,
                  unit: sh.cardCount === 1 ? t("cardOne") : t("cardMany"),
                })}
              </div>
              <div className="pf-redeem-cost__line pf-redeem-cost__line--item">
                <span className="pf-redeem-cost__label">{t("shipping")}</span>
                <span className="tkl-mono pf-redeem-cost__val">
                  {formatRedeemUsd(sh.shippingUsd)}
                </span>
              </div>
              <div className="pf-redeem-cost__line pf-redeem-cost__line--item">
                <span className="pf-redeem-cost__label">
                  {t("redemptionFee", {
                    count: sh.cardCount,
                    each: formatRedeemUsd(feeEachUsd(sh.retrievalFeeTotalUsd, sh.cardCount)),
                  })}
                </span>
                <span className="tkl-mono pf-redeem-cost__val">
                  {formatRedeemUsd(sh.retrievalFeeTotalUsd)}
                </span>
              </div>
              {sh.earlyWithdrawalFeeTotalUsd > 0 ? (
                <div className="pf-redeem-cost__line pf-redeem-cost__line--item">
                  <span className="pf-redeem-cost__label">{t("early")}</span>
                  <span className="tkl-mono pf-redeem-cost__val">
                    {formatRedeemUsd(sh.earlyWithdrawalFeeTotalUsd)}
                  </span>
                </div>
              ) : null}
            </div>
          ))}
          <div className="pf-redeem-cost__line pf-redeem-cost__line--total">
            <span className="pf-redeem-cost__label">{resolvedTotal}</span>
            <span className="tkl-mono pf-redeem-cost__val">
              {formatRedeemUsd(est.totalUsd)}
            </span>
          </div>
          {fx.currency !== "USD" && !fx.fallbackToUsd ? (
            <div className="pf-redeem-cost__line">
              <span className="pf-redeem-cost__label">{t("reference")}</span>
              <span className="tkl-mono pf-redeem-cost__val">
                {formatDisplayMoney(est.totalUsd, fx)}
              </span>
            </div>
          ) : null}
        </div>
        {!embed ? (
          <p className="pf-redeem-cost__copy">
            {est.shipments && est.shipments.length > 1
              ? t("multiShip")
              : est.shipments?.[0]?.provider === "partner"
                ? t("partnerShip")
                : t("psaRates")}
            {est.ageBasis === "unknown_assume_early" ? t("earlyNote") : null}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={wrapClass}>
      {header}
      <div className="pf-redeem-cost__lines">
        <div className="pf-redeem-cost__line">
          <span className="pf-redeem-cost__label">{t("shipping")}</span>
          <span className="tkl-mono pf-redeem-cost__val">{dash}</span>
        </div>
        <div className="pf-redeem-cost__line">
          <span className="pf-redeem-cost__label">
            Redemption fee × {cardCount}
          </span>
          <span className="tkl-mono pf-redeem-cost__val">{dash}</span>
        </div>
        <div className="pf-redeem-cost__line pf-redeem-cost__line--total">
          <span className="pf-redeem-cost__label">{totalLabel}</span>
          <span className="tkl-mono pf-redeem-cost__val">{dash}</span>
        </div>
      </div>
    </div>
  );
}
