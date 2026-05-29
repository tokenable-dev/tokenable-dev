"use client";

import Link from "next/link";
import type { RefObject } from "react";
import type { AssetListFilter, AssetRow } from "@/lib/portfolio/portfolioTypes";
import { PortfolioAssetCard } from "./PortfolioAssetCard";

function filterEmptyMessage(
  assetFilter: AssetListFilter,
  assetRowsLength: number,
): string {
  if (assetFilter === "hidden") return "No hidden cards.";
  if (assetFilter === "listed") return "No cards are currently listed for sale.";
  if (assetFilter === "unlisted") {
    return "All visible cards are currently listed. Cancel a listing to move back to not listed.";
  }
  if (assetRowsLength > 0) {
    return "All holdings are hidden. Open Hidden to manage or unhide.";
  }
  return "No visible holdings.";
}

export function PortfolioHoldingsSection({
  assetsSectionLoading,
  assetRowsLength,
  assetFilter,
  setAssetFilter,
  holdingsCount,
  listedAssetCount,
  unlistedAssetCount,
  hiddenAssetCount,
  filteredAssetRows,
  pagedAssetRows,
  visibleAssetCount,
  assetScrollSentinelRef,
  address,
  valuesPending,
  isBurnAdmin,
  cancellingListingTokenId,
  burningTokenId,
  hidingTokenId,
  unhidingTokenId,
  onOpenToken,
  onRequestHide,
  onUnhide,
  onCancelListing,
  onBurn,
}: {
  assetsSectionLoading: boolean;
  assetRowsLength: number;
  assetFilter: AssetListFilter;
  setAssetFilter: (f: AssetListFilter) => void;
  holdingsCount: number;
  listedAssetCount: number;
  unlistedAssetCount: number;
  hiddenAssetCount: number;
  filteredAssetRows: AssetRow[];
  pagedAssetRows: AssetRow[];
  visibleAssetCount: number;
  assetScrollSentinelRef: RefObject<HTMLDivElement | null>;
  address: string | undefined;
  valuesPending: boolean;
  isBurnAdmin: boolean;
  cancellingListingTokenId: number | null;
  burningTokenId: number | null;
  hidingTokenId: number | null;
  unhidingTokenId: number | null;
  onOpenToken: (tokenId: number) => void;
  onRequestHide: (row: AssetRow) => void;
  onUnhide: (tokenId: number) => void;
  onCancelListing: (tokenId: number, orderHash: string) => void;
  onBurn: (tokenId: number, hasListing: boolean) => void;
}) {
  return (
    <div className="mb-6 rounded-2xl border border-gray-800 bg-[#0b1118] p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold">My Collectibles</h2>
        </div>
        <div className="inline-flex rounded-full border border-gray-700/80 bg-gray-900/70 p-1 text-[11px]">
          <button
            type="button"
            onClick={() => setAssetFilter("all")}
            className={`rounded-full px-3 py-1 font-semibold transition-colors ${
              assetFilter === "all" ? "bg-mint text-[#061018]" : "text-gray-400 hover:text-white"
            }`}
          >
            All <span className="tabular-nums">({holdingsCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setAssetFilter("listed")}
            className={`rounded-full px-3 py-1 font-semibold transition-colors ${
              assetFilter === "listed"
                ? "bg-mint text-mint-ink"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Listed <span className="tabular-nums">({listedAssetCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setAssetFilter("unlisted")}
            className={`rounded-full px-3 py-1 font-semibold transition-colors ${
              assetFilter === "unlisted"
                ? "bg-zinc-500/90 text-[#061018]"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Not listed <span className="tabular-nums">({unlistedAssetCount})</span>
          </button>
          {hiddenAssetCount > 0 ? (
            <button
              type="button"
              onClick={() => setAssetFilter("hidden")}
              className={`rounded-full px-3 py-1 font-semibold transition-colors ${
                assetFilter === "hidden"
                  ? "bg-zinc-600/90 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Hidden <span className="tabular-nums">({hiddenAssetCount})</span>
            </button>
          ) : null}
        </div>
      </div>
      {assetsSectionLoading ? (
        <div className="-mx-0.5 grid grid-cols-2 gap-2.5 pb-2 pt-0.5 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="w-full overflow-hidden rounded-lg border border-gray-800/80 bg-gray-900/40 sm:rounded-xl"
            >
              <div className="aspect-[5/6] animate-pulse bg-gray-800/50 sm:aspect-[3/4]" />
              <div className="space-y-2 p-2.5 sm:p-4">
                <div className="h-4 w-2/3 animate-pulse rounded bg-gray-800/60" />
                <div className="h-3 w-full animate-pulse rounded bg-gray-800/40" />
              </div>
            </div>
          ))}
        </div>
      ) : assetRowsLength === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          No assets yet.{" "}
          <Link href="/vault" className="text-mint hover:underline">
            Mint your first card
          </Link>
        </p>
      ) : filteredAssetRows.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          {filterEmptyMessage(assetFilter, assetRowsLength)}
        </p>
      ) : (
        <div
          className={
            filteredAssetRows.length > 4
              ? "max-h-[min(70vh,560px)] overflow-y-auto pr-0.5 sm:max-h-[560px]"
              : "overflow-visible"
          }
        >
          <div className="-mx-0.5 grid grid-cols-2 gap-2.5 pb-2 pt-0.5 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {pagedAssetRows.map((r) => (
              <PortfolioAssetCard
                key={r.tokenId}
                row={r}
                assetFilter={assetFilter}
                address={address}
                valuesPending={valuesPending}
                isBurnAdmin={isBurnAdmin}
                cancellingListingTokenId={cancellingListingTokenId}
                burningTokenId={burningTokenId}
                hidingTokenId={hidingTokenId}
                unhidingTokenId={unhidingTokenId}
                onOpen={() => onOpenToken(r.tokenId)}
                onRequestHide={() => onRequestHide(r)}
                onUnhide={() => onUnhide(r.tokenId)}
                onCancelListing={() => {
                  if (r.activeListingOrderHash) {
                    onCancelListing(r.tokenId, r.activeListingOrderHash);
                  }
                }}
                onBurn={() => onBurn(r.tokenId, r.listPriceUsd != null)}
              />
            ))}
            {visibleAssetCount < filteredAssetRows.length ? (
              <div
                ref={assetScrollSentinelRef}
                className="col-span-full h-px w-full"
                aria-hidden
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
