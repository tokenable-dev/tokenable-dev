"use client";

import { useState } from "react";
import { useConnect } from "wagmi";
import { connectMetaMaskWallet } from "@/lib/wallet/connectMetaMaskWallet";
import type { RwaDetailLoadedProps } from "@/hooks/rwa-detail";
import { RwaDetailDesktopSidebar } from "./layout/RwaDetailDesktopSidebar";
import { RwaDetailMobileColumn } from "./layout/RwaDetailMobileColumn";
import { RwaDetailListModalHost } from "./modals/RwaDetailListModalHost";
import { RwaDetailPlaceBidModal } from "./modals/RwaDetailPlaceBidModal";
import { TradeCelebrationModal } from "@/components/marketplace/trade";
import { RWA_MOBILE_PAGE_CHANNEL_MAX_LG_CLASS } from "./theme";

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
  const { connect, connectors } = useConnect();
  const [bidModalOpen, setBidModalOpen] = useState(false);

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
    connectMetaMaskWallet(connect, connectors);
  };

  const handleOpenPlaceBid = () => {
    if (!isConnected) {
      handleConnectWallet();
      return;
    }
    if (market.collectionKeyForMatch) {
      setBidModalOpen(true);
    }
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
      <div
        className={`grid grid-cols-1 items-start gap-y-6 max-lg:flex max-lg:min-h-0 max-lg:flex-1 max-lg:flex-col max-lg:gap-y-0 max-lg:self-stretch lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.62fr)] lg:items-start lg:gap-x-6 xl:gap-x-8 ${RWA_MOBILE_PAGE_CHANNEL_MAX_LG_CLASS}`}
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
          onFulfillAsk={() => void buyFlow.handleFulfillAsk()}
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
          onFulfillAsk={() => void buyFlow.handleFulfillAsk()}
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
          collectionKey={collectionKey}
          collectionAsks={market.collectionAsks}
          connectedAddress={address}
          hasActiveListing={activeAskListing != null}
          onClose={() => setBidModalOpen(false)}
          onPlaced={handleBidPlaced}
          onPurchaseFilled={handleBidPurchaseFilled}
        />
      ) : null}
    </>
  );
}
