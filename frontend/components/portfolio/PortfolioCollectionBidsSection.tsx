"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { CollectionMarketStats, Order } from "@/lib/core";
import type { PortfolioBidCollectionMeta, PortfolioBidRow } from "@/lib/portfolio/portfolioBidTypes";
import { compareSortNum, compareSortText } from "@/lib/portfolio/portfolioTableHelpers";
import { formatUsdListing } from "@/lib/market/collectionMarketPricing";
import { TkButton, TkTable, TkTag } from "@/components/ds";
import { usePortfolioTableSort } from "@/hooks/portfolio/usePortfolioTableSort";
import { highestBidUsdForHolding } from "@/hooks/portfolio/usePortfolioCollectionTopBids";
import { PortfolioMobileSort } from "./PortfolioMobileSort";
import { PortfolioSortableTh, PortfolioStaticTh } from "./PortfolioSortableTh";
import { CARD_DISPLAY_LINE1_CLAMP_CLASS } from "@/components/marketplace/marketplace-shared";

type BidsSortKey = "name" | "bid" | "top" | "ask" | "expires";

const BIDS_SORT_OPTIONS = [
  { key: "name", label: "Card" },
  { key: "bid", label: "Your bid" },
  { key: "top", label: "Top bid" },
  { key: "ask", label: "Ask price" },
  { key: "expires", label: "Expires" },
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
  const { sortKey, sortDir, toggleSort, applyMobileSort, mobileSortValue } =
    usePortfolioTableSort<BidsSortKey>("name");

  const sortedBids = useMemo(() => {
    const rows = [...bids];
    rows.sort((a, b) => {
      const labelA =
        collectionMetaByKey.get(a.collectionKey)?.displayLabel ??
        a.collectionKey.replace(/^ch:/, "");
      const labelB =
        collectionMetaByKey.get(b.collectionKey)?.displayLabel ??
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
      <div className="pf-panel-toolbar pf-panel-toolbar--bids-only">
        <PortfolioMobileSort
          options={[...BIDS_SORT_OPTIONS]}
          value={mobileSortValue}
          onChange={applyMobileSort}
        />
      </div>

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
              onSort={(k) => toggleSort(k as BidsSortKey)}
            />
            <PortfolioStaticTh label="Action" muted />
          </tr>
        </thead>
        <tbody>
          {sortedBids.map((bid, index) => {
            const meta = collectionMetaByKey.get(bid.collectionKey);
            const label =
              meta?.displayLabel ?? bid.collectionKey.replace(/^ch:/, "").slice(0, 48);
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
                    <span className={`pf-table-card-name ${CARD_DISPLAY_LINE1_CLAMP_CLASS}`}>
                      {label}
                    </span>
                  </Link>
                </td>
                <td data-label="Your bid">
                  <span className="tkl-mono pf-table-bid">{bid.priceLabel}</span>
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
    </>
  );
}
