"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { TxKind, TxLifecycle, TxRow } from "@/lib/portfolio/portfolioTypes";
import {
  compareSortNum,
  compareSortText,
  formatPortfolioUsd,
} from "@/lib/portfolio/portfolioTableHelpers";
import {
  txAmountIsNonTrade,
  txKindLabel,
  txLifecycleLabel,
} from "@/lib/portfolio/buildPortfolioTxRows";
import { TkTable } from "@/components/ds";
import { usePortfolioTableSort } from "@/hooks/portfolio/usePortfolioTableSort";
import {
  placePortfolioToolbar,
  useDockPortfolioToolbar,
} from "@/components/portfolio/PortfolioMainSection";
import { PortfolioTxDetailDrawer } from "./PortfolioTxDetailDrawer";
import { useAppChain } from "@/providers/AppChainProvider";

type HistorySortKey = "date" | "type" | "card" | "status" | "amount";
type HistoryStatusFilter = "" | TxLifecycle;

function shortHex(value: string): string {
  const s = value.trim();
  if (s.length < 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function txActionTone(type: TxKind): string {
  if (type === "BUY") return "pf-ux-pos";
  if (type === "SELL") return "pf-ux-neg";
  if (type === "MINT") return "pf-ux-purple";
  if (type === "REDEEM") return "pf-ux-blue";
  if (type === "TRANSFER") return "";
  return "";
}

function txStatusTone(status: TxLifecycle): string {
  if (status === "in_progress") return "pf-ux-warn";
  if (status === "failed") return "pf-ux-neg";
  if (status === "canceled") return "pf-ux-mute";
  return "pf-ux-pos";
}

function TxHashLink({
  hash,
  status,
  scan,
}: {
  hash?: string;
  status: TxLifecycle;
  scan: string;
}) {
  if (hash) {
    return (
      <a
        className="pf-ux-hash"
        href={`${scan}/tx/${hash}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        {shortHex(hash)} ↗
      </a>
    );
  }
  if (status === "in_progress") {
    return <span className="pf-ux-mono pf-ux-mute">pending</span>;
  }
  return null;
}

export function PortfolioActivitySection({
  loading,
  txRows,
}: {
  loading: boolean;
  txRows: TxRow[];
}) {
  const { chain } = useAppChain();
  const [selectedTx, setSelectedTx] = useState<TxRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<HistoryStatusFilter>("");
  const dockSlot = useDockPortfolioToolbar(1024);
  const { sortKey, sortDir } = usePortfolioTableSort<HistorySortKey>("date", "desc");

  const sortedRows = useMemo(() => {
    const rows = txRows.filter((tx) => !statusFilter || tx.status === statusFilter);
    rows.sort((a, b) => {
      switch (sortKey) {
        case "type":
          return compareSortText(txKindLabel(a), txKindLabel(b), sortDir);
        case "card":
          return compareSortText(a.asset, b.asset, sortDir);
        case "status":
          return compareSortText(txLifecycleLabel(a.status), txLifecycleLabel(b.status), sortDir);
        case "amount":
          return compareSortNum(a.price, b.price, sortDir);
        default:
          return compareSortNum(a.dateMs, b.dateMs, sortDir);
      }
    });
    return rows;
  }, [txRows, statusFilter, sortKey, sortDir]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-white/5" />
        ))}
      </div>
    );
  }

  if (txRows.length === 0) {
    return (
      <div className="pf-empty pf-empty--panel">
        <p>No transactions yet</p>
        <p className="pf-empty__sub">
          Buys, sells, mints, and redeems will show up here once they settle.
        </p>
        <Link href="/markets" className="pf-empty__cta">
          Browse collections
        </Link>
      </div>
    );
  }

  return (
    <>
      {placePortfolioToolbar(
      <div className="pf-tbar" id="hx-toolbar">
        <label className="pf-tdrop">
          <span className="pf-tdrop__k">Filter:</span>
          <select
            aria-label="Filter transactions by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as HistoryStatusFilter)}
          >
            <option value="">All</option>
            <option value="completed">Completed</option>
            <option value="in_progress">In progress</option>
            <option value="failed">Failed</option>
          </select>
          <svg className="cx" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </label>
      </div>,
      dockSlot,
      )}

      {sortedRows.length === 0 ? (
        <p className="pf-empty pf-empty--panel">No transactions match this filter.</p>
      ) : (
        <TkTable wrapClassName="pf-table-wrap" className="pf-table--history pf-ux">
          <thead>
            <tr>
              <th>Item</th>
              <th>Action</th>
              <th>Date</th>
              <th>Status</th>
              <th className="pf-ux-r">Amount</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((tx) => {
              const dash = txAmountIsNonTrade(tx);
              const fullName = tx.assetHover || tx.asset;
              const amount = dash ? null : formatPortfolioUsd(tx.price);
              const when = tx.dateTimeLabel ?? tx.date;
              const hash = tx.chainTxs?.[0]?.hash;
              const scan = chain.explorerBaseUrl.replace(/\/$/, "");
              const actionTone = txActionTone(tx.type);
              const statusTone = txStatusTone(tx.status);
              const statusLabel = txLifecycleLabel(tx.status);
              const kind = txKindLabel(tx);
              return (
                <tr
                  key={tx.orderHash}
                  className="pf-history-row pf-ux-row"
                  onClick={() => setSelectedTx(tx)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedTx(tx);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                >
                  <td data-label="Item">
                    <div className="pf-ux-item">
                      <span className="pf-ux-thumb">
                        {tx.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={tx.imageUrl} alt="" />
                        ) : null}
                      </span>
                      <span className="pf-ux-txt">
                        <span className="pf-ux-name" title={fullName}>
                          {tx.asset}
                        </span>
                        <span className="pf-ux-sub">
                          <TxHashLink hash={hash} status={tx.status} scan={scan} />
                        </span>
                      </span>
                    </div>
                  </td>
                  <td data-label="Action">
                    <span className={`pf-ux-v ${actionTone}`}>{kind}</span>
                  </td>
                  <td data-label="Date">
                    <span className="pf-ux-d">{when}</span>
                  </td>
                  <td data-label="Status">
                    <span className={`pf-ux-v ${statusTone}`}>{statusLabel}</span>
                  </td>
                  <td data-label="Amount" className="pf-ux-r">
                    {amount != null ? <span className="pf-ux-amt">{amount}</span> : null}
                  </td>
                  <td className="pf-ux-mc" data-label="Mobile">
                    <div className="pf-ux-mc__card">
                      <span className="pf-ux-mc__thumb">
                        {tx.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={tx.imageUrl} alt="" />
                        ) : null}
                      </span>
                      <div className="pf-ux-mc__body">
                        <div className="pf-ux-mc__row">
                          <span className="pf-ux-mc__name" title={fullName}>
                            {tx.asset}
                          </span>
                        </div>
                        <div className="pf-ux-mc__money">
                          <span className={`pf-ux-v ${actionTone}`}>{kind}</span>
                          {amount != null ? <span className="pf-ux-amt">{amount}</span> : null}
                          <span className={`pf-ux-chip ${statusTone}`}>{statusLabel}</span>
                        </div>
                        <div className="pf-ux-mc__meta">
                          <span className="pf-ux-d">{when}</span>
                          {hash || tx.status === "in_progress" ? (
                            <>
                              {" · "}
                              <TxHashLink hash={hash} status={tx.status} scan={scan} />
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TkTable>
      )}

      <PortfolioTxDetailDrawer tx={selectedTx} onClose={() => setSelectedTx(null)} />
    </>
  );
}
