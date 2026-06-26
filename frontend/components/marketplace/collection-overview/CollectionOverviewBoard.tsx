"use client";

import {
  COLLECTION_DETAILS_BG_CLASS,
  COLLECTION_DETAILS_BORDER_ALL,
} from "@/components/marketplace/collectionOverviewChrome";
import { useCollectionOverviewLayout } from "@/hooks/collection-overview";
import { CollectionOverviewLeftColumn } from "./columns/CollectionOverviewLeftColumn";
import { CollectionOverviewMobileHeadlineSlot } from "./CollectionOverviewMobileHeadlineSlot";
import { CollectionOverviewTopBar } from "./header/CollectionOverviewTopBar";
import { CollectionOverviewBookColumn } from "./layout/CollectionOverviewBookColumn";
import { CollectionOverviewChartPanel } from "./layout/CollectionOverviewChartPanel";
import { CollectionOverviewMarketsCluster } from "./layout/CollectionOverviewMarketsCluster";
import type { CollectionOverviewBoardProps } from "./types";

export type {
  CollectionOverviewBoardProps,
  CollectionOverviewStat,
} from "./types";

export function CollectionOverviewBoard(props: CollectionOverviewBoardProps) {
  const {
    title,
    subtitle,
    headlineTitle,
    headlineStructuredTitle,
    headlineSetLine,
    headlineMetaStrip,
    headlineInfoTags,
    categoryBadge,
    gradeBadge,
    populationBadge,
    headlineTitleLayout = false,
    badgeLabel = "Collection",
    imageUrl,
    metadataRows,
    stats,
    chartMetricsRow,
    orderBook,
    tradeTicket,
    listingCount,
    showListingSummary = true,
    priceChart,
    marketsChartFooter,
    orderBookNextToChart,
    tradePanel,
    marketsDockTradePanel = false,
    metadataExpand,
    marketsRightStackTop,
    showOrderBook = true,
    onShowOrderBookChange,
    leftColumnFooter,
    heroActions,
    coverOverlay,
    coverGallery,
    belowCover,
    mobileCoverBelowMetrics,
    mobileCurrentPriceRow,
    mobileHeroStatsRow,
    mobileMarketTabs,
    mobileTabbedMarketUi = false,
    marketsBelowChart,
    suppressHeadlineBanner = false,
  } = props;

  const layout = useCollectionOverviewLayout({
    orderBook,
    tradeTicket,
    tradePanel,
    orderBookNextToChart,
    onShowOrderBookChange,
    showOrderBook,
    headlineTitleLayout,
    headlineTitle,
    headlineStructuredTitle,
    headlineSetLine,
    headlineMetaStrip,
    headlineInfoTags,
    statsLength: stats.length,
    mobileTabbedMarketUi,
    mobileMarketTabs,
    suppressHeadlineBanner,
    chartMetricsRow,
  });

  const mobileHeadlineBlock = (
    <CollectionOverviewMobileHeadlineSlot
      show={layout.showMobileHeroIdentity}
      headlineTitle={headlineTitle}
      headlineStructuredTitle={headlineStructuredTitle}
      headlineSubtitleLine={layout.headlineSubtitleLine}
      mobileHeadlineCopy={layout.mobileHeadlineCopy}
      suppressHeadlineBanner={layout.suppressHeadlineBanner}
    />
  );

  const marketsCluster = layout.showInlineMarketCluster ? (
    layout.marketsTriple && orderBookNextToChart != null ? (
      <CollectionOverviewMarketsCluster
        orderBookToggleEnabled={layout.orderBookToggleEnabled}
        showOrderBook={showOrderBook}
        onShowOrderBookChange={onShowOrderBookChange}
        orderBookColumnVisible={layout.orderBookColumnVisible}
        useMobileTabbedMarket={layout.useMobileTabbedMarket}
        chartMetricsRow={
          layout.desktopMetricsAboveChart ? chartMetricsRow : undefined
        }
        priceChart={priceChart}
        orderBookNextToChart={orderBookNextToChart}
        marketsRightStackTop={marketsRightStackTop}
        marketsDockTradePanel={marketsDockTradePanel}
        tradePanel={tradePanel}
        marketsChartFooter={marketsChartFooter}
        marketsBelowChart={marketsBelowChart}
        belowCover={belowCover}
      />
    ) : (
      <CollectionOverviewChartPanel
        mode={tradePanel != null ? "trade-sidebar" : "classic"}
        chartMetricsRow={chartMetricsRow}
        priceChart={priceChart}
        tradePanel={tradePanel}
      />
    )
  ) : null;

  return (
    <section
      className={`relative w-full min-w-0 overflow-hidden rounded-2xl ${COLLECTION_DETAILS_BORDER_ALL} ${COLLECTION_DETAILS_BG_CLASS} max-lg:overflow-visible max-lg:shadow-none lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-visible lg:shadow-[0_28px_64px_-32px_rgba(0,0,0,0.9)]`}
      aria-label="Collection overview"
    >
      <CollectionOverviewTopBar
        title={title}
        subtitle={subtitle}
        headlineTitle={headlineTitle}
        headlineStructuredTitle={headlineStructuredTitle}
        headlineSubtitleLine={layout.headlineSubtitleLine}
        useStructuredHeadline={layout.useStructuredHeadline}
        headlineTitleLayout={headlineTitleLayout}
        categoryBadge={categoryBadge}
        gradeBadge={gradeBadge}
        populationBadge={populationBadge}
        badgeLabel={badgeLabel}
        listingCount={listingCount}
        showListingSummary={showListingSummary}
        stats={stats}
        showMobileHeroIdentity={layout.showMobileHeroIdentity}
        hideTopHeadlineBarOnMobile={layout.hideTopHeadlineBarOnMobile}
        suppressHeadlineBanner={layout.suppressHeadlineBanner}
        hideDesktopHeadlineBadges={layout.useMobileTabbedMarket}
      />

      <div
        className={`relative grid w-full min-w-0 max-lg:grid-cols-1 max-lg:justify-items-stretch max-lg:overflow-visible lg:min-h-0 lg:flex-1 lg:overflow-visible ${layout.gridBodyClass} max-lg:gap-0 max-lg:px-0 max-lg:pt-0 max-lg:pb-2 px-3.5 pt-0 pb-4 sm:px-6 sm:pb-6 lg:px-8 lg:pt-0 lg:pb-6`}
      >
        <div className={`min-w-0 ${layout.useMobileTabbedMarket ? "lg:hidden" : ""}`}>
          <CollectionOverviewLeftColumn
            imageUrl={imageUrl}
            marketsTriple={layout.marketsTriple}
            useMobileTabbedMarket={layout.useMobileTabbedMarket}
            mobileHeadlineBlock={mobileHeadlineBlock}
            mobileCurrentPriceRow={mobileCurrentPriceRow}
            mobileHeroStatsRow={mobileHeroStatsRow}
            mobileMarketTabs={mobileMarketTabs}
            mobileCoverBelowMetrics={mobileCoverBelowMetrics}
            belowCover={belowCover}
            heroActions={heroActions}
            coverOverlay={coverOverlay}
            coverGallery={coverGallery}
            metadataExpand={metadataExpand}
            metadataRows={metadataRows}
            leftColumnFooter={leftColumnFooter}
          />
        </div>

        {marketsCluster != null ? (
          <div
            className={`flex min-w-0 w-full max-w-full flex-col items-stretch gap-2 overflow-x-clip sm:gap-2.5 lg:min-w-0 lg:self-start ${
              layout.useMobileTabbedMarket ? "lg:col-span-full" : "lg:col-start-2"
            }`}
          >
            {marketsCluster}
          </div>
        ) : null}

        {layout.hasBookColumn ? (
          <CollectionOverviewBookColumn orderBook={orderBook} tradeTicket={tradeTicket} />
        ) : null}
      </div>
    </section>
  );
}
