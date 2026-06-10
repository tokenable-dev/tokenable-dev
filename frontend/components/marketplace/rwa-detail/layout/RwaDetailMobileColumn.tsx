"use client";

import type { ReactNode } from "react";
import { RwaDetailAssetPanel } from "@/components/marketplace/rwa-detail-asset-panel";
import type { RwaDetailMetadata } from "@/lib/marketplace/rwa-detail";
import {
  RwaDetailMobileCardHeader,
  RwaDetailStickyBuyButton,
  RwaDetailStickyBuyFooter,
} from "@/components/marketplace/rwa-detail/mobile";
import { RwaDetailBuyerTradePanel } from "../ui/RwaDetailBuyerTradePanel";
import type { Order } from "@/lib/core";
import type { AssetDetailHeadlineParts } from "@/lib/marketplace/assetDetailHeadline";

export function RwaDetailMobileColumn({
  metadata,
  imageUrl,
  tokenId,
  collectionDisplayName,
  metaLoading,
  detailHeadlineParts,
  detailTitlePulse,
  footerNote,
  activeAskListing,
  isOwner,
  isConnected,
  listingBuyPriceUsdc,
  buyBusy,
  buyErr,
  connectPending,
  collectionHref,
  collectionKey,
  onFulfillAsk,
  onConnectWallet,
  onOpenPlaceBid,
  onOpenListModal,
  onViewMarket,
}: {
  metadata: RwaDetailMetadata | null;
  imageUrl: string | null;
  tokenId: number;
  collectionDisplayName: string;
  metaLoading: boolean;
  detailHeadlineParts: AssetDetailHeadlineParts;
  detailTitlePulse: boolean;
  footerNote: ReactNode;
  activeAskListing: Order | null;
  isOwner: boolean;
  isConnected: boolean;
  listingBuyPriceUsdc: number | null;
  buyBusy: boolean;
  buyErr: string | null;
  connectPending: boolean;
  collectionHref: string | null;
  collectionKey: string | null;
  onFulfillAsk: () => void;
  onConnectWallet: () => void;
  onOpenPlaceBid?: () => void;
  onOpenListModal: (initialPriceUsdc?: string | null) => void;
  onViewMarket: () => void;
}) {
  const hasListing = activeAskListing != null && listingBuyPriceUsdc != null;
  const showBuyerFooter =
    !isOwner && (Boolean(collectionKey) || activeAskListing != null);

  const ownerLabel = !isConnected
    ? connectPending
      ? "Connecting…"
      : "Connect wallet"
    : hasListing
      ? "Change price"
      : "List for sale";

  const showOwnerCta = isOwner;
  const showViewMarket =
    !isOwner && !showBuyerFooter && collectionHref != null;

  return (
    <div className="relative flex w-full min-w-0 flex-col max-lg:min-h-0 max-lg:flex-1 lg:col-start-1 lg:items-start lg:justify-start">
      <div className="flex min-h-0 w-full flex-1 flex-col items-center max-lg:overflow-hidden">
        <RwaDetailMobileCardHeader
          headlineParts={detailHeadlineParts}
          titleLoading={detailTitlePulse}
          metadata={metadata}
        />
        <div className="flex w-full min-h-0 flex-1 flex-col items-center justify-center px-3 pb-2">
          <RwaDetailAssetPanel
            metadata={metadata}
            imageUrl={imageUrl}
            tokenId={tokenId}
            collectionLabel={collectionDisplayName}
            metaLoading={metaLoading}
            openSeaMobile
          />
        </div>
      </div>

      <RwaDetailStickyBuyFooter footerNote={footerNote}>
        {showOwnerCta ? (
          <RwaDetailStickyBuyButton
            emphasis={!isConnected ? "primary" : "default"}
            disabled={connectPending}
            onClick={() => {
              if (!isConnected) {
                onConnectWallet();
                return;
              }
              onOpenListModal(
                hasListing && listingBuyPriceUsdc != null
                  ? String(listingBuyPriceUsdc)
                  : null,
              );
            }}
          >
            {ownerLabel}
          </RwaDetailStickyBuyButton>
        ) : showBuyerFooter ? (
          <RwaDetailBuyerTradePanel
            collectionKey={collectionKey}
            activeAskListing={activeAskListing}
            listingPriceUsd={listingBuyPriceUsdc}
            marketPriceUsd={null}
            buyBusy={buyBusy}
            buyErr={buyErr}
            isConnected={isConnected}
            connectPending={connectPending}
            onConnectWallet={onConnectWallet}
            onFulfillAsk={onFulfillAsk}
            onOpenPlaceBid={onOpenPlaceBid}
            compactActions
          />
        ) : showViewMarket ? (
          <RwaDetailStickyBuyButton onClick={onViewMarket}>View market</RwaDetailStickyBuyButton>
        ) : null}
      </RwaDetailStickyBuyFooter>
    </div>
  );
}
