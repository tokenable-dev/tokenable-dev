"use client";

import { useEffect, useState } from "react";
import type { TxRow } from "@/lib/portfolio/portfolioTypes";
import { formatPortfolioUsd } from "@/lib/portfolio/portfolioTableHelpers";
import { PortfolioHistoryStatusBadge } from "./PortfolioHistoryStatusBadge";

const FEE_PCT = 5;
const CLOSE_MS = 280;

function typeLabel(tx: TxRow): string {
  if (tx.status === "vaulted") return "Vault (Mint)";
  return tx.type === "BUY" ? "Buy" : "Sell";
}

function typeClass(tx: TxRow): string {
  if (tx.status === "vaulted") return "pf-table-type--vault";
  return tx.type === "BUY" ? "pf-table-type--buy" : "pf-table-type--sell";
}

function cardSubline(tx: TxRow): string {
  const grade = tx.gradeLabel?.trim();
  const cert = tx.certNumber?.trim();
  if (grade && cert) return `${grade} · Cert #${cert}`;
  if (grade) return grade;
  if (cert) return `Cert #${cert}`;
  return tx.category?.trim() || "—";
}

/** Portfolio.html `#hx-drawer` — transaction detail side panel. */
export function PortfolioTxDetailDrawer({
  tx,
  onClose,
}: {
  tx: TxRow | null;
  onClose: () => void;
}) {
  const [displayTx, setDisplayTx] = useState<TxRow | null>(tx);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (tx) {
      setDisplayTx(tx);
      const id = requestAnimationFrame(() => setOpen(true));
      return () => cancelAnimationFrame(id);
    }
    setOpen(false);
    const t = window.setTimeout(() => setDisplayTx(null), CLOSE_MS);
    return () => window.clearTimeout(t);
  }, [tx]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    setCopied(false);
  }, [displayTx?.orderHash]);

  if (!displayTx) return null;

  const status = displayTx.status ?? "settled";
  const fee = Math.round(displayTx.price * (FEE_PCT / 100));
  const isSell = displayTx.type === "SELL";
  const isVault = status === "vaulted";
  const isPending = status === "pending";
  const isFailed = status === "failed";
  const showMoney = !isVault && displayTx.price > 0;
  const orderHash = displayTx.orderHash;
  const shortHash = `${orderHash.slice(0, 6)}…${orderHash.slice(-4)}`;

  async function copyHash() {
    try {
      await navigator.clipboard.writeText(orderHash);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <button
        type="button"
        className={`pf-tx-drawer-overlay${open ? " pf-tx-drawer-overlay--open" : ""}`}
        aria-label="Close transaction detail"
        onClick={onClose}
      />
      <aside
        className={`pf-tx-drawer${open ? " pf-tx-drawer--open" : ""}`}
        aria-label="Transaction detail"
      >
        <div className="pf-tx-drawer__head">
          <span className="pf-tx-drawer__title">Transaction Detail</span>
          <button
            type="button"
            className="pf-tx-drawer__close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="pf-tx-drawer__body">
          <div className="pf-tx-drawer__card pf-tx-drawer__card--with-img">
            <div className="pf-tx-drawer__thumb">
              {displayTx.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={displayTx.imageUrl} alt="" />
              ) : null}
            </div>
            <div className="pf-tx-drawer__card-copy">
              <div className="pf-tx-drawer__card-name">{displayTx.asset}</div>
              <div className="pf-tx-drawer__card-sub tkl-mono">{cardSubline(displayTx)}</div>
            </div>
          </div>

          <div className="pf-tx-drawer__meta">
            <div className="pf-tx-drawer__row">
              <span className="pf-tx-drawer__k">Type</span>
              <span className={`pf-tx-drawer__v pf-table-type ${typeClass(displayTx)}`}>
                {typeLabel(displayTx)}
              </span>
            </div>
            <div className="pf-tx-drawer__row">
              <span className="pf-tx-drawer__k">Date</span>
              <span className="pf-tx-drawer__v tkl-mono pf-table-muted">
                {displayTx.dateTimeLabel ?? displayTx.date}
              </span>
            </div>
            <div className="pf-tx-drawer__row">
              <span className="pf-tx-drawer__k">Status</span>
              <PortfolioHistoryStatusBadge status={status} />
            </div>
          </div>

          {showMoney ? (
            <>
              <div className="pf-tx-drawer__divider" />
              <div className="pf-tx-drawer__money">
                {isFailed ? (
                  <>
                    <div className="pf-tx-drawer__row">
                      <span className="pf-tx-drawer__k">
                        {isSell ? "Asking Price" : "Purchase Price"}
                      </span>
                      <span className="pf-tx-drawer__v tkl-mono">
                        {formatPortfolioUsd(displayTx.price)}
                      </span>
                    </div>
                    <p className="pf-tx-drawer__note pf-tx-drawer__note--danger tkl-mono">
                      This transaction failed. No funds were moved.
                    </p>
                  </>
                ) : isPending ? (
                  <>
                    <div className="pf-tx-drawer__row">
                      <span className="pf-tx-drawer__k">Listed Price</span>
                      <span className="pf-tx-drawer__v tkl-mono">
                        {formatPortfolioUsd(displayTx.price)}
                      </span>
                    </div>
                    <div className="pf-tx-drawer__row">
                      <span className="pf-tx-drawer__k">
                        Platform Fee ({FEE_PCT}%)
                      </span>
                      <span className="pf-tx-drawer__v tkl-mono pf-tx-drawer__fee">
                        -{formatPortfolioUsd(fee)}
                      </span>
                    </div>
                    <div className="pf-tx-drawer__divider pf-tx-drawer__divider--tight" />
                    <div className="pf-tx-drawer__row pf-tx-drawer__row--total">
                      <span className="pf-tx-drawer__k">Estimated Net</span>
                      <span className="pf-tx-drawer__v tkl-mono pf-tx-drawer__total pf-tx-drawer__total--pending">
                        {formatPortfolioUsd(displayTx.price - fee)}
                      </span>
                    </div>
                    <p className="pf-tx-drawer__note tkl-mono">
                      Settlement usually completes within a few minutes.
                    </p>
                  </>
                ) : isSell ? (
                  <>
                    <div className="pf-tx-drawer__row">
                      <span className="pf-tx-drawer__k">Settled Price</span>
                      <span className="pf-tx-drawer__v tkl-mono">
                        {formatPortfolioUsd(displayTx.price)}
                      </span>
                    </div>
                    <div className="pf-tx-drawer__row">
                      <span className="pf-tx-drawer__k">
                        Platform Fee ({FEE_PCT}%)
                      </span>
                      <span className="pf-tx-drawer__v tkl-mono pf-tx-drawer__fee">
                        -{formatPortfolioUsd(fee)}
                      </span>
                    </div>
                    <div className="pf-tx-drawer__divider pf-tx-drawer__divider--tight" />
                    <div className="pf-tx-drawer__row pf-tx-drawer__row--total">
                      <span className="pf-tx-drawer__k">Net Received</span>
                      <span className="pf-tx-drawer__v tkl-mono pf-tx-drawer__total pf-tx-drawer__total--pos">
                        {formatPortfolioUsd(displayTx.price - fee)}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="pf-tx-drawer__row">
                      <span className="pf-tx-drawer__k">Purchase Price</span>
                      <span className="pf-tx-drawer__v tkl-mono">
                        {formatPortfolioUsd(displayTx.price)}
                      </span>
                    </div>
                    <div className="pf-tx-drawer__row">
                      <span className="pf-tx-drawer__k">
                        Platform Fee ({FEE_PCT}%)
                      </span>
                      <span className="pf-tx-drawer__v tkl-mono pf-tx-drawer__fee">
                        -{formatPortfolioUsd(fee)}
                      </span>
                    </div>
                    <div className="pf-tx-drawer__divider pf-tx-drawer__divider--tight" />
                    <div className="pf-tx-drawer__row pf-tx-drawer__row--total">
                      <span className="pf-tx-drawer__k">Total Paid</span>
                      <span className="pf-tx-drawer__v tkl-mono pf-tx-drawer__total">
                        {formatPortfolioUsd(displayTx.price + fee)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : null}

          {isVault ? (
            <>
              <div className="pf-tx-drawer__divider" />
              <div className="pf-tx-drawer__money">
                <div className="pf-tx-drawer__row">
                  <span className="pf-tx-drawer__k">Minted</span>
                  <span className="pf-tx-drawer__v tkl-mono">
                    {displayTx.dateTimeLabel ?? displayTx.date}
                  </span>
                </div>
                {displayTx.tokenId != null ? (
                  <div className="pf-tx-drawer__row">
                    <span className="pf-tx-drawer__k">Token ID</span>
                    <span className="pf-tx-drawer__v tkl-mono">#{displayTx.tokenId}</span>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          <div className="pf-tx-drawer__divider" />
          <div className="pf-tx-drawer__tx">
            <div className="pf-tx-drawer__row">
              <span className="pf-tx-drawer__k">Order</span>
              <span className="pf-tx-drawer__hash-wrap">
                <span className="tkl-mono pf-tx-drawer__hash" title={orderHash}>
                  {shortHash}
                </span>
                <button
                  type="button"
                  className="pf-tx-drawer__copy"
                  title={copied ? "Copied" : "Copy"}
                  aria-label="Copy order hash"
                  onClick={() => void copyHash()}
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                    <path d="M4 2h7v2H6v9H4V2zm3 3h7v9H7V5z" />
                  </svg>
                </button>
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
