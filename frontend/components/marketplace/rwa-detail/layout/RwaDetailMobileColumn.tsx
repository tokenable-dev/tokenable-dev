"use client";

import type { ReactNode } from "react";
import { RwaDetailAssetPanel } from "@/components/marketplace/rwa-detail-asset-panel";
import type { RwaDetailMetadata } from "@/lib/marketplace/rwa-detail";
import {
  RwaDetailMobileSlabCaption,
  RwaDetailStickyBuyButton,
  RwaDetailStickyBuyFooter,
} from "@/components/marketplace/rwa-detail/mobile";
import { RwaDetailBuyerTradePanel } from "../ui/RwaDetailBuyerTradePanel";
import { RwaDetailOwnerListingPanel } from "../ui/RwaDetailOwnerListingPanel";
import type { Order } from "@/lib/core";
import type { AssetDetailHeadlineParts } from "@/lib/marketplace/assetDetailHeadline";
import {
  RWA_DETAIL_MOBILE_SLAB_TOP_INSET_CLASS,
  RWA_MOBILE_SLAB_STACK_CLASS,
  RWA_MOBILE_STICKY_FOOTER_RESERVE_CLASS,
} from "@/components/marketplace/rwa-detail/theme";

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
  const showBuyerFooter =
    !isOwner && (Boolean(collectionKey) || activeAskListing != null);

  const showOwnerCta = isOwner;
  const showViewMarket =
    !isOwner && !showBuyerFooter && collectionHref != null;

  return (
    <div
      className={`relative flex w-full min-w-0 flex-col max-lg:min-h-0 max-lg:flex-1 ${RWA_MOBILE_STICKY_FOOTER_RESERVE_CLASS} lg:col-start-1 lg:items-start lg:justify-start`}
    >
      <div
        className={`flex min-h-0 w-full flex-1 flex-col items-center py-2 max-lg:overflow-y-auto max-lg:overscroll-y-contain lg:items-start lg:justify-start lg:px-0 ${RWA_DETAIL_MOBILE_SLAB_TOP_INSET_CLASS}`}
      >
        <div className={RWA_MOBILE_SLAB_STACK_CLASS}>
          <RwaDetailAssetPanel
            metadata={metadata}
            imageUrl={imageUrl}
            tokenId={tokenId}
            collectionLabel={collectionDisplayName}
            metaLoading={metaLoading}
            openSeaMobile
            mobileSlabCaptionSlot={
              <RwaDetailMobileSlabCaption
                headlineParts={detailHeadlineParts}
                titleLoading={detailTitlePulse}
                metadata={metadata}
              />
            }
          />
        </div>
      </div>

      <RwaDetailStickyBuyFooter footerNote={footerNote}>
        {showOwnerCta ? (
          <RwaDetailOwnerListingPanel
            isConnected={isConnected}
            connectPending={connectPending}
            listingPriceUsd={listingBuyPriceUsdc}
            marketPriceUsd={null}
            marketChangePct={null}
            marketChangePeriodLabel=""
            marketChangeCoverageHint=""
            onOpenListModal={onOpenListModal}
            onConnectWallet={onConnectWallet}
            compactActions
          />
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
