"use client";

import type { ReactNode } from "react";
import { RwaDetailAssetPanel } from "@/components/marketplace/rwa-detail-asset-panel";
import type { RwaDetailMetadata } from "@/lib/marketplace/rwa-detail";
import {
  RWA_MOBILE_CONTENT_SCROLL_CLASS,
  RwaDetailMobileCardHeader,
  RwaDetailStickyBuyFooter,
} from "@/components/marketplace/rwa-detail/mobile";
import { RwaDetailMobileSpecsPanel } from "@/components/marketplace/rwa-detail/mobile";
import { RwaDetailOwnerListingPanel } from "../ui/RwaDetailOwnerListingPanel";
import { RwaDetailTradesPanel } from "../ui/RwaDetailTradesPanel";
import { RwaDetailBuyerTradePanel } from "../ui/RwaDetailBuyerTradePanel";
import type { CollectionPlatformTapeFill, Order } from "@/lib/core";
import type { AssetDetailHeadlineParts } from "@/lib/marketplace/assetDetailHeadline";

export function RwaDetailMobileColumn({
  metadata,
  imageUrl,
  tokenId,
  collectionDisplayName,
  metaLoading,
  detailHeadlineParts,
  detailTitlePulse,
  externalRefUsd,
  marketChangePct,
  marketChangePeriodShort,
  marketChangePeriodLabel,
  marketChangeCoverageHint,
  showMobileMarketContext,
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
  tokenTrades,
  tradesLoading,
  tradesAvailable,
}: {
  metadata: RwaDetailMetadata | null;
  imageUrl: string | null;
  tokenId: number;
  collectionDisplayName: string;
  metaLoading: boolean;
  detailHeadlineParts: AssetDetailHeadlineParts;
  detailTitlePulse: boolean;
  externalRefUsd: number | null;
  marketChangePct: number | null;
  marketChangePeriodShort: string;
  marketChangePeriodLabel: string;
  marketChangeCoverageHint: string;
  showMobileMarketContext: boolean;
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
  tokenTrades: CollectionPlatformTapeFill[];
  tradesLoading: boolean;
  tradesAvailable: boolean;
}) {
  const showBuyerFooter =
    !isOwner && (Boolean(collectionKey) || activeAskListing != null);

  return (
    <div className="relative flex w-full min-w-0 flex-col gap-0 max-lg:items-center lg:col-start-1 lg:items-start lg:justify-start">
      <div className={`w-full ${RWA_MOBILE_CONTENT_SCROLL_CLASS}`}>
        <RwaDetailAssetPanel
          metadata={metadata}
          imageUrl={imageUrl}
          tokenId={tokenId}
          collectionLabel={collectionDisplayName}
          metaLoading={metaLoading}
          openSeaMobile
        />
        <RwaDetailMobileCardHeader
          headlineParts={detailHeadlineParts}
          titleLoading={detailTitlePulse}
          metadata={metadata}
        />
        <RwaDetailMobileSpecsPanel
          metadata={metadata}
          loading={metaLoading}
          externalRefUsd={externalRefUsd}
          marketChangePct={marketChangePct}
          marketChangePeriodShort={marketChangePeriodShort}
          marketChangePeriodLabel={marketChangePeriodLabel}
          marketChangeCoverageHint={marketChangeCoverageHint}
          showMarketContext={showMobileMarketContext}
        />
        {isOwner ? (
          <div className="mx-auto w-full max-w-[32rem] px-5 pb-4 lg:hidden">
            <RwaDetailOwnerListingPanel
              isConnected={isConnected}
              connectPending={connectPending}
              listingPriceUsd={listingBuyPriceUsdc}
              marketPriceUsd={externalRefUsd}
              marketChangePct={marketChangePct}
              marketChangePeriodLabel={marketChangePeriodLabel}
              marketChangeCoverageHint={marketChangeCoverageHint}
              onOpenListModal={onOpenListModal}
            />
          </div>
        ) : null}
        <div className="mx-auto w-full max-w-[32rem] border-t border-[rgba(38,39,45,1)] px-5 pb-4 pt-5 lg:hidden">
          <RwaDetailTradesPanel
            trades={tokenTrades}
            loading={tradesLoading}
            tradesAvailable={tradesAvailable}
          />
        </div>
      </div>

      <RwaDetailStickyBuyFooter footerNote={footerNote}>
        {showBuyerFooter ? (
          <RwaDetailBuyerTradePanel
            collectionKey={collectionKey}
            activeAskListing={activeAskListing}
            listingPriceUsd={listingBuyPriceUsdc}
            marketPriceUsd={externalRefUsd}
            buyBusy={buyBusy}
            buyErr={buyErr}
            isConnected={isConnected}
            connectPending={connectPending}
            onConnectWallet={onConnectWallet}
            onFulfillAsk={onFulfillAsk}
            onOpenPlaceBid={onOpenPlaceBid}
            compactActions
          />
        ) : !isOwner && collectionHref ? (
          <button
            type="button"
            onClick={onViewMarket}
            className="w-full min-h-[52px] rounded-lg border border-zinc-700 bg-zinc-950 px-4 text-[17px] font-semibold text-white"
          >
            View market
          </button>
        ) : null}
      </RwaDetailStickyBuyFooter>
    </div>
  );
}
