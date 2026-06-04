"use client";

import type { Address } from "viem";
import { pickCollectionHeroImageUrl } from "@/lib/marketplace";
import { CollectionAdminCoverPanel } from "@/components/marketplace/collection-hero";
import { COLLECTION_DETAIL_SHELL_CLASS } from "@/constants/layout";
import { COLLECTION_MARKETS_CHART_TAB_HEIGHT_CLASS } from "@/components/marketplace/collectionOverviewChrome";
import { CollectionOverviewBoard } from "@/components/marketplace/collection-overview";
import { CollectionDetailsKvCard, CollectionHeroDetailsTabs } from "@/components/marketplace/collection-hero";
import {
  CollectionMobileCurrentPriceRow,
  CollectionMobileMarketTabs,
} from "@/components/marketplace/collection-mobile";
import { CollectionTradingTabs } from "@/components/marketplace/collection-trading";
import { CollectionOwnedRwaListModal } from "@/components/marketplace/collection-listings";
import { TradeCelebrationModal } from "@/components/marketplace/trade";
import type { CollectionDetailLoadedProps } from "@/hooks/collection-detail";
import { AiInsightComingSoonModal } from "./AiInsightComingSoonModal";
import { CollectionDetailListingsGrid } from "./CollectionDetailListingsGrid";
import { CollectionDetailMobileNav } from "./CollectionDetailMobileNav";
import {
  buildCollectionDetailMarketsSlots,
  buildCollectionDetailMobilePanels,
} from "./buildCollectionDetailMarketsSlots";

export function CollectionDetailLoadedView(detail: CollectionDetailLoadedProps) {
  const {
    collectionKey,
    router,
    address,
    data,
    headline,
    market,
    asks,
    collectionBids,
    listings,
    invalidateCollection,
    listingTokenIdsForAdmin,
    isCoverAdmin,
    presetPriceFromBook,
    listPricePresetUsdc,
    preferredBidOrderHash,
    collectionOrderBookProps,
    sellModalOpen,
    setSellModalOpen,
    tradeCelebration,
    setTradeCelebration,
    bookSelection,
    aiInsightComingSoonOpen,
    setAiInsightComingSoonOpen,
    showOrderBook,
    setShowOrderBook,
    tradeFlow,
    setTradeFlow,
    tradeDockOpen,
    setTradeDockOpen,
    setSessionFillPoint,
  } = detail;

  const collection = data.collection!;
  const collectionCoverUrl = pickCollectionHeroImageUrl(data);

  const {
    marketsPriceMetricsStrip,
    collectionDualPriceChart,
    collectionDualPriceChartTab,
    collectionOrderBook,
    collectionOrderBookMobile,
  } = buildCollectionDetailMarketsSlots({ market, collectionOrderBookProps });

  const collectionListingsBody = (
    <CollectionDetailListingsGrid
      collectionKey={collectionKey}
      tokenIds={listings.tokenIds}
      askMap={listings.askMap}
      batchMetadata={listings.batchMetadata}
      address={address as Address | undefined}
    />
  );

  const { mobileInformationPanel, mobileListingsPanel } = buildCollectionDetailMobilePanels({
    market,
    asks,
    listingsBody: collectionListingsBody,
  });

  return (
    <div className="min-h-screen min-w-0 overflow-x-clip bg-black text-white max-lg:min-h-0">
      <div
        className={`${COLLECTION_DETAIL_SHELL_CLASS} flex min-h-0 flex-1 flex-col py-4 max-lg:overflow-visible max-lg:py-1.5 max-lg:pb-[max(4.25rem,env(safe-area-inset-bottom,0px)+3.5rem)] sm:overflow-hidden sm:py-8 sm:pb-20`}
      >
        <CollectionDetailMobileNav />
        {isCoverAdmin && address ? (
          <CollectionAdminCoverPanel
            collectionKey={collection.collectionKey}
            adminWallet={address as Address}
            currentCoverUrl={collectionCoverUrl}
            listingTokenIds={listingTokenIdsForAdmin}
            onSaved={() => {
              invalidateCollection();
            }}
            onDeleted={() => {
              invalidateCollection();
              router.push("/markets");
            }}
          />
        ) : null}
        <CollectionOverviewBoard
          title={headline.collectionWovenTitle}
          subtitle={headline.subtitle}
          headlineTitle={headline.collectionHeadlineDisplayTitle}
          headlineStructuredTitle={headline.collectionHeadlineParts}
          headlineSetLine={headline.headlineSetLine}
          headlineMetaStrip={headline.collectionHeadlineMetaStrip ?? undefined}
          headlineInfoTags={headline.headlineInfoTags ?? undefined}
          categoryBadge={headline.collectionCategoryBadge}
          gradeBadge={headline.headlineGradeBadge ?? undefined}
          populationBadge={headline.collectionPopulationBadge ?? undefined}
          headlineTitleLayout
          badgeLabel="Collection"
          imageUrl={collectionCoverUrl}
          belowCover={
            <CollectionHeroDetailsTabs
              onAiInsightsClick={() => setAiInsightComingSoonOpen(true)}
              detailsPanel={
                <CollectionDetailsKvCard
                  title={headline.collectionHeadlineDisplayTitle}
                  subtitle={null}
                  catalogLine={headline.detailsCatalogLine}
                  rows={headline.heroDetailsKvRows}
                  compactRows={headline.heroDetailsKvRows.filter((r) => r.id !== "player")}
                  compact
                />
              }
            />
          }
          metadataRows={headline.metadataRows}
          stats={[]}
          chartMetricsRow={marketsPriceMetricsStrip}
          mobileTabbedMarketUi
          mobileCurrentPriceRow={
            <CollectionMobileCurrentPriceRow
              priceUsd={market.resolvedExternal.usd}
              loading={market.marketSeriesLoading}
            />
          }
          mobileMarketTabs={
            <CollectionMobileMarketTabs
              informationPanel={mobileInformationPanel}
              chartPanel={
                <div
                  className={`${COLLECTION_MARKETS_CHART_TAB_HEIGHT_CLASS} w-full min-w-0 shrink-0 overflow-hidden`}
                >
                  {collectionDualPriceChartTab}
                </div>
              }
              orderBookPanel={
                <div
                  className={`${COLLECTION_MARKETS_CHART_TAB_HEIGHT_CLASS} flex w-full min-w-0 shrink-0 flex-col overflow-hidden`}
                >
                  {collectionOrderBookMobile}
                </div>
              }
              listingsPanel={mobileListingsPanel}
            />
          }
          bookColumnMetricsRow={null}
          showOrderBook={showOrderBook}
          onShowOrderBookChange={setShowOrderBook}
          marketsDockTradePanel
          listingCount={asks.length}
          showListingSummary={false}
          priceChart={collectionDualPriceChart}
          orderBookNextToChart={collectionOrderBook}
          tradePanel={
            <CollectionTradingTabs
              bookSelection={bookSelection}
              address={address as Address | undefined}
              onBuySuccess={() => {
                setSellModalOpen(false);
                setTradeCelebration("purchase");
                invalidateCollection();
              }}
              onOpenSellModal={() => setSellModalOpen(true)}
              collectionKey={collection.collectionKey}
              collectionLabel={headline.collectionHeadlineDisplayTitle}
              asks={asks}
              collectionBids={collectionBids}
              connectedAddress={address ?? undefined}
              onInvalidate={invalidateCollection}
              onInstantBuyFillUsdc={(usdc) =>
                setSessionFillPoint({ t: Math.floor(Date.now() / 1000), v: usdc })
              }
              onPurchaseFilled={() => {
                setSellModalOpen(false);
                setTradeCelebration("purchase");
                invalidateCollection();
              }}
              presetPriceFromBook={presetPriceFromBook}
              listingCount={asks.length}
              showSellListingCount={false}
              tradeFlow={tradeFlow}
              onTradeFlowChange={setTradeFlow}
              marketsDock
              dockOpen={tradeDockOpen}
              onDockOpenChange={setTradeDockOpen}
            />
          }
          marketsBelowChart={collectionListingsBody}
        />
      </div>

      <TradeCelebrationModal
        open={tradeCelebration != null}
        kind={tradeCelebration ?? "purchase"}
        onClose={() => setTradeCelebration(null)}
      />

      <AiInsightComingSoonModal
        open={aiInsightComingSoonOpen}
        onClose={() => setAiInsightComingSoonOpen(false)}
      />

      <CollectionOwnedRwaListModal
        open={sellModalOpen}
        onClose={() => setSellModalOpen(false)}
        collectionKey={collection.collectionKey}
        collectionLabel={headline.collectionHeadlineDisplayTitle}
        collectionBids={collectionBids}
        listPricePresetUsdc={listPricePresetUsdc}
        preferredBidOrderHash={preferredBidOrderHash}
        onSaleCelebration={() => setTradeCelebration("sale")}
      />
    </div>
  );
}
