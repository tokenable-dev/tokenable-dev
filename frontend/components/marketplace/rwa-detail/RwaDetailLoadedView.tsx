"use client";

import { useEffect, useState } from "react";
import { useTradeAccessGate } from "@/hooks/auth/useTradeAccessGate";
import type { RwaDetailLoadedProps } from "@/hooks/rwa-detail";
import { getRwaDetailHeaderBadgeLabels } from "@/lib/marketplace/rwa-detail";
import { trackEvent } from "@/lib/analytics/googleAnalytics";
import { RwaDetailBreadcrumb } from "./RwaDetailBreadcrumb";
import { RwaDetailDesktopSidebar } from "./layout/RwaDetailDesktopSidebar";
import { RwaDetailMobileColumn } from "./layout/RwaDetailMobileColumn";
import { RwaDetailListModalHost } from "./modals/RwaDetailListModalHost";
import { RwaDetailPlaceBidModal } from "./modals/RwaDetailPlaceBidModal";
import { TradeCelebrationModal } from "@/components/marketplace/trade";
import { RWA_DETAIL_DESKTOP_GRID_CLASS, RWA_MOBILE_PAGE_CHANNEL_MAX_LG_CLASS } from "./theme";

export function RwaDetailLoadedView({
  tokenId,
  metadata,
  imageUrl,
  metaLoading,
  listing,
  listingError,
  activeAskListing,
  listingBuyPriceUsdc,
  isListingSeller,
  isOwner,
  isConnected,
  connectPending,
  market,
  headline,
  listFlow,
  buyFlow,
  platformTrades,
  navigateToCollectionAfterTrade,
  router,
  address,
}: RwaDetailLoadedProps) {
  const tradeReturnTo = `/marketplace/${tokenId}`;
  const { runTradeAccessGate } = useTradeAccessGate(tradeReturnTo);
  const [bidModalOpen, setBidModalOpen] = useState(false);

  useEffect(() => {
    const { gradeLine } = getRwaDetailHeaderBadgeLabels(metadata);
    trackEvent("asset_detail_viewed", {
      card_id: String(tokenId),
      card_name: headline.detailTitle || undefined,
      grade: gradeLine ?? undefined,
      price: listingBuyPriceUsdc ?? undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBidPurchaseFilled = () => {
    setBidModalOpen(false);
    listFlow.setTradeCelebration("purchase");
    navigateToCollectionAfterTrade();
  };

  const handleBidPlaced = () => {
    setBidModalOpen(false);
    void buyFlow.invalidateMarketplaceQueries();
    navigateToCollectionAfterTrade();
  };

  const handleConnectWallet = () => {
    runTradeAccessGate();
  };

  const handleFulfillAsk = () => {
    trackEvent("buy_now_clicked", {
      card_id: String(tokenId),
      price: listingBuyPriceUsdc ?? undefined,
    });
    runTradeAccessGate(() => void buyFlow.handleFulfillAsk());
  };

  const handleOpenPlaceBid = () => {
    runTradeAccessGate(() => {
      if (market.collectionKeyForMatch) {
        trackEvent("bid_clicked", {
          card_id: String(tokenId),
          current_price: listingBuyPriceUsdc ?? undefined,
        });
        setBidModalOpen(true);
      }
    });
  };

  const mobileStickyFooterNote =
    buyFlow.buyErr != null ? (
      <p className="text-xs leading-snug text-red-400">{buyFlow.buyErr}</p>
    ) : listingError ? (
      <p className="text-xs text-orange-400">Could not load listing.</p>
    ) : null;

  const collectionKey = market.collectionKeyForMatch;

  const handleListed = () => {
    listFlow.closeListModal();
    void buyFlow.invalidateMarketplaceQueries();
  };

  return (
    <>
      <RwaDetailBreadcrumb
        collectionHref={market.collectionHref}
        collectionLabel={market.collectionDisplayName}
        tokenLabel={headline.detailTitle || `#${tokenId}`}
      />

      <div
        className={`grid grid-cols-1 items-start gap-y-6 max-lg:flex max-lg:min-h-0 max-lg:flex-1 max-lg:flex-col max-lg:gap-y-0 max-lg:self-stretch ${RWA_DETAIL_DESKTOP_GRID_CLASS} ${RWA_MOBILE_PAGE_CHANNEL_MAX_LG_CLASS}`}
      >
        <RwaDetailMobileColumn
          metadata={metadata}
          imageUrl={imageUrl}
          tokenId={tokenId}
          collectionDisplayName={market.collectionDisplayName}
          metaLoading={metaLoading}
          detailHeadlineParts={headline.detailHeadlineParts}
          detailTitlePulse={headline.detailTitlePulse}
          footerNote={mobileStickyFooterNote}
          activeAskListing={activeAskListing}
          isOwner={isOwner}
          isConnected={isConnected}
          listingBuyPriceUsdc={listingBuyPriceUsdc}
          buyBusy={buyFlow.buyBusy}
          buyErr={buyFlow.buyErr}
          connectPending={connectPending}
          collectionHref={market.collectionHref}
          collectionKey={collectionKey}
          onFulfillAsk={handleFulfillAsk}
          onConnectWallet={handleConnectWallet}
          onOpenPlaceBid={collectionKey ? handleOpenPlaceBid : undefined}
          onOpenListModal={listFlow.openListModal}
          onViewMarket={() => {
            if (market.collectionHref) router.push(market.collectionHref);
          }}
        />

        <RwaDetailDesktopSidebar
          detailHeadlineParts={headline.detailHeadlineParts}
          detailTitle={headline.detailTitle}
          detailTitlePulse={headline.detailTitlePulse}
          metadata={metadata}
          listingError={listingError}
          activeAskListing={activeAskListing}
          isOwner={isOwner}
          isConnected={isConnected}
          listingBuyPriceUsdc={listingBuyPriceUsdc}
          buyBusy={buyFlow.buyBusy}
          buyErr={buyFlow.buyErr}
          connectPending={connectPending}
          externalRefUsd={market.externalRefUsd}
          marketChangePct={market.marketChangePct}
          marketChangePeriodLabel={market.marketChangePeriodLabel}
          marketChangeCoverageHint={market.marketChangeCoverageHint}
          tokenTrades={platformTrades.trades}
          tradesLoading={platformTrades.tradesLoading}
          tradesAvailable={platformTrades.tradesAvailable}
          onFulfillAsk={handleFulfillAsk}
          onConnectWallet={handleConnectWallet}
          onOpenPlaceBid={collectionKey ? handleOpenPlaceBid : undefined}
          collectionKey={collectionKey}
          onOpenListModal={listFlow.openListModal}
        />
      </div>

      <TradeCelebrationModal
        open={listFlow.tradeCelebration != null}
        kind={listFlow.tradeCelebration ?? "purchase"}
        onClose={() => listFlow.setTradeCelebration(null)}
      />

      <RwaDetailListModalHost
        open={listFlow.listModalOpen}
        tokenId={tokenId}
        assetTitle={headline.detailTitle}
        collectionKey={market.collectionKeyForMatch ?? undefined}
        collectionBids={market.collectionBids}
        existingAskOrder={listing && isListingSeller ? listing : undefined}
        initialPriceUsdc={listFlow.listModalInitialPrice}
        onMatchedSale={() => listFlow.setTradeCelebration("sale")}
        onClose={listFlow.closeListModal}
        onListed={handleListed}
      />

      {collectionKey ? (
        <RwaDetailPlaceBidModal
          open={bidModalOpen}
          assetTitle={headline.detailTitle}
          tokenId={tokenId}
          collectionKey={collectionKey}
          listing={activeAskListing}
          collectionBids={market.collectionBids}
          connectedAddress={address}
          onClose={() => setBidModalOpen(false)}
          onPlaced={handleBidPlaced}
          onPurchaseFilled={handleBidPurchaseFilled}
        />
      ) : null}
    </>
  );
}
