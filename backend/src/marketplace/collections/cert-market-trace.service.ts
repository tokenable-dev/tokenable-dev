import { Injectable } from '@nestjs/common';
import type { PsaAnalyzeResult } from '../../psa/psa.service';
import { PsaService } from '../../psa/psa.service';
import { buildSearchQueryFromParsed } from '../../psa/utils/psa-ocr.util';
import type { MarketplaceCollection } from '../entities/marketplace-collection.entity';
import {
  bucketGradeScoreFromPsaGradeInput,
  psaGradePolicyInputFromGraded,
} from '../utils/psa-grade-policy.util';
import {
  computeMarketBucketKey,
  type MarketBucketComponents,
} from '../utils/bucket-key.util';
import { marketParallelKeyFromPsaVariety } from '../utils/market-parallel-key.util';
import { marketHistoryTierFromComponents } from '../utils/market-history-tier.util';
import type {
  MarketCollectionPreview,
  MarketCompsSnapshot,
  MarketPriceHistoryResult,
} from '../utils/market-reference.types';
import type { MarketHistoryPeriod } from '../utils/price-history-period.util';
import { CardhedgerMarketDataService } from '../market-data/cardhedger-market-data.service';
import type { CertMarketTraceDto } from './dto/cert-market-trace.dto';

function normalizeBucketPart(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function historyPeriodFromMaxDays(maxDays: number): MarketHistoryPeriod {
  const d = Math.min(365, Math.max(1, Math.floor(maxDays)));
  if (d <= 7) return '7d';
  if (d <= 30) return '30d';
  if (d <= 90) return '90d';
  return '1y';
}

export type CertMarketTraceInferredBucket =
  | {
      computed: true;
      bucketKey: string;
      components: MarketBucketComponents;
    }
  | {
      computed: false;
      reason: string;
    };

export interface CertMarketTraceResult {
  meta: {
    certNumberNormalized: string;
    elapsedMs: number;
    historyTier: string;
    historyPeriod: MarketHistoryPeriod;
    historyMaxCalendarDays: number;
    /** Same policy as {@link marketHistoryTierFromComponents} (currently always PSA_10 bucket). */
    historyTierPolicy: 'marketHistoryTierFromComponents';
    /** True when `POST /psa/analyze-by-cert` merged PSA Public API PSACert (needs `PSA_PUBLIC_API_TOKEN`). */
    psaEnrichedFromOfficialApi: boolean;
    /** False when `CARDHEDGER_API_KEY` is missing — `cardhedger` payload is stubbed. */
    cardhedgerEnabled: boolean;
    /**
     * True when synthetic `components` include `psaVariety` (PSA `Variety` / `varietyHint`).
     * Needed for Base vs parallel Cardhedger rows.
     */
    syntheticHasPsaVariety: boolean;
  };
  psaAnalyze: PsaAnalyzeResult;
  syntheticCollection: {
    collectionKey: string;
    displayLabel: string;
    queryUsed: string | null;
    components: Record<string, unknown>;
    coverImageUrl: string | null;
    createdAt: string;
  };
  collectionQuery: ReturnType<
    CardhedgerMarketDataService['buildCollectionQuery']
  >;
  inferredBucket: CertMarketTraceInferredBucket;
  cardhedger: {
    preview: MarketCollectionPreview;
    history: MarketPriceHistoryResult;
    /** `POST /v1/cards/comps` — time-weighted headline + up to 100 raw auction rows. */
    comps: MarketCompsSnapshot;
    /**
     * Daily `prices-by-card` merged with comps raw sales (same pipeline as collection chart snapshots).
     * Calendar-clipped to {@link CertMarketTraceDto.historyMaxCalendarDays}.
     */
    mergedChartPoints: Array<{ t: number; v: number }>;
  };
}

@Injectable()
export class CertMarketTraceService {
  constructor(
    private readonly psaService: PsaService,
    private readonly cardMarket: CardhedgerMarketDataService,
  ) {}

  private inferBucketFromAnalyze(
    analyze: PsaAnalyzeResult,
  ): CertMarketTraceInferredBucket {
    const psa = analyze.psa;
    const base = analyze.identity?.base_card;
    const cardNameRaw = String(
      base?.card_name ?? psa.cardNameHint ?? '',
    ).trim();
    const cardSetRaw = String(base?.set ?? psa.setHint ?? '').trim();
    if (!cardNameRaw) {
      return { computed: false, reason: 'missing_card_name' };
    }
    const score = psa.gradeScore;
    const policyInput = {
      gradingCompany: 'PSA',
      gradeScore: score,
      gradeLabel: psa.gradeLabel,
      gradeDescription: psa.gradeDescription,
    };
    const bucketGrade = bucketGradeScoreFromPsaGradeInput(policyInput);
    if (!bucketGrade) {
      return { computed: false, reason: 'missing_grade_score' };
    }
    const variantType =
      analyze.identity?.variant?.variant_type === 'PSA_DNA'
        ? ('psa_dna' as const)
        : undefined;
    const cardNumRaw = String(
      base?.card_number ?? psa.cardNumberHint ?? '',
    ).trim();
    const cardNumber = cardNumRaw ? normalizeBucketPart(cardNumRaw) : undefined;
    const psaVariety = String(psa.varietyHint ?? '').trim();
    const marketParallelKey = marketParallelKeyFromPsaVariety(psaVariety);
    const pop = psa.totalPopulation;
    const components: MarketBucketComponents = {
      gradingCompany: normalizeBucketPart('PSA'),
      cardName: normalizeBucketPart(cardNameRaw),
      cardSet: normalizeBucketPart(cardSetRaw),
      gradeScore: bucketGrade,
      gradingCompanyDisplay: 'PSA',
      cardNameDisplay: cardNameRaw.replace(/\s+/g, ' ').trim(),
      ...(cardSetRaw
        ? { cardSetDisplay: cardSetRaw.replace(/\s+/g, ' ').trim() }
        : {}),
      ...(variantType ? { variantType } : {}),
      ...(cardNumber ? { cardNumber } : {}),
      marketParallelKey,
      ...(typeof pop === 'number' &&
      Number.isFinite(pop) &&
      pop >= 0 &&
      Math.floor(pop) === pop
        ? { psaTotalPopulation: Math.floor(pop) }
        : {}),
    };
    return {
      computed: true,
      components,
      bucketKey: computeMarketBucketKey(components),
    };
  }

  private buildSyntheticCollection(
    analyze: PsaAnalyzeResult,
  ): MarketplaceCollection {
    const psa = analyze.psa;
    const mint = analyze.cardhedgerMint;
    const base = analyze.identity?.base_card;

    const cardName = String(base?.card_name ?? psa.cardNameHint ?? '').trim();
    const cardSet = String(base?.set ?? psa.setHint ?? '').trim();
    const cardNumber = String(base?.card_number ?? psa.cardNumberHint ?? '')
      .replace(/^#/, '')
      .trim();

    const gradeScore =
      typeof psa.gradeScore === 'number' && Number.isFinite(psa.gradeScore)
        ? psa.gradeScore
        : undefined;
    const policyInput = {
      gradingCompany: 'psa',
      gradeScore: gradeScore ?? psa.gradeScore,
      gradeLabel: psa.gradeLabel,
      gradeDescription: psa.gradeDescription,
    };
    const bucketGrade = bucketGradeScoreFromPsaGradeInput(policyInput);

    const certKey = String(psa.certNumber ?? '')
      .replace(/\D/g, '')
      .slice(0, 32);

    const components: Record<string, unknown> = {
      gradingCompany: 'psa',
      cardName,
      cardSet,
      ...(cardNumber ? { cardNumber } : {}),
      ...(bucketGrade ? { gradeScore: bucketGrade } : {}),
      ...(typeof psa.gradeLabel === 'string' && psa.gradeLabel.trim()
        ? { psaGradeLabel: psa.gradeLabel.trim() }
        : {}),
      ...(typeof psa.gradeDescription === 'string' && psa.gradeDescription.trim()
        ? { psaGradeDescription: psa.gradeDescription.trim() }
        : {}),
      ...(mint?.cardId?.trim() ? { cardhedgerCardId: mint.cardId.trim() } : {}),
      ...(mint?.searchQuery?.trim()
        ? { cardhedgerSearchQuery: mint.searchQuery.trim() }
        : {}),
      ...(typeof psa.specId === 'number' && Number.isFinite(psa.specId)
        ? { psaSpecId: String(Math.floor(psa.specId)) }
        : {}),
    };

    /** Align with mint IPFS `graded.psa` mirror → {@link CardhedgerMarketDataService.buildCollectionQuery} parallel gate. */
    if (typeof psa.varietyHint === 'string' && psa.varietyHint.trim()) {
      components.psaVariety = psa.varietyHint.trim().replace(/\s+/g, ' ');
    }
    components.marketParallelKey = marketParallelKeyFromPsaVariety(
      String(components.psaVariety ?? ''),
    );
    if (typeof psa.cardNameHint === 'string' && psa.cardNameHint.trim()) {
      components.psaSubject = psa.cardNameHint.trim();
    }
    if (typeof psa.setHint === 'string' && psa.setHint.trim()) {
      components.psaBrand = psa.setHint.trim();
    }
    if (typeof psa.year === 'string' && psa.year.trim()) {
      components.psaYear = psa.year.trim();
    }

    const displayLabel =
      [cardName, cardNumber ? `#${cardNumber}` : '']
        .filter(Boolean)
        .join(' ')
        .trim() ||
      base?.base_identity?.trim() ||
      mint?.searchQuery?.trim() ||
      (psa.certNumber ? `PSA ${psa.certNumber}` : 'Cert market trace');

    const queryUsed =
      mint?.searchQuery?.trim() ||
      [cardName, cardNumber, cardSet].filter(Boolean).join(' ').trim() ||
      buildSearchQueryFromParsed(psa) ||
      null;

    const coverImageUrl =
      mint?.imageUrl?.trim() || analyze.psaCertImages?.front || null;

    return {
      collectionKey: certKey
        ? `cert_trace_${certKey}`
        : `cert_trace_${Date.now()}`,
      displayLabel,
      queryUsed,
      components,
      coverImageUrl,
      createdAt: new Date(),
    } as MarketplaceCollection;
  }

  async trace(dto: CertMarketTraceDto): Promise<CertMarketTraceResult> {
    const t0 = Date.now();
    const maxDays = Math.min(
      365,
      Math.max(1, Math.floor(dto.historyMaxCalendarDays ?? 90)),
    );
    const period = historyPeriodFromMaxDays(maxDays);

    const psaAnalyze = await this.psaService.analyzeByCertNumber(
      dto.certNumber,
    );
    const synthetic = this.buildSyntheticCollection(psaAnalyze);
    const tier = marketHistoryTierFromComponents(synthetic.components);

    const [bundled, inferredBucket] = await Promise.all([
      this.cardMarket.getBundledCardData(synthetic, {
        tier,
        period,
        maxCalendarDays: maxDays,
        includeComps: true,
      }),
      Promise.resolve(this.inferBucketFromAnalyze(psaAnalyze)),
    ]);

    const cardhedger = {
      preview: bundled.preview,
      history: bundled.history,
      comps: bundled.comps,
      mergedChartPoints: bundled.history.points ?? [],
    };

    const certNorm = String(psaAnalyze.psa.certNumber ?? '').trim();
    const synComp = synthetic.components as Record<string, unknown>;

    return {
      meta: {
        certNumberNormalized: certNorm,
        elapsedMs: Date.now() - t0,
        historyTier: tier,
        historyPeriod: period,
        historyMaxCalendarDays: maxDays,
        historyTierPolicy: 'marketHistoryTierFromComponents',
        psaEnrichedFromOfficialApi: Boolean(
          psaAnalyze.psa.enrichedFromOfficialApi,
        ),
        cardhedgerEnabled: this.cardMarket.isConfigured(),
        syntheticHasPsaVariety:
          typeof synComp.psaVariety === 'string' &&
          Boolean(String(synComp.psaVariety).trim()),
      },
      psaAnalyze,
      syntheticCollection: {
        collectionKey: synthetic.collectionKey,
        displayLabel: synthetic.displayLabel,
        queryUsed: synthetic.queryUsed,
        components: synthetic.components,
        coverImageUrl: synthetic.coverImageUrl,
        createdAt: synthetic.createdAt.toISOString(),
      },
      collectionQuery: this.cardMarket.buildCollectionQuery(synthetic),
      inferredBucket,
      cardhedger,
    };
  }
}
