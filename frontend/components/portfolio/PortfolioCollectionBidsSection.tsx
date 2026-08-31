"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CollectionMarketStats } from "@/lib/core";
import type { PortfolioBidCollectionMeta, PortfolioBidRow } from "@/lib/portfolio/portfolioBidTypes";
import { compareSortNum, compareSortText, formatPortfolioUsd } from "@/lib/portfolio/portfolioTableHelpers";
import { TkButton, TkTable, TkTag } from "@/components/ds";
import { usePortfolioTableSort } from "@/hooks/portfolio/usePortfolioTableSort";
import type { PortfolioBidCancelTarget } from "@/hooks/portfolio/usePortfolioBidActions";
import { PortfolioMobileSort } from "./PortfolioMobileSort";
import { PortfolioPanelSearch } from "./PortfolioPanelSearch";
import { PortfolioSortableTh, PortfolioStaticTh } from "./PortfolioSortableTh";
import { CARD_DISPLAY_LINE1_CLAMP_CLASS } from "@/components/marketplace/marketplace-shared";

type BidsSortKey = "name" | "bid" | "ask";

const BIDS_SORT_OPTIONS = [
  { key: "name", label: "Card" },
  { key: "bid", label: "Your bid" },
  { key: "ask", label: "Ask price" },
] as const;

function collectionHref(collectionKey: string) {
  return `/marketplace/collections/${encodeURIComponent(collectionKey)}`;
}

function isOutbidByBook(
  bidPriceUsdc: number,
  highestBidUsd: number | null | undefined,
): boolean {
  return (
    highestBidUsd != null &&
    Number.isFinite(highestBidUsd) &&
    highestBidUsd > 0 &&
    bidPriceUsdc + 1e-9 < highestBidUsd
  );
}

function formatExpiresIn(endTimeIso?: string | null): string | null {
  if (!endTimeIso) return null;
  const endMs = Date.parse(endTimeIso);
  if (!Number.isFinite(endMs)) return null;
  const ms = endMs - Date.now();
  if (ms <= 0) return "0h";

  const hours = Math.max(0, Math.floor(ms / 3_600_000));
  if (hours >= 48) {
    const days = Math.max(1, Math.floor(hours / 24));
    return `${days}d`;
  }
  return `${Math.max(1, hours)}h`;
}

export function PortfolioCollectionBidsSection({
  loading,
  metaLoading,
  activeBids,
  collectionMetaByKey,
  statsByCollectionKey,
  highestBidByCollectionKey,
  cancellingHash,
  clearingOutbid,
  onCancel,
  onClearOutbid,
}: {
  loading: boolean;
  metaLoading: boolean;
  activeBids: PortfolioBidRow[];
  collectionMetaByKey: Map<string, PortfolioBidCollectionMeta>;
  statsByCollectionKey: Map<string, CollectionMarketStats>;
  /** Best live bid on the collection (any bidder). */
  highestBidByCollectionKey?: Map<string, number | null>;
  cancellingHash: string | null;
  clearingOutbid?: boolean;
  onCancel: (
    orderHash: string,
    collectionKey: string,
    collectionLabel: string,
    priceLabel: string,
    mode: "cancel" | "remove_outbid",
  ) => void;
  onClearOutbid?: (items: PortfolioBidCancelTarget[]) => void;
}) {
  const { sortKey, sortDir, toggleSort, applyMobileSort, mobileSortValue } =
    usePortfolioTableSort<BidsSortKey>("name");
  const [searchQuery, setSearchQuery] = useState("");

  const sortedBids = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const rows = activeBids.filter((bid) => {
      if (!q) return true;
      const label =
        collectionMetaByKey.get(bid.collectionKey)?.displayLabel ??
        bid.collectionKey.replace(/^ch:/, "");
      return label.toLowerCase().includes(q) || bid.collectionKey.toLowerCase().includes(q);
    });
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
  }, [
    activeBids,
    searchQuery,
    sortKey,
    sortDir,
    collectionMetaByKey,
    statsByCollectionKey,
  ]);

  const outbidItems = useMemo((): PortfolioBidCancelTarget[] => {
    return activeBids
      .filter((bid) =>
        isOutbidByBook(
          bid.priceUsdc,
          highestBidByCollectionKey?.get(bid.collectionKey.toLowerCase()) ??
            highestBidByCollectionKey?.get(bid.collectionKey),
        ),
      )
      .map((bid) => ({
        orderHash: bid.orderHash,
        collectionKey: bid.collectionKey,
        priceLabel: bid.priceLabel,
      }));
  }, [activeBids, highestBidByCollectionKey]);

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
        <p>No active bids yet</p>
        <p className="pf-empty__sub">
          Place an offer from a card listing — your active bids will appear here.
        </p>
        <Link href="/markets" className="pf-empty__cta">
          Browse collections
        </Link>
      </div>
    );
  }

  return (
    <>
      {outbidItems.length > 0 && onClearOutbid ? (
        <div className="pf-bids-outbid-bar">
          <p className="pf-bids-outbid-bar__copy">
            {outbidItems.length} offer{outbidItems.length === 1 ? "" : "s"}{" "}
            outbid — still live until you remove {outbidItems.length === 1 ? "it" : "them"}.
          </p>
          <TkButton
            type="button"
            variant="subtle"
            size="sm"
            className="pf-table-btn"
            disabled={clearingOutbid || cancellingHash != null}
            onClick={() => onClearOutbid(outbidItems)}
          >
            {clearingOutbid ? "Clearing…" : "Clear all outbid"}
          </TkButton>
        </div>
      ) : null}

      <div className="pf-panel-toolbar">
        <PortfolioPanelSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search bids — collection name"
          ariaLabel="Search active bids"
        />
        <PortfolioMobileSort
          options={[...BIDS_SORT_OPTIONS]}
          value={mobileSortValue}
          onChange={applyMobileSort}
        />
      </div>

      {sortedBids.length === 0 ? (
        <p className="pf-empty pf-empty--panel">No bids match your search.</p>
      ) : (
      <TkTable wrapClassName="pf-table-wrap" className="pf-table--bids">
        <colgroup>
          <col className="pf-col-card" />
          <col className="pf-col-bid" />
          <col className="pf-col-ask" />
          <col className="pf-col-status" />
          <col className="pf-col-action" />
        </colgroup>
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
            <PortfolioStaticTh label="Status" align="right" />
            <PortfolioStaticTh label="Action" align="right" muted />
          </tr>
        </thead>
        <tbody>
          {sortedBids.map((bid, index) => {
            const meta = collectionMetaByKey.get(bid.collectionKey);
            const label =
              meta?.displayLabel ?? bid.collectionKey.replace(/^ch:/, "").slice(0, 48);
            const ask = statsByCollectionKey.get(bid.collectionKey)?.floor ?? null;
            const highest =
              highestBidByCollectionKey?.get(bid.collectionKey.toLowerCase()) ??
              highestBidByCollectionKey?.get(bid.collectionKey) ??
              null;
            const busy =
              clearingOutbid || cancellingHash === bid.orderHash;
            const outbid = isOutbidByBook(bid.priceUsdc, highest);
            const zebra = index % 2 === 1 ? "pf-table-row--zebra" : undefined;

            return (
              <tr key={bid.orderHash} className={zebra}>
                <td data-label="Card">
                  <Link
                    href={
                      bid.tokenId && bid.tokenId !== "0"
                        ? `/marketplace/${encodeURIComponent(bid.tokenId)}`
                        : collectionHref(bid.collectionKey)
                    }
                    className="pf-table-card-cell"
                  >
                    <div className="pf-table-thumb pf-table-thumb--lg">
                      {meta?.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={meta.imageUrl} alt="" />
                      ) : metaLoading ? (
                        <div className="h-full w-full animate-pulse bg-white/5" />
                      ) : null}
                    </div>
                    <span className={`pf-table-card-name ${CARD_DISPLAY_LINE1_CLAMP_CLASS}`}>{label}</span>
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
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 3,
                      alignItems: "flex-end",
                    }}
                  >
                    {outbid ? (
                      <TkTag
                        tone="warning"
                        appearance="soft"
                        className="pf-bid-status-tag"
                      >
                        OUTBID
                      </TkTag>
                    ) : (
                      <TkTag
                        tone="positive"
                        appearance="soft"
                        className="pf-bid-status-tag"
                      >
                        HIGHEST
                      </TkTag>
                    )}
                    {(() => {
                      const expires = formatExpiresIn(bid.endTime);
                      if (!expires) return null;
                      return (
                        <span
                          className="tkl-mono"
                          style={{
                            fontSize: 10,
                            color: outbid
                              ? "rgba(255,255,255,0.52)"
                              : "var(--warn)",
                          }}
                        >
                          Expires in {expires}
                        </span>
                      );
                    })()}
                  </div>
                </td>
                <td data-label="Action" style={{ textAlign: "right" }}>
                  <div className="pf-table-actions">
                    <TkButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="pf-table-btn"
                      disabled={busy}
                      onClick={() =>
                        onCancel(
                          bid.orderHash,
                          bid.collectionKey,
                          label,
                          bid.priceLabel,
                          outbid ? "remove_outbid" : "cancel",
                        )
                      }
                    >
                      {cancellingHash === bid.orderHash
                        ? "Cancelling…"
                        : "Cancel"}
                    </TkButton>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </TkTable>
      )}
    </>
  );
}
