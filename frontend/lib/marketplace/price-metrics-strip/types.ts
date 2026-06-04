import type { ReactNode } from "react";
import type { ReferencePercentChangeResult } from "@/lib/market";
import type { PsaPopulationMetrics } from "@/lib/market/gradedCardMarketCap";

export interface CollectionPriceMetricsStripProps {
  externalMarketUsd?: number | null;
  externalPriceSource?: string | null;
  marketTierDisplay?: string | null;
  externalMarketMatchConfidence?: "verified" | "approximate" | null;
  externalPriceLoading?: boolean;
  externalVolatilityCvPct?: number | null;
  volatilityFootnote?: string | null;
  platformPriceSamples?: number[];
  bookSpreadPct?: number | null;
  externalPriceChange1MoPct?: number | null;
  externalPriceChange1MoLoading?: boolean;
  externalPriceChangePeriod?: Pick<
    ReferencePercentChangeResult,
    "isFullYear" | "windowSec" | "marketChangeWindow"
  > | null;
  externalPriceChangeBasisText?: string | null;
  marketCapUsd?: number | null;
  marketCapMethodHint?: string | null;
  showPriceChange?: boolean;
  showVolatility?: boolean;
  showMarketCap?: boolean;
  showFootnotes?: boolean;
  compact?: boolean;
  formatMarketCap: (usd: number | null) => string;
  marketsColumn?: "chart" | "trade";
  marketsUnifiedRow?: boolean;
  /** 30d merged trade notional (platform + Cardhedger comps in trades tape). */
  tradeVolumeUsdc?: number | null;
  tradeVolumeLoading?: boolean;
  /** @deprecated Prefer psaPopulationMetrics */
  totalPopulation?: number | null;
  psaPopulationMetrics?: PsaPopulationMetrics | null;
}

export type PriceMetricsTileSpec = {
  label: string;
  compact: boolean;
  footer?: ReactNode;
  tone?: "default" | "primary";
  variant?: "card" | "panelCell";
  cellClassName?: string;
  value: ReactNode;
};
