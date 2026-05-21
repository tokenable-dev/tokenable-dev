import { Injectable } from '@nestjs/common';
import type { MarketplaceCollection } from '../entities/marketplace-collection.entity';
import type { CollectionAiInsightPricingStats } from './cardhedger-market-data.service';
import { CardhedgerMarketDataService } from './cardhedger-market-data.service';

/** Single-line-ish copy cap for skim-friendly UI */
function tight(s: string, maxLen: number): string {
  const t = String(s).replace(/\s+/g, ' ').trim();
  if (!t.length) return t;
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1).trimEnd()}…`;
}

export type CollectionAiMarketPerspective =
  | 'Uptrend'
  | 'Accumulation'
  | 'Distribution'
  | 'Dead cat bounce'
  | 'Illiquid / niche'
  | 'Consolidating'
  | 'Volatile'
  | 'Overextended'
  | 'Cooling';

@Injectable()
export class CardhedgerAiInsightService {
  constructor(private readonly marketData: CardhedgerMarketDataService) {}

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

  private miniSeriesByPerspective(perspective: CollectionAiMarketPerspective): {
    miniSeries: number[];
    pathRepresentation: string;
  } {
    if (perspective === 'Uptrend') {
      return {
        miniSeries: [18, 19, 20, 21, 22, 24, 25, 26, 27, 28, 29, 30],
        pathRepresentation:
          'Low → Accumulation → Expansion ↑↑ → Consolidation → Breakout pressure ↑',
      };
    }
    if (perspective === 'Cooling' || perspective === 'Distribution') {
      return {
        miniSeries: [31, 30, 29, 28, 27, 26, 25, 25, 24, 23, 22, 21],
        pathRepresentation:
          'Peak → Distribution → Breakdown ↓ → Lower range → Continued weakness',
      };
    }
    if (perspective === 'Consolidating' || perspective === 'Accumulation') {
      return {
        miniSeries: [24, 24, 25, 24, 25, 24, 25, 25, 24, 25, 26, 26],
        pathRepresentation:
          'Range → Compression → Oscillation → Range-bound structure',
      };
    }
    if (perspective === 'Overextended') {
      return {
        miniSeries: [18, 19, 21, 24, 27, 29, 28, 30, 27, 28, 27, 26],
        pathRepresentation:
          'Low → Expansion spike ↑↑ → Volatile retest → Re-balance zone',
      };
    }
    if (perspective === 'Volatile') {
      return {
        miniSeries: [24, 27, 23, 28, 22, 27, 23, 26, 24, 27, 23, 25],
        pathRepresentation:
          'Wide range -> Expansion/Compression swings -> Directional bias pending',
      };
    }
    if (perspective === 'Dead cat bounce') {
      return {
        miniSeries: [30, 28, 26, 25, 26, 27, 26, 25, 24, 23, 22, 21],
        pathRepresentation:
          'Down leg ↓ → Counter-trend spike ↑ → Fade risk → Lower-high retest zone',
      };
    }
    if (perspective === 'Illiquid / niche') {
      return {
        miniSeries: [22, 23, 22, 22, 23, 22, 23, 22, 23, 22, 23, 22],
        pathRepresentation:
          'Thin tape → jitter prints → directional noise → waits for liquidity',
      };
    }
    return {
      miniSeries: [22, 22, 23, 23, 24, 24, 24, 25, 25, 25, 26, 26],
      pathRepresentation:
        'Base → Gradual expansion → Mild consolidation → Two-way chop',
    };
  }

  private adjustConfidence(params: {
    base: number | null;
    stats: CollectionAiInsightPricingStats;
    lowParticipation: boolean;
    dataSparse: boolean;
  }): { confidence: number | null; note: string | null } {
    if (params.base == null || !Number.isFinite(params.base)) {
      return { confidence: null, note: null };
    }
    let c = params.base;
    if (params.dataSparse) c *= 0.88;
    if (params.lowParticipation) c *= 0.82;
    c = Math.min(0.97, Math.max(0.35, c));
    const note =
      params.lowParticipation || params.dataSparse
        ? tight(
            'Low market participation / sparse comps — downgrade conviction.',
            78,
          )
        : null;
    return { confidence: Math.round(c * 1000) / 1000, note };
  }

  async getAiInsightForCollection(col: MarketplaceCollection | null): Promise<{
    title: string;
    summary: string;
    bullets: string[];
    dynamics?: string[];
    syntheticChart?: string;
    chartSpec?: {
      chartStyle: string;
      trendStructure: string[];
      momentumBehavior: string;
      visualInterpretation: string;
      miniSeries: number[];
      pathRepresentation: string;
    };
    outlook?: string;
    outlookScenarios?: {
      bullCase: string;
      baseCase: string;
      bearCase: string;
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
    /** Shown when confidence is tapered for thin tape / sparse windows. */
    confidenceNote?: string | null;
    /** Extra risk caveat when reads are distorted by inactive markets. */
    riskTapeNote?: string | null;
    marketTone?: CollectionAiMarketPerspective | null;
    riskScore?: number | null;
    riskLabel?: 'Low' | 'Medium' | 'High' | null;
    stats?: {
      psa10SpotUsd: number | null;
      rawSpotUsd: number | null;
      premiumVsRawPct: number | null;
      sales7d: number | null;
      sales30d: number | null;
      change7dPct: number | null;
      change30dPct: number | null;
      change90dPct: number | null;
      change365dPct: number | null;
      points90d: number;
      points365d: number;
      psaTotalPopulation?: number | null;
      psa10PriceConfidence?: 'high' | 'medium' | 'low' | null;
      psa10PricingNote?: string | null;
      psa10SpotLowUsd?: number | null;
      psa10SpotHighUsd?: number | null;
      psa10CatalogUsd?: number | null;
    };
  }> {
    const now = new Date().toISOString();
    if (!col) {
      return {
        title: 'Collection AI Insight',
        summary: tight(
          'Early price discovery — clearer trend once liquidity picks up.',
          140,
        ),
        bullets: [
          tight('Structure forming from first active prints.', 90),
          tight('Momentum: read it with book depth.', 85),
          tight('Premium signal sharpens as flow grows.', 90),
        ],
        dynamics: [],
        syntheticChart:
          'early base-building with shallow swings and gradual range definition',
        outlook: tight('Trend firms as buys/sells widen.', 100),
        chartSpec: {
          chartStyle: 'Expanded Macro View (Wide X-Axis)',
          trendStructure: [
            'Phase 1: Accumulation / base formation',
            'Phase 2: Early expansion attempt',
            'Phase 3: Controlled consolidation pocket',
            'Phase 4: Current positioning in price discovery',
          ],
          momentumBehavior:
            'Momentum is compressing, then re-expanding in short bursts.',
          visualInterpretation:
            'Price action appears as a broad base with gentle upward bias and intermittent consolidation shelves.',
          miniSeries: [20, 20, 21, 21, 22, 22, 22, 23, 23, 24, 24, 25],
          pathRepresentation:
            'Base -> Early accumulation -> Controlled expansion -> Constructive positioning',
        },
        outlookScenarios: {
          bullCase: tight('Demand sticks → breakout follow-through.', 70),
          baseCase: tight('Sideways churn while bids build.', 70),
          bearCase: tight('Failed breakout → pullback to base.', 70),
        },
        uiInstructions: {
          loading: {
            style: 'premium-gradient-shimmer',
            scanningEffect: 'crypto-data-scan',
            minDurationMs: 800,
            maxDurationMs: 1500,
          },
          progressiveRenderOrder: [
            'AI Insight',
            'Market Structure',
            'Key Signals',
            'Synthetic Trend Chart',
            'Forward Outlook',
            'Market Tone',
          ],
        },
        generatedAt: now,
        confidence: null,
        confidenceNote: null,
        riskTapeNote: null,
      };
    }
    if (!this.marketData.isConfigured()) {
      return {
        title: `${col.displayLabel} — AI Market Brief`,
        summary: tight(
          `${col.displayLabel}: live-flow context loading — feeds not wired.`,
          120,
        ),
        bullets: [
          tight('Momentum follows active discovery.', 80),
          tight('Premium grows with traded depth.', 80),
          tight('Liquidity trend is the real tell.', 80),
        ],
        dynamics: [],
        syntheticChart:
          'forming trend channel with intermittent consolidation pockets',
        outlook: tight('Follow-through rises if depth holds.', 100),
        chartSpec: {
          chartStyle: 'Expanded Macro View (Wide X-Axis)',
          trendStructure: [
            'Phase 1: Base development',
            'Phase 2: Expansion leg',
            'Phase 3: Cooling consolidation',
            'Phase 4: Re-acceleration watch zone',
          ],
          momentumBehavior: 'Momentum is expanding off a consolidation floor.',
          visualInterpretation:
            'Chart likely prints a stair-step climb with pauses that resolve into higher zones.',
          miniSeries: [19, 20, 20, 21, 22, 23, 23, 24, 25, 25, 26, 27],
          pathRepresentation:
            'Accumulation -> Expansion ↑ -> Consolidation shelf -> Continuation bias',
        },
        outlookScenarios: {
          bullCase: tight('Supply melts → upside leg.', 60),
          baseCase: tight('Range → then next move.', 50),
          bearCase: tight('Demand rotates off → fade.', 55),
        },
        uiInstructions: {
          loading: {
            style: 'premium-gradient-shimmer',
            scanningEffect: 'crypto-data-scan',
            minDurationMs: 800,
            maxDurationMs: 1500,
          },
          progressiveRenderOrder: [
            'AI Insight',
            'Market Structure',
            'Key Signals',
            'Synthetic Trend Chart',
            'Forward Outlook',
            'Market Tone',
          ],
        },
        generatedAt: now,
        confidence: null,
        confidenceNote: null,
        riskTapeNote: null,
      };
    }

    const q = this.marketData.buildCollectionQuery(col);
    const query =
      q.cardhedgerSearchQuery ||
      q.listingDisplayTitle ||
      q.query ||
      String(col.displayLabel ?? '').trim();
    if (!query) {
      return {
        title: `${col.displayLabel} — AI Market Brief`,
        summary: tight(
          'Narrow discovery window — structure still sorting itself out.',
          120,
        ),
        bullets: [
          tight('Not noise: transition regime.', 80),
          tight('Quality bids matter more than one print.', 90),
          tight('Need sustained follow-through to confirm.', 90),
        ],
        dynamics: [],
        syntheticChart: 'compressed range with emerging directional bias',
        outlook: tight('Cleaner move once range breaks.', 100),
        chartSpec: {
          chartStyle: 'Expanded Macro View (Wide X-Axis)',
          trendStructure: [
            'Phase 1: Accumulation base',
            'Phase 2: Initial expansion probe',
            'Phase 3: Range consolidation',
            'Phase 4: Directional decision zone',
          ],
          momentumBehavior:
            'Momentum is compressing and preparing for directional release.',
          visualInterpretation:
            'Visual profile resembles a rounded base with tightening swings near resistance.',
          miniSeries: [21, 21, 22, 22, 22, 23, 22, 23, 23, 24, 24, 24],
          pathRepresentation:
            'Range base -> Compression -> Directional pressure build -> Pending expansion',
        },
        outlookScenarios: {
          bullCase: tight('Break + hold bids → up.', 50),
          baseCase: tight('Chop inside range.', 45),
          bearCase: tight('Fake breakout → dip.', 45),
        },
        uiInstructions: {
          loading: {
            style: 'premium-gradient-shimmer',
            scanningEffect: 'crypto-data-scan',
            minDurationMs: 800,
            maxDurationMs: 1500,
          },
          progressiveRenderOrder: [
            'AI Insight',
            'Market Structure',
            'Key Signals',
            'Synthetic Trend Chart',
            'Forward Outlook',
            'Market Tone',
          ],
        },
        generatedAt: now,
        confidence: null,
        confidenceNote: null,
        riskTapeNote: null,
      };
    }

    try {
      const pack = await this.marketData.getAiInsightPricingBundle(col);
      if (!pack.matched) {
        return {
          title: `${col.displayLabel} — AI Market Brief`,
          summary: tight(
            'Early-cycle tape; momentum forming on thin liquidity.',
            110,
          ),
          bullets: [
            tight('Direction building despite uneven flow.', 85),
            tight(
              'Wait for repeatable sales windows before leaning on premiums.',
              95,
            ),
            tight('Upsize risk only after depth improves.', 78),
          ],
          dynamics: [],
          syntheticChart:
            'rounded consolidation with periodic expansion spikes',
          outlook: tight('Constructive if dips keep clearing.', 100),
          chartSpec: {
            chartStyle: 'Expanded Macro View (Wide X-Axis)',
            trendStructure: [
              'Phase 1: Base build',
              'Phase 2: Expansion pulse',
              'Phase 3: Cooling band',
              'Phase 4: Re-accumulation bias',
            ],
            momentumBehavior:
              'Momentum rotates between expansion and compression cycles.',
            visualInterpretation:
              'Chart forms a broad staircase with temporary consolidation clusters between legs.',
            miniSeries: [20, 21, 22, 23, 24, 23, 24, 25, 24, 25, 26, 27],
            pathRepresentation:
              'Accumulation -> Expansion ↑ -> Consolidation -> Re-expansion bias',
          },
          outlookScenarios: {
            bullCase: tight('Dips absorbed → leg up.', 55),
            baseCase: tight('Grinding range, mild bid.', 55),
            bearCase: tight('Cooling → deeper reset.', 50),
          },
          uiInstructions: {
            loading: {
              style: 'premium-gradient-shimmer',
              scanningEffect: 'crypto-data-scan',
              minDurationMs: 800,
              maxDurationMs: 1500,
            },
            progressiveRenderOrder: [
              'AI Insight',
              'Market Structure',
              'Key Signals',
              'Synthetic Trend Chart',
              'Forward Outlook',
              'Market Tone',
            ],
          },
          generatedAt: now,
          confidence: null,
          confidenceNote: tight(
            'Low market participation — card match or sales feed thin.',
            72,
          ),
          riskTapeNote: null,
          marketTone: 'Illiquid / niche',
          riskScore: null,
          riskLabel: null,
        };
      }

      const stats = pack.stats;
      const participationWeak =
        (stats.sales30d != null && stats.sales30d < 10) ||
        (stats.sales30d != null &&
          stats.sales30d < 8 &&
          (stats.sales7d ?? 0) < 4);
      const dataSparse =
        stats.points90d < 5 ||
        stats.points365d < 8 ||
        (stats.sales30d != null && stats.sales30d < 3);

      const riskPack = this.riskFromTape({
        sales7d: stats.sales7d,
        sales30d: stats.sales30d,
        change7dPct: stats.change7dPct,
        change30dPct: stats.change30dPct,
        change90dPct: stats.change90dPct,
        change365dPct: stats.change365dPct,
      });
      const riskScore = riskPack.score;
      const riskLabel = riskPack.label;
      const riskTapeNote = riskPack.hiddenTape
        ? tight(
            'Hidden tape risk: few recent sales — “low volatility” can be illiquidity, not safety.',
            102,
          )
        : null;

      const marketTone = this.derivePerspective({ stats, riskScore });

      const liqLine =
        stats.sales30d != null
          ? stats.sales30d >= 40
            ? 'Liquidity: healthy 30d sales.'
            : stats.sales30d >= 15
              ? 'Liquidity: moderate 30d sales.'
              : stats.sales30d >= 5
                ? 'Liquidity: thin 30d sales.'
                : 'Liquidity: very thin — prints can mislead.'
          : 'Liquidity: unknown — treat ranges carefully.';

      const premLine = this.describePremium(stats);
      const trendLine = this.trendContextSentence(marketTone, stats);

      const riskLine = riskTapeNote
        ? tight(
            `Tape risk ${riskLabel} (${riskScore}/100) — illiquidity can hide gaps, not safety.`,
            118,
          )
        : tight(`Tape risk ${riskLabel} (${riskScore}/100).`, 88);

      const summary = tight(
        `${col.displayLabel}: ${marketTone}. ${trendLine} ${premLine} ${liqLine} ${riskLine}`.replace(
          /\s+/g,
          ' ',
        ),
        320,
      );

      const flowAndPremium = tight(
        `${premLine ? `${premLine} ` : ''}${liqLine}`.trim(),
        125,
      );
      const bullets: string[] = [
        tight(trendLine, 118),
        flowAndPremium,
        riskLine,
      ];

      const pricingCallout =
        stats.psa10PricingNote === 'history_median_replaces_catalog_anomaly'
          ? tight(
              'PSA 10 uses 90d median — upstream catalog PSA 10 diverged from PSA_10 history.',
              102,
            )
          : stats.psa10PricingNote === 'suppressed_catalog_history_conflict'
            ? tight(
                'PSA 10 withheld: catalog conflicts with PSA_10 tier series — verify card id.',
                98,
              )
            : stats.psa10PriceConfidence === 'low' &&
                stats.psa10SpotUsd != null &&
                stats.psa10PricingNote ===
                  'history_median_thin_catalog_confidence'
              ? tight('PSA 10 from history median — thin verified sales.', 85)
              : null;
      if (pricingCallout)
        bullets[1] = tight(`${pricingCallout} ${bullets[1]}`, 118);

      const confAdj = this.adjustConfidence({
        base: pack.uiConfidence,
        stats,
        lowParticipation: participationWeak,
        dataSparse,
      });

      let syntheticChart: string | undefined;
      if (marketTone === 'Dead cat bounce') {
        syntheticChart =
          'counter-trend bounce inside a larger downtrend — fade risk dominates without fresh momentum';
      } else if (marketTone === 'Uptrend') {
        syntheticChart =
          'controlled stair-step climb with orderly pullbacks and higher lows';
      } else if (marketTone === 'Distribution') {
        syntheticChart =
          'topping process: rallies sold into — lower highs forming on intermediates';
      } else if (marketTone === 'Illiquid / niche') {
        syntheticChart =
          'micro-range noise on minimal volume awaiting real flow';
      } else if (marketTone === 'Cooling') {
        syntheticChart = 'bearish glide with intermittent short-covering pops';
      } else if (
        marketTone === 'Consolidating' ||
        marketTone === 'Accumulation'
      ) {
        syntheticChart =
          'balanced two-way auctions compressing volatility before next impulse';
      } else if (marketTone === 'Overextended') {
        syntheticChart =
          'extended markup seeking mean reversion or volatile pause';
      } else if (marketTone === 'Volatile') {
        syntheticChart =
          'expanding ranges — directional conviction resets frequently';
      } else {
        syntheticChart =
          'two-sided trade with rotational flows between equilibrium bands';
      }

      const outlook =
        marketTone === 'Dead cat bounce'
          ? tight(
              'Fade risk until 365d trend repairs or volume confirms reversal.',
              88,
            )
          : marketTone === 'Uptrend'
            ? tight('Upside if pullbacks stay shallow on volume.', 56)
            : marketTone === 'Distribution'
              ? tight('Suspect rallies — protect until 90d stabilizes.', 56)
              : marketTone === 'Illiquid / niche'
                ? tight(
                    'Wait for repeatable prints before leaning on deltas.',
                    60,
                  )
                : marketTone === 'Cooling'
                  ? tight(
                      'Defensive until buyers reclaim shorter averages.',
                      58,
                    )
                  : marketTone === 'Volatile'
                    ? tight('Size down; trade levels, not stories.', 48)
                    : marketTone === 'Overextended'
                      ? tight('Mean reversion risk — trail risk tightly.', 52)
                      : tight('Balance risk around range edges.', 48);

      const mini = this.miniSeriesByPerspective(marketTone);
      return {
        title: `${col.displayLabel} — AI Market Brief`,
        summary,
        bullets,
        dynamics: [],
        syntheticChart,
        chartSpec: {
          chartStyle: 'Expanded Macro View (Wide X-Axis)',
          trendStructure: [
            'Phase 1: Macro 365d regime',
            'Phase 2: Intermediate 90d rhythm',
            'Phase 3: Recent 7–30d pressure / relief',
            'Phase 4: Liquidity-adjusted read',
          ],
          momentumBehavior:
            marketTone === 'Dead cat bounce'
              ? 'Momentum flips positive on 90d while 365d remains damaged — classic relief bounce dynamics.'
              : marketTone === 'Uptrend'
                ? 'Momentum stacks positively across 30–90d with supportive 365d context.'
                : marketTone === 'Distribution'
                  ? 'Momentum is rolling over on 90d despite a still-positive 365d memory.'
                  : marketTone === 'Illiquid / niche'
                    ? 'Momentum signals are mostly noise — participation is too low to trust slopes.'
                    : marketTone === 'Volatile'
                      ? 'Momentum mean-reverts quickly — expansion cycles dominate.'
                      : marketTone === 'Overextended'
                        ? 'Momentum persists but reacts violently to any supply.'
                        : 'Momentum balances between contraction pockets and bursts.',
          visualInterpretation:
            mini.pathRepresentation.length > 0
              ? tight(mini.pathRepresentation.replace(/ -> /g, ' → '), 200)
              : 'Synthetic path mirrors liquidity-aware interpretation.',
          miniSeries: mini.miniSeries,
          pathRepresentation: mini.pathRepresentation,
        },
        outlook,
        outlookScenarios: {
          bullCase:
            marketTone === 'Dead cat bounce'
              ? tight(
                  'Reversal validates only if highs expand with volume.',
                  62,
                )
              : tight('Flows broaden → continuation.', 42),
          baseCase:
            marketTone === 'Dead cat bounce'
              ? tight('Choppy relief before retest of range lows.', 58)
              : tight('Balanced auctions near fair value.', 40),
          bearCase:
            marketTone === 'Dead cat bounce'
              ? tight('Bounce fails → prior downtrend resumes.', 58)
              : tight('Liquidity fades → sharper reset.', 45),
        },
        uiInstructions: {
          loading: {
            style: 'premium-gradient-shimmer',
            scanningEffect: 'crypto-data-scan',
            minDurationMs: 800,
            maxDurationMs: 1500,
          },
          progressiveRenderOrder: [
            'AI Insight',
            'Market Structure',
            'Key Signals',
            'Synthetic Trend Chart',
            'Forward Outlook',
            'Market Tone',
          ],
        },
        generatedAt: now,
        confidence: confAdj.confidence,
        confidenceNote: confAdj.note,
        riskTapeNote,
        marketTone,
        riskScore,
        riskLabel,
        stats,
      };
    } catch (e) {
      void e;
      return {
        title: `${col.displayLabel} — AI Market Brief`,
        summary: tight(
          `${col.displayLabel}: Brief unavailable — retry shortly.`,
          100,
        ),
        bullets: [tight('This page’s prices and listings stay live.', 80)],
        dynamics: [],
        generatedAt: now,
        confidence: null,
        confidenceNote: null,
        riskTapeNote: null,
        marketTone: null,
        riskScore: null,
        riskLabel: null,
      };
    }
  }
}
