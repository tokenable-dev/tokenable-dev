"use client";

import { useConnect } from "wagmi";
import { useShallow } from "zustand/react/shallow";
import type { Address } from "viem";
import { useMarketplaceAdminCards } from "@/hooks/marketplace-admin/useMarketplaceAdminCards";
import { connectMetaMaskWallet } from "@/lib/wallet/connectMetaMaskWallet";
import { isMarketplaceAdminWallet, marketplaceAdminWallets } from "@/lib/marketplace";
import { useAppStore, selectWallet } from "@/store";
import { MarketplaceAdminCardRow } from "./MarketplaceAdminCardRow";

const REQUIRED_ADMIN_HINT = marketplaceAdminWallets()[0] ?? "";

export function MarketplaceAdminCardsPage() {
  const { address, isConnected } = useAppStore(useShallow(selectWallet));
  const { connect, connectors, isPending: connectPending } = useConnect();
  const isAdmin = isMarketplaceAdminWallet(address);
  const adminWallet = isAdmin && address ? (address as Address) : undefined;

  const { query, updateMutation, previewMetadataImage } =
    useMarketplaceAdminCards(adminWallet);

  if (!isConnected || !address) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-white">Card admin</h1>
        <p className="mt-3 text-sm text-zinc-400">
          Connect the marketplace admin wallet to manage listed RWA cards.
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

  const items = query.data?.items ?? [];

  return (
    <div className="mx-auto min-h-screen w-full max-w-4xl px-3 py-6 sm:px-5 sm:py-8">
      <header className="mb-6 rounded-xl border border-amber-500/35 bg-amber-500/[0.06] p-4">
        <h1 className="text-lg font-bold text-amber-100">Admin · Listed cards</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Active ask listings — edit display image, name, and collection bucket per
          token. Image overrides apply immediately on RWA detail and listing cards.
        </p>
        <p className="mt-2 font-mono text-[10px] text-amber-200/60">
          {adminWallet}
        </p>
      </header>

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
              adminWallet={adminWallet!}
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
