"use client";

/**
 * Collection moderation: pending_review queue + active/rejected filters.
 * AI Insight preview remains available on each row.
 */
import { useState } from "react";
import { useMarketplaceAdminCollections } from "@/hooks/marketplace-admin/useMarketplaceAdminCollections";
import type { CollectionReviewStatusFilter } from "@/lib/core";
import {
  ADMIN_BTN_LOAD_MORE,
  ADMIN_COUNT,
  ADMIN_LIST,
} from "./adminUi";
import { MarketplaceAdminCollectionRow } from "./MarketplaceAdminCollectionRow";
import { MarketplaceAdminCreateCollectionPanel } from "./MarketplaceAdminCreateCollectionPanel";
import { MarketplaceAdminPageHeader } from "./MarketplaceAdminPageHeader";

const FILTERS: {
  id: CollectionReviewStatusFilter;
  label: string;
}[] = [
  { id: "pending_review", label: "Pending review" },
  { id: "active", label: "Active" },
  { id: "rejected", label: "Rejected" },
  { id: "all", label: "All" },
];

export function MarketplaceAdminCollectionsPage() {
  const {
    reviewFilter,
    setReviewFilter,
    counts,
    listQuery,
    items,
    snapshotByKey,
    snapshotsQuery,
    invalidateCollections,
    setReviewStatus,
    hasMore,
    loadMore,
    isLoadingMore,
  } = useMarketplaceAdminCollections();
  const [reviewBusyKey, setReviewBusyKey] = useState<string | null>(null);

  async function onReview(
    collectionKey: string,
    next: "active" | "rejected" | "pending_review",
  ) {
    setReviewBusyKey(collectionKey);
    try {
      await setReviewStatus(collectionKey, next);
    } finally {
      setReviewBusyKey(null);
    }
  }

  const emptyCopy =
    reviewFilter === "pending_review"
      ? "No collections awaiting review."
      : "No collections found for this filter.";

  return (
    <>
      <MarketplaceAdminPageHeader
        title="Collections"
        subtitle="Create catalog buckets from a PSA cert (no mint required), then review cover, names, prices, chart, and Cardhedger before Markets."
      />

      <MarketplaceAdminCreateCollectionPanel
        onCreated={async () => {
          setReviewFilter("pending_review");
          await invalidateCollections();
        }}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count =
            f.id === "all"
              ? (counts?.pending_review ?? 0) +
                (counts?.active ?? 0) +
                (counts?.rejected ?? 0)
              : counts?.[f.id as "pending_review" | "active" | "rejected"];
          const active = reviewFilter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setReviewFilter(f.id)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                active
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400"
              }`}
            >
              {f.label}
              {typeof count === "number" ? (
                <span
                  className={`ml-1.5 tabular-nums ${
                    active ? "text-zinc-300" : "text-zinc-500"
                  }`}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {listQuery.isLoading ? (
        <p className="text-base text-zinc-700">Loading collections…</p>
      ) : listQuery.isError ? (
        <p className="text-base text-red-600" role="alert">
          {listQuery.error instanceof Error
            ? listQuery.error.message
            : "Failed to load collections"}
        </p>
      ) : items.length === 0 ? (
        <p className="text-base text-zinc-700">{emptyCopy}</p>
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
              busy={isLoadingMore || reviewBusyKey === row.collectionKey}
              onCoverSaved={() => void invalidateCollections(row.collectionKey)}
              onDeleted={() => void invalidateCollections(row.collectionKey)}
              onApprove={() => void onReview(row.collectionKey, "active")}
              onReject={() => void onReview(row.collectionKey, "rejected")}
              onReopen={() => void onReview(row.collectionKey, "pending_review")}
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
    </>
  );
}
