"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { TxKind, TxLifecycle, TxRow } from "@/lib/portfolio/portfolioTypes";
import {
  compareSortNum,
  compareSortText,
  formatPortfolioUsd,
} from "@/lib/portfolio/portfolioTableHelpers";
import {
  TX_KIND_LABEL,
  txAmountIsNonTrade,
  txKindClass,
  txKindLabel,
  txLifecycleLabel,
} from "@/lib/portfolio/buildPortfolioTxRows";
import { TkButton, TkTable } from "@/components/ds";
import { usePortfolioTableSort } from "@/hooks/portfolio/usePortfolioTableSort";
import { PortfolioToolbarSearch } from "./PortfolioToolbarSearch";
import { PortfolioTxDetailDrawer } from "./PortfolioTxDetailDrawer";
import { useAppChain } from "@/providers/AppChainProvider";

type HistorySortKey = "date" | "type" | "card" | "status" | "amount";
type HistoryStatusFilter = "" | TxLifecycle;
type HistoryRangeFilter = "all" | "30" | "90" | "ytd" | "custom";

const ALL_KINDS: TxKind[] = ["BUY", "SELL", "MINT", "REDEEM", "TRANSFER"];
const DAY_MS = 86_400_000;

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function startOfLocalDay(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return NaN;
  return new Date(y, m - 1, d).getTime();
}

function endOfLocalDay(isoDate: string): number {
  const start = startOfLocalDay(isoDate);
  if (!Number.isFinite(start)) return NaN;
  return start + DAY_MS - 1;
}

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

function inDateRange(
  tx: TxRow,
  range: HistoryRangeFilter,
  customFrom: string,
  customTo: string,
  now: Date,
): boolean {
  if (range === "all") return true;
  if (range === "custom") {
    const from = customFrom ? startOfLocalDay(customFrom) : NaN;
    const to = customTo ? endOfLocalDay(customTo) : NaN;
    if (Number.isFinite(from) && tx.dateMs < from) return false;
    if (Number.isFinite(to) && tx.dateMs > to) return false;
    return true;
  }
  if (range === "ytd") {
    return tx.dateMs >= new Date(now.getFullYear(), 0, 1).getTime();
  }
  const days = Number(range);
  return tx.dateMs >= now.getTime() - days * DAY_MS;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | TxKind>("");
  const [statusFilter, setStatusFilter] = useState<HistoryStatusFilter>("");
  const [rangeFilter, setRangeFilter] = useState<HistoryRangeFilter>("90");
  const [draftType, setDraftType] = useState<"" | TxKind>("");
  const [draftRange, setDraftRange] = useState<HistoryRangeFilter>("90");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const { sortKey, sortDir } = usePortfolioTableSort<HistorySortKey>("date", "desc");

  useEffect(() => {
    if (!filterOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFilterOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [filterOpen]);

  function openFilters() {
    setDraftType(typeFilter);
    setDraftRange(rangeFilter);
    setFilterOpen(true);
  }

  function applyFilters() {
    setTypeFilter(draftType);
    setRangeFilter(draftRange);
    setFilterOpen(false);
  }

  const filterCount = (typeFilter ? 1 : 0) + (rangeFilter !== "90" ? 1 : 0);

  const sortedRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const now = new Date();
    const kindFilter = typeFilter;
    const rows = txRows.filter((tx) => {
      if (q) {
        const hay = `${tx.asset} ${tx.assetHover ?? ""} ${tx.certNumber ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (kindFilter && tx.type !== kindFilter) return false;
      if (statusFilter && tx.status !== statusFilter) return false;
      if (!inDateRange(tx, rangeFilter, customFrom, customTo, now)) return false;
      return true;
    });
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
  }, [
    txRows,
    searchQuery,
    typeFilter,
    statusFilter,
    rangeFilter,
    customFrom,
    customTo,
    sortKey,
    sortDir,
  ]);

  function exportCsv() {
    const lines = [
      [
        "Date",
        "Type",
        "Card",
        "Status",
        "Amount",
        "Token ID",
        "Contract",
        "Tx hashes",
        "Seaport order",
        "Seller",
        "Buyer",
      ],
    ];
    for (const tx of sortedRows) {
      const dash = txAmountIsNonTrade(tx);
      const txs = (tx.chainTxs ?? []).map((t) => `${t.label} ${t.hash}`).join(" | ");
      const seaport = tx.type === "BUY" || tx.type === "SELL" ? tx.orderHash : "";
      lines.push([
        tx.dateTimeLabel ?? tx.date,
        txKindLabel(tx),
        tx.assetHover || tx.asset,
        txLifecycleLabel(tx.status),
        dash ? "—" : formatPortfolioUsd(tx.price),
        tx.tokenId != null ? String(tx.tokenId) : "",
        tx.tokenContract ?? "",
        txs,
        seaport,
        tx.sellerWallet ?? "",
        tx.buyerWallet ?? "",
      ]);
    }
    const csv = lines.map((row) => row.map(csvCell).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    a.download = "tokenable-tx-history.csv";
    a.click();
  }

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
        <button
          type="button"
          className="pf-tbtn pf-tbtn--icon"
          aria-label="Filter history"
          aria-expanded={filterOpen}
          onClick={openFilters}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="7" y1="12" x2="17" y2="12" />
            <line x1="10" y1="18" x2="14" y2="18" />
          </svg>
          {filterCount > 0 ? (
            <span className="pf-tbtn__badge">{filterCount}</span>
          ) : null}
        </button>
        <PortfolioToolbarSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search card or cert #"
          aria-label="Search transaction history"
        />
        <div className="pf-tbar__spacer" />
        <div className="pf-tbar__cluster">
          <button
            type="button"
            className="pf-tbtn pf-tbtn--icon"
            aria-label="Export CSV"
            onClick={exportCsv}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
        </div>
      </div>

      {filterOpen ? (
        <div className="pf-filter-drawer" role="presentation">
          <button
            type="button"
            className="pf-filter-drawer__scrim"
            aria-label="Close filter"
            onClick={() => setFilterOpen(false)}
          />
          <div
            className="pf-filter-drawer__sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Filters"
          >
            <div className="pf-filter-drawer__grip" />
            <div className="pf-filter-drawer__h">Filters</div>
            <div className="pf-filter-drawer__fields">
              <label className="pf-filter-drawer__label">
                <span>Type</span>
                <select
                  className="pf-filter-drawer__select"
                  value={draftType}
                  onChange={(e) => setDraftType(e.target.value as "" | TxKind)}
                >
                  <option value="">All types</option>
                  {ALL_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {TX_KIND_LABEL[kind]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="pf-filter-drawer__label">
                <span>Date range</span>
                <select
                  className="pf-filter-drawer__select"
                  value={draftRange}
                  onChange={(e) =>
                    setDraftRange(e.target.value as HistoryRangeFilter)
                  }
                >
                  <option value="all">All time</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                  <option value="ytd">Year to date</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              {draftRange === "custom" ? (
                <div className="pf-hx-custom">
                  <input
                    type="date"
                    className="pf-hx-custom__input"
                    aria-label="From date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                  />
                  <span className="pf-hx-custom__sep">–</span>
                  <input
                    type="date"
                    className="pf-hx-custom__input"
                    aria-label="To date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                  />
                </div>
              ) : null}
            </div>
            <TkButton
              type="button"
              variant="primary"
              className="pf-filter-drawer__apply"
              onClick={applyFilters}
            >
              Apply filters
            </TkButton>
          </div>
        </div>
      ) : null}

      {sortedRows.length === 0 ? (
        <p className="pf-empty pf-empty--panel">No transactions match your search.</p>
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
              const amount = dash ? "—" : formatPortfolioUsd(tx.price);
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
                          {hash ? (
                            <a
                              className="pf-ux-hash"
                              href={`${scan}/tx/${hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {shortHex(hash)} ↗
                            </a>
                          ) : (
                            <span className="pf-ux-mono pf-ux-mute">pending</span>
                          )}
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
                    <span className={`pf-ux-amt${dash ? " pf-ux-mute" : ""}`}>{amount}</span>
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
                          <span className={`pf-ux-chip ${statusTone}`}>{statusLabel}</span>
                        </div>
                        <div className="pf-ux-mc__money">
                          <span className={`pf-ux-v ${actionTone}`}>{kind}</span>
                          {"\u00a0\u00a0"}
                          <span className={`pf-ux-amt${dash ? " pf-ux-mute" : ""}`}>{amount}</span>
                        </div>
                        <div className="pf-ux-mc__meta">
                          <span className="pf-ux-d">{when}</span>
                          {hash ? (
                            <>
                              {" · "}
                              <a
                                className="pf-ux-hash"
                                href={`${scan}/tx/${hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {shortHex(hash)} ↗
                              </a>
                            </>
                          ) : (
                            <>
                              {" · "}
                              <span className="pf-ux-mono pf-ux-mute">pending</span>
                            </>
                          )}
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
