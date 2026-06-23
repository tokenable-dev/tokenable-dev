"use client";

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useConnect } from "wagmi";
import { useMarketplaceAdminCards } from "@/hooks/marketplace-admin/useMarketplaceAdminCards";
import { useAdminCollectionMarketSnapshots } from "@/hooks/marketplace-admin/useAdminCollectionMarketSnapshots";
import { useAdminBurnToken } from "@/hooks/marketplace-admin/useAdminBurnToken";
import { connectMetaMaskWallet } from "@/lib/wallet/connectMetaMaskWallet";
import { useAppStore, selectWallet } from "@/store";
import { AdminBurnTokenPanel } from "./AdminBurnTokenPanel";
import { MarketplaceAdminCardRow } from "./MarketplaceAdminCardRow";
import { MarketplaceAdminNav } from "./MarketplaceAdminNav";

export function MarketplaceAdminCardsPage() {
  const { address, isConnected } = useAppStore(useShallow(selectWallet));
  const { connect, connectors, isPending: connectPending } = useConnect();
  const operatorAddress = isConnected && address ? address : undefined;

  const { query, updateMutation, previewMetadataImage } = useMarketplaceAdminCards();

  const items = query.data?.items ?? [];

  const collectionKeys = useMemo(
    () =>
      items
        .map((r) => r.collectionKey)
        .filter((k): k is string => Boolean(k?.trim())),
    [items],
  );
  const { byKey: snapshotByKey } = useAdminCollectionMarketSnapshots(collectionKeys);
  const { burningTokenId, burnToken } = useAdminBurnToken(operatorAddress);

  return (
    <div className="mx-auto min-h-screen w-full max-w-4xl px-3 py-6 sm:px-5 sm:py-8">
      <MarketplaceAdminNav />

      <AdminBurnTokenPanel
        burningTokenId={burningTokenId}
        onBurn={(tokenId) => void burnToken(tokenId)}
        walletConnected={Boolean(operatorAddress)}
        connectPending={connectPending}
        onConnect={() => connectMetaMaskWallet(connect, connectors)}
      />

      {query.isLoading ? (
        <p className="text-sm text-zinc-500">Loading listed cards…</p>
      ) : query.isError ? (
        <p className="text-sm text-red-400" role="alert">
          {query.error instanceof Error
            ? query.error.message
            : "Failed to load cards"}
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-zinc-500">No active listings found.</p>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-zinc-500">{items.length} listed card(s)</p>
          {items.map((row) => (
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
