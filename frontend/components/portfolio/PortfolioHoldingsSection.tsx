"use client";

import type { AssetListFilter, AssetRow } from "@/lib/portfolio/portfolioTypes";
import { GatedSellLink } from "@/components/auth/GatedSellLink";
import { PortfolioAssetCard } from "./PortfolioAssetCard";

function filterEmptyMessage(
  assetFilter: AssetListFilter,
  assetRowsLength: number,
): string {
  if (assetFilter === "hidden") return "No hidden cards.";
  if (assetRowsLength > 0) {
    return "All holdings are hidden. Open Hidden to manage or unhide.";
  }
  return "No visible holdings.";
}

export function PortfolioHoldingsSection({
  embedded = false,
  assetsSectionLoading,
  assetRowsLength,
  assetFilter,
  setAssetFilter,
  hiddenAssetCount,
  filteredAssetRows,
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
  onChangeListing,
  onCancelListing,
  onBurn,
}: {
  /** When true, omits outer card chrome (used inside PortfolioMainSection tabs). */
  embedded?: boolean;
  assetsSectionLoading: boolean;
  assetRowsLength: number;
  assetFilter: AssetListFilter;
  setAssetFilter: (f: AssetListFilter) => void;
  hiddenAssetCount: number;
  filteredAssetRows: AssetRow[];
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
  onChangeListing: (tokenId: number) => void;
  onCancelListing: (tokenId: number, orderHash: string) => void;
  onBurn: (tokenId: number, hasListing: boolean) => void;
}) {
  const hiddenToggle =
    hiddenAssetCount > 0 ? (
      <div className="mb-2 flex justify-end">
        {assetFilter === "hidden" ? (
          <button
            type="button"
            onClick={() => setAssetFilter("all")}
            className="text-[11px] font-semibold text-zinc-400 transition-colors hover:text-white"
          >
            Show all
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setAssetFilter("hidden")}
            className="text-[11px] font-semibold text-zinc-400 transition-colors hover:text-white"
          >
            Hidden <span className="tabular-nums text-zinc-500">({hiddenAssetCount})</span>
          </button>
        )}
      </div>
    ) : null;

  const body = (
    <>
      {assetsSectionLoading ? (
        <div className="-mx-0.5 grid grid-cols-2 gap-2.5 pb-2 pt-0.5 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="w-full overflow-hidden rounded-lg border border-gray-800/80 bg-gray-900/40 sm:rounded-xl"
            >
              <div className="aspect-[3/4] animate-pulse bg-gray-800/50" />
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
          <GatedSellLink className="text-mint hover:underline">
            Mint your first card
          </GatedSellLink>
        </p>
      ) : filteredAssetRows.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          {filterEmptyMessage(assetFilter, assetRowsLength)}
        </p>
      ) : (
        <div className="-mx-0.5 grid grid-cols-2 gap-2.5 pb-2 pt-0.5 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {filteredAssetRows.map((r) => (
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
              onChangeListing={() => onChangeListing(r.tokenId)}
              onSellNow={() => onChangeListing(r.tokenId)}
              onCancelListing={() => {
                if (r.activeListingOrderHash) {
                  onCancelListing(r.tokenId, r.activeListingOrderHash);
                }
              }}
              onBurn={() => onBurn(r.tokenId, r.listPriceUsd != null)}
            />
          ))}
        </div>
      )}
    </>
  );

  if (embedded) {
    return (
      <div>
        {hiddenToggle}
        {body}
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-2xl border border-gray-800 bg-[#0b1118] p-4 sm:p-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold">My Collectibles</h2>
        {hiddenToggle}
      </div>
      {body}
    </div>
  );
}
