import { Injectable } from '@nestjs/common';
import { CardhedgerService } from '../../cardhedger/cardhedger.service';
import type { MarketplaceCollection } from '../entities/marketplace-collection.entity';
import { CardhedgerMarketDataService } from './cardhedger-market-data.service';

type CardhedgerCardRow = Record<string, unknown>;

/** Single-line-ish copy cap for skim-friendly UI */
function tight(s: string, maxLen: number): string {
  const t = String(s).replace(/\s+/g, ' ').trim();
  if (!t.length) return t;
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1).trimEnd()}…`;
}

@Injectable()
export class CardhedgerAiInsightService {
  constructor(
    private readonly cardhedger: CardhedgerService,
    private readonly marketData: CardhedgerMarketDataService,
  ) {}

  private clamp01to100(v: number): number {
    if (!Number.isFinite(v)) return 0;
    return Math.min(100, Math.max(0, v));
  }

  private classifyMarketTone(input: {
    change7dPct: number | null;
    change30dPct: number | null;
    change90dPct: number | null;
  }): 'Bullish' | 'Neutral' | 'Bearish' | 'Consolidation' {
    const c7 = input.change7dPct ?? 0;
    const c30 = input.change30dPct ?? 0;
    const c90 = input.change90dPct ?? 0;
    if (c30 >= 10 && c90 >= 18) return 'Bullish';
    if (c30 <= -8 && c7 <= -3) return 'Bearish';
    if (Math.abs(c30) <= 4 && Math.abs(c90) <= 8) return 'Consolidation';
    return 'Neutral';
  }

  private riskScoreFromLiquidityVolatility(input: {
    sales30d: number | null;
    change30dPct: number | null;
    change90dPct: number | null;
  }): { score: number | null; label: 'Low' | 'Medium' | 'High' | null } {
    const sales30 = input.sales30d;
    const c30 = Math.abs(input.change30dPct ?? 0);
    const c90 = Math.abs(input.change90dPct ?? 0);
    const volatilityScore = this.clamp01to100(c30 * 2.4 + c90 * 1.6);
    const liquidityScore =
      sales30 != null && Number.isFinite(sales30) && sales30 >= 0
        ? this.clamp01to100(Math.log10(sales30 + 1) * 40)
        : 35;
    const risk = this.clamp01to100(volatilityScore * 0.55 + (100 - liquidityScore) * 0.45);
    const score = Math.round(risk);
    const label = score >= 67 ? 'High' : score >= 34 ? 'Medium' : 'Low';
    return { score, label };
  }

  private miniSeriesByTone(
    tone:
      | 'Bullish'
      | 'Neutral'
      | 'Bearish'
      | 'Consolidation'
      | 'Cooling'
      | 'Consolidating'
      | 'Overextended'
      | 'Accumulating'
      | 'Volatile'
      | null,
  ): { miniSeries: number[]; pathRepresentation: string } {
    if (tone === 'Bullish') {
      return {
        miniSeries: [18, 19, 20, 21, 22, 24, 25, 26, 27, 28, 29, 30],
        pathRepresentation:
          'Low -> Accumulation -> Expansion ↑↑ -> Consolidation -> Breakout pressure ↑',
      };
    }
    if (tone === 'Bearish' || tone === 'Cooling') {
      return {
        miniSeries: [31, 30, 29, 28, 27, 26, 25, 25, 24, 23, 22, 21],
        pathRepresentation:
          'Peak -> Distribution -> Breakdown ↓ -> Lower range -> Continued weakness',
      };
    }
    if (tone === 'Consolidation' || tone === 'Consolidating') {
      return {
        miniSeries: [24, 24, 25, 24, 25, 24, 25, 25, 24, 25, 26, 26],
        pathRepresentation:
          'Range -> Compression -> Oscillation -> Range-bound structure',
      };
    }
    if (tone === 'Overextended') {
      return {
        miniSeries: [18, 19, 21, 24, 27, 29, 28, 30, 27, 28, 27, 26],
        pathRepresentation:
          'Low -> Expansion spike ↑↑ -> Volatile retest -> Re-balance zone',
      };
    }
    if (tone === 'Volatile') {
      return {
        miniSeries: [24, 27, 23, 28, 22, 27, 23, 26, 24, 27, 23, 25],
        pathRepresentation:
          'Wide range -> Expansion/Compression swings -> Directional bias pending',
      };
    }
    return {
      miniSeries: [22, 22, 23, 23, 24, 24, 24, 25, 25, 25, 26, 26],
      pathRepresentation:
        'Base -> Gradual expansion -> Mild consolidation -> Upward bias',
    };
  }

  private toneLabelForUi(input: {
    marketTone: 'Bullish' | 'Neutral' | 'Bearish' | 'Consolidation' | null;
    riskLabel: 'Low' | 'Medium' | 'High' | null;
  }): 'Bullish' | 'Cooling' | 'Consolidating' | 'Overextended' | 'Accumulating' | 'Volatile' {
    if (input.riskLabel === 'High' && input.marketTone === 'Bullish') return 'Overextended';
    if (input.riskLabel === 'High') return 'Volatile';
    if (input.marketTone === 'Bullish') return 'Bullish';
    if (input.marketTone === 'Bearish') return 'Cooling';
    if (input.marketTone === 'Consolidation') return 'Consolidating';
    return 'Accumulating';
  }

  async getAiInsightForCollection(
    col: MarketplaceCollection | null,
  ): Promise<{
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
    marketTone?: 'Bullish' | 'Cooling' | 'Consolidating' | 'Overextended' | 'Accumulating' | 'Volatile' | null;
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
        syntheticChart: 'early base-building with shallow swings and gradual range definition',
        outlook: tight('Trend firms as buys/sells widen.', 100),
        chartSpec: {
          chartStyle: 'Expanded Macro View (Wide X-Axis)',
          trendStructure: [
            'Phase 1: Accumulation / base formation',
            'Phase 2: Early expansion attempt',
            'Phase 3: Controlled consolidation pocket',
            'Phase 4: Current positioning in price discovery',
          ],
          momentumBehavior: 'Momentum is compressing, then re-expanding in short bursts.',
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
        syntheticChart: 'forming trend channel with intermittent consolidation pockets',
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
      };
    }

    const q = this.marketData.buildCollectionQuery(col);
    const query =
      q.cardhedgerSearchQuery || q.query || String(col.displayLabel ?? '').trim();
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
          momentumBehavior: 'Momentum is compressing and preparing for directional release.',
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
      };
    }

    try {
      const body = await this.cardhedger.forwardJson('POST', '/v1/cards/card-match', {
        body: { query },
      });
      const match =
        typeof body === 'object' && body != null
          ? ((body as { match?: unknown }).match as Record<string, unknown> | undefined)
          : undefined;
      if (!match) {
        return {
          title: `${col.displayLabel} — AI Market Brief`,
          summary: tight(
            'Early-cycle tape; momentum forming on thin liquidity.',
            110,
          ),
          bullets: [
            tight('Direction building despite uneven flow.', 85),
            tight('Premium points to conviction buyers.', 80),
            tight('Upside needs liquidity post-pullback.', 85),
          ],
          dynamics: [],
          syntheticChart: 'rounded consolidation with periodic expansion spikes',
          outlook: tight('Constructive if dips keep clearing.', 100),
          chartSpec: {
            chartStyle: 'Expanded Macro View (Wide X-Axis)',
            trendStructure: [
              'Phase 1: Base build',
              'Phase 2: Expansion pulse',
              'Phase 3: Cooling band',
              'Phase 4: Re-accumulation bias',
            ],
            momentumBehavior: 'Momentum rotates between expansion and compression cycles.',
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
        };
      }
      const confidenceRaw = match.confidence;
      const confidence =
        typeof confidenceRaw === 'number' && Number.isFinite(confidenceRaw)
          ? confidenceRaw
          : null;
      const cardId =
        typeof match.card_id === 'string' && match.card_id.trim()
          ? match.card_id.trim()
          : null;
      const reasoning =
        typeof match.reasoning === 'string' && match.reasoning.trim()
          ? match.reasoning.trim()
          : 'Cardhedger returned a directional read for this collection match.';
      let summary = tight(reasoning, 220);
      const bullets = [
        tight(`${col.displayLabel}: Cardhedger match — directional hint only.`, 82),
        confidence != null
          ? tight(`~${Math.round(confidence * 100)}% match confidence.`, 72)
          : tight('Weak catalog match.', 48),
      ];

      let stats:
        | {
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
          }
        | undefined;
      let marketTone: 'Bullish' | 'Cooling' | 'Consolidating' | 'Overextended' | 'Accumulating' | 'Volatile' | null = null;
      let riskScore: number | null = null;
      let riskLabel: 'Low' | 'Medium' | 'High' | null = null;
      let dynamics: string[] = [];
      let syntheticChart: string | undefined;
      let outlook: string | undefined;
      if (cardId) {
        try {
          const allPrices = await this.marketData.fetchAllPricesByCard(cardId);
          const merged =
            allPrices.length > 0
              ? ({ ...(match as Record<string, unknown>), prices: allPrices } as CardhedgerCardRow)
              : (match as CardhedgerCardRow);
          const psa10Spot = this.marketData.readGradePrice(merged, 'PSA 10');
          const rawSpot = this.marketData.readGradePrice(merged, 'Raw');
          const h90 = await this.marketData.fetchTierHistoryByCard(cardId, 'PSA_10', 90);
          const h365 = await this.marketData.fetchTierHistoryByCard(cardId, 'PSA_10', 365);
          const change90 = this.marketData.pctFromPoints(h90);
          const change365 = this.marketData.pctFromPoints(h365);
          const change7 =
            typeof merged.gain === 'number' && Number.isFinite(merged.gain)
              ? Number(merged.gain)
              : null;
          const change30 =
            typeof merged.gain_30day === 'number' && Number.isFinite(merged.gain_30day)
              ? Number(merged.gain_30day)
              : null;
          const sales30 =
            typeof merged['30 Day Sales'] === 'number' ? Number(merged['30 Day Sales']) : null;
          stats = {
            psa10SpotUsd: psa10Spot,
            rawSpotUsd: rawSpot,
            premiumVsRawPct: this.marketData.premiumPct(psa10Spot, rawSpot),
            sales7d:
              typeof merged['7 Day Sales'] === 'number'
                ? Number(merged['7 Day Sales'])
                : null,
            sales30d: sales30,
            change7dPct: change7,
            change30dPct: change30,
            change90dPct: change90,
            change365dPct: change365,
            points90d: h90.length,
            points365d: h365.length,
          };
          const structuralTone = this.classifyMarketTone({
            change7dPct: stats.change7dPct,
            change30dPct: stats.change30dPct,
            change90dPct: stats.change90dPct,
          });
          const risk = this.riskScoreFromLiquidityVolatility({
            sales30d: stats.sales30d,
            change30dPct: stats.change30dPct,
            change90dPct: stats.change90dPct,
          });
          riskScore = risk.score;
          riskLabel = risk.label;
          marketTone = this.toneLabelForUi({
            marketTone: structuralTone,
            riskLabel,
          });
          const shortTerm =
            stats.change7dPct != null
              ? stats.change7dPct >= 6
                ? 'strong upside momentum'
                : stats.change7dPct <= -4
                  ? 'clear short-term cooling'
                  : 'range-bound short-term action'
              : 'limited short-term visibility';
          const longTermShort =
            stats.change90dPct != null
              ? stats.change90dPct >= 15
                ? '90d uptrend intact'
                : stats.change90dPct <= -10
                  ? '90d pressured'
                  : '90d rangey'
              : '90d data thin';
          const premShort =
            stats.premiumVsRawPct != null
              ? stats.premiumVsRawPct >= 80
                ? 'Extreme PSA vs raw.'
                : stats.premiumVsRawPct >= 25
                  ? 'Solid PSA uplift.'
                  : 'Tight PSA vs raw.'
              : '';
          const liqShort =
            stats.sales30d != null
              ? stats.sales30d >= 50
                ? 'Strong 30d sales.'
                : stats.sales30d >= 20
                  ? 'OK 30d sales.'
                  : 'Thin 30d sales.'
              : '';

          summary = tight(
            `${col.displayLabel}: ${marketTone}. ${shortTerm}; ${longTermShort}.${premShort ? ` ${premShort}` : ''} ${liqShort} Risk: ${riskLabel ?? '?'}.`.replace(/\s+/g, ' ').trim(),
            260,
          );
          dynamics = [];
          bullets.splice(0, bullets.length);
          bullets.push(tight(`${shortTerm} · ${longTermShort}`, 105));
          bullets.push(tight(liqShort || '30d liquidity unknown.', 85));
          bullets.push(
            tight(
              premShort
                ? `${premShort} Risk ${riskLabel} (${riskScore ?? '–'}/100).`
                : `Risk ${riskLabel} (${riskScore ?? '–'}/100).`,
              115,
            ),
          );
          syntheticChart =
            marketTone === 'Bullish'
              ? 'gradual upward continuation with intermittent consolidation zones'
              : marketTone === 'Cooling'
                ? 'cooling downtrend with reactive rebounds into lower-volatility bands'
                : marketTone === 'Consolidating'
                  ? 'rounded consolidation after prior expansion, with breakout pressure building'
                  : marketTone === 'Overextended'
                    ? 'steep expansion followed by choppy pullback-retest behavior'
                    : marketTone === 'Volatile'
                      ? 'wide oscillation channel with momentum expansion/compression swings'
                  : 'stair-step advance with alternating compression and expansion pockets';
          outlook =
            marketTone === 'Bullish'
              ? tight('Upside if dips clear on volume.', 55)
              : marketTone === 'Cooling'
                ? tight('Weak until buyers reload.', 50)
                : marketTone === 'Consolidating'
                  ? tight('Range — wait breakout.', 45)
                  : marketTone === 'Overextended'
                    ? tight('Stretched tape — pullback risk.', 50)
                    : marketTone === 'Volatile'
                      ? tight('Volatile — smaller size.', 45)
                      : tight('Neutral — need confirmation.', 50);
          const mini = this.miniSeriesByTone(marketTone);
          return {
            title: `${col.displayLabel} — AI Market Brief`,
            summary,
            bullets,
            dynamics,
            syntheticChart,
            chartSpec: {
              chartStyle: 'Expanded Macro View (Wide X-Axis)',
              trendStructure: [
                'Phase 1: Accumulation / base formation',
                'Phase 2: Expansion / breakout move',
                'Phase 3: Consolidation / cooling zone',
                'Phase 4: Current positioning',
              ],
              momentumBehavior:
                marketTone === 'Bullish'
                  ? 'Momentum is expanding with brief compression between continuation legs.'
                  : marketTone === 'Cooling'
                    ? 'Momentum is contracting, with rebounds absorbed into lower-volatility bands.'
                    : marketTone === 'Consolidating'
                      ? 'Momentum is compressing inside consolidation, with breakout pressure gradually building.'
                      : marketTone === 'Overextended'
                        ? 'Momentum remains elevated but increasingly unstable, with stronger pullback sensitivity.'
                        : marketTone === 'Volatile'
                          ? 'Momentum alternates between sharp expansion and fast compression inside a wide channel.'
                      : 'Momentum alternates between expansion bursts and stabilization pockets.',
              visualInterpretation:
                marketTone === 'Bullish'
                  ? 'Price action forms a wide staircase structure with intermittent consolidation zones, indicating controlled expansion.'
                  : marketTone === 'Cooling'
                    ? 'Structure leans into cooling drift with reactive rebounds that fail to establish sustained expansion.'
                    : marketTone === 'Consolidating'
                      ? 'A rounded consolidation band is visible after expansion, with directional energy coiling near the upper range.'
                      : marketTone === 'Overextended'
                        ? 'A steep breakout leg appears followed by volatile retests, resembling an overextended channel seeking re-balance.'
                        : marketTone === 'Volatile'
                          ? 'Chart resembles a broad oscillation channel with frequent regime shifts between expansion and compression.'
                      : 'A broad trend channel is forming with alternating compression and expansion regimes.',
              miniSeries: mini.miniSeries,
              pathRepresentation: mini.pathRepresentation,
            },
            outlook,
            outlookScenarios: {
              bullCase: tight('Bids hold → upside leg.', 50),
              baseCase: tight('Grind sideways.', 35),
              bearCase: tight('Demand fades → slip.', 40),
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
            confidence,
            marketTone,
            riskScore,
            riskLabel,
            stats,
          };
        } catch {
          // Keep AI result available even when metric enrichment fails.
        }
      }

      return {
        title: `${col.displayLabel} — AI Market Brief`,
        summary: tight(
          reasoning.toLowerCase().startsWith(col.displayLabel.toLowerCase())
            ? reasoning
            : `${col.displayLabel}: ${reasoning}`,
          240,
        ),
        bullets,
        dynamics,
        syntheticChart: 'early-stage trend channel with low-frequency expansion pulses',
        outlook: tight(
          'Direction needs volume — watch absorption vs fade.',
          90,
        ),
        chartSpec: {
          chartStyle: 'Expanded Macro View (Wide X-Axis)',
          trendStructure: [
            'Phase 1: Early accumulation',
            'Phase 2: Initial expansion',
            'Phase 3: Cooling consolidation',
            'Phase 4: Positioning for next leg',
          ],
          momentumBehavior:
            tight('Momentum: expansion attempts, not sustained yet.', 80),
          visualInterpretation: tight(
            'Shallow up-channel with consolidation shelves.',
            85,
          ),
          miniSeries: [20, 20, 21, 21, 22, 22, 23, 23, 24, 24, 25, 25],
          pathRepresentation:
            'Base -> Expansion probes -> Consolidation shelf -> Constructive drift',
        },
        outlookScenarios: {
          bullCase: tight('Flows align → grind up.', 50),
          baseCase: tight('Sideways chop.', 40),
          bearCase: tight('Cooling pullback first.', 50),
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
        confidence,
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
        marketTone: null,
        riskScore: null,
        riskLabel: null,
      };
    }
  }
}
