import { Injectable } from '@nestjs/common';
import type { MarketplaceCollection } from '../entities/marketplace-collection.entity';
import { psaCertNumberFromCollectionRow } from '../utils/collection-row.util';
import type { CollectionAiInsightPricingStats } from './cardhedger-market-data.types';
import { CardhedgerMarketDataService } from './cardhedger-market-data.service';
import { CardhedgerAiInsightEnrichmentService } from './cardhedger-ai-insight-enrichment.service';
import {
  buildAiInsightSections,
  historyToMiniSeries,
} from './cardhedger-ai-insight-sections.util';
import type {
  AiInsightPlatformContext,
  CollectionAiInsightResponse,
} from './cardhedger-ai-insight.types';

/** Single-line-ish copy cap for skim-friendly UI */
function tight(s: string, maxLen: number): string {
  const t = String(s).replace(/\s+/g, ' ').trim();
  if (!t.length) return t;
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1).trimEnd()}…`;
}

type CollectionAiMarketPerspective =
  | 'Uptrend'
  | 'Accumulation'
  | 'Distribution'
  | 'Dead cat bounce'
  | 'Illiquid / niche'
  | 'Consolidating'
  | 'Volatile'
  | 'Overextended'
  | 'Cooling';

const UI_INSTRUCTIONS: NonNullable<CollectionAiInsightResponse['uiInstructions']> =
  {
    loading: {
      style: 'premium-gradient-shimmer',
      scanningEffect: 'crypto-data-scan',
      minDurationMs: 800,
      maxDurationMs: 1500,
    },
    progressiveRenderOrder: [
      'AI Market Summary',
      'Card Identity',
      'Market Structure',
      'Market Performance',
      'Price Trend',
      'FMV Analysis',
      'Grade Premium',
      'Volatility',
      'Market Cycle',
      'Liquidity',
      'Demand Score',
      'Rarity',
      'Market Rank',
      'Opportunity Score',
      'Investment Thesis',
      'Sales Timeline',
      'PSA Verification',
      'Insight Confidence',
    ],
  };

@Injectable()
export class CardhedgerAiInsightService {
  constructor(
    private readonly marketData: CardhedgerMarketDataService,
    private readonly enrichment: CardhedgerAiInsightEnrichmentService,
  ) {}

  private clamp01to100(v: number): number {
    if (!Number.isFinite(v)) return 0;
    return Math.min(100, Math.max(0, v));
  }

  private n(v: number | null | undefined): number | null {
    if (v == null || !Number.isFinite(v)) return null;
    return v;
  }

  /** 0–100: higher = deeper, more reliable tape. */
  private liquidityScore(sales30d: number | null): number {
    if (sales30d == null || !Number.isFinite(sales30d) || sales30d < 0)
      return 18;
    return this.clamp01to100(Math.log10(sales30d + 1) * 38);
  }

  /** 0–100: activity / participation proxy from recent sales frequency. */
  private activityScore(
    sales7d: number | null,
    sales30d: number | null,
  ): number {
    const s7 =
      sales7d != null && Number.isFinite(sales7d) && sales7d >= 0 ? sales7d : 0;
    const s30 =
      sales30d != null && Number.isFinite(sales30d) && sales30d >= 0
        ? sales30d
        : 0;
    return this.clamp01to100(
      Math.log10(s7 + 1) * 32 + Math.log10(s30 + 1) * 24,
    );
  }

  private riskFromTape(input: {
    sales7d: number | null;
    sales30d: number | null;
    change7dPct: number | null;
    change30dPct: number | null;
    change90dPct: number | null;
    change365dPct: number | null;
  }): {
    score: number;
    label: 'Low' | 'Medium' | 'High';
    hiddenTape: boolean;
  } {
    const c7 = Math.abs(this.n(input.change7dPct) ?? 0);
    const c30 = Math.abs(this.n(input.change30dPct) ?? 0);
    const c90 = Math.abs(this.n(input.change90dPct) ?? 0);
    const c365 = Math.abs(this.n(input.change365dPct) ?? 0);
    const volatilityScore = this.clamp01to100(
      c30 * 2.1 + c90 * 1.55 + c365 * 0.65 + c7 * 0.75,
    );
    const liq = this.liquidityScore(input.sales30d);
    const act = this.activityScore(input.sales7d, input.sales30d);
    let risk = this.clamp01to100(
      volatilityScore * 0.42 + (100 - liq) * 0.3 + (100 - act) * 0.28,
    );
    const s30 = input.sales30d ?? 0;
    const s7 = input.sales7d ?? 0;
    const hiddenTape = s30 < 6 && s7 < 3;
    if (hiddenTape && risk < 44) risk = 44;
    const score = Math.round(risk);
    const label = score >= 67 ? 'High' : score >= 40 ? 'Medium' : 'Low';
    return { score, label, hiddenTape };
  }

  private describePremium(stats: CollectionAiInsightPricingStats): string {
    const p = this.n(stats.premiumVsRawPct);
    const pop = stats.psaTotalPopulation;
    const s30 = stats.sales30d ?? 0;
    if (p == null) return '';
    if (p > 500) {
      const lowPop = pop != null && pop < 1200;
      const flow = s30 >= 15;
      if (lowPop && !flow) {
        return tight(
          'PSA premium is extreme vs raw — reads scarcity-driven (low pop, thin flow), not broad demand.',
          118,
        );
      }
      if (flow && !lowPop) {
        return tight(
          'PSA premium is extreme vs raw — flow is active; demand can explain part of the lift.',
          108,
        );
      }
      if (lowPop && flow) {
        return tight(
          'PSA premium is extreme — both low pop and some sales; treat as mixed until depth confirms.',
          112,
        );
      }
      return tight(
        'PSA premium is extreme — confirm with pop data and consistent sales before calling it demand.',
        110,
      );
    }
    if (p >= 120) {
      const lowPop = pop != null && pop < 800;
      if (lowPop && s30 < 12) {
        return tight(
          'Wide PSA lift — likely partly supply-scarcity, not just momentum.',
          95,
        );
      }
      return tight(
        'Wide PSA vs raw — grading scarcity premium is material.',
        88,
      );
    }
    if (p >= 40) return tight('Solid PSA uplift vs raw.', 72);
    if (p >= 15) return tight('Moderate PSA premium.', 64);
    return tight('Tight PSA vs raw.', 58);
  }

  private derivePerspective(input: {
    stats: CollectionAiInsightPricingStats;
    riskScore: number;
  }): CollectionAiMarketPerspective {
    const s = input.stats;
    const c365 = this.n(s.change365dPct);
    const c90 = this.n(s.change90dPct);
    const c30 = this.n(s.change30dPct);
    const c7 = this.n(s.change7dPct);
    const s30 = s.sales30d ?? 0;
    const s7 = s.sales7d ?? 0;

    const deadCatBounce =
      c365 != null &&
      c90 != null &&
      c365 <= -5 &&
      c90 >= 4 &&
      !(c365 >= 0 && c90 >= 0);

    const baseAfterDecline =
      c365 != null &&
      c90 != null &&
      c30 != null &&
      c365 <= -10 &&
      Math.abs(c90) <= 7 &&
      Math.abs(c30) <= 6;

    const distribution = c365 != null && c90 != null && c365 >= 6 && c90 <= -4;

    const illiquidTape = s30 < 5 && s7 < 3;
    const ambiguous =
      (c90 == null || Math.abs(c90) <= 11) &&
      (c30 == null || Math.abs(c30) <= 7);

    const volatile =
      input.riskScore >= 72 ||
      (c30 != null && c7 != null && Math.abs(c30) >= 14 && Math.abs(c7) >= 9);

    const overextended =
      !deadCatBounce &&
      c90 != null &&
      c30 != null &&
      c90 >= 22 &&
      c30 >= 10 &&
      input.riskScore >= 52;

    if (volatile) return 'Volatile';
    if (overextended) return 'Overextended';
    if (deadCatBounce) return 'Dead cat bounce';
    if (distribution) return 'Distribution';

    const cooling =
      (c90 != null && c90 <= -9) ||
      (c30 != null && c30 <= -9 && (c90 ?? 0) < 0);
    if (cooling && !baseAfterDecline) return 'Cooling';

    if (illiquidTape && ambiguous && !baseAfterDecline)
      return 'Illiquid / niche';

    const consolidating =
      (c90 != null &&
        Math.abs(c90) <= 7 &&
        c30 != null &&
        Math.abs(c30) <= 5) ||
      (c90 != null && Math.abs(c90) <= 5);
    if (
      consolidating &&
      !baseAfterDecline &&
      (c365 == null || Math.abs(c365) <= 15)
    ) {
      return 'Consolidating';
    }

    if (baseAfterDecline) return 'Accumulation';

    const bothNonNeg = c365 != null && c90 != null && c365 >= 0 && c90 >= 0;
    if (bothNonNeg) {
      if (c90 >= 12 || (c30 != null && c30 >= 8)) return 'Uptrend';
      return 'Accumulation';
    }

    if (c90 != null && c90 >= 8 && (c365 == null || c365 > -15))
      return 'Uptrend';

    return 'Consolidating';
  }

  private trendContextSentence(
    perspective: CollectionAiMarketPerspective,
    stats: CollectionAiInsightPricingStats,
  ): string {
    const c365 = this.n(stats.change365dPct);
    const c90 = this.n(stats.change90dPct);
    if (perspective === 'Dead cat bounce') {
      const lt =
        c365 != null
          ? `${c365 >= 0 ? '+' : ''}${c365.toFixed(1)}% over 365d`
          : 'a weak 365d tape';
      const st =
        c90 != null ? `+${c90.toFixed(1)}% on 90d` : 'a near-term bounce';
      return tight(
        `Short-term rebound (${st}) inside a longer decline (${lt}) — treat as corrective, not base-building.`,
        155,
      );
    }
    if (perspective === 'Uptrend') {
      return tight(
        'Trend structure is constructive on 90–365d when participation is sufficient.',
        98,
      );
    }
    if (perspective === 'Accumulation') {
      return tight(
        'Positioning skews sideways-to-up with non-negative broader returns or a tight post-drawdown base.',
        118,
      );
    }
    if (perspective === 'Distribution') {
      return tight(
        'Late-cycle risk: macro window still positive on 365d while 90d weakens — supply may be outweighing bids.',
        128,
      );
    }
    if (perspective === 'Cooling') {
      return tight(
        'Momentum is fading on recent windows — buyers need to prove absorption.',
        92,
      );
    }
    if (perspective === 'Illiquid / niche') {
      return tight(
        'Sparse prints — directional labels are unreliable without more turnover.',
        95,
      );
    }
    if (perspective === 'Volatile' || perspective === 'Overextended') {
      return tight(
        'Tape is swinging hard — prioritize risk management over narrative.',
        88,
      );
    }
    return tight(
      'Two-way trade: range-working environment until range breaks.',
      88,
    );
  }

  private emptyResponse(
    title: string,
    summary: string,
    generatedAt: string,
  ): CollectionAiInsightResponse {
    return {
      title,
      summary,
      bullets: [],
      generatedAt,
      uiInstructions: UI_INSTRUCTIONS,
      confidence: null,
      confidenceNote: null,
      riskTapeNote: null,
      marketTone: null,
      riskScore: null,
      riskLabel: null,
      sections: {},
      dataAvailable: false,
    };
  }

  async getAiInsightForCollection(
    col: MarketplaceCollection | null,
    options?: { platform?: AiInsightPlatformContext },
  ): Promise<CollectionAiInsightResponse> {
    const now = new Date().toISOString();
    const label = col?.displayLabel?.trim() || 'Collection';

    if (!col) {
      return this.emptyResponse(
        'Collection AI Insight',
        'No collection selected — insight requires a matched catalog row.',
        now,
      );
    }

    if (!this.marketData.isConfigured()) {
      return this.emptyResponse(
        `${label} — AI Market Brief`,
        'Cardhedger market data is not configured — insight sections require live API feeds.',
        now,
      );
    }

    try {
      const bundle = await this.marketData.getAiInsightDataBundle(col);
      if (!bundle.matched || !bundle.matchConfidence) {
        return this.emptyResponse(
          `${label} — AI Market Brief`,
          'No verified Cardhedger catalog match — connect listings or card metadata to enable insight.',
          now,
        );
      }

      const stats = bundle.stats;
      const riskPack = this.riskFromTape({
        sales7d: stats.sales7d,
        sales30d: stats.sales30d,
        change7dPct: stats.change7dPct,
        change30dPct: stats.change30dPct,
        change90dPct: stats.change90dPct,
        change365dPct: stats.change365dPct,
      });
      const marketTone = this.derivePerspective({
        stats,
        riskScore: riskPack.score,
      });
      const population = this.enrichment.buildPopulationContext(
        col.components ?? {},
        stats.psaTotalPopulation,
      );
      const psaCert = psaCertNumberFromCollectionRow(col);
      const defaultPlatform: AiInsightPlatformContext = {
        activeListingCount: 0,
        floorUsd: null,
        listingPricesUsd: [],
      };
      const enrichment = await this.enrichment.buildEnrichment(
        col,
        options?.platform ?? defaultPlatform,
        bundle.cardId,
      );

      const sections = buildAiInsightSections({
        displayLabel: label,
        gradeLabel: bundle.gradeLabel,
        stats,
        history90: bundle.history90,
        history365: bundle.history365,
        compsRaw: bundle.compsRaw,
        compsLowUsd: bundle.compsLowUsd,
        compsHighUsd: bundle.compsHighUsd,
        fmv: bundle.fmv,
        allPricesRow: bundle.allPricesRow,
        matchConfidence: bundle.matchConfidence,
        psaCertNumber: psaCert,
        population,
        enrichment,
        components: col.components ?? {},
        marketTone,
        riskScore: riskPack.score,
        riskLabel: riskPack.label,
      });

      const trendLine = this.trendContextSentence(marketTone, stats);
      const premLine = this.describePremium(stats);
      const liqLine =
        stats.sales30d != null
          ? stats.sales30d >= 40
            ? 'Liquidity: healthy 30d sales.'
            : stats.sales30d >= 15
              ? 'Liquidity: moderate 30d sales.'
              : stats.sales30d >= 5
                ? 'Liquidity: thin 30d sales.'
                : 'Liquidity: very thin — prints can mislead.'
          : '';
      const riskTapeNote = riskPack.hiddenTape
        ? tight(
            'Hidden tape risk: few recent sales — “low volatility” can be illiquidity, not safety.',
            102,
          )
        : null;
      const riskLine = riskTapeNote
        ? tight(
            `Tape risk ${riskPack.label} (${riskPack.score}/100) — illiquidity can hide gaps.`,
            118,
          )
        : tight(`Tape risk ${riskPack.label} (${riskPack.score}/100).`, 88);

      const summarySource =
        sections.executiveSummary?.paragraphs.join(' ') ||
        `${label}: ${marketTone}. ${trendLine} ${premLine} ${liqLine} ${riskLine}`.replace(
          /\s+/g,
          ' ',
        );
      const summary = tight(summarySource, 420);

      const bullets: string[] = [];
      if (sections.marketPerformance?.commentary[0]) {
        bullets.push(sections.marketPerformance.commentary[0]);
      }
      if (premLine || liqLine) {
        bullets.push(tight(`${premLine} ${liqLine}`.trim(), 125));
      }
      if (riskLine) bullets.push(riskLine);

      const miniSeries = historyToMiniSeries(bundle.history365);
      const priceHistory = bundle.history365.filter((p) => p.v > 0);

      const confSection = sections.confidence;
      const participationWeak =
        (stats.sales30d != null && stats.sales30d < 10) ||
        stats.points90d < 5;
      const confidenceNote =
        participationWeak && confSection?.level !== 'high'
          ? tight('Low market participation — downgrade conviction.', 78)
          : confSection?.reasoning[0] ?? null;

      return {
        title: `${label} — AI Market Brief`,
        summary,
        bullets,
        chartSpec:
          miniSeries.length >= 2
            ? {
                chartStyle: 'Cardhedger PSA 10 history (365d)',
                trendStructure: [
                  '365d macro regime',
                  '90d intermediate rhythm',
                  '30d recent pressure',
                  '7d near-term delta',
                ],
                momentumBehavior: trendLine,
                visualInterpretation: tight(
                  `Real ${bundle.gradeLabel} price history from Cardhedger (${priceHistory.length} observations).`,
                  120,
                ),
                miniSeries,
                pathRepresentation: `Historical ${bundle.gradeLabel} closes`,
              }
            : undefined,
        uiInstructions: UI_INSTRUCTIONS,
        generatedAt: now,
        confidence: confSection?.score ?? bundle.uiConfidence,
        confidenceNote,
        riskTapeNote,
        marketTone,
        riskScore: riskPack.score,
        riskLabel: riskPack.label,
        stats,
        sections,
        priceHistory,
        dataAvailable: true,
      };
    } catch {
      return this.emptyResponse(
        `${label} — AI Market Brief`,
        'Insight temporarily unavailable — Cardhedger request failed. Retry shortly.',
        now,
      );
    }
  }
}
