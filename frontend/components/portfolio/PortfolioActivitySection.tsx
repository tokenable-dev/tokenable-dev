"use client";

import { useMemo, useState } from "react";
import type { TxRow } from "@/lib/portfolio/portfolioTypes";
import { compareSortNum, compareSortText, formatPortfolioUsd } from "@/lib/portfolio/portfolioTableHelpers";
import { TkTable } from "@/components/ds";
import { usePortfolioTableSort } from "@/hooks/portfolio/usePortfolioTableSort";
import { PortfolioHistoryStatusBadge } from "./PortfolioHistoryStatusBadge";
import { PortfolioMobileSort } from "./PortfolioMobileSort";
import { PortfolioSortableTh } from "./PortfolioSortableTh";
import { PortfolioTxDetailDrawer } from "./PortfolioTxDetailDrawer";

type HistorySortKey = "date" | "type" | "card" | "amount";

const HISTORY_SORT_OPTIONS = [
  { key: "date", label: "Date" },
  { key: "type", label: "Type" },
  { key: "card", label: "Card" },
  { key: "amount", label: "Amount" },
] as const;

export function PortfolioActivitySection({
  loading,
  txRows,
}: {
  loading: boolean;
  txRows: TxRow[];
}) {
  const [selectedTx, setSelectedTx] = useState<TxRow | null>(null);
  const { sortKey, sortDir, toggleSort, applyMobileSort, mobileSortValue } =
    usePortfolioTableSort<HistorySortKey>("date");

  const sortedRows = useMemo(() => {
    const rows = [...txRows];
    rows.sort((a, b) => {
      switch (sortKey) {
        case "type":
          return compareSortText(a.type, b.type, sortDir);
        case "card":
          return compareSortText(a.asset, b.asset, sortDir);
        case "amount":
          return compareSortNum(a.price, b.price, sortDir);
        default:
          return compareSortText(a.date, b.date, sortDir);
      }
    });
    return rows;
  }, [txRows, sortKey, sortDir]);

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
    return <p className="pf-empty">No transactions yet</p>;
  }

  return (
    <>
      <PortfolioMobileSort
        options={[...HISTORY_SORT_OPTIONS]}
        value={mobileSortValue}
        onChange={applyMobileSort}
      />

      <TkTable wrapClassName="pf-table-wrap">
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
            <th style={{ textAlign: "right" }}>Status</th>
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
          {sortedRows.map((tx) => (
            <tr
              key={tx.orderHash}
              className="pf-history-row"
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
                <span
                  className={`tkl-mono pf-table-type ${
                    tx.status === "vaulted"
                      ? "pf-table-type--vault"
                      : tx.type === "BUY"
                        ? "pf-table-type--buy"
                        : "pf-table-type--sell"
                  }`}
                >
                  {tx.status === "vaulted" ? "Vault" : tx.type === "BUY" ? "Buy" : "Sell"}
                </span>
              </td>
              <td data-label="Card">
                <span className="pf-table-card-name">{tx.asset}</span>
              </td>
              <td data-label="Status" style={{ textAlign: "right" }}>
                <PortfolioHistoryStatusBadge status={tx.status ?? "settled"} />
              </td>
              <td data-label="Amount" style={{ textAlign: "right" }}>
                <span className="tkl-mono pf-table-amount">
                  {tx.status === "vaulted" || tx.price === 0
                    ? "—"
                    : formatPortfolioUsd(tx.price)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </TkTable>

      <PortfolioTxDetailDrawer tx={selectedTx} onClose={() => setSelectedTx(null)} />
    </>
  );
}
