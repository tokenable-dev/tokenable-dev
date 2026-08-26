"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { TxRow } from "@/lib/portfolio/portfolioTypes";
import {
  compareSortNum,
  compareSortText,
  formatPortfolioUsd,
} from "@/lib/portfolio/portfolioTableHelpers";
import { TkTable } from "@/components/ds";
import { usePortfolioTableSort } from "@/hooks/portfolio/usePortfolioTableSort";
import { PortfolioHistoryStatusBadge } from "./PortfolioHistoryStatusBadge";
import { PortfolioMobileSort } from "./PortfolioMobileSort";
import { PortfolioPanelSearch } from "./PortfolioPanelSearch";
import { PortfolioSortableTh } from "./PortfolioSortableTh";
import { PortfolioTxDetailDrawer } from "./PortfolioTxDetailDrawer";

type HistorySortKey = "date" | "type" | "card" | "status" | "amount";

const HISTORY_SORT_OPTIONS = [
  { key: "date", label: "Date" },
  { key: "type", label: "Type" },
  { key: "card", label: "Card" },
  { key: "status", label: "Status" },
  { key: "amount", label: "Amount" },
] as const;

function typeLabel(tx: TxRow): string {
  if (tx.status === "vaulted") return "Vault";
  return tx.type === "BUY" ? "Buy" : "Sell";
}

function typeClass(tx: TxRow): string {
  if (tx.status === "vaulted") return "pf-table-type--vault";
  return tx.type === "BUY" ? "pf-table-type--buy" : "pf-table-type--sell";
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
  const { sortKey, sortDir, toggleSort, applyMobileSort, mobileSortValue } =
    usePortfolioTableSort<HistorySortKey>("date", "desc");

  const sortedRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const rows = txRows.filter((tx) => {
      if (!q) return true;
      const hay = `${tx.asset} ${typeLabel(tx)} ${tx.certNumber ?? ""} ${tx.gradeLabel ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
    rows.sort((a, b) => {
      switch (sortKey) {
        case "type":
          return compareSortText(typeLabel(a), typeLabel(b), sortDir);
        case "card":
          return compareSortText(a.asset, b.asset, sortDir);
        case "status":
          return compareSortText(a.status ?? "settled", b.status ?? "settled", sortDir);
        case "amount":
          return compareSortNum(a.price, b.price, sortDir);
        default:
          return compareSortNum(a.dateMs, b.dateMs, sortDir);
      }
    });
    return rows;
  }, [txRows, searchQuery, sortKey, sortDir]);

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
          Buys, sells, and vault mints will show up here once they settle.
        </p>
        <Link href="/markets" className="pf-empty__cta">
          Browse collections
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="pf-panel-toolbar">
        <PortfolioPanelSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search history — card, type, cert"
          ariaLabel="Search transaction history"
        />
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
            const zeroAmount = tx.status === "vaulted" || tx.price === 0;
            const zebra = index % 2 === 1 ? " pf-table-row--zebra" : "";
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
                  <span className={`tkl-mono pf-table-type ${typeClass(tx)}`}>
                    {typeLabel(tx)}
                  </span>
                </td>
                <td data-label="Card">
                  <span className="pf-table-card-name">{tx.asset}</span>
                </td>
                <td data-label="Status" style={{ textAlign: "right" }}>
                  <PortfolioHistoryStatusBadge status={tx.status ?? "settled"} />
                </td>
                <td data-label="Amount" style={{ textAlign: "right" }}>
                  <span
                    className={`tkl-mono ${
                      zeroAmount ? "pf-table-amount--dash" : "pf-table-amount"
                    }`}
                  >
                    {zeroAmount ? "—" : formatPortfolioUsd(tx.price)}
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
