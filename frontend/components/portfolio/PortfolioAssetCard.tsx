"use client";

import type { AssetListFilter, AssetRow } from "@/lib/portfolio/portfolioTypes";
import { PortfolioListingManageButton } from "./PortfolioListingManageButton";
import { PortfolioListingPriceStrip } from "./PortfolioListingPriceStrip";
import { PortfolioSellNowButton } from "./PortfolioSellNowButton";
import {
  PortfolioCardIconButton,
  PortfolioHideIcon,
  PortfolioUnhideIcon,
} from "./PortfolioCardIconButton";

export function PortfolioAssetCard({
  row,
  assetFilter,
  address,
  valuesPending,
  isBurnAdmin,
  cancellingListingTokenId,
  burningTokenId,
  hidingTokenId,
  unhidingTokenId,
  onOpen,
  onRequestHide,
  onUnhide,
  onChangeListing,
  onCancelListing,
  onSellNow,
  onBurn,
}: {
  row: AssetRow;
  assetFilter: AssetListFilter;
  address: string | undefined;
  valuesPending: boolean;
  isBurnAdmin: boolean;
  cancellingListingTokenId: number | null;
  burningTokenId: number | null;
  hidingTokenId: number | null;
  unhidingTokenId: number | null;
  onOpen: () => void;
  onRequestHide: () => void;
  onUnhide: () => void;
  onChangeListing: () => void;
  onCancelListing: () => void;
  onSellNow: () => void;
  onBurn: () => void;
}) {
  const titleLine = row.name;
  const isListed = row.listPriceUsd != null && row.activeListingOrderHash != null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group flex min-w-0 w-full cursor-pointer flex-col rounded-lg bg-gradient-to-b from-gray-900/80 to-[#0a1018] text-left shadow-md shadow-black/20 outline-none transition-[box-shadow,background-color] duration-200 hover:bg-gray-900/90 hover:shadow-[0_14px_44px_-14px_rgba(0,0,0,0.75)] sm:rounded-xl sm:shadow-lg"
    >
      <div className="relative aspect-[3/4] w-full shrink-0 overflow-hidden rounded-t-lg bg-[#070a0f] sm:rounded-t-xl">
        {row.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.imageUrl}
            alt=""
            className="h-full w-full object-contain object-center p-2 sm:p-3"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
            <span className="font-mono text-[11px] text-gray-600">#{row.tokenId}</span>
            <span className="text-[10px] text-gray-600">No preview image</span>
          </div>
        )}
        {assetFilter === "hidden" && address ? (
          <PortfolioCardIconButton
            ariaLabel="Restore to portfolio"
            title="Unhide"
            disabled={unhidingTokenId === row.tokenId}
            className="opacity-100"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onUnhide();
            }}
          >
            {unhidingTokenId === row.tokenId ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-mint/30 border-t-mint" />
            ) : (
              <PortfolioUnhideIcon />
            )}
          </PortfolioCardIconButton>
        ) : null}
        {address && assetFilter !== "hidden" ? (
          <PortfolioCardIconButton
            ariaLabel="Hide from portfolio"
            title="Hide"
            disabled={
              hidingTokenId === row.tokenId || cancellingListingTokenId === row.tokenId
            }
            className="opacity-80 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRequestHide();
            }}
          >
            {hidingTokenId === row.tokenId ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-mint/30 border-t-mint" />
            ) : (
              <PortfolioHideIcon />
            )}
          </PortfolioCardIconButton>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-2.5 pt-2 sm:gap-3 sm:p-4 sm:pt-3">
        <p
          className="line-clamp-2 text-[11px] font-semibold leading-tight text-white sm:text-[13px]"
          title={titleLine}
        >
          {titleLine}
        </p>
        <div className="min-w-0 border-t border-gray-800/80 pt-2 sm:pt-3">
          <PortfolioListingPriceStrip
            askPriceUsd={row.listPriceUsd}
            marketPriceUsd={row.currentPrice}
            marketPending={valuesPending}
          />
        </div>
        {address && assetFilter !== "hidden" ? (
          <div className="border-t border-gray-800/80 pt-2 sm:pt-3">
            {isListed ? (
              <PortfolioListingManageButton
                busy={cancellingListingTokenId === row.tokenId}
                onChange={onChangeListing}
                onCancel={onCancelListing}
              />
            ) : (
              <PortfolioSellNowButton onClick={onSellNow} />
            )}
          </div>
        ) : null}
        {isBurnAdmin && address && assetFilter !== "hidden" ? (
          <div className="border-t border-gray-800/80 pt-2 sm:pt-3">
            <button
              type="button"
              disabled={
                burningTokenId === row.tokenId || cancellingListingTokenId === row.tokenId
              }
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onBurn();
              }}
              className="w-full rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-1.5 text-center text-[10px] font-semibold text-amber-200 transition-colors hover:border-amber-400/45 hover:bg-amber-500/18 disabled:cursor-not-allowed disabled:opacity-50 sm:rounded-lg sm:px-3 sm:py-2.5 sm:text-[12px]"
            >
              {burningTokenId === row.tokenId ? "Burning…" : "Burn (test)"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
