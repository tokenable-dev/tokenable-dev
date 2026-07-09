"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { CollectionMarketStats } from "@/lib/core";
import type { PortfolioBidCollectionMeta, PortfolioBidRow } from "@/lib/portfolio/portfolioBidTypes";
import { compareSortNum, compareSortText, formatPortfolioUsd } from "@/lib/portfolio/portfolioTableHelpers";
import { TkButton, TkTable, TkTag } from "@/components/ds";
import { usePortfolioTableSort } from "@/hooks/portfolio/usePortfolioTableSort";
import { PortfolioMobileSort } from "./PortfolioMobileSort";
import { PortfolioSortableTh } from "./PortfolioSortableTh";

type BidsSortKey = "name" | "bid" | "ask";

const BIDS_SORT_OPTIONS = [
  { key: "name", label: "Card" },
  { key: "bid", label: "Your bid" },
  { key: "ask", label: "Ask price" },
] as const;

function collectionHref(collectionKey: string) {
  return `/marketplace/collections/${encodeURIComponent(collectionKey)}`;
}

export function PortfolioCollectionBidsSection({
  loading,
  metaLoading,
  activeBids,
  collectionMetaByKey,
  statsByCollectionKey,
  cancellingHash,
  openingChangeHash,
  onCancel,
  onChangePrice,
}: {
  loading: boolean;
  metaLoading: boolean;
  activeBids: PortfolioBidRow[];
  collectionMetaByKey: Map<string, PortfolioBidCollectionMeta>;
  statsByCollectionKey: Map<string, CollectionMarketStats>;
  cancellingHash: string | null;
  openingChangeHash: string | null;
  onCancel: (
    orderHash: string,
    collectionKey: string,
    collectionLabel: string,
    priceLabel: string,
  ) => void;
  onChangePrice: (orderHash: string, collectionKey: string) => void;
}) {
  const { sortKey, sortDir, toggleSort, applyMobileSort, mobileSortValue } =
    usePortfolioTableSort<BidsSortKey>("name");

  const sortedBids = useMemo(() => {
    const rows = [...activeBids];
    rows.sort((a, b) => {
      const labelA =
        collectionMetaByKey.get(a.collectionKey)?.displayLabel ??
        a.collectionKey.replace(/^ch:/, "");
      const labelB =
        collectionMetaByKey.get(b.collectionKey)?.displayLabel ??
        b.collectionKey.replace(/^ch:/, "");
      const askA = statsByCollectionKey.get(a.collectionKey)?.floor ?? null;
      const askB = statsByCollectionKey.get(b.collectionKey)?.floor ?? null;
      switch (sortKey) {
        case "bid":
          return compareSortNum(a.priceUsdc, b.priceUsdc, sortDir);
        case "ask":
          return compareSortNum(askA, askB, sortDir);
        default:
          return compareSortText(labelA, labelB, sortDir);
      }
    });
    return rows;
  }, [activeBids, sortKey, sortDir, collectionMetaByKey, statsByCollectionKey]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-white/5" />
        ))}
      </div>
    );
  }

  if (activeBids.length === 0) {
    return (
      <div className="pf-empty pf-empty--panel">
        <p>No collection bids yet</p>
        <p className="pf-empty__sub">
          Place a bid from a collection&apos;s Buy tab — your active bids will appear here.
        </p>
        <Link href="/markets" className="pf-empty__cta">
          Browse collections
        </Link>
      </div>
    );
  }

  return (
    <>
      <PortfolioMobileSort
        options={[...BIDS_SORT_OPTIONS]}
        value={mobileSortValue}
        onChange={applyMobileSort}
      />

      <TkTable wrapClassName="pf-table-wrap">
        <thead>
          <tr>
            <PortfolioSortableTh
              label="Card"
              sortKey="name"
              activeKey={sortKey}
              sortDir={sortDir}
              onSort={(k) => toggleSort(k as BidsSortKey)}
            />
            <PortfolioSortableTh
              label="Your bid"
              sortKey="bid"
              activeKey={sortKey}
              sortDir={sortDir}
              align="right"
              onSort={(k) => toggleSort(k as BidsSortKey)}
            />
            <PortfolioSortableTh
              label="Ask price"
              sortKey="ask"
              activeKey={sortKey}
              sortDir={sortDir}
              align="right"
              onSort={(k) => toggleSort(k as BidsSortKey)}
            />
            <th style={{ textAlign: "right" }}>Status</th>
            <th style={{ textAlign: "right" }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {sortedBids.map((bid, index) => {
            const meta = collectionMetaByKey.get(bid.collectionKey);
            const label =
              meta?.displayLabel ?? bid.collectionKey.replace(/^ch:/, "").slice(0, 48);
            const ask = statsByCollectionKey.get(bid.collectionKey)?.floor ?? null;
            const busy =
              cancellingHash === bid.orderHash || openingChangeHash === bid.orderHash;
            const canRaise = ask != null && ask > bid.priceUsdc;
            const isHighest = ask == null || bid.priceUsdc >= ask;
            const zebra = index % 2 === 1 ? "pf-table-row--zebra" : undefined;

            return (
              <tr key={bid.orderHash} className={zebra}>
                <td data-label="Card">
                  <Link href={collectionHref(bid.collectionKey)} className="pf-table-card-cell">
                    <div className="pf-table-thumb pf-table-thumb--lg">
                      {meta?.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={meta.imageUrl} alt="" />
                      ) : metaLoading ? (
                        <div className="h-full w-full animate-pulse bg-white/5" />
                      ) : null}
                    </div>
                    <span className="pf-table-card-name">{label}</span>
                  </Link>
                </td>
                <td data-label="Your bid" style={{ textAlign: "right" }}>
                  <span className="tkl-mono pf-table-bid">{bid.priceLabel}</span>
                </td>
                <td data-label="Ask price" style={{ textAlign: "right" }}>
                  <span className="tkl-mono pf-table-muted">
                    {ask != null ? formatPortfolioUsd(ask) : "—"}
                  </span>
                </td>
                <td data-label="Status" style={{ textAlign: "right" }}>
                  {isHighest ? (
                    <TkTag tone="positive" appearance="soft" className="pf-bid-status-tag">
                      HIGHEST
                    </TkTag>
                  ) : (
                    <TkTag tone="warning" appearance="soft" className="pf-bid-status-tag">
                      OUTBID
                    </TkTag>
                  )}
                </td>
                <td data-label="Action" style={{ textAlign: "right" }}>
                  <div className="pf-table-actions">
                    {canRaise ? (
                      <TkButton
                        type="button"
                        variant="primary"
                        size="sm"
                        className="pf-table-btn"
                        disabled={busy}
                        onClick={() => onChangePrice(bid.orderHash, bid.collectionKey)}
                      >
                        {openingChangeHash === bid.orderHash ? "…" : "Raise"}
                      </TkButton>
                    ) : (
                      <TkButton
                        type="button"
                        variant="subtle"
                        size="sm"
                        className="pf-table-btn"
                        disabled={busy}
                        onClick={() =>
                          onCancel(
                            bid.orderHash,
                            bid.collectionKey,
                            label,
                            bid.priceLabel,
                          )
                        }
                      >
                        {cancellingHash === bid.orderHash ? "…" : "Cancel"}
                      </TkButton>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </TkTable>
    </>
  );
}
