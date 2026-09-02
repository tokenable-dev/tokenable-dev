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
  TX_KIND_LABEL,
  txAmountIsNonTrade,
  txKindClass,
  txKindLabel,
  txLifecycleLabel,
} from "@/lib/portfolio/buildPortfolioTxRows";
import { TkButton, TkSelect, TkTable } from "@/components/ds";
import { usePortfolioTableSort } from "@/hooks/portfolio/usePortfolioTableSort";
import { PortfolioHistoryStatusBadge } from "./PortfolioHistoryStatusBadge";
import { CARD_DISPLAY_LINE1_CLAMP_CLASS } from "@/components/marketplace/marketplace-shared";
import { PortfolioMobileSort } from "./PortfolioMobileSort";
import { PortfolioSortableTh } from "./PortfolioSortableTh";
import { PortfolioTxDetailDrawer } from "./PortfolioTxDetailDrawer";

type HistorySortKey = "date" | "type" | "card" | "status" | "amount";
type HistoryStatusFilter = "" | TxLifecycle;
type HistoryRangeFilter = "all" | "30" | "90" | "ytd" | "custom";

const HISTORY_SORT_OPTIONS = [
  { key: "date", label: "Date" },
  { key: "type", label: "Type" },
  { key: "card", label: "Card" },
  { key: "status", label: "Status" },
  { key: "amount", label: "Amount" },
] as const;

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
  const [selectedTx, setSelectedTx] = useState<TxRow | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | TxKind>("");
  const [statusFilter, setStatusFilter] = useState<HistoryStatusFilter>("");
  const [rangeFilter, setRangeFilter] = useState<HistoryRangeFilter>("90");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const { sortKey, sortDir, toggleSort, applyMobileSort, mobileSortValue } =
    usePortfolioTableSort<HistorySortKey>("date", "desc");

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
      <div className="pf-hx-toolbar">
        <div className="pf-hx-search">
          <svg
            className="pf-hx-search__icon"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="2"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" />
          </svg>
          <input
            type="search"
            className="pf-hx-search__input"
            autoComplete="off"
            placeholder="Search card or cert #"
            value={searchQuery}
            aria-label="Search transaction history"
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <TkSelect
          aria-label="Filter by type"
          wrapClassName="pf-hx-sel"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as "" | TxKind)}
        >
          <option value="">All types</option>
          {ALL_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {TX_KIND_LABEL[kind]}
            </option>
          ))}
        </TkSelect>
        <TkSelect
          aria-label="Filter by status"
          wrapClassName="pf-hx-sel"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as HistoryStatusFilter)}
        >
          <option value="">All statuses</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="canceled">Canceled</option>
        </TkSelect>
        <TkSelect
          aria-label="Filter by date range"
          wrapClassName="pf-hx-sel"
          value={rangeFilter}
          onChange={(e) => setRangeFilter(e.target.value as HistoryRangeFilter)}
        >
          <option value="all">All time</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="ytd">Year to date</option>
          <option value="custom">Custom</option>
        </TkSelect>
        {rangeFilter === "custom" ? (
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
        <TkButton
          type="button"
          variant="subtle"
          size="sm"
          className="pf-hx-export"
          onClick={exportCsv}
        >
          Export CSV
        </TkButton>
        <PortfolioMobileSort
          options={[...HISTORY_SORT_OPTIONS]}
          value={mobileSortValue}
          onChange={applyMobileSort}
        />
      </div>

      {sortedRows.length === 0 ? (
        <p className="pf-empty pf-empty--panel">No transactions match your search.</p>
      ) : (
        <TkTable wrapClassName="pf-table-wrap" className="pf-table--history">
          <colgroup>
            <col className="pf-col-date" />
            <col className="pf-col-type" />
            <col className="pf-col-card" />
            <col className="pf-col-status" />
            <col className="pf-col-amount" />
          </colgroup>
          <thead>
            <tr>
              <PortfolioSortableTh
                label="Date"
                sortKey="date"
                activeKey={sortKey}
                sortDir={sortDir}
                onSort={(k) => toggleSort(k as HistorySortKey)}
              />
              <PortfolioSortableTh
                label="Type"
                sortKey="type"
                activeKey={sortKey}
                sortDir={sortDir}
                onSort={(k) => toggleSort(k as HistorySortKey)}
              />
              <PortfolioSortableTh
                label="Card"
                sortKey="card"
                activeKey={sortKey}
                sortDir={sortDir}
                onSort={(k) => toggleSort(k as HistorySortKey)}
              />
              <PortfolioSortableTh
                label="Status"
                sortKey="status"
                activeKey={sortKey}
                sortDir={sortDir}
                align="right"
                onSort={(k) => toggleSort(k as HistorySortKey)}
              />
              <PortfolioSortableTh
                label="Amount"
                sortKey="amount"
                activeKey={sortKey}
                sortDir={sortDir}
                align="right"
                onSort={(k) => toggleSort(k as HistorySortKey)}
              />
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((tx, index) => {
              const dash = txAmountIsNonTrade(tx);
              const zebra = index % 2 === 1 ? " pf-table-row--zebra" : "";
              const fullName = tx.assetHover || tx.asset;
              return (
                <tr
                  key={tx.orderHash}
                  className={`pf-history-row${zebra}`}
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
                  <td data-label="Date">
                    <span className="tkl-mono pf-table-muted">{tx.date}</span>
                  </td>
                  <td data-label="Type">
                    <span className={`pf-table-type ${txKindClass(tx)}`}>
                      {txKindLabel(tx)}
                    </span>
                  </td>
                  <td data-label="Card">
                    <span
                      className={`pf-table-card-name ${CARD_DISPLAY_LINE1_CLAMP_CLASS}`}
                      title={fullName}
                    >
                      {tx.asset}
                    </span>
                  </td>
                  <td data-label="Status" style={{ textAlign: "right" }}>
                    <PortfolioHistoryStatusBadge status={tx.status} />
                  </td>
                  <td data-label="Amount" style={{ textAlign: "right" }}>
                    <span
                      className={`tkl-mono pf-table-amount${
                        dash ? " pf-table-amount--dash" : ""
                      }`}
                    >
                      {dash ? "—" : formatPortfolioUsd(tx.price)}
                    </span>
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
