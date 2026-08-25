"use client";

import {
  formatRedeemUsd,
  type RedeemEstimate,
} from "@/lib/core/api/rwa-redeem";

/** Shared redeem fee lines — supports multi-shipment (PSA + Partner). */
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

  if (est?.shipments && est.shipments.length > 0) {
    return (
      <div className={wrapClass}>
        {header}
        <div className="pf-redeem-cost__lines">
          {est.shipments.map((sh, idx) => (
            <div key={sh.key} className="pf-redeem-cost__shipment">
              <div className="pf-redeem-cost__shipment-title">
                Shipment {idx + 1} · {sh.vaultLabel}{" "}
                <span className="pf-redeem-cost__shipment-count">
                  ({sh.cardCount} card{sh.cardCount === 1 ? "" : "s"})
                </span>
              </div>
              <div className="pf-redeem-cost__line">
                <span className="pf-redeem-cost__label">
                  Shipping &amp; handling
                  {sh.shippingSource === "fedex_stub"
                    ? " (estimate)"
                    : sh.shippingSource === "fedex_rate"
                      ? " (FedEx)"
                      : ""}
                </span>
                <span className="tkl-mono">
                  {formatRedeemUsd(sh.shippingUsd)}
                </span>
              </div>
              {sh.retrievalFeeTotalUsd > 0 ? (
                <div className="pf-redeem-cost__line">
                  <span className="pf-redeem-cost__label">
                    Redemption fee (
                    {sh.cardCount} ×{" "}
                    {formatRedeemUsd(
                      sh.cardCount > 0
                        ? sh.retrievalFeeTotalUsd / sh.cardCount
                        : 0,
                    )}
                    )
                  </span>
                  <span className="tkl-mono">
                    {formatRedeemUsd(sh.retrievalFeeTotalUsd)}
                  </span>
                </div>
              ) : null}
              {sh.earlyWithdrawalFeeTotalUsd > 0 ? (
                <div className="pf-redeem-cost__line">
                  <span className="pf-redeem-cost__label">
                    Early withdrawal
                  </span>
                  <span className="tkl-mono">
                    {formatRedeemUsd(sh.earlyWithdrawalFeeTotalUsd)}
                  </span>
                </div>
              ) : null}
            </div>
          ))}
          <div className="pf-redeem-cost__line pf-redeem-cost__line--total">
            <span>{totalLabel}</span>
            <span className="tkl-mono">{formatRedeemUsd(est.totalUsd)}</span>
          </div>
        </div>
        {!embed ? (
          <p className="pf-redeem-cost__copy">
            {est.shipments.length > 1
              ? "Separate shipments when cards come from different vaults. One USDC payment covers all."
              : est.shipments[0]?.provider === "partner"
                ? "Partner vault shipping estimate — FedEx Rate when enabled."
                : "Matches PSA Vault published rates — no markup."}
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
          <span className="pf-redeem-cost__label">Shipping &amp; handling</span>
          <span className="tkl-mono">
            {est ? formatRedeemUsd(est.shippingUsd) : dash}
          </span>
        </div>
        <div className="pf-redeem-cost__line">
          <span className="pf-redeem-cost__label">
            Redemption fee
            {est && cardCount > 0
              ? ` (${cardCount} × ${formatRedeemUsd(est.retrievalFeeTotalUsd / cardCount)})`
              : ` × ${cardCount}`}
          </span>
          <span className="tkl-mono">
            {est ? formatRedeemUsd(est.retrievalFeeTotalUsd) : dash}
          </span>
        </div>
        {est && est.earlyWithdrawalCardCount > 0 ? (
          <div className="pf-redeem-cost__line">
            <span className="pf-redeem-cost__label">
              Early withdrawal (&lt;{est.earlyWithdrawalDays}d)
              {` (${est.earlyWithdrawalCardCount} × ${formatRedeemUsd(est.earlyWithdrawalFeePerCardUsd)})`}
            </span>
            <span className="tkl-mono">
              {formatRedeemUsd(est.earlyWithdrawalFeeTotalUsd)}
            </span>
          </div>
        ) : null}
        <div className="pf-redeem-cost__line pf-redeem-cost__line--total">
          <span>{totalLabel}</span>
          <span className="tkl-mono">
            {est ? formatRedeemUsd(est.totalUsd) : dash}
          </span>
        </div>
      </div>
      {!embed ? (
        <p className="pf-redeem-cost__copy">
          {est?.shipments?.[0]?.provider === "partner"
            ? "Partner vault shipping estimate — FedEx Rate when enabled."
            : "Matches PSA Vault published rates — no markup."}
          {est?.ageBasis === "unknown_assume_early"
            ? " Early-withdrawal applied until vault age is confirmed."
            : null}
        </p>
      ) : null}
    </div>
  );
}
