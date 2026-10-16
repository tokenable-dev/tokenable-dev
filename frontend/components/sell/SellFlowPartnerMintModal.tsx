"use client";

import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { TkButton } from "@/components/ds";
import {
  PARTNER_PORTFOLIO_PATH,
  portfolioUrl,
} from "@/lib/portfolio/portfolioPaths";
import type { PartnerMintBatchResult } from "@/lib/sell/mintSellFlowCard";

type Props = {
  mintBusy: boolean;
  done: number;
  total: number;
  progressHidden: boolean;
  onProgressHiddenChange: (hidden: boolean) => void;
  result: PartnerMintBatchResult | null;
  onDismissResult: () => void;
  onRetryFailed: () => void;
};

/** Partner-Add-Cards-standalone — `#csv-progress` + `#csv-done` (light `glass` card, not sell-flow dark glass). */
export function SellFlowPartnerMintBackground({
  visible,
  done,
  total,
  onShow,
}: {
  visible: boolean;
  done: number;
  total: number;
  onShow: () => void;
}) {
  if (!visible) return null;
  return (
    <p className="sell-flow-csv-bg" role="status">
      Minting in the background ·{" "}
      <span className="tkl-mono">{done}</span> / <span className="tkl-mono">{total}</span>
      {" · "}
      <button type="button" className="sell-flow-csv-link" onClick={onShow}>
        Show
      </button>
    </p>
  );
}

export function SellFlowPartnerMintModal({
  mintBusy,
  done,
  total,
  progressHidden,
  onProgressHiddenChange,
  result,
  onDismissResult,
  onRetryFailed,
}: Props) {
  const complete = result !== null && !mintBusy;
  const open = (mintBusy && !progressHidden) || complete;

  const batchTotal = useMemo(() => {
    if (!result) return total;
    return result.succeeded.length + result.skipped.length;
  }, [result, total]);

  const displayTotal = complete ? Math.max(batchTotal, total) : total;
  const displayDone = complete ? displayTotal : done;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (complete) onProgressHiddenChange(false);
  }, [complete, onProgressHiddenChange]);

  if (!open) return null;

  const barPct =
    displayTotal > 0 ? Math.min(100, (displayDone / displayTotal) * 100) : 0;

  const okN = result?.succeeded.length ?? 0;
  const failed = result?.skipped ?? [];
  const collectionHref = portfolioUrl(PARTNER_PORTFOLIO_PATH, "tab=assets");

  const frac = (
    <>
      <span className="tkl-mono">{displayDone}</span> /{" "}
      <span className="tkl-mono">{displayTotal}</span>
    </>
  );

  return createPortal(
    <div
      className="sell-flow-csv-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="partner-mint-modal-title"
    >
      <div className="sell-flow-csv-modal__card">
        <div className="sell-flow-csv-modal__head">
          <div id="partner-mint-modal-title" className="sell-flow-csv-modal__title">
            Minting your cards
          </div>
          <span
            className={`sell-flow-csv-pill${
              complete ? " sell-flow-csv-pill--done" : ""
            }`}
          >
            {complete ? "Done" : "Minting"}
          </span>
        </div>

        <div className="sell-flow-csv-modal__frac-row">
          <span className="sell-flow-csv-frac tkl-mono">{frac}</span>
        </div>
        <div className="sell-flow-csv-bar" aria-hidden={complete}>
          <span style={{ width: `${barPct}%` }} />
        </div>

        {complete ? (
          <>
            <p className="sell-flow-csv-modal__done-title">
              <span className="tkl-mono">{okN}</span> card{okN === 1 ? "" : "s"} minted to your
              collection
            </p>
            {failed.length > 0 ? (
              <p className="sell-flow-csv-modal__done-fail">
                <span className="tkl-mono">{failed.length}</span> failed:{" "}
                {failed.map((row, i) => (
                  <span key={row.cert}>
                    {i > 0 ? ", " : null}
                    <span className="tkl-mono">{row.cert}</span>
                  </span>
                ))}
              </p>
            ) : null}
            <div className="sell-flow-csv-modal__done-actions">
              <TkButton
                href={collectionHref}
                variant="primary"
                className="sell-flow-csv-modal__view"
              >
                View in collection
              </TkButton>
              {failed.length > 0 ? (
                <TkButton
                  type="button"
                  variant="subtle"
                  className="sell-flow-partner-btn--ghost sell-flow-csv-modal__close"
                  onClick={() => {
                    onDismissResult();
                    onRetryFailed();
                  }}
                >
                  Retry failed
                </TkButton>
              ) : (
                <TkButton
                  type="button"
                  variant="subtle"
                  className="sell-flow-partner-btn--ghost sell-flow-csv-modal__close"
                  onClick={onDismissResult}
                >
                  Close
                </TkButton>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="sell-flow-csv-pnote sell-flow-csv-modal__note">
              Each card is minted on-chain one at a time on our servers. You can hide this
              dialog or leave this page — mint keeps running. We&apos;ll notify you in your
              inbox when the batch finishes.
            </p>
            <div className="sell-flow-csv-modal__btns">
              <TkButton
                type="button"
                variant="subtle"
                className="sell-flow-partner-btn--ghost sell-flow-csv-modal__hide"
                onClick={() => onProgressHiddenChange(true)}
              >
                Hide
              </TkButton>
              <TkButton
                type="button"
                variant="primary"
                className="sell-flow-csv-modal__prog"
                disabled
                aria-disabled="true"
              >
                {displayTotal > 0 ? (
                  <>
                    Minting <span className="tkl-mono">{displayDone}</span> /{" "}
                    <span className="tkl-mono">{displayTotal}</span>
                  </>
                ) : (
                  "Minting"
                )}
              </TkButton>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
