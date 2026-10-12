"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CollectionMarketStats, Order } from "@/lib/core";
import type { PortfolioBidCollectionMeta, PortfolioBidRow } from "@/lib/portfolio/portfolioBidTypes";
import { compareSortNum, compareSortText } from "@/lib/portfolio/portfolioTableHelpers";
import { formatUsdListing } from "@/lib/market/collectionMarketPricing";
import { TkTable } from "@/components/ds";
import { usePortfolioTableSort } from "@/hooks/portfolio/usePortfolioTableSort";
import { highestBidUsdForHolding } from "@/hooks/portfolio/usePortfolioCollectionTopBids";
import { collectionDetailHref } from "@/lib/marketplace/collectionBrowseContext";
import { PortfolioToolbarSearch } from "./PortfolioToolbarSearch";

type BidsSortKey = "name" | "bid" | "top" | "ask" | "expires";
type BidsStatusFilter = "" | "highest" | "outbid" | "expired";

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

function formatExpiresLong(
  endTimeIso: string | null | undefined,
  expired: boolean,
): string {
  if (expired) return "Expired";
  const ms = expiresMsRemaining(endTimeIso);
  if (ms == null || ms <= 0) return "Expired";
  const hours = Math.max(1, Math.floor(ms / 3_600_000));
  if (hours >= 48) {
    const days = Math.max(1, Math.floor(hours / 24));
    return `Ends in ${days} day${days === 1 ? "" : "s"}`;
  }
  return `Ends in ${hours} hour${hours === 1 ? "" : "s"}`;
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

function BidRowActions({
  expired,
  busy,
  changing,
  cancelling,
  onChange,
  onCancel,
  onRebid,
}: {
  expired: boolean;
  busy: boolean;
  changing: boolean;
  cancelling: boolean;
  onChange: () => void;
  onCancel: () => void;
  onRebid: () => void;
}) {
  if (expired) {
    return (
      <div className="pf-ux-acts">
        <button type="button" className="pf-ux-btn" disabled={busy} onClick={onRebid}>
          {changing ? "Opening…" : "Re-bid"}
        </button>
      </div>
    );
  }
  return (
    <div className="pf-ux-acts">
      <button type="button" className="pf-ux-btn" disabled={busy} onClick={onChange}>
        {changing ? "Opening…" : "Change"}
      </button>
      <button type="button" className="pf-ux-btn" disabled={busy} onClick={onCancel}>
        {cancelling ? "Cancelling…" : "Cancel"}
      </button>
    </div>
  );
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
  const { sortKey, sortDir } = usePortfolioTableSort<BidsSortKey>("bid", "desc");

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

  return (
    <>
      <div className="pf-tbar" id="bids-tbar">
        <label className="pf-tdrop">
          <span className="pf-tdrop__k">Filter:</span>
          <select
            aria-label="Filter bids by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as BidsStatusFilter)}
          >
            {BIDS_STATUS_OPTIONS.map((opt) => (
              <option key={opt.id || "all"} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
          <svg className="cx" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </label>
        <PortfolioToolbarSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search your bids"
          aria-label="Search your bids"
        />
        <div className="pf-tbar__spacer" />
      </div>

      {sortedBids.length === 0 ? (
        <p className="pf-empty pf-empty--panel">No bids match your search.</p>
      ) : (
      <TkTable wrapClassName="pf-table-wrap" className="pf-table--bids pf-ux">
        <thead>
          <tr>
            <th>Item</th>
            <th>Action</th>
            <th>Date</th>
            <th>Status</th>
            <th className="pf-ux-r" />
          </tr>
        </thead>
        <tbody>
          {sortedBids.map((bid) => {
            const meta = collectionMetaByKey.get(bid.collectionKey);
            const label =
              meta?.displayLabel?.trim() ||
              bid.collectionKey.replace(/^ch:/, "").slice(0, 48);
            const hoverLabel = meta?.hoverLabel?.trim() || label;
            const href = collectionDetailHref(bid.collectionKey, {
              listingTokenId: bid.tokenId && bid.tokenId !== "0" ? bid.tokenId : null,
            });
            const book =
              bidsByCollectionKey?.get(bid.collectionKey) ??
              bidsByCollectionKey?.get(bid.collectionKey.toLowerCase());
            const top = highestBidUsdForHolding(book, bid.tokenId);
            const expired =
              bid.status === "expired" ||
              (expiresMsRemaining(bid.endTime) != null &&
                (expiresMsRemaining(bid.endTime) as number) <= 0);
            const outbid = !expired && isOutbidByBook(bid.priceUsdc, top);
            const expires = formatExpiresLabel(bid.endTime, expired);
            const expiresLong = formatExpiresLong(bid.endTime, expired);
            const busy =
              cancellingHash === bid.orderHash || changingHash === bid.orderHash;
            const statusLabel = expired ? "Expired" : outbid ? "Outbid" : "Highest";
            const statusClass = expired ? "pf-ux-mute" : outbid ? "pf-ux-warn" : "pf-ux-pos";
            const bidUsd = formatUsdListing(bid.priceUsdc);
            const topUsd = top != null ? formatUsdListing(top) : "—";
            const actions = (
              <BidRowActions
                expired={expired}
                busy={busy}
                changing={changingHash === bid.orderHash}
                cancelling={cancellingHash === bid.orderHash}
                onChange={() => onChangeBid(bid)}
                onRebid={() => onRebid(bid)}
                onCancel={() =>
                  onCancel(bid.orderHash, bid.collectionKey, label, bid.priceLabel)
                }
              />
            );

            return (
              <tr
                key={bid.orderHash}
                className={`pf-ux-row${expired ? " is-dim" : ""}`}
                style={{ cursor: "pointer" }}
              >
                <td data-label="Item">
                  <div className="pf-ux-item">
                    <span className="pf-ux-thumb">
                      {meta?.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={meta.imageUrl} alt="" />
                      ) : metaLoading ? (
                        <span className="pf-ux-thumb__ph" />
                      ) : null}
                    </span>
                    <span className="pf-ux-txt">
                      <Link href={href} className="pf-ux-name" title={hoverLabel}>
                        {label}
                      </Link>
                      <span className="pf-ux-sub">
                        <span className="pf-ux-mono">
                          Your bid <b className="pf-ux-blue">{bidUsd}</b>
                          {" · "}top {topUsd}
                        </span>
                      </span>
                    </span>
                  </div>
                </td>
                <td data-label="Action">
                  <span className="pf-ux-v">Bid</span>
                </td>
                <td data-label="Date">
                  <span className={`pf-ux-d${expires.urgent ? " pf-ux-warn" : ""}`}>
                    {expires.text}
                  </span>
                  <span
                    className={`pf-ux-dm${expires.urgent ? " pf-ux-warn" : ""}`}
                  >
                    {expiresLong}
                  </span>
                </td>
                <td data-label="Status">
                  <span className={`pf-ux-v ${statusClass}`}>{statusLabel}</span>
                </td>
                <td data-label="Trail" className="pf-ux-r">
                  {actions}
                </td>
                <td className="pf-ux-mc" data-label="Mobile">
                  <div className="pf-ux-mc__card">
                    <span className="pf-ux-mc__thumb">
                      {meta?.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={meta.imageUrl} alt="" />
                      ) : null}
                    </span>
                    <div className="pf-ux-mc__body">
                      <div className="pf-ux-mc__row">
                        <Link href={href} className="pf-ux-mc__name" title={hoverLabel}>
                          {label}
                        </Link>
                        <span className={`pf-ux-chip ${statusClass}`}>{statusLabel}</span>
                      </div>
                      <div className="pf-ux-mc__money">
                        <span className="pf-ux-mono">
                          Your bid <b className="pf-ux-blue">{bidUsd}</b>
                          {" · "}top {topUsd}
                        </span>
                      </div>
                      <div className={`pf-ux-mc__meta${expires.urgent ? " pf-ux-warn" : ""}`}>
                        {expiresLong}
                      </div>
                      {actions}
                    </div>
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
