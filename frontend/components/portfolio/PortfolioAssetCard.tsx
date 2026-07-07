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
  cancellingListingTokenId,
  hidingTokenId,
  unhidingTokenId,
  onOpen,
  onRequestHide,
  onUnhide,
  onChangeListing,
  onCancelListing,
  onSellNow,
}: {
  row: AssetRow;
  assetFilter: AssetListFilter;
  address: string | undefined;
  valuesPending: boolean;
  cancellingListingTokenId: number | null;
  hidingTokenId: number | null;
  unhidingTokenId: number | null;
  onOpen: () => void;
  onRequestHide: () => void;
  onUnhide: () => void;
  onChangeListing: () => void;
  onCancelListing: () => void;
  onSellNow: () => void;
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
      className="pf-asset-card group flex min-w-0 w-full cursor-pointer flex-col text-left outline-none"
    >
      <div className="pf-asset-card__image-wrap relative w-full shrink-0 overflow-hidden">
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
      <div className="pf-asset-card__body flex min-w-0 flex-1 flex-col">
        <p
          className="pf-asset-card__title line-clamp-2"
          title={titleLine}
        >
          {titleLine}
        </p>
        <div className="min-w-0 border-t border-white/8 pt-2">
          <PortfolioListingPriceStrip
            askPriceUsd={row.listPriceUsd}
            marketPriceUsd={row.currentPrice}
            marketPending={valuesPending}
          />
        </div>
        {address && assetFilter !== "hidden" ? (
          <div className="pf-asset-card__actions border-t border-white/8 pt-2">
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
      </div>
    </div>
  );
}
