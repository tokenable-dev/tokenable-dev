"use client";

import Link from "next/link";
import type { Address } from "viem";
import { CollectionRwaCard } from "@/components/marketplace/collection-listings";
import type { Order, RwaMetadata } from "@/lib/core";
import {
  COLLECTION_DETAIL_LISTING_GRID_CLASS,
} from "@/lib/marketplace/collectionListingUtils";

export function CollectionDetailListingsGrid({
  collectionKey,
  tokenIds,
  askMap,
  batchMetadata,
  address,
}: {
  collectionKey: string;
  tokenIds: number[];
  askMap: Map<number, Order>;
  batchMetadata:
    | Map<number, { metadata: RwaMetadata | null; imageUrl: string | null }>
    | undefined;
  address: Address | undefined;
}) {
  if (tokenIds.length === 0) {
    return (
      <div className="w-full rounded-lg border border-zinc-900/80 bg-zinc-950/40 px-4 py-8 text-center text-[13px] leading-relaxed text-zinc-500 max-lg:py-6 lg:py-10 lg:text-[14px]">
        No listings yet. List an asset from{" "}
        <Link href="/portfolio" className="text-mint hover:underline">
          Portfolio
        </Link>
        .
      </div>
    );
  }

  return (
    <div className={COLLECTION_DETAIL_LISTING_GRID_CLASS}>
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
            compact
            collectionDetailListing
          />
        );
      })}
    </div>
  );
}
