"use client";

import { useMemo } from "react";
import {
  assetDetailHeadlineHasContent,
  type AssetDetailHeadlineParts,
} from "@/lib/marketplace/assetDetailHeadline";
import {
  buildHeadlineSubtitleLine,
  buildMobileHeadlineCopy,
} from "@/lib/marketplace/collectionHeadlineCopy";

export function useCollectionOverviewLayout(input: {
  orderBook: unknown;
  tradeTicket: unknown;
  tradePanel: unknown;
  orderBookNextToChart: unknown;
  onShowOrderBookChange?: (next: boolean) => void;
  showOrderBook: boolean;
  headlineTitleLayout: boolean;
  headlineTitle?: string | null;
  headlineStructuredTitle?: AssetDetailHeadlineParts | null;
  headlineSetLine?: string | null;
  headlineMetaStrip?: string | null;
  headlineInfoTags?: { id: string; text: string }[] | null;
  statsLength: number;
  mobileTabbedMarketUi: boolean;
  mobileMarketTabs: unknown;
  suppressHeadlineBanner: boolean;
  chartMetricsRow?: unknown;
}) {
  const {
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
    statsLength,
    mobileTabbedMarketUi,
    mobileMarketTabs,
    suppressHeadlineBanner,
    chartMetricsRow,
  } = input;

  const hasBookColumn = orderBook != null || tradeTicket != null;
  const marketsTriple = tradePanel != null && orderBookNextToChart != null;
  const orderBookToggleEnabled = onShowOrderBookChange != null;
  const orderBookColumnVisible = !orderBookToggleEnabled || showOrderBook;

  const useStructuredHeadline =
    headlineStructuredTitle != null &&
    assetDetailHeadlineHasContent(headlineStructuredTitle);

  const headlineSubtitleLine =
    headlineTitleLayout && headlineTitle && !useStructuredHeadline
      ? buildHeadlineSubtitleLine(headlineSetLine, headlineMetaStrip, headlineInfoTags ?? null)
      : null;

  const mobileHeadlineCopy =
    headlineTitleLayout && headlineTitle && !useStructuredHeadline
      ? buildMobileHeadlineCopy(headlineSetLine, headlineMetaStrip, headlineInfoTags ?? null)
      : null;

  const showMobileHeroIdentity = Boolean(headlineTitleLayout && headlineTitle);
  const hideTopHeadlineBarOnMobile = showMobileHeroIdentity && statsLength === 0;
  const useMobileTabbedMarket = mobileTabbedMarketUi && mobileMarketTabs != null;
  // Desktop cluster must stay mounted whenever tabbed UI is used; visibility is
  // CSS-only. Unmounting it on mobile blanked the page on widen (Tailwind hides
  // the mobile column at ≥1024px before React remounts desktop).
  const desktopMetricsAboveChart = marketsTriple && chartMetricsRow != null;

  const gridBodyClass = useMemo(() => {
    if (marketsTriple && useMobileTabbedMarket) {
      return "gap-3 sm:gap-4 lg:grid-cols-1 lg:gap-y-0 lg:items-start";
    }
    if (marketsTriple) {
      return "gap-3 sm:gap-4 lg:gap-x-10 lg:gap-y-0 lg:items-start lg:grid-cols-[307px_minmax(0,1fr)]";
    }
    if (hasBookColumn) {
      return "lg:items-start gap-6 lg:gap-8 lg:grid-cols-[minmax(260px,min(307px,40vw))_minmax(0,1fr)_minmax(220px,300px)]";
    }
    return "lg:items-start gap-6 lg:gap-8 lg:grid-cols-[minmax(260px,min(307px,40vw))_minmax(0,1fr)]";
  }, [marketsTriple, useMobileTabbedMarket, hasBookColumn]);

  return {
    hasBookColumn,
    marketsTriple,
    orderBookToggleEnabled,
    orderBookColumnVisible,
    useStructuredHeadline,
    headlineSubtitleLine,
    mobileHeadlineCopy,
    showMobileHeroIdentity,
    hideTopHeadlineBarOnMobile,
    useMobileTabbedMarket,
    suppressHeadlineBanner,
    gridBodyClass,
    desktopMetricsAboveChart,
  };
}
