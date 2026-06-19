"use client";

import { useConnect } from "wagmi";
import { useShallow } from "zustand/react/shallow";
import type { Address } from "viem";
import { useMarketplaceAdminCollections } from "@/hooks/marketplace-admin/useMarketplaceAdminCollections";
import { connectMetaMaskWallet } from "@/lib/wallet/connectMetaMaskWallet";
import { isMarketplaceAdminWallet, marketplaceAdminWallets } from "@/lib/marketplace";
import { useAppStore, selectWallet } from "@/store";
import { MarketplaceAdminCollectionRow } from "./MarketplaceAdminCollectionRow";
import { MarketplaceAdminNav } from "./MarketplaceAdminNav";

const REQUIRED_ADMIN_HINT = marketplaceAdminWallets()[0] ?? "";

export function MarketplaceAdminCollectionsPage() {
  const { address, isConnected } = useAppStore(useShallow(selectWallet));
  const { connect, connectors, isPending: connectPending } = useConnect();
  const isAdmin = isMarketplaceAdminWallet(address);
  const adminWallet = isAdmin && address ? (address as Address) : undefined;

  const {
    listQuery,
    items,
    snapshotByKey,
    snapshotsQuery,
    invalidateCollections,
    hasMore,
    loadMore,
    isLoadingMore,
  } = useMarketplaceAdminCollections(adminWallet);

  if (!isConnected || !address) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-white">Collection admin</h1>
        <p className="mt-3 text-sm text-zinc-400">
          Connect the marketplace admin wallet to manage collections.
        </p>
        <p className="mt-2 font-mono text-[11px] text-zinc-500">{REQUIRED_ADMIN_HINT}</p>
        <button
          type="button"
          disabled={connectPending}
          onClick={() => connectMetaMaskWallet(connect, connectors)}
          className="mt-6 rounded-lg bg-amber-500/90 px-4 py-2 text-sm font-bold text-[#0a0a0a] hover:bg-amber-400 disabled:opacity-50"
        >
          {connectPending ? "Connecting…" : "Connect wallet"}
        </button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-white">Access denied</h1>
        <p className="mt-3 text-sm text-zinc-400">
          This page is only available to authorized marketplace admin wallets.
        </p>
        <p className="mt-2 font-mono text-[11px] text-zinc-500">
          Connected: {address}
        </p>
        <p className="mt-1 font-mono text-[11px] text-zinc-500">
          Required: {REQUIRED_ADMIN_HINT}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-4xl px-3 py-6 sm:px-5 sm:py-8">
      <header className="mb-2 rounded-xl border border-amber-500/35 bg-amber-500/[0.06] p-4">
        <h1 className="text-lg font-bold text-amber-100">Admin · Collections</h1>
        <p className="mt-1 text-sm text-zinc-400">
          All marketplace collections with reference (Cardhedger/PSA) and on-platform
          floor prices. Edit cover URLs or delete collections (DB only — NFTs stay on-chain).
        </p>
        <p className="mt-2 font-mono text-[10px] text-amber-200/60">{adminWallet}</p>
      </header>

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
              adminWallet={adminWallet!}
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
