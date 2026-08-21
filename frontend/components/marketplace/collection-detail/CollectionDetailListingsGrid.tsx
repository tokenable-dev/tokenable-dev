"use client";

import { useMemo, useState } from "react";
import type { Address } from "viem";
import { TkButton } from "@/components/ds";
import type { Order, RwaMetadata } from "@/lib/core";
import { CollectionListingAskRow } from "./CollectionListingAskRow";
import { CollectionDetailViewAllDrawer } from "./CollectionDetailViewAllDrawer";

/** Card.html `#ask-listbox` — show 7 rows; View all opens the drawer. */
const VISIBLE_ASK_ROWS = 7;

export function CollectionDetailListingsGrid({
  collectionKey: _collectionKey,
  tokenIds,
  askMap,
  batchMetadata,
  address: _address,
  gradeLabel: _gradeLabel,
  onOpenListing,
  onPlaceBid,
  emptyMode = "portfolio",
}: {
  collectionKey: string;
  tokenIds: number[];
  askMap: Map<number, Order>;
  batchMetadata:
    | Map<number, { metadata: RwaMetadata | null; imageUrl: string | null }>
    | undefined;
  address: Address | undefined;
  gradeLabel?: string | null;
  onOpenListing?: (tokenId: number, action?: "view" | "buy" | "bid") => void;
  onPlaceBid?: () => void;
  /** Card.html empty copy uses Place a bid; mobile may keep portfolio hint. */
  emptyMode?: "card-html" | "portfolio";
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const rows = useMemo(() => {
    return tokenIds
      .map((tid) => {
        const listing = askMap.get(tid);
        if (!listing) return null;
        return {
          tokenId: tid,
          listing,
          metadata: batchMetadata?.get(tid)?.metadata ?? null,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r != null);
  }, [tokenIds, askMap, batchMetadata]);

  if (rows.length === 0) {
    if (emptyMode === "card-html") {
      return (
        <div className="cd-asks-empty" id="asks-empty">
          <div className="cd-asks-empty__title">No listings yet</div>
          <p className="cd-asks-empty__body">
            Place a bid and we&rsquo;ll fill it the moment one appears. You&rsquo;ll
            be first in line at your price.
          </p>
          {onPlaceBid ? (
            <TkButton
              type="button"
              variant="primary"
              className="cd-asks-empty__cta"
              onClick={onPlaceBid}
            >
              Place a bid
            </TkButton>
          ) : null}
          <div className="cd-asks-empty__hint mono">
            Backed by your USDC balance · expires in 7 days
          </div>
        </div>
      );
    }
    return (
      <div className="cd-listings-empty w-full px-4 py-8 text-center text-[13px] leading-relaxed max-lg:py-6 lg:py-10 lg:text-[14px]">
        No listings yet.
      </div>
    );
  }

  const visible = rows.slice(0, VISIBLE_ASK_ROWS);
  const hasMore = rows.length > VISIBLE_ASK_ROWS;

  const table = (list: typeof rows, id?: string) => (
    <div className="cd-ask-notch notch" id={id}>
      <div className="cd-ask-notch__head">
        <span className="mono">Ask price</span>
        <span className="mono">Vault</span>
        <span className="mono">Cert</span>
        <span className="mono cd-ask-notch__head-buy">Buy</span>
      </div>
      <div className="cd-ask-notch__list" id={id ? undefined : "ask-listbox"}>
        {list.map((row) => (
          <CollectionListingAskRow
            key={row.tokenId}
            tokenId={row.tokenId}
            listing={row.listing}
            metadata={row.metadata}
            isLowest={row.tokenId === rows[0]?.tokenId}
            onOpenListing={onOpenListing}
          />
        ))}
      </div>
    </div>
  );

  return (
    <>
      {table(visible, "ask-notch")}
      {hasMore ? (
        <button
          type="button"
          className="viewall-btn cd-viewall-btn"
          onClick={() => setDrawerOpen(true)}
        >
          View all {rows.length} asks
        </button>
      ) : null}
      <CollectionDetailViewAllDrawer
        open={drawerOpen}
        title={`All asks (${rows.length})`}
        onClose={() => setDrawerOpen(false)}
      >
        {table(rows)}
      </CollectionDetailViewAllDrawer>
    </>
  );
}
