import type { CardhedgerFmvResult } from './cardhedger-fmv.util';
import type {
  CardhedgerCardRow,
  CardhedgerCompRawPoint,
} from './cardhedger-market-data.types';
import type { CollectionAiInsightPricingStats } from './cardhedger-market-data.types';

export type AiInsightPriceTrendLabel =
  | 'cooling'
  | 'consolidation'
  | 'breakout'
  | 'stable'
  | 'volatile';

export type AiInsightLiquidityLevel =
  | 'healthy'
  | 'moderate'
  | 'thin'
  | 'very_thin';

export type AiInsightConfidenceLevel = 'high' | 'medium' | 'low';

export type AiInsightVolatilityLevel = 'low' | 'medium' | 'high';

export type AiInsightMarketCycleLabel =
  | 'accumulation'
  | 'expansion'
  | 'distribution'
  | 'correction';

export interface AiInsightScoredComponent {
  key: string;
  label: string;
  score: number;
  weight: number;
  contribution: number;
}

export interface AiInsightTrendWindow {
  window: '7d' | '30d' | '90d' | '365d';
  changePct: number | null;
}

export interface AiInsightMarketPerformanceSection {
  dataSources: string[];
  commentary: string[];
  trends: AiInsightTrendWindow[];
  volumeNote: string | null;
}

export interface AiInsightPriceTrendSection {
  dataSources: string[];
  label: AiInsightPriceTrendLabel | null;
  commentary: string[];
  lowestUsd: number | null;
  highestUsd: number | null;
  medianSaleUsd: number | null;
  recentSaleUsd: number | null;
}

export interface AiInsightLiquiditySection {
  dataSources: string[];
  level: AiInsightLiquidityLevel | null;
  commentary: string[];
  sales7d: number | null;
  sales30d: number | null;
  avgDaysBetweenSales: number | null;
  tokenableActiveListings: number | null;
  listingToSaleRatio: number | null;
}

export interface AiInsightDemandSection {
  dataSources: string[];
  score: number;
  components: AiInsightScoredComponent[];
  reasoning: string[];
}

export interface AiInsightRarityPopulationRow {
  label: string;
  count: number;
}

export interface AiInsightRaritySection {
  dataSources: string[];
  commentary: string[];
  populations: AiInsightRarityPopulationRow[];
  psa10SharePct: number | null;
  scarcityRatio10vs9: number | null;
  gradeDistribution: AiInsightRarityPopulationRow[];
}

export interface AiInsightInvestmentThesisSection {
  dataSources: string[];
  bullCase: string[];
  bearCase: string[];
  keyRisks: string[];
}

export interface AiInsightSalesTimelineEntry {
  date: string;
  priceUsd: number;
  marketplace: string | null;
  grade: string;
}

export interface AiInsightSalesTimelineSection {
  dataSources: string[];
  entries: AiInsightSalesTimelineEntry[];
  trendSummary: string | null;
}

export interface AiInsightPsaVerificationSection {
  dataSources: string[];
  psaVerified: boolean | null;
  certMatch: boolean | null;
  gradeMatch: boolean | null;
  marketDataCoverage: boolean;
  certification: string | null;
  gradingLabel: string | null;
  trustScore: number;
  reasoning: string[];
}

export interface AiInsightMarketStructureSection {
  dataSources: string[];
  spotUsd: number | null;
  compLowUsd: number | null;
  compHighUsd: number | null;
  tokenableFloorUsd: number | null;
  floorPremiumPct: number | null;
  listingConcentrationPct: number | null;
  marketplaceDistribution: Array<{ label: string; pct: number }>;
  commentary: string[];
}

export interface AiInsightFmvSection {
  dataSources: string[];
  currentUsd: number | null;
  fmvUsd: number | null;
  premiumVsFmvPct: number | null;
  confidenceGrade: 'A' | 'B' | 'C' | 'D' | null;
  method: string | null;
  freshnessDays: number | null;
}

export interface AiInsightGradePremiumRow {
  grade: string;
  priceUsd: number | null;
}

export interface AiInsightGradePremiumSection {
  dataSources: string[];
  grades: AiInsightGradePremiumRow[];
  psa10VsRawPct: number | null;
  psa10VsPsa9Ratio: number | null;
  psa10VsPsa8Ratio: number | null;
}

export interface AiInsightVolatilitySection {
  dataSources: string[];
  vol30dPct: number | null;
  vol90dPct: number | null;
  vol365dPct: number | null;
  level30d: AiInsightVolatilityLevel | null;
  level90d: AiInsightVolatilityLevel | null;
  level365d: AiInsightVolatilityLevel | null;
}

export interface AiInsightMarketCycleSection {
  dataSources: string[];
  label: AiInsightMarketCycleLabel;
  reasoning: string[];
}

export interface AiInsightMarketRankSection {
  dataSources: string[];
  rank: number;
  category: string;
  rankChange30d: number | null;
  percentile: number;
}

export interface AiInsightOpportunitySection {
  dataSources: string[];
  score: number;
  components: AiInsightScoredComponent[];
}

export interface AiInsightCardIdentityFact {
  label: string;
  value: string;
}

export interface AiInsightCardIdentitySection {
  dataSources: string[];
  facts: AiInsightCardIdentityFact[];
}

export interface AiInsightExecutiveSummarySection {
  dataSources: string[];
  paragraphs: string[];
}

export interface AiInsightConfidenceSection {
  dataSources: string[];
  level: AiInsightConfidenceLevel;
  score: number;
  reasoning: string[];
}

export interface CollectionAiInsightSections {
  marketPerformance?: AiInsightMarketPerformanceSection;
  priceTrend?: AiInsightPriceTrendSection;
  liquidity?: AiInsightLiquiditySection;
  demand?: AiInsightDemandSection;
  rarity?: AiInsightRaritySection;
  investmentThesis?: AiInsightInvestmentThesisSection;
  salesTimeline?: AiInsightSalesTimelineSection;
  psaVerification?: AiInsightPsaVerificationSection;
  marketStructure?: AiInsightMarketStructureSection;
  fmv?: AiInsightFmvSection;
  gradePremium?: AiInsightGradePremiumSection;
  volatility?: AiInsightVolatilitySection;
  marketCycle?: AiInsightMarketCycleSection;
  marketRank?: AiInsightMarketRankSection;
  opportunity?: AiInsightOpportunitySection;
  cardIdentity?: AiInsightCardIdentitySection;
  executiveSummary?: AiInsightExecutiveSummarySection;
  confidence?: AiInsightConfidenceSection;
}

export interface AiInsightPlatformContext {
  activeListingCount: number;
  floorUsd: number | null;
  medianUsd?: number | null;
  sampleSize?: number;
  listingPricesUsd: number[];
}

export interface AiInsightPopulationContext {
  psa10: number | null;
  psa9: number | null;
  specTotal: number | null;
  byGrade: Record<string, number> | null;
  hasCompleteByGrade: boolean;
}

export interface AiInsightTop100RankContext {
  rank: number;
  category: string;
  rankChange30d: number | null;
}

export interface AiInsightEnrichmentContext {
  platform: AiInsightPlatformContext;
  watchlistCount: number;
  psaCertSnapshot: Record<string, unknown> | null;
  top100Rank: AiInsightTop100RankContext | null;
  listingGradeScore: string | null;
}

export interface AiInsightSectionInput {
  displayLabel: string;
  gradeLabel: string;
  stats: CollectionAiInsightPricingStats;
  history90: Array<{ t: number; v: number }>;
  history365: Array<{ t: number; v: number }>;
  compsRaw: CardhedgerCompRawPoint[];
  compsLowUsd: number | null;
  compsHighUsd: number | null;
  fmv: CardhedgerFmvResult | null;
  allPricesRow: CardhedgerCardRow | null;
  matchConfidence: 'verified' | 'approximate';
  psaCertNumber: string | null;
  population: AiInsightPopulationContext;
  enrichment: AiInsightEnrichmentContext;
  components: Record<string, unknown>;
  marketTone: string | null;
  riskScore: number | null;
  riskLabel: 'Low' | 'Medium' | 'High' | null;
}

export interface AiInsightDataBundle {
  matched: boolean;
  matchConfidence: 'verified' | 'approximate' | null;
  catalogLabel: string;
  uiConfidence: number | null;
  stats: CollectionAiInsightPricingStats;
  cardId: string | null;
  gradeLabel: string;
  history90: Array<{ t: number; v: number }>;
  history365: Array<{ t: number; v: number }>;
  compsRaw: CardhedgerCompRawPoint[];
  compsLowUsd: number | null;
  compsHighUsd: number | null;
  fmv: CardhedgerFmvResult | null;
  allPricesRow: CardhedgerCardRow | null;
}

export interface CollectionAiInsightResponse {
  title: string;
  summary: string;
  bullets: string[];
  chartSpec?: {
    chartStyle: string;
    trendStructure: string[];
    momentumBehavior: string;
    visualInterpretation: string;
    miniSeries: number[];
    pathRepresentation: string;
  };
  uiInstructions?: {
    loading: {
      style: string;
      scanningEffect: string;
      minDurationMs: number;
      maxDurationMs: number;
    };
    progressiveRenderOrder: string[];
  };
  generatedAt: string;
  confidence?: number | null;
  confidenceNote?: string | null;
  riskTapeNote?: string | null;
  marketTone?: string | null;
  riskScore?: number | null;
  riskLabel?: 'Low' | 'Medium' | 'High' | null;
  stats?: CollectionAiInsightPricingStats;
  sections?: CollectionAiInsightSections;
  priceHistory?: Array<{ t: number; v: number }>;
  dataAvailable: boolean;
}
