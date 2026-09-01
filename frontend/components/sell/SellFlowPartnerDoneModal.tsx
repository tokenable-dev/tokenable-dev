"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { TkButton } from "@/components/ds";
import { PARTNER_PORTFOLIO_PATH } from "@/lib/portfolio/portfolioPaths";
import type { PartnerMintBatchResult } from "@/lib/sell/mintSellFlowCard";

/** Partner mint success — overlay modal (copy from Choose-Vault-Individual.html #scr-done). */
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

  const title = allFailed ? (
    <>None of {total} cards were registered</>
  ) : (
    <>
      {ok} {noun} vaulted and token minted.
      {skip > 0 ? ` (${skip} skipped)` : null}
    </>
  );

  const copy = allFailed
    ? "Each card below was skipped so the rest of the queue could finish. You can fix them and try again."
    : skip > 0
      ? "Registered cards are in your portfolio. Skipped cards stayed in your list so you can retry."
      : "Set a price and start selling, or add more cards.";

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
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          ) : (
            <svg
              width="42"
              height="42"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--pos, rgb(0, 200, 100))"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
        <h1 id="partner-done-title" className="sell-flow-partner-done-title">
          {title}
        </h1>
        <p className="sell-flow-partner-done-copy">{copy}</p>

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
            <TkButton href={PARTNER_PORTFOLIO_PATH} variant="primary">
              Set prices
            </TkButton>
          ) : null}
          <TkButton type="button" variant={ok > 0 ? "subtle" : "primary"} onClick={onAddMore}>
            Add cards
          </TkButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}
