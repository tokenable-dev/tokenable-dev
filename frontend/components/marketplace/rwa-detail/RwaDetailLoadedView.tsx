"use client";

import type { RwaDetailLoadedProps } from "@/hooks/rwa-detail";
import { RwaDetailDesktopSidebar } from "./layout/RwaDetailDesktopSidebar";
import { RwaDetailMobileColumn } from "./layout/RwaDetailMobileColumn";
import { RwaDetailListModalHost } from "./modals/RwaDetailListModalHost";
import { TradeCelebrationModal } from "@/components/marketplace/trade";

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
  showMobileMarketContext,
  navigateToCollectionAfterTrade,
  router,
}: RwaDetailLoadedProps) {
  const mobileStickyFooterNote =
    buyFlow.buyErr != null ? (
      <p className="text-xs leading-snug text-red-400">{buyFlow.buyErr}</p>
    ) : listingError ? (
      <p className="text-xs text-orange-400">Could not load listing.</p>
    ) : null;

  return (
    <>
      <div className="grid grid-cols-1 items-start gap-y-6 max-lg:items-center max-lg:gap-y-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.62fr)] lg:items-start lg:gap-x-10 xl:gap-x-12">
        <RwaDetailMobileColumn
          metadata={metadata}
          imageUrl={imageUrl}
          tokenId={tokenId}
          collectionDisplayName={market.collectionDisplayName}
          metaLoading={metaLoading}
          detailHeadlineParts={headline.detailHeadlineParts}
          detailTitlePulse={headline.detailTitlePulse}
          externalRefUsd={market.externalRefUsd}
          marketChangePct={market.marketChangePct}
          marketChangePeriodShort={market.marketChangePeriodShort}
          marketChangePeriodLabel={market.marketChangePeriodLabel}
          marketChangeCoverageHint={market.marketChangeCoverageHint}
          showMobileMarketContext={showMobileMarketContext}
          footerNote={mobileStickyFooterNote}
          activeAskListing={activeAskListing}
          isOwner={isOwner}
          isConnected={isConnected}
          listing={listing}
          listingBuyPriceUsdc={listingBuyPriceUsdc}
          buyBusy={buyFlow.buyBusy}
          connectPending={connectPending}
          collectionHref={market.collectionHref}
          onFulfillAsk={() => void buyFlow.handleFulfillAsk()}
          onOpenListModal={() => listFlow.openListModal(null)}
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
          listing={listing}
          listingBuyPriceUsdc={listingBuyPriceUsdc}
          buyBusy={buyFlow.buyBusy}
          buyErr={buyFlow.buyErr}
          connectPending={connectPending}
          externalRefUsd={market.externalRefUsd}
          marketChangePct={market.marketChangePct}
          marketChangePeriodLabel={market.marketChangePeriodLabel}
          marketChangeCoverageHint={market.marketChangeCoverageHint}
          rwaDetailStatRows={headline.rwaDetailStatRows}
          onFulfillAsk={() => void buyFlow.handleFulfillAsk()}
          onOpenListModal={() => listFlow.openListModal(null)}
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
        onListed={() => {
          listFlow.closeListModal();
          void buyFlow.invalidateMarketplaceQueries();
          navigateToCollectionAfterTrade();
        }}
      />
    </>
  );
}
