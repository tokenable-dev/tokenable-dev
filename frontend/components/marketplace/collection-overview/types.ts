import type { ReactNode } from "react";
import type { CollectionMetadataExpandableProps } from "@/components/marketplace/collection-cover";
import type { AssetDetailHeadlineParts } from "@/lib/marketplace/assetDetailHeadline";

export interface CollectionOverviewStat {
  label: string;
  value: string;
  tone?: "up" | "down" | "neutral";
  sub?: string;
}

export interface CollectionOverviewBoardProps {
  title: string;
  subtitle?: string | null;
  headlineTitle?: string | null;
  headlineStructuredTitle?: AssetDetailHeadlineParts | null;
  headlineSetLine?: string | null;
  headlineMetaStrip?: string | null;
  headlineInfoTags?: { id: string; text: string; title?: string }[] | null;
  categoryBadge?: string | null;
  gradeBadge?: string | null;
  populationBadge?: string | null;
  headlineTitleLayout?: boolean;
  badgeLabel?: string;
  imageUrl: string | null;
  metadataRows: { label: string; value: string }[];
  stats: CollectionOverviewStat[];
  chartMetricsRow?: ReactNode;
  bookColumnMetricsRow?: ReactNode;
  orderBook?: ReactNode;
  tradeTicket?: ReactNode;
  listingCount: number;
  showListingSummary?: boolean;
  priceChart?: ReactNode;
  marketsChartFooter?: ReactNode;
  orderBookNextToChart?: ReactNode;
  tradePanel?: ReactNode;
  marketsDockTradePanel?: boolean;
  metadataExpand?: Omit<CollectionMetadataExpandableProps, "metadataRows">;
  marketsRightStackTop?: ReactNode;
  showOrderBook?: boolean;
  onShowOrderBookChange?: (next: boolean) => void;
  leftColumnFooter?: ReactNode;
  belowCover?: ReactNode;
  mobileCoverBelowMetrics?: ReactNode;
  mobileCurrentPriceRow?: ReactNode;
  mobileMarketTabs?: ReactNode;
  mobileTabbedMarketUi?: boolean;
  marketsBelowChart?: ReactNode;
  suppressHeadlineBanner?: boolean;
  heroActions?: ReactNode;
}
