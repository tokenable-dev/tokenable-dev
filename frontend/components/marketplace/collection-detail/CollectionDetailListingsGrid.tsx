"use client";

import Link from "next/link";
import type { Address } from "viem";
import { CollectionRwaCard } from "@/components/marketplace/collection-listings";
import type { Order, RwaMetadata } from "@/lib/core";

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
      <div className="w-full px-1 py-6 text-center text-[13px] leading-relaxed text-zinc-500 max-lg:py-5 lg:px-4 lg:py-8 lg:text-[15px] lg:text-[#a0a0a0]">
        No listings yet. List an asset from{" "}
        <Link href="/portfolio" className="text-mint hover:underline">
          Portfolio
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="grid w-full min-w-0 max-w-full grid-cols-2 content-start items-stretch justify-items-stretch gap-2 max-lg:gap-2 lg:flex lg:flex-row lg:flex-wrap lg:gap-x-[0.875rem] lg:gap-y-[0.9rem] lg:pb-2">
      {tokenIds.map((tid) => {
        const prefetch = batchMetadata?.get(tid);
        return (
          <div
            key={tid}
            className="flex min-h-0 min-w-0 w-full lg:w-[218px] lg:shrink-0 lg:w-[234px]"
          >
            <CollectionRwaCard
              tokenId={tid}
              collectionKey={collectionKey}
              listing={askMap.get(tid) ?? null}
              address={address}
              prefetchedImageUrl={prefetch?.imageUrl}
              prefetchedMetadata={prefetch?.metadata}
              compact
            />
          </div>
        );
      })}
    </div>
  );
}
