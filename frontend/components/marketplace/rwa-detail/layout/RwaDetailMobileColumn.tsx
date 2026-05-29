"use client";

import type { ReactNode } from "react";
import { useConnect } from "wagmi";
import { connectMetaMaskWallet } from "@/lib/wallet/connectMetaMaskWallet";
import { RwaDetailAssetPanel } from "@/components/marketplace/rwa-detail-asset-panel";
import type { RwaDetailMetadata } from "@/lib/marketplace/rwa-detail";
import {
  RWA_MOBILE_CONTENT_SCROLL_CLASS,
  RwaDetailMobileCardHeader,
  RwaDetailStickyBuyButton,
  RwaDetailStickyBuyFooter,
} from "@/components/marketplace/rwa-detail/mobile";
import { RwaDetailMobileSpecsPanel } from "@/components/marketplace/rwa-detail/mobile";
import type { AssetDetailHeadlineParts } from "@/lib/marketplace/assetDetailHeadline";
import type { Order } from "@/lib/core";

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
  listing,
  listingBuyPriceUsdc,
  buyBusy,
  connectPending,
  collectionHref,
  onFulfillAsk,
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
  listing: Order | null | undefined;
  listingBuyPriceUsdc: number | null;
  buyBusy: boolean;
  connectPending: boolean;
  collectionHref: string | null;
  onFulfillAsk: () => void;
  onOpenListModal: () => void;
  onViewMarket: () => void;
}) {
  const { connect, connectors } = useConnect();

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
      </div>

      <RwaDetailStickyBuyFooter footerNote={footerNote}>
        {activeAskListing && !isOwner ? (
          <RwaDetailStickyBuyButton
            emphasis="primary"
            priceUsd={listingBuyPriceUsdc}
            disabled={buyBusy || connectPending}
            onClick={() => {
              if (!isConnected) {
                connectMetaMaskWallet(connect, connectors);
                return;
              }
              onFulfillAsk();
            }}
          >
            {!isConnected
              ? connectPending
                ? "Connecting…"
                : "Connect wallet"
              : buyBusy
                ? "Buying…"
                : "Buy now"}
          </RwaDetailStickyBuyButton>
        ) : isOwner ? (
          <RwaDetailStickyBuyButton
            priceUsd={
              listing && listingBuyPriceUsdc != null ? listingBuyPriceUsdc : null
            }
            priceCaption="Listed at"
            disabled={connectPending}
            onClick={() => {
              if (!isConnected) {
                connectMetaMaskWallet(connect, connectors);
                return;
              }
              onOpenListModal();
            }}
          >
            {!isConnected
              ? connectPending
                ? "Connecting…"
                : "Connect wallet"
              : listing
                ? "Manage listing"
                : "List for sale"}
          </RwaDetailStickyBuyButton>
        ) : (
          <RwaDetailStickyBuyButton
            disabled={!collectionHref}
            onClick={onViewMarket}
          >
            View market
          </RwaDetailStickyBuyButton>
        )}
      </RwaDetailStickyBuyFooter>
    </div>
  );
}
