"use client";

import { useMarketplaceAdminCollections } from "@/hooks/marketplace-admin/useMarketplaceAdminCollections";
import { MarketplaceAdminCollectionRow } from "./MarketplaceAdminCollectionRow";
import { MarketplaceAdminNav } from "./MarketplaceAdminNav";

export function MarketplaceAdminCollectionsPage() {
  const {
    listQuery,
    items,
    snapshotByKey,
    snapshotsQuery,
    invalidateCollections,
    hasMore,
    loadMore,
    isLoadingMore,
  } = useMarketplaceAdminCollections();

  return (
    <div className="mx-auto min-h-screen w-full max-w-4xl px-3 py-6 sm:px-5 sm:py-8">
      <MarketplaceAdminNav />

      {listQuery.isLoading ? (
        <p className="text-sm text-zinc-500">Loading collections…</p>
      ) : listQuery.isError ? (
        <p className="text-sm text-red-400" role="alert">
          {listQuery.error instanceof Error
            ? listQuery.error.message
            : "Failed to load collections"}
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-zinc-500">No collections found.</p>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-zinc-500">
            {items.length} collection(s)
            {snapshotsQuery.isFetching ? " · refreshing market data…" : ""}
          </p>
          {items.map((row) => (
            <MarketplaceAdminCollectionRow
              key={row.collectionKey}
              row={row}
              snapshot={snapshotByKey.get(row.collectionKey.toLowerCase())}
              busy={isLoadingMore}
              onCoverSaved={() => void invalidateCollections(row.collectionKey)}
              onDeleted={() => void invalidateCollections(row.collectionKey)}
            />
          ))}
          {hasMore ? (
            <button
              type="button"
              disabled={isLoadingMore}
              onClick={() => void loadMore()}
              className="w-full rounded-lg border border-zinc-700 py-2 text-[11px] font-semibold text-zinc-300 hover:bg-zinc-800/80 disabled:opacity-50"
            >
              {isLoadingMore ? "Loading…" : "Load more"}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
