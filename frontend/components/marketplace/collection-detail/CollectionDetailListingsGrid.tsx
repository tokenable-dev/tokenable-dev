"use client";

import Link from "next/link";
import type { Address } from "viem";
import { CollectionRwaCard } from "@/components/marketplace/collection-listings";
import { CollectionListingOrderbookRow } from "@/components/marketplace/collection-detail/CollectionListingOrderbookRow";
import type { Order, RwaMetadata } from "@/lib/core";
import {
  COLLECTION_DETAIL_LISTING_GRID_DESKTOP_CLASS,
  COLLECTION_DETAIL_LISTING_ORDERBOOK_CLASS,
} from "@/lib/marketplace/collectionListingUtils";

export function CollectionDetailListingsGrid({
  collectionKey,
  tokenIds,
  askMap,
  batchMetadata,
  address,
  gradeLabel,
  onOpenListing,
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
}) {
  if (tokenIds.length === 0) {
    return (
      <div className="cd-listings-empty w-full px-4 py-8 text-center text-[13px] leading-relaxed max-lg:py-6 lg:py-10 lg:text-[14px]">
        No listings yet. List an asset from{" "}
        <Link href="/portfolio" className="hover:underline">
          Portfolio
        </Link>
        .
      </div>
    );
  }

  return (
    <>
      <div className={COLLECTION_DETAIL_LISTING_GRID_DESKTOP_CLASS}>
        {tokenIds.map((tid) => {
          const prefetch = batchMetadata?.get(tid);
          return (
            <CollectionRwaCard
              key={tid}
              tokenId={tid}
              collectionKey={collectionKey}
              listing={askMap.get(tid) ?? null}
              address={address}
              prefetchedImageUrl={prefetch?.imageUrl}
              prefetchedMetadata={prefetch?.metadata}
              collectionDetailListing
              onOpenListing={onOpenListing}
            />
          );
        })}
      </div>

      <div className={COLLECTION_DETAIL_LISTING_ORDERBOOK_CLASS}>
        {tokenIds.map((tid) => {
          const listing = askMap.get(tid);
          if (!listing) return null;
          const prefetch = batchMetadata?.get(tid);
          return (
            <CollectionListingOrderbookRow
              key={tid}
              tokenId={tid}
              collectionKey={collectionKey}
              listing={listing}
              imageUrl={prefetch?.imageUrl}
              gradeLabel={gradeLabel}
              onOpenListing={onOpenListing}
            />
          );
        })}
      </div>
    </>
  );
}
