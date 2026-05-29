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
    belowCover,
    mobileCoverBelowMetrics,
    mobileCurrentPriceRow,
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
  });

  const mobileHeadlineBlock = (
    <CollectionOverviewMobileHeadlineSlot
      show={layout.showMobileHeroIdentity}
      headlineTitle={headlineTitle}
      headlineStructuredTitle={headlineStructuredTitle}
      headlineSubtitleLine={layout.headlineSubtitleLine}
      mobileHeadlineCopy={layout.mobileHeadlineCopy}
      categoryBadge={categoryBadge}
      gradeBadge={gradeBadge}
      populationBadge={populationBadge}
      badgeLabel={badgeLabel}
      suppressHeadlineBanner={layout.suppressHeadlineBanner}
    />
  );

  return (
    <section
      className={`relative w-full min-w-0 overflow-hidden rounded-2xl ${COLLECTION_DETAILS_BORDER_ALL} ${COLLECTION_DETAILS_BG_CLASS} max-lg:overflow-visible max-lg:shadow-none lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:shadow-[0_28px_64px_-32px_rgba(0,0,0,0.9)]`}
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
      />

      <div
        className={`relative grid w-full min-w-0 max-lg:grid-cols-1 max-lg:justify-items-stretch max-lg:overflow-visible lg:min-h-0 lg:flex-1 lg:overflow-hidden ${layout.gridBodyClass} max-lg:gap-0 max-lg:px-0 max-lg:pt-1.5 max-lg:pb-2 px-3.5 pt-3.5 pb-4 sm:p-6 lg:px-8 lg:pt-6 lg:pb-6`}
      >
        <CollectionOverviewLeftColumn
          imageUrl={imageUrl}
          marketsTriple={layout.marketsTriple}
          useMobileTabbedMarket={layout.useMobileTabbedMarket}
          mobileHeadlineBlock={mobileHeadlineBlock}
          mobileCurrentPriceRow={mobileCurrentPriceRow}
          mobileMarketTabs={mobileMarketTabs}
          mobileCoverBelowMetrics={mobileCoverBelowMetrics}
          belowCover={belowCover}
          heroActions={heroActions}
          metadataExpand={metadataExpand}
          metadataRows={metadataRows}
          leftColumnFooter={leftColumnFooter}
        />

        {layout.showInlineMarketCluster ? (
          <div className="flex min-w-0 w-full max-w-full flex-col items-stretch gap-2 overflow-x-clip sm:gap-2.5 lg:min-w-0 lg:self-start">
            {layout.marketsTriple && orderBookNextToChart != null ? (
              <CollectionOverviewMarketsCluster
                orderBookToggleEnabled={layout.orderBookToggleEnabled}
                showOrderBook={showOrderBook}
                onShowOrderBookChange={onShowOrderBookChange}
                chartMetricsRow={chartMetricsRow}
                orderBookColumnVisible={layout.orderBookColumnVisible}
                useMobileTabbedMarket={layout.useMobileTabbedMarket}
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
            )}
          </div>
        ) : null}

        {layout.hasBookColumn ? (
          <CollectionOverviewBookColumn orderBook={orderBook} tradeTicket={tradeTicket} />
        ) : null}
      </div>
    </section>
  );
}
