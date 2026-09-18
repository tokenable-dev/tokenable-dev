"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { CollectionMarketStats, Order } from "@/lib/core";
import type { PortfolioBidCollectionMeta, PortfolioBidRow } from "@/lib/portfolio/portfolioBidTypes";
import { compareSortNum, compareSortText } from "@/lib/portfolio/portfolioTableHelpers";
import { formatUsdListing } from "@/lib/market/collectionMarketPricing";
import { TkButton, TkTable, TkTag } from "@/components/ds";
import { usePortfolioTableSort } from "@/hooks/portfolio/usePortfolioTableSort";
import { highestBidUsdForHolding } from "@/hooks/portfolio/usePortfolioCollectionTopBids";
import { PortfolioSortableTh, PortfolioStaticTh } from "./PortfolioSortableTh";
import { CARD_DISPLAY_LINE1_CLAMP_CLASS } from "@/components/marketplace/marketplace-shared";
import { collectionDetailHref } from "@/lib/marketplace/collectionBrowseContext";
import { PortfolioToolbarSearch } from "./PortfolioToolbarSearch";

type BidsSortKey = "name" | "bid" | "top" | "ask" | "expires";
type BidsStatusFilter = "" | "highest" | "outbid" | "expired";

const BIDS_TOOLBAR_SORT: { value: BidsSortKey; label: string }[] = [
  { value: "bid", label: "Your bid" },
  { value: "top", label: "Top bid" },
  { value: "expires", label: "Expiry" },
];

const BIDS_STATUS_OPTIONS: { id: BidsStatusFilter; label: string }[] = [
  { id: "", label: "All" },
  { id: "highest", label: "Highest" },
  { id: "outbid", label: "Outbid" },
  { id: "expired", label: "Expired" },
];

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

function expiresMsRemaining(endTimeIso?: string | null): number | null {
  if (!endTimeIso) return null;
  const endMs = Date.parse(endTimeIso);
  if (!Number.isFinite(endMs)) return null;
  return endMs - Date.now();
}

/** Portfolio.html: "In 5d" / "In 21h" / "Expired". */
function formatExpiresLabel(
  endTimeIso: string | null | undefined,
  expired: boolean,
): { text: string; urgent: boolean } {
  if (expired) return { text: "Expired", urgent: false };
  const ms = expiresMsRemaining(endTimeIso);
  if (ms == null) return { text: "—", urgent: false };
  if (ms <= 0) return { text: "Expired", urgent: false };
  const hours = Math.max(0, Math.floor(ms / 3_600_000));
  if (hours >= 48) {
    const days = Math.max(1, Math.floor(hours / 24));
    return { text: `In ${days}d`, urgent: false };
  }
  return { text: `In ${Math.max(1, hours)}h`, urgent: true };
}

function askUsdForToken(
  listings: Order[] | undefined,
  tokenId: string,
  floor: number | null | undefined,
): number | null {
  if (listings?.length) {
    let best: number | null = null;
    for (const o of listings) {
      if (o.status !== "active") continue;
      if (String(o.side ?? "ask").toLowerCase() === "bid") continue;
      if (String(o.tokenId) !== String(tokenId)) continue;
      try {
        const usd = Number(o.considerationAmount) / 1_000_000;
        if (!Number.isFinite(usd) || usd <= 0) continue;
        if (best == null || usd < best) best = usd;
      } catch {
        /* skip */
      }
    }
    if (best != null) return best;
  }
  return floor != null && Number.isFinite(floor) ? floor : null;
}

export function PortfolioCollectionBidsSection({
  loading,
  metaLoading,
  bids,
  collectionMetaByKey,
  statsByCollectionKey,
  bidsByCollectionKey,
  listingsByCollectionKey,
  cancellingHash,
  changingHash,
  onCancel,
  onChangeBid,
  onRebid,
}: {
  loading: boolean;
  metaLoading: boolean;
  /** Active + expired bids shown in the table. */
  bids: PortfolioBidRow[];
  collectionMetaByKey: Map<string, PortfolioBidCollectionMeta>;
  statsByCollectionKey: Map<string, CollectionMarketStats>;
  bidsByCollectionKey?: Map<string, Order[]>;
  listingsByCollectionKey?: Map<string, Order[]>;
  cancellingHash: string | null;
  changingHash?: string | null;
  onCancel: (
    orderHash: string,
    collectionKey: string,
    collectionLabel: string,
    priceLabel: string,
  ) => void;
  onChangeBid: (bid: PortfolioBidRow) => void;
  onRebid: (bid: PortfolioBidRow) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<BidsStatusFilter>("");
  const [filterOpen, setFilterOpen] = useState(false);
  const { sortKey, sortDir, toggleSort, setSort } =
    usePortfolioTableSort<BidsSortKey>("bid", "desc");

  useEffect(() => {
    if (!filterOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFilterOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [filterOpen]);

  const sortedBids = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const rows = bids.filter((bid) => {
      const meta = collectionMetaByKey.get(bid.collectionKey);
      const label =
        meta?.displayLabel?.trim() ||
        bid.collectionKey.replace(/^ch:/, "").slice(0, 48);
      const line2 = meta?.line2?.trim() || "";
      if (q) {
        const hay = `${label} ${line2} ${bid.collectionKey}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (!statusFilter) return true;
      const book =
        bidsByCollectionKey?.get(bid.collectionKey) ??
        bidsByCollectionKey?.get(bid.collectionKey.toLowerCase());
      const top = highestBidUsdForHolding(book, bid.tokenId);
      const expired =
        bid.status === "expired" ||
        (expiresMsRemaining(bid.endTime) != null &&
          (expiresMsRemaining(bid.endTime) as number) <= 0);
      const outbid = !expired && isOutbidByBook(bid.priceUsdc, top);
      if (statusFilter === "expired") return expired;
      if (statusFilter === "outbid") return outbid;
      if (statusFilter === "highest") return !expired && !outbid;
      return true;
    });
    rows.sort((a, b) => {
      const labelA =
        collectionMetaByKey.get(a.collectionKey)?.displayLabel ||
        a.collectionKey.replace(/^ch:/, "");
      const labelB =
        collectionMetaByKey.get(b.collectionKey)?.displayLabel ||
        b.collectionKey.replace(/^ch:/, "");
      const listingsA =
        listingsByCollectionKey?.get(a.collectionKey) ??
        listingsByCollectionKey?.get(a.collectionKey.toLowerCase());
      const listingsB =
        listingsByCollectionKey?.get(b.collectionKey) ??
        listingsByCollectionKey?.get(b.collectionKey.toLowerCase());
      const askA = askUsdForToken(
        listingsA,
        a.tokenId,
        statsByCollectionKey.get(a.collectionKey)?.floor ?? null,
      );
      const askB = askUsdForToken(
        listingsB,
        b.tokenId,
        statsByCollectionKey.get(b.collectionKey)?.floor ?? null,
      );
      const bookA =
        bidsByCollectionKey?.get(a.collectionKey) ??
        bidsByCollectionKey?.get(a.collectionKey.toLowerCase());
      const bookB =
        bidsByCollectionKey?.get(b.collectionKey) ??
        bidsByCollectionKey?.get(b.collectionKey.toLowerCase());
      const topA = highestBidUsdForHolding(bookA, a.tokenId);
      const topB = highestBidUsdForHolding(bookB, b.tokenId);
      const expA = expiresMsRemaining(a.endTime) ?? Number.NEGATIVE_INFINITY;
      const expB = expiresMsRemaining(b.endTime) ?? Number.NEGATIVE_INFINITY;
      switch (sortKey) {
        case "bid":
          return compareSortNum(a.priceUsdc, b.priceUsdc, sortDir);
        case "top":
          return compareSortNum(topA, topB, sortDir);
        case "ask":
          return compareSortNum(askA, askB, sortDir);
        case "expires":
          return compareSortNum(expA, expB, sortDir);
        default:
          return compareSortText(labelA, labelB, sortDir);
      }
    });
    return rows;
  }, [
    bids,
    searchQuery,
    statusFilter,
    sortKey,
    sortDir,
    collectionMetaByKey,
    statsByCollectionKey,
    bidsByCollectionKey,
    listingsByCollectionKey,
  ]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-white/5" />
        ))}
      </div>
    );
  }

  if (bids.length === 0) {
    return (
      <div className="pf-empty pf-empty--panel">
        <p>No bids yet</p>
        <p className="pf-empty__sub">
          Place an offer from a card listing — your bids will appear here.
        </p>
        <Link href="/markets" className="pf-empty__cta">
          Browse collections
        </Link>
      </div>
    );
  }

  const filterActive = statusFilter !== "";

  return (
    <>
      <div className="pf-tbar" id="bids-tbar">
        <button
          type="button"
          className={`pf-tbtn pf-tbtn--icon${filterActive ? " pf-tbtn--on" : ""}`}
          aria-label="Filter bids"
          aria-expanded={filterOpen}
          onClick={() => setFilterOpen(true)}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="7" y1="12" x2="17" y2="12" />
            <line x1="10" y1="18" x2="14" y2="18" />
          </svg>
          {filterActive ? <span className="pf-tbtn__dot" /> : null}
        </button>
        <PortfolioToolbarSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search your bids"
          aria-label="Search your bids"
        />
        <div className="pf-tbar__spacer" />
        <div className="pf-tbar__cluster">
          <div className="pf-tbar__sortsel">
            <select
              aria-label="Sort bids"
              value={sortKey === "name" || sortKey === "ask" ? "bid" : sortKey}
              onChange={(e) => {
                setSort(e.target.value as BidsSortKey, "desc");
              }}
            >
              {BIDS_TOOLBAR_SORT.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <svg className="cx" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
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
            aria-label="Filter bids"
          >
            <div className="pf-filter-drawer__grip" />
            <div className="pf-filter-drawer__h">Filter bids</div>
            {BIDS_STATUS_OPTIONS.map((opt) => {
              const sel = statusFilter === opt.id;
              return (
                <button
                  key={opt.id || "all"}
                  type="button"
                  className={`pf-filter-drawer__opt${sel ? " pf-filter-drawer__opt--sel" : ""}`}
                  onClick={() => {
                    setStatusFilter(opt.id);
                    setFilterOpen(false);
                  }}
                >
                  {opt.label}
                  <span className="pf-filter-drawer__ck" aria-hidden>
                    ✓
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {sortedBids.length === 0 ? (
        <p className="pf-empty pf-empty--panel">No bids match your search.</p>
      ) : (
      <TkTable wrapClassName="pf-table-wrap" className="pf-table--bids">
        <colgroup>
          <col className="pf-col-card" />
          <col className="pf-col-bid" />
          <col className="pf-col-top" />
          <col className="pf-col-ask" />
          <col className="pf-col-status" />
          <col className="pf-col-expires" />
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
              onSort={(k) => toggleSort(k as BidsSortKey)}
            />
            <PortfolioSortableTh
              label="Top bid"
              sortKey="top"
              activeKey={sortKey}
              sortDir={sortDir}
              onSort={(k) => toggleSort(k as BidsSortKey)}
            />
            <PortfolioSortableTh
              label="Ask price"
              sortKey="ask"
              activeKey={sortKey}
              sortDir={sortDir}
              onSort={(k) => toggleSort(k as BidsSortKey)}
            />
            <PortfolioStaticTh label="Status" />
            <PortfolioSortableTh
              label="Expires"
              sortKey="expires"
              activeKey={sortKey}
              sortDir={sortDir}
              muted
              onSort={(k) => toggleSort(k as BidsSortKey)}
            />
            <PortfolioStaticTh label="Action" muted />
          </tr>
        </thead>
        <tbody>
          {sortedBids.map((bid, index) => {
            const meta = collectionMetaByKey.get(bid.collectionKey);
            const label =
              meta?.displayLabel?.trim() ||
              bid.collectionKey.replace(/^ch:/, "").slice(0, 48);
            const line2 = meta?.line2?.trim() || "";
            const hoverLabel = meta?.hoverLabel?.trim() || label;
            const book =
              bidsByCollectionKey?.get(bid.collectionKey) ??
              bidsByCollectionKey?.get(bid.collectionKey.toLowerCase());
            const listings =
              listingsByCollectionKey?.get(bid.collectionKey) ??
              listingsByCollectionKey?.get(bid.collectionKey.toLowerCase());
            const top = highestBidUsdForHolding(book, bid.tokenId);
            const ask = askUsdForToken(
              listings,
              bid.tokenId,
              statsByCollectionKey.get(bid.collectionKey)?.floor ?? null,
            );
            const expired =
              bid.status === "expired" ||
              (expiresMsRemaining(bid.endTime) != null &&
                (expiresMsRemaining(bid.endTime) as number) <= 0);
            const outbid = !expired && isOutbidByBook(bid.priceUsdc, top);
            const expires = formatExpiresLabel(bid.endTime, expired);
            const busy =
              cancellingHash === bid.orderHash || changingHash === bid.orderHash;
            const zebra = index % 2 === 1 ? "pf-table-row--zebra" : undefined;
            const rowClass = [zebra, expired ? "pf-table-row--expired" : null]
              .filter(Boolean)
              .join(" ");

            return (
              <tr key={bid.orderHash} className={rowClass || undefined}>
                <td data-label="Card">
                  <Link
                    href={collectionDetailHref(bid.collectionKey, {
                      listingTokenId:
                        bid.tokenId && bid.tokenId !== "0" ? bid.tokenId : null,
                    })}
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
                    <div className="pf-table-card-copy">
                      <span
                        className={`pf-table-card-name pf-table-card-name--bids ${CARD_DISPLAY_LINE1_CLAMP_CLASS}`}
                        title={hoverLabel}
                      >
                        {label}
                      </span>
                      {line2 ? (
                        <span className="pf-table-card-sub pf-table-card-sub--hover">
                          {line2}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </td>
                <td data-label="Your bid">
                  <span className="tkl-mono pf-table-bid">$ {bid.priceLabel}</span>
                </td>
                <td data-label="Top bid">
                  <span
                    className={`tkl-mono ${
                      !expired && !outbid && top != null
                        ? "pf-table-top-bid--mine"
                        : "pf-table-muted"
                    }`}
                  >
                    {top != null ? formatUsdListing(top) : "—"}
                  </span>
                </td>
                <td data-label="Ask price">
                  <span className="tkl-mono pf-table-muted">
                    {ask != null ? formatUsdListing(ask) : "—"}
                  </span>
                </td>
                <td data-label="Status">
                  {expired ? (
                    <TkTag tone="neutral" appearance="soft" className="pf-bid-status-tag">
                      EXPIRED
                    </TkTag>
                  ) : outbid ? (
                    <TkTag tone="warning" appearance="soft" className="pf-bid-status-tag">
                      {top != null
                        ? `OUTBID · TOP ${formatUsdListing(top)}`
                        : "OUTBID"}
                    </TkTag>
                  ) : (
                    <TkTag tone="positive" appearance="soft" className="pf-bid-status-tag">
                      HIGHEST
                    </TkTag>
                  )}
                </td>
                <td data-label="Expires">
                  <span
                    className={`tkl-mono pf-table-expires ${
                      expires.urgent ? "pf-table-expires--urgent" : ""
                    } ${expired ? "pf-table-expires--done" : ""}`}
                  >
                    {expires.text}
                  </span>
                </td>
                <td data-label="Action">
                  <div className="pf-table-actions">
                    {expired ? (
                      <TkButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="pf-table-btn pf-table-btn--bid-action"
                        disabled={busy}
                        onClick={() => onRebid(bid)}
                      >
                        {changingHash === bid.orderHash ? "Opening…" : "Re-bid"}
                      </TkButton>
                    ) : outbid ? (
                      <TkButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="pf-table-btn pf-table-btn--bid-action"
                        disabled={busy}
                        onClick={() => onChangeBid(bid)}
                      >
                        {changingHash === bid.orderHash ? "Opening…" : "Change"}
                      </TkButton>
                    ) : (
                      <TkButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="pf-table-btn pf-table-btn--bid-action"
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
                        {cancellingHash === bid.orderHash ? "Cancelling…" : "Cancel"}
                      </TkButton>
                    )}
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
