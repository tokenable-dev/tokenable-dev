"use client";

import {
  CollectionDetailLoadedView,
  CollectionDetailLoadingShell,
} from "@/components/marketplace/collection-detail";
import {
  useCollectionDetailPage,
  type CollectionDetailLoadedProps,
} from "@/hooks/collection-detail";

export default function MarketplaceCollectionPage() {
  const detail = useCollectionDetailPage();

  if (detail.status === "invalid") {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-gray-500 text-sm">
        Invalid collection.
      </div>
    );
  }

  if (detail.status === "loading") {
    return <CollectionDetailLoadingShell />;
  }

  if (detail.status === "error") {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center">
        <p className="text-red-400 text-sm mb-4">
          {detail.error instanceof Error
            ? detail.error.message
            : "Collection not found (no summary row for this bucket yet). List an NFT in this bucket or open it from the markets after the first listing."}
        </p>
      </div>
    );
  }

  if (!detail.data || !detail.collectionOrderBookProps) {
    return null;
  }

  const loaded = detail as CollectionDetailLoadedProps;

  return <CollectionDetailLoadedView {...loaded} />;
}
