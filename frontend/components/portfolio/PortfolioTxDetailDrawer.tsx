"use client";

import { useEffect } from "react";
import type { TxRow } from "@/lib/portfolio/portfolioTypes";
import { formatPortfolioUsd } from "@/lib/portfolio/portfolioTableHelpers";
import { TkButton } from "@/components/ds";
import { PortfolioHistoryStatusBadge } from "./PortfolioHistoryStatusBadge";

function typeLabel(type: TxRow["type"]) {
  return type === "BUY" ? "Buy" : "Sell";
}

function typeClass(type: TxRow["type"]) {
  return type === "BUY" ? "pf-table-type--buy" : "pf-table-type--sell";
}

export function PortfolioTxDetailDrawer({
  tx,
  onClose,
}: {
  tx: TxRow | null;
  onClose: () => void;
}) {
  const open = tx != null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!tx) return null;

  const fee = Math.round(tx.price * 0.05);
  const net = tx.type === "SELL" ? tx.price - fee : tx.price + fee;

  return (
    <>
      <button
        type="button"
        className="pf-tx-drawer-overlay"
        aria-label="Close transaction detail"
        onClick={onClose}
      />
      <aside className={`pf-tx-drawer${open ? " pf-tx-drawer--open" : ""}`} aria-label="Transaction detail">
        <div className="pf-tx-drawer__head">
          <span className="pf-tx-drawer__title">Transaction Detail</span>
          <button type="button" className="pf-tx-drawer__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="pf-tx-drawer__body">
          <div className="pf-tx-drawer__card">
            <div className="pf-tx-drawer__card-name">{tx.asset}</div>
            {tx.category ? (
              <div className="pf-tx-drawer__card-sub tkl-mono">{tx.category}</div>
            ) : null}
          </div>

          <div className="pf-tx-drawer__meta">
            <div className="pf-tx-drawer__row">
              <span className="pf-tx-drawer__k">Type</span>
              <span className={`pf-tx-drawer__v pf-table-type ${typeClass(tx.type)}`}>
                {typeLabel(tx.type)}
              </span>
            </div>
            <div className="pf-tx-drawer__row">
              <span className="pf-tx-drawer__k">Date</span>
              <span className="pf-tx-drawer__v tkl-mono pf-table-muted">{tx.date}</span>
            </div>
            <div className="pf-tx-drawer__row">
              <span className="pf-tx-drawer__k">Status</span>
              <PortfolioHistoryStatusBadge status="settled" />
            </div>
          </div>

          <div className="pf-tx-drawer__divider" />

          <div className="pf-tx-drawer__money">
            <div className="pf-tx-drawer__row">
              <span className="pf-tx-drawer__k">Amount</span>
              <span className="pf-tx-drawer__v tkl-mono pf-table-amount">
                {formatPortfolioUsd(tx.price)}
              </span>
            </div>
            <div className="pf-tx-drawer__row">
              <span className="pf-tx-drawer__k">Platform fee (5%)</span>
              <span className="pf-tx-drawer__v tkl-mono" style={{ color: "var(--neg)" }}>
                {tx.type === "SELL" ? "-" : "+"}
                {formatPortfolioUsd(fee)}
              </span>
            </div>
            <div className="pf-tx-drawer__row pf-tx-drawer__row--total">
              <span className="pf-tx-drawer__k">{tx.type === "SELL" ? "You receive" : "Total paid"}</span>
              <span className="pf-tx-drawer__v tkl-mono pf-table-amount">{formatPortfolioUsd(net)}</span>
            </div>
          </div>

          <div className="pf-tx-drawer__divider" />

          <div className="pf-tx-drawer__tx">
            <div className="pf-tx-drawer__row">
              <span className="pf-tx-drawer__k">Order</span>
              <span className="pf-tx-drawer__v tkl-mono pf-tx-drawer__hash" title={tx.orderHash}>
                {tx.orderHash.slice(0, 10)}…{tx.orderHash.slice(-6)}
              </span>
            </div>
            <TkButton decorative variant="subtle" size="sm" className="pf-tx-drawer__scan">
              View on Polygonscan →
            </TkButton>
          </div>
        </div>
      </aside>
    </>
  );
}
