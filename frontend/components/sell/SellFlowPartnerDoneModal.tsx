"use client";

import Link from "next/link";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { PARTNER_PORTFOLIO_PATH } from "@/lib/portfolio/portfolioPaths";
import type { PartnerMintBatchResult } from "@/lib/sell/mintSellFlowCard";

/** Partner-Add-Cards.html #done-overlay + #done-box */
export function SellFlowPartnerDoneModal({
  result,
  onAddMore,
}: {
  result: PartnerMintBatchResult;
  onAddMore: () => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const ok = result.succeeded.length;
  const skip = result.skipped.length;
  const total = ok + skip;
  const allFailed = ok === 0 && skip > 0;
  const noun = ok === 1 ? "card" : "cards";

  return createPortal(
    <div
      className="sell-flow-partner-done-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="partner-done-title"
    >
      <div className="sell-flow-partner-done-box">
        <div
          className={
            allFailed
              ? "sell-flow-partner-done-icon sell-flow-partner-done-icon--warn"
              : "sell-flow-partner-done-icon"
          }
          aria-hidden
        >
          {allFailed ? (
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          ) : (
            <svg
              width="34"
              height="34"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#059669"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
        <div id="partner-done-title" className="sell-flow-partner-done-title">
          {allFailed ? (
            <>None of {total} cards were registered</>
          ) : (
            <>
              <span className="sell-flow-partner-done-n">{ok}</span>{" "}
              <span className="sell-flow-partner-done-noun">{noun}</span> registered
              {skip > 0 ? (
                <>
                  {" "}
                  <span className="sell-flow-partner-done-skip-n">
                    ({skip} skipped)
                  </span>
                </>
              ) : (
                <> in your vault</>
              )}
            </>
          )}
        </div>
        <p className="sell-flow-partner-done-copy">
          {allFailed
            ? "Each card below was skipped so the rest of the queue could finish. You can fix them and try again."
            : skip > 0
              ? "Registered cards are in your portfolio. Skipped cards stayed in your list so you can retry."
              : "They’re now digital assets in your portfolio. Set a price to put them up for sale."}
        </p>

        {ok + skip > 0 ? (
          <div className="sell-flow-partner-done-scroll">
            {ok > 0 ? (
              <ul className="sell-flow-partner-done-list" aria-label="Registered">
                {result.succeeded.map((row) => (
                  <li key={`ok-${row.cert}`} className="sell-flow-partner-done-row">
                    <span className="sell-flow-partner-done-row__mark sell-flow-partner-done-row__mark--ok">
                      OK
                    </span>
                    <span className="sell-flow-partner-done-row__body">
                      <span className="sell-flow-partner-done-row__name">{row.name}</span>
                      <span className="sell-flow-partner-done-row__meta tkl-mono">
                        Cert #{row.cert} · token #{row.tokenId}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            {skip > 0 ? (
              <ul className="sell-flow-partner-done-list" aria-label="Skipped">
                {result.skipped.map((row) => (
                  <li key={`skip-${row.cert}`} className="sell-flow-partner-done-row">
                    <span className="sell-flow-partner-done-row__mark sell-flow-partner-done-row__mark--skip">
                      Skip
                    </span>
                    <span className="sell-flow-partner-done-row__body">
                      <span className="sell-flow-partner-done-row__name">{row.name}</span>
                      <span className="sell-flow-partner-done-row__meta tkl-mono">
                        Cert #{row.cert} · {row.title}
                      </span>
                      <span className="sell-flow-partner-done-row__detail">{row.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="sell-flow-partner-done-actions">
          {ok > 0 ? (
            <Link
              href={PARTNER_PORTFOLIO_PATH}
              className="sell-flow-partner-modal-btn sell-flow-partner-modal-btn--primary"
            >
              Set prices in portfolio
            </Link>
          ) : null}
          <button
            type="button"
            className={
              ok > 0
                ? "sell-flow-partner-modal-btn sell-flow-partner-modal-btn--ghost"
                : "sell-flow-partner-modal-btn sell-flow-partner-modal-btn--primary"
            }
            onClick={onAddMore}
          >
            {skip > 0 ? "Back to remaining cards" : "Add more cards"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
