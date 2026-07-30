"use client";

import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useMarketplaceAdminCards } from "@/hooks/marketplace-admin/useMarketplaceAdminCards";
import { useAdminCollectionMarketSnapshots } from "@/hooks/marketplace-admin/useAdminCollectionMarketSnapshots";
import { useAdminBurnToken } from "@/hooks/marketplace-admin/useAdminBurnToken";
import { useAppChain } from "@/providers/AppChainProvider";
import { useAppStore, selectWallet } from "@/store";
import { AdminBurnTokenPanel } from "./AdminBurnTokenPanel";
import {
  ADMIN_ARTICLE,
  ADMIN_COUNT,
  ADMIN_LIST,
  ADMIN_SEGMENT,
  ADMIN_SEGMENT_BTN,
  ADMIN_SEGMENT_BTN_ACTIVE,
} from "./adminUi";
import { MarketplaceAdminCardRow } from "./MarketplaceAdminCardRow";
import { MarketplaceAdminPageHeader } from "./MarketplaceAdminPageHeader";

type CardsTab = "active" | "burned";

const CARD_TABS: { value: CardsTab; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "burned", label: "Burned" },
];

export function MarketplaceAdminCardsPage() {
  const [tab, setTab] = useState<CardsTab>("active");
  const { chain } = useAppChain();
  const { address, isConnected } = useAppStore(useShallow(selectWallet));
  const { query, updateMutation, previewMetadataImage } = useMarketplaceAdminCards();
  const { burningTokenId, burnToken } = useAdminBurnToken(
    isConnected && address ? address : undefined,
  );

  const items = query.data?.items ?? [];

  const activeItems = useMemo(
    () => items.filter((r) => !r.burnedAt),
    [items],
  );
  const burnedItems = useMemo(
    () => items.filter((r) => r.burnedAt),
    [items],
  );
  const visibleItems = tab === "burned" ? burnedItems : activeItems;

  const listedCount = useMemo(
    () => activeItems.filter((r) => r.hasActiveListing).length,
    [activeItems],
  );

  const collectionKeys = useMemo(
    () =>
      visibleItems
        .map((r) => r.collectionKey)
        .filter((k): k is string => Boolean(k?.trim())),
    [visibleItems],
  );
  const { byKey: snapshotByKey } = useAdminCollectionMarketSnapshots(collectionKeys);

  return (
    <>
      <MarketplaceAdminPageHeader
        title="All cards"
        subtitle={`Every minted RWA on ${chain.label} — listed, unlisted, and burned. Edit display metadata and run admin burn. Switch network in the top bar to manage another chain.`}
      />

      {tab === "active" ? (
        <AdminBurnTokenPanel
          burningTokenId={burningTokenId}
          onBurn={(tokenId) => {
            const row = items.find((r) => r.tokenId === tokenId);
            void burnToken(tokenId, {
              hasActiveListing: row?.hasActiveListing,
              alreadyBurned: Boolean(row?.burnedAt),
            });
          }}
        />
      ) : null}

      <div className={`${ADMIN_ARTICLE} mb-6`}>
        <div className={ADMIN_SEGMENT}>
          {CARD_TABS.map((t) => {
            const count = t.value === "burned" ? burnedItems.length : activeItems.length;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTab(t.value)}
                className={
                  tab === t.value ? ADMIN_SEGMENT_BTN_ACTIVE : ADMIN_SEGMENT_BTN
                }
              >
                {t.label}
                <span className="ml-1 tabular-nums text-zinc-500">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {query.isLoading ? (
        <p className="text-base text-zinc-700">Loading cards…</p>
      ) : query.isError ? (
        <p className="text-base text-red-600" role="alert">
          {query.error instanceof Error
            ? query.error.message
            : "Failed to load cards"}
        </p>
      ) : items.length === 0 ? (
        <p className="text-base text-zinc-700">
          No minted RWA tokens in the {chain.label} registry yet.
        </p>
      ) : visibleItems.length === 0 ? (
        <p className="text-base text-zinc-700">
          {tab === "burned"
            ? "No burned tokens in the registry."
            : "No active tokens — switch to Burned to see redeemed cards."}
        </p>
      ) : (
        <div className={ADMIN_LIST}>
          <p className={ADMIN_COUNT}>
            {visibleItems.length} {tab === "burned" ? "burned" : "active"} card
            {visibleItems.length === 1 ? "" : "s"}
            {tab === "active" && listedCount > 0
              ? ` · ${listedCount} listed`
              : ""}
          </p>
          {visibleItems.map((row) => (
            <MarketplaceAdminCardRow
              key={row.tokenId}
              row={row}
              snapshot={
                row.collectionKey
                  ? snapshotByKey.get(row.collectionKey.toLowerCase())
                  : undefined
              }
              busy={updateMutation.isPending}
              onSave={async (patch) => {
                await updateMutation.mutateAsync({
                  tokenId: row.tokenId,
                  ...patch,
                });
              }}
              onPreviewMetadata={async () => {
                const res = await previewMetadataImage(row.tokenId);
                return res.httpsUrl ?? res.imageRef;
              }}
              onClearImageOverride={async () => {
                await updateMutation.mutateAsync({
                  tokenId: row.tokenId,
                  displayImageUrl: null,
                });
              }}
              burningTokenId={tab === "active" ? burningTokenId : null}
              onBurn={
                tab === "active"
                  ? () =>
                      void burnToken(row.tokenId, {
                        hasActiveListing: row.hasActiveListing,
                        alreadyBurned: Boolean(row.burnedAt),
                      })
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </>
  );
}
