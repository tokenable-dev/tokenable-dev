"use client";

import { useMemo, type ReactNode } from "react";
import {
  RwaDetailHeaderBadges,
} from "@/components/marketplace/rwa-detail-asset-panel";
import {
  buildRwaDetailMobileTrustView,
  type RwaDetailMetadata,
} from "@/lib/marketplace/rwa-detail";
import {
  assetDetailHeadlineHasContent,
  formatAssetDetailHeadlineText,
  type AssetDetailHeadlineParts,
} from "@/lib/marketplace/assetDetailHeadline";
import type { CollectionPlatformTapeFill, Order } from "@/lib/core";
import {
  RWA_DETAIL_DESKTOP_SIDEBAR_CERT_CLASS,
  RWA_DETAIL_DESKTOP_SIDEBAR_TITLE_CLASS,
  RWA_DETAIL_DESKTOP_SIDEBAR_TOP_INSET_CLASS,
  rwaDetailRightFont,
} from "../theme";
import { RwaDetailBuyerTradePanel } from "../ui/RwaDetailBuyerTradePanel";
import { RwaDetailMarketContextStrip } from "../ui/RwaDetailMarketContextStrip";
import { RwaDetailOwnerListingPanel } from "../ui/RwaDetailOwnerListingPanel";
import { RwaDetailTradesPanel } from "../ui/RwaDetailTradesPanel";

export function RwaDetailDesktopSidebar({
  detailHeadlineParts,
  detailTitle,
  detailTitlePulse,
  metadata,
  listingError,
  activeAskListing,
  isOwner,
  isConnected,
  listingBuyPriceUsdc,
  buyBusy,
  buyErr,
  connectPending,
  externalRefUsd,
  marketChangePct,
  marketChangePeriodLabel,
  marketChangeCoverageHint,
  tokenTrades,
  tradesLoading,
  tradesAvailable,
  onFulfillAsk,
  onConnectWallet,
  onOpenPlaceBid,
  collectionKey,
  onOpenListModal,
}: {
  detailHeadlineParts: AssetDetailHeadlineParts;
  detailTitle: string;
  detailTitlePulse: boolean;
  metadata: RwaDetailMetadata | null;
  listingError: boolean;
  activeAskListing: Order | null;
  isOwner: boolean;
  isConnected: boolean;
  listingBuyPriceUsdc: number | null;
  buyBusy: boolean;
  buyErr: string | null;
  connectPending: boolean;
  externalRefUsd: number | null;
  marketChangePct: number | null;
  marketChangePeriodLabel: string;
  marketChangeCoverageHint: string;
  tokenTrades: CollectionPlatformTapeFill[];
  tradesLoading: boolean;
  tradesAvailable: boolean;
  onFulfillAsk: () => void;
  onConnectWallet: () => void;
  onOpenPlaceBid?: () => void;
  collectionKey: string | null;
  onOpenListModal: (initialPriceUsdc?: string | null) => void;
}) {
  const showBuyerActions = !isOwner && (collectionKey || activeAskListing);
  const certNumber = useMemo(() => {
    const trust = buildRwaDetailMobileTrustView(metadata);
    return trust.certNumber?.trim() ?? "";
  }, [metadata]);
  const titleText = useMemo(() => {
    if (assetDetailHeadlineHasContent(detailHeadlineParts)) {
      return formatAssetDetailHeadlineText(detailHeadlineParts);
    }
    return detailTitle;
  }, [detailHeadlineParts, detailTitle]);
  const titleTooltip = certNumber ? `${titleText} ${certNumber}` : titleText;

  return (
    <div
      className={`hidden w-full min-w-0 flex-col gap-5 lg:sticky lg:top-6 lg:col-start-2 lg:flex lg:max-w-[400px] lg:justify-self-start lg:self-start ${RWA_DETAIL_DESKTOP_SIDEBAR_TOP_INSET_CLASS}`}
    >
      <div className="hidden min-w-0 space-y-2.5 lg:block">
        {detailTitlePulse ? (
          <div
            className="h-7 w-[min(100%,20rem)] max-w-full animate-pulse rounded bg-gray-800/85"
            aria-hidden
          />
        ) : (
          <h1
            className={`${rwaDetailRightFont.className} ${RWA_DETAIL_DESKTOP_SIDEBAR_TITLE_CLASS}`}
            title={titleTooltip}
          >
            {titleText}
            {certNumber ? (
              <>
                {" "}
                <span className={RWA_DETAIL_DESKTOP_SIDEBAR_CERT_CLASS}>
                  {certNumber}
                </span>
              </>
            ) : null}
          </h1>
        )}
        <RwaDetailHeaderBadges metadata={metadata} loading={detailTitlePulse} />
      </div>

      {listingError ? (
        <p className="hidden text-xs text-orange-400 lg:block">Could not load listing.</p>
      ) : null}

      {showBuyerActions ? (
        <div className="hidden lg:block">
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
            marketChangePct={marketChangePct}
            marketChangePeriodLabel={marketChangePeriodLabel}
            marketChangeCoverageHint={marketChangeCoverageHint}
            showMarketContextWhenUnlisted={!activeAskListing}
          />
        </div>
      ) : !isOwner && !activeAskListing ? (
        <div className="hidden space-y-5 sm:space-y-6 lg:block">
          <p className={`${rwaDetailRightFont.className} text-xl font-semibold text-zinc-400`}>
            Not for sale
          </p>
          <RwaDetailMarketContextStrip
            externalRefUsd={externalRefUsd}
            marketChangePct={marketChangePct}
            changePeriodLabel={marketChangePeriodLabel}
            changeCoverageHint={marketChangeCoverageHint}
          />
        </div>
      ) : null}

      {isOwner ? (
        <div
          className={`hidden w-full max-w-full lg:block ${
            listingBuyPriceUsdc == null ? "lg:mt-4" : ""
          }`}
        >
          <RwaDetailOwnerListingPanel
            isConnected={isConnected}
            connectPending={connectPending}
            listingPriceUsd={listingBuyPriceUsdc}
            marketPriceUsd={externalRefUsd}
            marketChangePct={marketChangePct}
            marketChangePeriodLabel={marketChangePeriodLabel}
            marketChangeCoverageHint={marketChangeCoverageHint}
            onOpenListModal={onOpenListModal}
            onConnectWallet={onConnectWallet}
          />
        </div>
      ) : null}

      <div className="hidden border-t border-[rgba(38,39,45,1)] pt-6 lg:block">
        <RwaDetailTradesPanel
          trades={tokenTrades}
          loading={tradesLoading}
          tradesAvailable={tradesAvailable}
        />
      </div>
    </div>
  );
}
