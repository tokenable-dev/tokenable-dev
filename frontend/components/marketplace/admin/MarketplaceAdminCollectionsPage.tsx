"use client";

/**
 * AI Insight preview: admin collections tab only (public detail uses coming-soon modal).
 */
import { useMarketplaceAdminCollections } from "@/hooks/marketplace-admin/useMarketplaceAdminCollections";
import {
  ADMIN_BTN_LOAD_MORE,
  ADMIN_COUNT,
  ADMIN_LIST,
  ADMIN_PAGE,
} from "./adminUi";
import { MarketplaceAdminCollectionRow } from "./MarketplaceAdminCollectionRow";
import { MarketplaceAdminNav } from "./MarketplaceAdminNav";
import { MarketplaceAdminPageHeader } from "./MarketplaceAdminPageHeader";

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
    <div className={ADMIN_PAGE}>
      <MarketplaceAdminNav />
      <MarketplaceAdminPageHeader
        title="Collections"
        subtitle="Browse collection buckets, market snapshots, and AI insight previews."
      />

      {listQuery.isLoading ? (
        <p className="text-base text-zinc-500">Loading collections…</p>
      ) : listQuery.isError ? (
        <p className="text-base text-red-400" role="alert">
          {listQuery.error instanceof Error
            ? listQuery.error.message
            : "Failed to load collections"}
        </p>
      ) : items.length === 0 ? (
        <p className="text-base text-zinc-500">No collections found.</p>
      ) : (
        <div className={ADMIN_LIST}>
          <p className={ADMIN_COUNT}>
            {items.length} collection{items.length === 1 ? "" : "s"}
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
              className={ADMIN_BTN_LOAD_MORE}
            >
              {isLoadingMore ? "Loading…" : "Load more collections"}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
