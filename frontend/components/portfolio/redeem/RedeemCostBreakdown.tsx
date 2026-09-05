"use client";

import {
  formatRedeemUsd,
  type RedeemEstimate,
  type RedeemShipmentEstimate,
} from "@/lib/core/api/rwa-redeem";

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
  title = "Total charged now",
  totalLabel = "Total",
}: {
  est: RedeemEstimate | undefined;
  loading?: boolean;
  cardCount: number;
  /** When true, omit outer box (already inside Cost / Paid box). */
  embed?: boolean;
  title?: string | null;
  totalLabel?: string;
}) {
  const dash = loading ? "…" : "—";
  const wrapClass = embed ? "pf-redeem-cost__inner" : "pf-redeem-cost";

  const header =
    title != null ? (
      <div className="pf-redeem-cost__title">{title}</div>
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
                Shipment {idx + 1}
                {sh.vaultLabel ? ` · ${sh.vaultLabel}` : ""}{" "}
                <span className="pf-redeem-cost__shipment-count">
                  ({sh.cardCount} card{sh.cardCount === 1 ? "" : "s"})
                </span>
              </div>
              <div className="pf-redeem-cost__line pf-redeem-cost__line--item">
                <span className="pf-redeem-cost__label">Shipping and handling</span>
                <span className="tkl-mono pf-redeem-cost__val">
                  {formatRedeemUsd(sh.shippingUsd)}
                </span>
              </div>
              <div className="pf-redeem-cost__line pf-redeem-cost__line--item">
                <span className="pf-redeem-cost__label">
                  Redemption fee (
                  {sh.cardCount} ×{" "}
                  {formatRedeemUsd(feeEachUsd(sh.retrievalFeeTotalUsd, sh.cardCount))}
                  )
                </span>
                <span className="tkl-mono pf-redeem-cost__val">
                  {formatRedeemUsd(sh.retrievalFeeTotalUsd)}
                </span>
              </div>
              {sh.earlyWithdrawalFeeTotalUsd > 0 ? (
                <div className="pf-redeem-cost__line pf-redeem-cost__line--item">
                  <span className="pf-redeem-cost__label">Early withdrawal</span>
                  <span className="tkl-mono pf-redeem-cost__val">
                    {formatRedeemUsd(sh.earlyWithdrawalFeeTotalUsd)}
                  </span>
                </div>
              ) : null}
            </div>
          ))}
          <div className="pf-redeem-cost__line pf-redeem-cost__line--total">
            <span className="pf-redeem-cost__label">{totalLabel}</span>
            <span className="tkl-mono pf-redeem-cost__val">
              {formatRedeemUsd(est.totalUsd)}
            </span>
          </div>
        </div>
        {!embed ? (
          <p className="pf-redeem-cost__copy">
            {est.shipments && est.shipments.length > 1
              ? "Separate shipments when cards come from different vaults. One USDC payment covers all."
              : est.shipments?.[0]?.provider === "partner"
                ? "Partner vault shipping estimate — FedEx Rate when enabled."
                : "Matches PSA Vault published rates — no markup."}
            {est.ageBasis === "unknown_assume_early"
              ? " Early-withdrawal applied until vault age is confirmed."
              : null}
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
          <span className="pf-redeem-cost__label">Shipping and handling</span>
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
