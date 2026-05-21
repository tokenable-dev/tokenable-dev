/* eslint-disable @typescript-eslint/no-base-to-string -- Cardhedger API payloads are loosely typed; string coercion is intentional for keys and logging. */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  TTL_CACHE_PROVIDER,
  type TtlCacheProvider,
} from '../../common/cache/ttl-cache.interface';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { CardhedgerService } from '../../cardhedger/cardhedger.service';
import {
  mergePsaApiIntoParsed,
  PsaPublicApiService,
} from '../../psa/psa-public-api.service';
import type { ParsedPsaLabel } from '../../psa/utils/psa-ocr.util';
import type { MarketplaceCollection } from '../entities/marketplace-collection.entity';
import {
  normalizeForExactCardNumberKey,
  normalizeForExactCatalogMatch,
  primaryCardNumber,
} from '../utils/card-match.util';
import { extractBucketComponentsFromMetadata } from '../utils/bucket-key.util';
import { marketHistoryTierFromComponents } from '../utils/market-history-tier.util';
import { cardhedgerGradeFromHistoryTier } from '../utils/psa-grade-policy.util';
import type {
  MarketCollectionPreview,
  MarketPriceHistoryResult,
} from '../utils/market-reference.types';
import type { MarketHistoryPeriod } from '../utils/price-history-period.util';
import { readPsaSpecIdCardhedgerMapFromConfig } from '../utils/psa-spec-cardhedger-map.util';
import { cardhedgerRowMatchesPsaVariety } from '../utils/cardhedger-psa-variety.util';
import {
  psaVarietyIsGenericSportRefractorLine,
  psaVarietyIsIllustrationRareLabel,
  psaVarietyIsSpecialIllustrationRareLabel,
  psaVarietyRequiresNonBaseCardhedgerRow,
} from '../../psa/psa-variety-catalog.util';
import { varietyHintsForSearch } from '../../psa/utils/psa-ocr.util';

export type AiInsightPsa10PriceConfidence = 'high' | 'medium' | 'low';

export interface CollectionAiInsightPricingStats {
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
  psa10PriceConfidence: AiInsightPsa10PriceConfidence | null;
  psa10PricingNote: string | null;
  psa10SpotLowUsd: number | null;
  psa10SpotHighUsd: number | null;
  psa10CatalogUsd: number | null;
  /** PSA line population from collection components when persisted (premium context). */
  psaTotalPopulation: number | null;
}

type CardhedgerCardRow = Record<string, unknown>;

type CardhedgerCompsHeadline = {
  usd: number;
  latestSaleAtSec: number | null;
  countUsed: number;
};

/** Cached `POST /v1/cards/comps` payload slice — headline + optional raw sale points for charts. */
type CardhedgerCompsCached = {
  headline: CardhedgerCompsHeadline | null;
  rawPoints: Array<{ t: number; v: number }>;
};

/**
 * Card Hedge `POST /v1/cards/prices-by-card` documents rolling `days` in [1, **365**] only.
 */
const CARDHEDGER_PRICES_BY_CARD_MAX_DAYS = 365;

/** PSA 10 headline via `POST /v1/cards/comps` — upstream allows count in [1, 100]. */
const CARDHEDGER_COMPS_HEADLINE_COUNT = 15;

/**
 * `POST /v1/cards/card-search` — slightly larger page so niche Brand/Subject lines still surface
 * a usable row after broader PSA-derived queries.
 */
const CARDHEDGER_CARD_SEARCH_PAGE_SIZE = 35;

/**
 * How to map `/v1/cards/comps` into the published PSA 10 “spot” when `raw_prices` is present:
 * - `last_raw_comp`: use the chronologically last eBay comp in `raw_prices` (literal last sale).
 * - `time_weighted`: use Cardhedger `comp_price` (`time_weighted: true`) — a smoothed figure that can
 *   sit **below** the latest auction on liquid cards.
 *
 * Override with env `CARDHEDGER_PSA10_SPOT_BASIS=time_weighted` to restore the old headline.
 */
type CardhedgerPsa10SpotBasis = 'last_raw_comp' | 'time_weighted';

/**
 * When Cardhedger returns this many or fewer positive sale/sample points, use arithmetic mean
 * instead of a single last observation (comps raw → then PSA 10 history).
 */
const SPARSE_SALE_POINTS_MAX = 5;

/** Catalog PSA 10 vs PSA_10 tier rolling history — beyond this ratio we distrust catalog. */
const DEFAULT_AI_INSIGHT_HIST_ANOMALY_RATIO = 5;
const AI_INSIGHT_MEDIAN_MIN_POINTS = 3;
const AI_INSIGHT_MEDIAN_FALLBACK_MIN_POINTS = 5;

/** Return type of resolveCardForCollection — used for the shared resolve cache and getBundledCardData. */
type ResolvedCard = {
  query: string;
  row: CardhedgerCardRow | null;
  confidence?: 'verified' | 'approximate';
};

@Injectable()
export class CardhedgerMarketDataService {
  private readonly logger = new Logger(CardhedgerMarketDataService.name);
  private readonly psaSpecIdMap = new Map<string, string>();

  // TTL-based caches to avoid unbounded memory growth and serve stale data during Cardhedger outages.
  private readonly PRICES_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
  private readonly RESOLVE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
  private readonly MIN_RELIABLE_SALES_30D: number;
  /**
   * Minimum 30-day sales required even for `verified` confidence matches.
   * Prevents stale catalog prices (e.g. low-population rare cards) from surfacing
   * as market price when no recent trades have occurred.
   * Defaults to 1; set CARDHEDGER_MIN_VERIFIED_SALES_30D=0 to restore old behaviour.
   */
  private readonly MIN_VERIFIED_SALES_30D: number;
  /** Max ratio between catalog PSA 10 slot and PSA_10 history median before anomaly handling. */
  private readonly AI_INSIGHT_HIST_ANOMALY_RATIO: number;
  private readonly PSA10_SPOT_BASIS: CardhedgerPsa10SpotBasis;
  /**
   * When using `last_raw_comp`: if last print / Cardhedger headline is below this fraction,
   * prefer time-weighted headline (`comp_price`). Example 0.48 → last &lt; 48% of headline ⇒ outlier.
   */
  private readonly LAST_COMP_LOW_VS_HEADLINE_FRAC: number;
  /**
   * When liquid: if last print is below this fraction of the median of the last {@link MEDIAN_RAW_COMPS_WINDOW}
   * raw comps, use that median instead (guards one bad tick vs the recent mass).
   */
  private readonly LAST_COMP_LOW_VS_MEDIAN_FRAC: number;
  private readonly MEDIAN_RAW_COMPS_WINDOW: number;
  private static readonly NS_ALL_PRICES = 'cardhedger:allPrices';
  private static readonly NS_TIER_HISTORY = 'cardhedger:tierHistory';
  private static readonly NS_COMPS = 'cardhedger:comps';
  private static readonly NS_RESOLVE = 'cardhedger:resolve';

  constructor(
    private readonly cardhedger: CardhedgerService,
    private readonly blockchain: BlockchainService,
    private readonly config: ConfigService,
    private readonly psaPublicApi: PsaPublicApiService,
    @Inject(TTL_CACHE_PROVIDER) private readonly ttlCache: TtlCacheProvider,
  ) {
    this.psaSpecIdMap = readPsaSpecIdCardhedgerMapFromConfig(this.config);
    this.MIN_RELIABLE_SALES_30D = Math.max(
      0,
      Number(
        this.config.get<string>('CARDHEDGER_MIN_RELIABLE_SALES_30D') ?? 5,
      ) || 5,
    );
    this.MIN_VERIFIED_SALES_30D = Math.max(
      0,
      Number(
        this.config.get<string>('CARDHEDGER_MIN_VERIFIED_SALES_30D') ?? 5,
      ) || 5,
    );
    this.AI_INSIGHT_HIST_ANOMALY_RATIO = Math.max(
      2,
      Number(
        this.config.get<string>('CARDHEDGER_AI_PSA_HISTORY_ANOMALY_RATIO'),
      ) || DEFAULT_AI_INSIGHT_HIST_ANOMALY_RATIO,
    );
    {
      const raw = this.config
        .get<string>('CARDHEDGER_PSA10_SPOT_BASIS')
        ?.trim()
        .toLowerCase();
      this.PSA10_SPOT_BASIS =
        raw === 'time_weighted' ? 'time_weighted' : 'last_raw_comp';
    }
    const clampFrac = (n: number, def: number): number => {
      if (!Number.isFinite(n) || n <= 0 || n >= 1) return def;
      return n;
    };
    this.LAST_COMP_LOW_VS_HEADLINE_FRAC = clampFrac(
      Number(
        this.config.get<string>(
          'CARDHEDGER_LAST_COMP_LOW_VS_HEADLINE_FRAC',
        ) ?? '0.48',
      ),
      0.48,
    );
    this.LAST_COMP_LOW_VS_MEDIAN_FRAC = clampFrac(
      Number(
        this.config.get<string>(
          'CARDHEDGER_LAST_COMP_LOW_VS_MEDIAN_FRAC',
        ) ?? '0.55',
      ),
      0.55,
    );
    this.MEDIAN_RAW_COMPS_WINDOW = Math.max(
      5,
      Math.min(
        31,
        Math.floor(
          Number(this.config.get<string>('CARDHEDGER_MEDIAN_RAW_COMPS_WINDOW')) ||
            15,
        ) || 15,
      ),
    );
  }

  isConfigured(): boolean {
    try {
      this.cardhedger.assertConfigured();
      return true;
    } catch {
      return false;
    }
  }

  buildCollectionQuery(col: MarketplaceCollection | null): {
    query: string;
    cardName: string;
    cardSet: string;
    cardNumber: string;
    cardhedgerCardId: string | null;
    cardhedgerSearchQuery: string | null;
    psaSpecId: string | null;
    /** IPFS `metadata.name` from first listing — aligns Cardhedger discovery with in-app RWA titles. */
    listingDisplayTitle: string | null;
    /** PSA `PSACert.Variety` (or mint mirror) — sole source for insert vs base Cardhedger alignment. */
    psaVariety: string | null;
    /** PSA `Subject` when persisted from mint/API mirror. */
    psaSubject: string | null;
    /** PSA `Brand` when persisted. */
    psaBrand: string | null;
    /** PSA `Year` / `YearIssued` when persisted. */
    psaYear: string | null;
  } {
    const comp = col?.components ?? {};
    const cardName = String(comp.cardName ?? '').trim();
    const cardSet = String(comp.cardSet ?? '').trim();
    const cardNumber = String(comp.cardNumber ?? '').trim();
    const cardhedgerCardId =
      typeof comp.cardhedgerCardId === 'string' && comp.cardhedgerCardId.trim()
        ? comp.cardhedgerCardId.trim()
        : null;
    const cardhedgerSearchQuery =
      typeof comp.cardhedgerSearchQuery === 'string' &&
      comp.cardhedgerSearchQuery.trim()
        ? comp.cardhedgerSearchQuery.trim()
        : null;
    const psaSpecId =
      typeof comp.psaSpecId === 'string' && comp.psaSpecId.trim()
        ? comp.psaSpecId.trim()
        : typeof comp.psaSpecId === 'number' && Number.isFinite(comp.psaSpecId)
          ? String(Math.floor(comp.psaSpecId))
          : null;
    const listingRaw = comp['listingDisplayTitle'];
    const listingDisplayTitle =
      typeof listingRaw === 'string' && listingRaw.trim()
        ? listingRaw.trim().replace(/\s+/g, ' ')
        : null;
    const psaVarietyRaw = comp['psaVariety'];
    const psaVariety =
      typeof psaVarietyRaw === 'string' && psaVarietyRaw.trim()
        ? psaVarietyRaw.trim()
        : null;
    const psaSubjectRaw = comp['psaSubject'];
    const psaSubject =
      typeof psaSubjectRaw === 'string' && psaSubjectRaw.trim()
        ? psaSubjectRaw.trim()
        : null;
    const psaBrandRaw = comp['psaBrand'];
    const psaBrand =
      typeof psaBrandRaw === 'string' && psaBrandRaw.trim()
        ? psaBrandRaw.trim()
        : null;
    const psaYearRaw = comp['psaYear'];
    const psaYear =
      typeof psaYearRaw === 'string' && psaYearRaw.trim()
        ? psaYearRaw.trim()
        : typeof psaYearRaw === 'number' && Number.isFinite(psaYearRaw)
          ? String(Math.floor(psaYearRaw))
          : null;

    const queryPrimary = [cardName, cardNumber, cardSet]
      .filter(Boolean)
      .join(' ')
      .trim();
    /** Fall back to PSA mirrors when mint/IPFS omit card.name/set (cert-trace / DNA / non-sport). */
    const queryFromPsa = [psaSubject, cardNumber, psaBrand]
      .filter(Boolean)
      .join(' ')
      .trim();
    const queryBrandSubject = [psaSubject, psaBrand]
      .filter(Boolean)
      .join(' ')
      .trim();
    const query =
      queryPrimary ||
      queryFromPsa ||
      queryBrandSubject ||
      (cardName ? [cardName, cardNumber].filter(Boolean).join(' ').trim() : '');
    return {
      query,
      cardName,
      cardSet,
      cardNumber,
      cardhedgerCardId,
      cardhedgerSearchQuery,
      psaSpecId,
      listingDisplayTitle,
      psaVariety,
      psaSubject,
      psaBrand,
      psaYear,
    };
  }

  /**
   * PSA-forward search line (Subject, Brand, Card #, Variety) — preferred over mint `cardhedger.searchQuery`.
   */
  private buildPsaForwardCardhedgerSearchQuery(q: {
    psaSubject: string | null;
    psaBrand: string | null;
    cardNumber: string;
    psaVariety: string | null;
    psaYear: string | null;
  }): string | null {
    const parts: string[] = [];
    if (q.psaSubject) parts.push(q.psaSubject);
    if (q.psaBrand) parts.push(q.psaBrand);
    if (q.psaYear) parts.push(q.psaYear);
    if (q.cardNumber) parts.push(`#${primaryCardNumber(q.cardNumber)}`);
    if (q.psaVariety) {
      parts.push(...varietyHintsForSearch(q.psaVariety));
    }
    const s = parts
      .map((x) => String(x ?? '').trim())
      .filter(Boolean)
      .join(' ')
      .trim();
    return s.length > 0 ? s : null;
  }

  /**
   * Ordered Cardhedger `card-search` strings — PSA-forward lines first, then broader lines
   * (Brand-only, Subject-only) for niche / non-sport / PSA-DNA products when the catalog title
   * does not match one long “mint searchQuery”.
   */
  private collectCardhedgerSearchCandidates(
    q: {
      query: string;
      cardName: string;
      cardSet: string;
      cardNumber: string;
      cardhedgerSearchQuery: string | null;
      listingDisplayTitle: string | null;
      psaVariety: string | null;
      psaSubject: string | null;
      psaBrand: string | null;
      psaYear: string | null;
    },
    displayLabel: string,
  ): string[] {
    const ordered: string[] = [];
    const seen = new Set<string>();
    const push = (s: unknown) => {
      const t = String(s ?? '').trim();
      if (t.length < 2) return;
      const k = t.toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      ordered.push(t);
    };

    push(this.buildPsaForwardCardhedgerSearchQuery(q));

    const forwardNoVariety = [
      q.psaSubject,
      q.psaBrand,
      q.psaYear,
      q.cardNumber ? `#${primaryCardNumber(q.cardNumber)}` : '',
    ]
      .map((x) => String(x ?? '').trim())
      .filter(Boolean)
      .join(' ')
      .trim();
    push(forwardNoVariety);

    push(
      [q.psaSubject, q.psaBrand, q.psaYear].filter(Boolean).join(' ').trim(),
    );
    push([q.psaSubject, q.psaBrand].filter(Boolean).join(' ').trim());

    if (q.psaBrand && q.psaVariety) {
      push(
        [q.psaBrand, ...varietyHintsForSearch(q.psaVariety)]
          .map((x) => String(x).trim())
          .filter(Boolean)
          .join(' ')
          .trim(),
      );
    }
    if (q.psaSubject && q.psaVariety) {
      push(
        [q.psaSubject, ...varietyHintsForSearch(q.psaVariety)]
          .map((x) => String(x).trim())
          .filter(Boolean)
          .join(' ')
          .trim(),
      );
    }

    push([q.psaBrand, q.psaYear].filter(Boolean).join(' ').trim());
    push([q.psaSubject, q.psaYear].filter(Boolean).join(' ').trim());

    if (q.cardName && q.cardSet) {
      push(
        [q.cardName, q.cardNumber, q.cardSet].filter(Boolean).join(' ').trim(),
      );
    }

    push(q.cardhedgerSearchQuery);
    push(q.listingDisplayTitle);
    push(displayLabel);
    push(q.query);
    push([q.cardNumber, q.cardSet].filter(Boolean).join(' ').trim());
    push(q.cardNumber);
    push(q.cardName);
    push(q.cardSet);

    if (q.psaBrand && q.psaBrand.length >= 12) push(q.psaBrand);
    if (q.psaSubject && q.psaSubject.length >= 6) push(q.psaSubject);

    return ordered;
  }

  private parseCardRows(body: unknown): CardhedgerCardRow[] {
    if (typeof body !== 'object' || body == null) return [];
    const cards = (body as { cards?: unknown[] }).cards;
    if (!Array.isArray(cards)) return [];
    return cards.filter(
      (x): x is CardhedgerCardRow => typeof x === 'object' && x != null,
    );
  }

  /** Region / print language from Cardhedger row (avoid hardcoding `US` for every card). */
  private pickCardhedgerMarketField(row: CardhedgerCardRow): string | null {
    for (const key of [
      'market',
      'language',
      'print_language',
      'country',
      'region',
      'locale',
    ] as const) {
      const v = row[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return null;
  }

  /**
   * Split a string into lowercase alphanumeric tokens (length >= 2).
   * Used for fuzzy name/set matching that tolerates inserted words
   * (e.g. "pikachu/grey felt hat" vs "Pikachu with Grey Felt Hat Van Gogh").
   */
  private tokenizeForMatch(s: string): Set<string> {
    return new Set(
      String(s ?? '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 2),
    );
  }

  /**
   * How much of `got` (the Cardhedger side) is covered by the `wantPool`
   * (our stored cardName / cardSet / cardhedgerSearchQuery tokens).
   * Returns 0..1. 0 when got is empty.
   */
  private coverageRatio(wantPool: string, got: string): number {
    const want = this.tokenizeForMatch(wantPool);
    const gotTokens = this.tokenizeForMatch(got);
    if (gotTokens.size === 0) return 0;
    let common = 0;
    for (const t of gotTokens) if (want.has(t)) common += 1;
    return common / gotTokens.size;
  }

  /**
   * PSA 공식/거울 필드를 `components`에 넣어 {@link buildCollectionQuery}·parallel 게이트·검색 스코어가
   * mint 프리뷰에서도 리스팅 버킷과 동일하게 동작하도록 한다 (민팅 JSON `graded.psa`).
   */
  private psaMirrorFromGradedBlock(
    graded: Record<string, unknown> | undefined,
  ): Record<string, unknown> {
    if (!graded || typeof graded !== 'object') return {};
    const psa = graded.psa as Record<string, unknown> | undefined;
    if (!psa || typeof psa !== 'object') return {};
    const out: Record<string, unknown> = {};
    const varietyRaw = [psa.Variety, psa.variety, psa.varietyHint]
      .find((x): x is string => typeof x === 'string' && Boolean(x.trim()))
      ?.trim();
    if (varietyRaw) {
      out.psaVariety = varietyRaw.replace(/\s+/g, ' ');
    }
    const subject = psa.Subject ?? psa.subject;
    if (typeof subject === 'string' && subject.trim()) {
      out.psaSubject = subject.trim();
    }
    const brand = psa.Brand ?? psa.brand;
    if (typeof brand === 'string' && brand.trim()) {
      out.psaBrand = brand.trim();
    }
    const y = psa.Year ?? psa.YearIssued ?? psa.year;
    if (typeof y === 'number' && Number.isFinite(y)) {
      out.psaYear = String(Math.floor(y));
    } else if (typeof y === 'string' && y.trim()) {
      out.psaYear = y.trim();
    }
    return out;
  }

  /**
   * 민트 JSON에 `graded.psa.Variety`가 없을 때, cert 번호로 PSA Public API를 조회해
   * {@link components}에 `psaVariety`/`psaSubject`/…를 보강한다 (Silver vs Base 구분).
   */
  private async enrichPsaMirrorFromCertLookup(
    graded: Record<string, unknown> | undefined,
    baseMirror: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (!graded || typeof graded !== 'object') return baseMirror;
    const psa = graded.psa as Record<string, unknown> | undefined;
    const grade = graded.grade as Record<string, unknown> | undefined;
    const certRaw =
      (typeof psa?.certNumber === 'string' && psa.certNumber.replace(/\D/g, '')) ||
      (typeof grade?.certNumber === 'string' &&
        String(grade.certNumber).replace(/\D/g, '')) ||
      '';
    if (!certRaw || certRaw.length < 7) return baseMirror;

    const psaMirrorComplete =
      typeof baseMirror.psaVariety === 'string' &&
      Boolean(baseMirror.psaVariety.trim()) &&
      typeof baseMirror.psaSubject === 'string' &&
      Boolean(baseMirror.psaSubject.trim()) &&
      typeof baseMirror.psaBrand === 'string' &&
      Boolean(baseMirror.psaBrand.trim());
    if (psaMirrorComplete) return baseMirror;

    const lookup = await this.psaPublicApi.getByCertNumber(certRaw);
    if (lookup.status !== 'success' || !lookup.raw) return baseMirror;

    const merged = mergePsaApiIntoParsed({} as ParsedPsaLabel, lookup.raw);
    const extra: Record<string, unknown> = { ...baseMirror };

    const hadVariety =
      typeof baseMirror.psaVariety === 'string' &&
      Boolean(baseMirror.psaVariety.trim());

    if (merged.varietyHint?.trim() && !hadVariety) {
      extra.psaVariety = merged.varietyHint.trim().replace(/\s+/g, ' ');
    }
    if (merged.cardNameHint?.trim()) {
      const existing =
        typeof baseMirror.psaSubject === 'string' &&
        Boolean(baseMirror.psaSubject.trim());
      if (!existing) extra.psaSubject = merged.cardNameHint.trim();
    }
    if (merged.setHint?.trim()) {
      const existing =
        typeof baseMirror.psaBrand === 'string' &&
        Boolean(baseMirror.psaBrand.trim());
      if (!existing) extra.psaBrand = merged.setHint.trim();
    }
    if (merged.year?.trim()) {
      const existing =
        typeof baseMirror.psaYear === 'string' &&
        Boolean(baseMirror.psaYear.trim());
      if (!existing) extra.psaYear = merged.year.trim();
    }
    if (!hadVariety && typeof extra.psaVariety === 'string' && extra.psaVariety.trim()) {
      this.logger.log(
        'Cardhedger mint preview: psaVariety filled via PSA Public API cert lookup (IPFS metadata had no PSA Variety)',
      );
    }
    return extra;
  }

  private rowParallelBlob(row: CardhedgerCardRow): string {
    return [row.variant, row.description, row.name, row.set, row.set_type]
      .map((x) => String(x ?? ''))
      .join(' ');
  }

  /** When PSA names a non-base line, reject Cardhedger rows that omit that Variety. */
  private parallelRowFailsExpectation(
    psaVariety: string | null,
    row: CardhedgerCardRow,
    opts?: { trustStoredCardhedgerCatalogId?: boolean },
  ): boolean {
    const pv = psaVariety?.trim() ?? '';
    if (!psaVarietyRequiresNonBaseCardhedgerRow(pv)) return false;
    /**
     * Pokémon SIR — Cardhedger often keeps `variant: "Base"` and omits "Special Illustration"
     * wording from the row blob; literal chunk match would reject every row. Allow Base.
     */
    if (psaVarietyIsSpecialIllustrationRareLabel(pv)) {
      const vr = String(row.variant ?? '').trim().toLowerCase();
      if (vr === 'base') return false;
    }
    if (psaVarietyIsIllustrationRareLabel(pv)) {
      const vr = String(row.variant ?? '').trim().toLowerCase();
      if (vr === 'base') return false;
    }
    if (!cardhedgerRowMatchesPsaVariety(row as Record<string, unknown>, pv)) return true;
    /**
     * PSA `{SPORT} REFRACTOR` matches the flagship `variant: "Refractor"` row **and** many other
     * parallels (RayWave, RWB, …). The plain Refractor catalog slot is often far above the
     * comps band users see on eBay. Treat flagship Refractor as incompatible when PSA only gives
     * the generic sport+refractor line **for search picks** so resolve prefers a more specific row.
     *
     * Exception: **`cardhedgerCardId` from mint/OCR catalog** (`POST /cards/card-details` by that id).
     * That id is authoritative for the slab — including flagship Refractor — so do not downgrade to search.
     */
    if (
      psaVarietyIsGenericSportRefractorLine(pv) &&
      !opts?.trustStoredCardhedgerCatalogId
    ) {
      const vr = String(row.variant ?? '').trim().toLowerCase();
      if (vr === 'refractor') return true;
    }
    return false;
  }

  private scoreCard(
    row: CardhedgerCardRow,
    hints: {
      cardName: string;
      cardSet: string;
      cardNumber: string;
      cardhedgerSearchQuery?: string | null;
      listingDisplayTitle?: string | null;
      psaVariety?: string | null;
      psaSubject?: string | null;
      psaBrand?: string | null;
    },
    parallelOpts?: { trustStoredCardhedgerCatalogId?: boolean },
  ): { score: number; verified: boolean; numberMatched: boolean } {
    const sameNumber = (a: string, b: string): boolean => {
      if (!a || !b) return false;
      if (a === b) return true;
      const aTrim = a.replace(/^0+/, '');
      const bTrim = b.replace(/^0+/, '');
      return Boolean(aTrim) && Boolean(bTrim) && aTrim === bTrim;
    };

    const rowName = String(row.description ?? row.name ?? '');
    const rowSet = String(row.set ?? '');
    const rowNum = String(row.number ?? '');

    // Normalized strings for the legacy substring compare.
    const wantName = normalizeForExactCatalogMatch(hints.cardName);
    const wantSet = normalizeForExactCatalogMatch(hints.cardSet);
    const wantNum = normalizeForExactCardNumberKey(
      primaryCardNumber(hints.cardNumber),
    );
    const gotName = normalizeForExactCatalogMatch(rowName);
    const gotSet = normalizeForExactCatalogMatch(rowSet);
    const gotNum = normalizeForExactCardNumberKey(primaryCardNumber(rowNum));

    const numberMatched = sameNumber(wantNum, gotNum);

    if (this.parallelRowFailsExpectation(hints.psaVariety ?? null, row, parallelOpts)) {
      return { score: 0, verified: false, numberMatched: false };
    }

    // Substring path (tight, keeps legacy exact-match wins)
    const nameSubstring = Boolean(
      wantName &&
      gotName &&
      (gotName.includes(wantName) || wantName.includes(gotName)),
    );
    const setSubstring = Boolean(
      wantSet &&
      gotSet &&
      (gotSet.includes(wantSet) || wantSet.includes(gotSet)),
    );

    // Token coverage path — used to tolerate inserted words and abbreviated set codes.
    // We pool cardName/cardSet with cardhedgerSearchQuery (curated long-form) when present,
    // because Cardhedger's row.description often matches the curated query verbatim.
    const wantNamePool = [
      hints.cardName,
      hints.psaSubject ?? '',
      hints.cardhedgerSearchQuery ?? '',
    ]
      .filter(Boolean)
      .join(' ');
    const wantSetPool = [
      hints.cardSet,
      hints.psaBrand ?? '',
      hints.cardhedgerSearchQuery ?? '',
    ]
      .filter(Boolean)
      .join(' ');
    const nameCoverage = this.coverageRatio(wantNamePool, rowName);
    const setCoverage = this.coverageRatio(wantSetPool, rowSet);
    const nameTokenMatch = nameCoverage >= 0.6;
    const setTokenMatch = setCoverage >= 0.5;

    const nameMatched = nameSubstring || nameTokenMatch;
    const setMatched = setSubstring || setTokenMatch;

    let score = 0;
    if (numberMatched) score += 100;
    if (setMatched) score += 60;
    if (nameMatched) score += 50;

    const verified = numberMatched && setMatched && nameMatched;
    return { score, verified, numberMatched };
  }

  private parsePrice(raw: unknown): number | null {
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
    if (typeof raw === 'string') {
      const n = parseFloat(raw.replace(/[^0-9.-]/g, ''));
      if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
  }

  private parseCount(raw: unknown): number | null {
    if (typeof raw === 'number' && Number.isFinite(raw)) return Math.floor(raw);
    if (typeof raw === 'string' && raw.trim()) {
      const n = Number(raw.replace(/[^0-9.-]/g, ''));
      if (Number.isFinite(n)) return Math.floor(n);
    }
    return null;
  }

  readGradePrice(row: CardhedgerCardRow, grade: string): number | null {
    const prices = row.prices;
    if (!Array.isArray(prices)) return null;
    const want = grade.trim().toUpperCase();
    for (const p of prices) {
      if (typeof p !== 'object' || p == null) continue;
      const pg = String((p as { grade?: unknown }).grade ?? '')
        .trim()
        .toUpperCase();
      if (pg === want) {
        return this.parsePrice((p as { price?: unknown }).price);
      }
    }
    return null;
  }

  private readTierSpot(
    row: CardhedgerCardRow,
    tier: string,
  ): { usd: number | null; gainPct: number | null } {
    const t = tier.toUpperCase();
    const gainRaw = row.gain;
    const gainPct =
      typeof gainRaw === 'number' && Number.isFinite(gainRaw) ? gainRaw : null;
    const chGrade = cardhedgerGradeFromHistoryTier(t);
    return { usd: this.readGradePrice(row, chGrade), gainPct };
  }

  async fetchAllPricesByCard(cardId: string): Promise<CardhedgerCardRow[]> {
    const id = String(cardId ?? '').trim();
    if (!id) return [];
    const cached = this.ttlCache.get<{ rows: CardhedgerCardRow[] }>(
      CardhedgerMarketDataService.NS_ALL_PRICES,
      id,
    );
    if (cached) {
      return cached.rows;
    }
    try {
      const body = await this.cardhedger.forwardJson(
        'POST',
        '/v1/cards/all-prices-by-card',
        {
          body: { card_id: id },
        },
      );
      const prices =
        typeof body === 'object' &&
        body != null &&
        Array.isArray((body as { prices?: unknown }).prices)
          ? (body as { prices: unknown[] }).prices
          : [];
      const out = prices.filter(
        (x): x is CardhedgerCardRow => typeof x === 'object' && x != null,
      );
      this.ttlCache.set(
        CardhedgerMarketDataService.NS_ALL_PRICES,
        id,
        { rows: out },
        this.PRICES_CACHE_TTL_MS,
      );
      return out;
    } catch {
      this.ttlCache.set(
        CardhedgerMarketDataService.NS_ALL_PRICES,
        id,
        { rows: [] },
        this.PRICES_CACHE_TTL_MS,
      );
      return [];
    }
  }

  private parseHistoricalPoints(
    body: unknown,
  ): Array<{ t: number; v: number }> {
    if (typeof body !== 'object' || body == null) return [];
    const rows = Array.isArray((body as { prices?: unknown[] }).prices)
      ? ((body as { prices: unknown[] }).prices ?? [])
      : [];
    const out: Array<{ t: number; v: number }> = [];
    for (const raw of rows) {
      if (typeof raw !== 'object' || raw == null) continue;
      const row = raw as Record<string, unknown>;
      const dateRaw =
        (typeof row.closing_date === 'string' && row.closing_date) ||
        (typeof row.update_timestamp === 'string' && row.update_timestamp) ||
        (typeof row.date === 'string' && row.date) ||
        null;
      const tMs = dateRaw ? Date.parse(dateRaw) : NaN;
      const v = this.parsePrice(row.price);
      if (!Number.isFinite(tMs) || v == null || v <= 0) continue;
      out.push({ t: Math.floor(tMs / 1000), v });
    }
    out.sort((a, b) => a.t - b.t);
    const dedup = new Map<number, number>();
    for (const p of out) dedup.set(p.t, p.v);
    return [...dedup.entries()].map(([t, v]) => ({ t, v }));
  }

  /** Single upstream fetch (no backoff). Prefer {@link fetchTierHistoryByCardAdaptive} for charts. */
  private async fetchTierHistoryByCardOnce(
    cardId: string,
    tier: string,
    days: number,
  ): Promise<Array<{ t: number; v: number }>> {
    const id = String(cardId ?? '').trim();
    if (!id) return [];
    const tierUpper = String(tier ?? '')
      .trim()
      .toUpperCase();
    const grade = cardhedgerGradeFromHistoryTier(tierUpper);
    const d = Math.min(
      CARDHEDGER_PRICES_BY_CARD_MAX_DAYS,
      Math.max(1, Math.floor(days)),
    );
    const cacheKey = `${id}:${grade}:${d}`;
    const cached = this.ttlCache.get<{ pts: Array<{ t: number; v: number }> }>(
      CardhedgerMarketDataService.NS_TIER_HISTORY,
      cacheKey,
    );
    if (cached) {
      return cached.pts;
    }
    try {
      const body = await this.cardhedger.forwardJson(
        'POST',
        '/v1/cards/prices-by-card',
        {
          body: { card_id: id, grade, days: d },
        },
      );
      const pts = this.parseHistoricalPoints(body);
      this.ttlCache.set(
        CardhedgerMarketDataService.NS_TIER_HISTORY,
        cacheKey,
        { pts },
        this.PRICES_CACHE_TTL_MS,
      );
      return pts;
    } catch {
      this.ttlCache.set(
        CardhedgerMarketDataService.NS_TIER_HISTORY,
        cacheKey,
        { pts: [] },
        this.PRICES_CACHE_TTL_MS,
      );
      return [];
    }
  }

  /** Rightmost point after upstream sorts by time (latest observation in the series). */
  private latestHistoryPoint(
    pts: Array<{ t: number; v: number }>,
  ): { t: number; v: number } | null {
    if (!Array.isArray(pts) || pts.length === 0) return null;
    const last = pts[pts.length - 1];
    if (
      last.v == null ||
      typeof last.v !== 'number' ||
      !Number.isFinite(last.v) ||
      last.v <= 0 ||
      last.t == null ||
      !Number.isFinite(last.t)
    ) {
      return null;
    }
    return last;
  }

  /**
   * Mean of 1..`maxN` positive USD points (comps raw sales or sparse `prices-by-card` samples).
   * Returns null when empty or when count exceeds `maxN` (caller keeps last-point / headline path).
   */
  private sparseSalePriceAverage(
    points: Array<{ t: number; v: number }>,
    maxN: number,
  ): { avg: number; latestT: number; n: number } | null {
    const valid = points.filter(
      (p) =>
        Number.isFinite(p.t) &&
        typeof p.v === 'number' &&
        Number.isFinite(p.v) &&
        p.v > 0,
    );
    const n = valid.length;
    if (n === 0 || n > maxN) return null;
    const sum = valid.reduce((s, p) => s + p.v, 0);
    const latestT = Math.max(...valid.map((p) => p.t));
    return { avg: sum / n, latestT, n };
  }

  /**
   * Median USD of the chronologically last `k` raw comp points (PSA 10 comps sale rows).
   */
  private medianLastRawCompsWindow(
    rawPts: Array<{ t: number; v: number }>,
    k: number,
  ): { median: number; latestT: number } | null {
    if (!rawPts.length || k < 1) return null;
    const slice = rawPts.slice(-Math.min(k, rawPts.length));
    const vals = slice.map((p) => p.v).filter((v) => Number.isFinite(v) && v > 0);
    if (vals.length === 0) return null;
    const sorted = [...vals].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 === 1
        ? sorted[mid]!
        : (sorted[mid - 1]! + sorted[mid]!) / 2;
    const latestT = Math.max(...slice.map((p) => p.t));
    return { median, latestT };
  }

  /**
   * Choose published PSA 10 USD from comps payload. When {@link PSA10_SPOT_BASIS} is
   * `last_raw_comp`, prefer the last `raw_prices` row — unless it is a clear low outlier vs
   * the Cardhedger headline or vs the median of recent raw prints on a liquid card.
   */
  private pickPublishedUsdFromComps(
    headline: CardhedgerCompsHeadline | null,
    rawPts: Array<{ t: number; v: number }>,
    liquidMarket: boolean,
  ): {
    usd: number;
    spotPriceBasis: 'comps' | 'latest_sale' | 'comps_median';
    latestSaleAt: number | null;
    headlineCompCount: number | null;
  } | null {
    const lastRaw =
      rawPts.length > 0 ? rawPts[rawPts.length - 1] : null;
    const headlineOk =
      headline != null &&
      Number.isFinite(headline.usd) &&
      headline.usd > 0;

    if (
      this.PSA10_SPOT_BASIS === 'last_raw_comp' &&
      lastRaw &&
      liquidMarket
    ) {
      if (
        headlineOk &&
        lastRaw.v < headline.usd * this.LAST_COMP_LOW_VS_HEADLINE_FRAC
      ) {
        return {
          usd: headline.usd,
          spotPriceBasis: 'comps',
          latestSaleAt: headline.latestSaleAtSec,
          headlineCompCount: headline.countUsed,
        };
      }
      const win = this.medianLastRawCompsWindow(
        rawPts,
        this.MEDIAN_RAW_COMPS_WINDOW,
      );
      if (
        win != null &&
        lastRaw.v < win.median * this.LAST_COMP_LOW_VS_MEDIAN_FRAC
      ) {
        return {
          usd: win.median,
          spotPriceBasis: 'comps_median',
          latestSaleAt: win.latestT,
          headlineCompCount: headlineOk ? headline.countUsed : null,
        };
      }
    }

    if (this.PSA10_SPOT_BASIS === 'last_raw_comp' && lastRaw) {
      return {
        usd: lastRaw.v,
        spotPriceBasis: 'latest_sale',
        latestSaleAt: lastRaw.t,
        headlineCompCount: headlineOk ? headline.countUsed : null,
      };
    }
    if (headlineOk) {
      return {
        usd: headline.usd,
        spotPriceBasis: 'comps',
        latestSaleAt: headline.latestSaleAtSec,
        headlineCompCount: headline.countUsed,
      };
    }
    if (lastRaw) {
      return {
        usd: lastRaw.v,
        spotPriceBasis: 'latest_sale',
        latestSaleAt: lastRaw.t,
        headlineCompCount: null,
      };
    }
    return null;
  }

  private parseCompsPsa10CachedBody(
    body: unknown,
  ): CardhedgerCompsCached | null {
    if (typeof body !== 'object' || body == null) return null;
    const o = body as Record<string, unknown>;
    const rawPoints: Array<{ t: number; v: number }> = [];
    const raw = o.raw_prices;
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (typeof item !== 'object' || item == null) continue;
        const sd = (item as { sale_date?: unknown }).sale_date;
        if (typeof sd !== 'string' || !sd.trim()) continue;
        const ms = Date.parse(sd.trim());
        if (!Number.isFinite(ms)) continue;
        const price = this.parsePrice((item as { price?: unknown }).price);
        if (price == null || price <= 0) continue;
        rawPoints.push({ t: Math.floor(ms / 1000), v: price });
      }
    }
    rawPoints.sort((a, b) => a.t - b.t);

    const usd = this.parsePrice(o.comp_price);
    const cnt = this.parseCount(o.count_used);
    let headline: CardhedgerCompsHeadline | null = null;
    if (usd != null && cnt != null && cnt >= 1) {
      let latestSaleAtSec: number | null = null;
      for (const p of rawPoints) {
        if (latestSaleAtSec == null || p.t > latestSaleAtSec)
          latestSaleAtSec = p.t;
      }
      headline = { usd, latestSaleAtSec, countUsed: cnt };
    }

    if (rawPoints.length === 0 && headline == null) return null;
    return { headline, rawPoints };
  }

  private async fetchCompsCached(
    cardId: string,
    grade: string,
  ): Promise<CardhedgerCompsCached | null> {
    const id = String(cardId ?? '').trim();
    const gradeKey = String(grade ?? '').trim();
    if (!id || !gradeKey) return null;
    const cacheKey = `${id}:${gradeKey.toLowerCase()}:comps`;
    const hit = this.ttlCache.get<{ value: CardhedgerCompsCached | null }>(
      CardhedgerMarketDataService.NS_COMPS,
      cacheKey,
    );
    if (hit) {
      return hit.value;
    }
    try {
      const body = await this.cardhedger.forwardJson(
        'POST',
        '/v1/cards/comps',
        {
          body: {
            card_id: id,
            count: CARDHEDGER_COMPS_HEADLINE_COUNT,
            grade: gradeKey,
            time_weighted: true,
            include_raw_prices: true,
          },
        },
      );
      const parsed = this.parseCompsPsa10CachedBody(body);
      this.ttlCache.set(
        CardhedgerMarketDataService.NS_COMPS,
        cacheKey,
        { value: parsed },
        this.PRICES_CACHE_TTL_MS,
      );
      return parsed;
    } catch {
      this.ttlCache.set(
        CardhedgerMarketDataService.NS_COMPS,
        cacheKey,
        { value: null },
        this.PRICES_CACHE_TTL_MS,
      );
      return null;
    }
  }

  private async fetchCompsPsa10Cached(
    cardId: string,
  ): Promise<CardhedgerCompsCached | null> {
    return this.fetchCompsCached(cardId, 'PSA 10');
  }

  private mergeTierHistoryWithCompPoints(
    base: Array<{ t: number; v: number }>,
    extra: Array<{ t: number; v: number }>,
  ): Array<{ t: number; v: number }> {
    const m = new Map<number, number>();
    const put = (t: number, v: number) => {
      if (
        !Number.isFinite(t) ||
        typeof v !== 'number' ||
        !Number.isFinite(v) ||
        !(v > 0)
      )
        return;
      m.set(Math.floor(t), v);
    };
    for (const p of base) put(p.t, p.v);
    for (const p of extra) put(p.t, p.v);
    return [...m.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([t, v]) => ({ t, v }));
  }

  /** Merge Cardhedger daily history with comps raw sales + weighted headline point. */
  private async augmentPsa10HistoryWithComps(
    cardId: string,
    tier: string,
    points: Array<{ t: number; v: number }>,
  ): Promise<Array<{ t: number; v: number }>> {
    const id = String(cardId ?? '').trim();
    const tierU = String(tier ?? '')
      .trim()
      .toUpperCase();
    if (!id || !tierU) {
      return points;
    }
    const cached = await this.fetchCompsCached(
      id,
      cardhedgerGradeFromHistoryTier(tierU),
    );
    if (!cached) return points;

    const rawPts = cached.rawPoints;
    const extra: Array<{ t: number; v: number }> = [...rawPts];

    const h = cached.headline;
    const useTimeWeightedInjection =
      this.PSA10_SPOT_BASIS === 'time_weighted' &&
      h != null &&
      Number.isFinite(h.usd) &&
      h.usd > 0;

    if (useTimeWeightedInjection) {
      let tHead = h.latestSaleAtSec;
      if (tHead == null || !Number.isFinite(tHead)) {
        if (rawPts.length > 0) {
          tHead = rawPts[rawPts.length - 1].t;
        } else if (points.length > 0) {
          tHead = Math.max(...points.map((p) => p.t)) + 60;
        } else {
          tHead = Math.floor(Date.now() / 1000);
        }
      }
      extra.push({ t: Math.floor(tHead), v: h.usd });
    } else if (
      h != null &&
      Number.isFinite(h.usd) &&
      h.usd > 0 &&
      rawPts.length === 0
    ) {
      let tHead = h.latestSaleAtSec;
      if (tHead == null || !Number.isFinite(tHead)) {
        if (points.length > 0) {
          tHead = Math.max(...points.map((p) => p.t)) + 60;
        } else {
          tHead = Math.floor(Date.now() / 1000);
        }
      }
      extra.push({ t: Math.floor(tHead), v: h.usd });
    }

    if (extra.length === 0) return points;
    let merged = this.mergeTierHistoryWithCompPoints(points, extra);
    if (
      useTimeWeightedInjection &&
      h != null &&
      merged.length > 0
    ) {
      const last = merged[merged.length - 1];
      const eps = Math.max(1e-6, Math.abs(h.usd) * 1e-9);
      if (Math.abs(last.v - h.usd) > eps) {
        merged = [...merged.slice(0, -1), { t: last.t, v: h.usd }];
      }
    }
    return merged;
  }

  /**
   * Request the widest upstream-legal window first (`days` capped at 365), then backoff when sparse.
   */
  private async fetchTierHistoryByCardAdaptive(
    cardId: string,
    tier: string,
    desiredDays: number,
  ): Promise<{
    pts: Array<{ t: number; v: number }>;
    upstreamRequests: number;
  }> {
    const capRequested = Math.min(4000, Math.max(1, Math.floor(desiredDays)));
    const widest = Math.min(CARDHEDGER_PRICES_BY_CARD_MAX_DAYS, capRequested);

    const tiersDesc = [
      ...new Set([widest, 180, 90, 30, 14, 7].filter((x) => x <= widest)),
    ].sort((a, b) => b - a);

    let upstreamRequests = 0;
    for (const d of tiersDesc) {
      upstreamRequests += 1;
      const pts = await this.fetchTierHistoryByCardOnce(cardId, tier, d);
      if (pts.length >= 2) return { pts, upstreamRequests };
    }

    return { pts: [], upstreamRequests };
  }

  async fetchTierHistoryByCard(
    cardId: string,
    tier: string,
    days: number,
  ): Promise<Array<{ t: number; v: number }>> {
    return this.fetchTierHistoryByCardOnce(cardId, tier, days);
  }

  pctFromPoints(points: Array<{ t: number; v: number }>): number | null {
    if (!Array.isArray(points) || points.length < 2) return null;
    const sorted = [...points].sort((a, b) => a.t - b.t);
    const first = sorted[0]?.v;
    const last = sorted[sorted.length - 1]?.v;
    if (
      first == null ||
      last == null ||
      !Number.isFinite(first) ||
      !Number.isFinite(last) ||
      first <= 0
    ) {
      return null;
    }
    return ((last - first) / first) * 100;
  }

  private fmtSignedPct(v: number | null | undefined, digits = 1): string {
    if (v == null || !Number.isFinite(v)) return 'trend data is sparse';
    return `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`;
  }

  premiumPct(psa10: number | null, raw: number | null): number | null {
    if (
      psa10 == null ||
      raw == null ||
      !Number.isFinite(psa10) ||
      !Number.isFinite(raw) ||
      raw <= 0
    ) {
      return null;
    }
    return ((psa10 - raw) / raw) * 100;
  }

  private emptyInsightStats(): CollectionAiInsightPricingStats {
    return {
      psa10SpotUsd: null,
      rawSpotUsd: null,
      premiumVsRawPct: null,
      sales7d: null,
      sales30d: null,
      change7dPct: null,
      change30dPct: null,
      change90dPct: null,
      change365dPct: null,
      points90d: 0,
      points365d: 0,
      psa10PriceConfidence: null,
      psa10PricingNote: null,
      psa10SpotLowUsd: null,
      psa10SpotHighUsd: null,
      psa10CatalogUsd: null,
      psaTotalPopulation: null,
    };
  }

  /** Same catalog PSA 10 gate as preview (`rowToPreview`). */
  private allowsPublishedCatalogPsa10(
    merged: CardhedgerCardRow,
    confidence: 'verified' | 'approximate',
  ): boolean {
    const sales30d = this.parseCount(merged['30 Day Sales']);
    const hasReliableSales30 =
      sales30d != null && sales30d >= this.MIN_RELIABLE_SALES_30D;
    const hasMinVerifiedSales =
      this.MIN_VERIFIED_SALES_30D === 0 ||
      (sales30d != null && sales30d >= this.MIN_VERIFIED_SALES_30D);
    return (
      (confidence === 'verified' && hasMinVerifiedSales) || hasReliableSales30
    );
  }

  private trimmedMedianUsdFromHistory(
    pts: Array<{ t: number; v: number }>,
  ): number | null {
    const raw = pts
      .map((p) => p.v)
      .filter((v) => typeof v === 'number' && Number.isFinite(v) && v > 0)
      .sort((a, b) => a - b);
    if (raw.length === 0) return null;
    if (raw.length === 1) return raw[0];
    if (raw.length === 2) return (raw[0] + raw[1]) / 2;
    let vals = raw;
    if (raw.length >= 8) {
      const qi = Math.floor((raw.length - 1) * 0.25);
      const qj = Math.floor((raw.length - 1) * 0.75);
      const q1 = raw[qi];
      const q3 = raw[qj];
      const iqr = Math.max(q3 - q1, 1e-6);
      const lo = q1 - 1.5 * iqr;
      const hi = q3 + 1.5 * iqr;
      const t = raw.filter((x) => x >= lo && x <= hi);
      if (t.length >= AI_INSIGHT_MEDIAN_MIN_POINTS) vals = t;
    }
    const m = Math.floor(vals.length / 2);
    return vals.length % 2 === 1 ? vals[m] : (vals[m - 1] + vals[m]) / 2;
  }

  private catalogHistoryMedianAnomaly(
    catalogUsd: number,
    histMedian: number | null | undefined,
  ): boolean {
    if (histMedian == null || !(histMedian > 0) || !(catalogUsd > 0))
      return false;
    const r = this.AI_INSIGHT_HIST_ANOMALY_RATIO;
    return catalogUsd / histMedian > r || histMedian / catalogUsd > r;
  }

  private computeInsightStatsFromMerged(
    merged: CardhedgerCardRow,
    matchConfidence: 'verified' | 'approximate',
    h90: Array<{ t: number; v: number }>,
    h365: Array<{ t: number; v: number }>,
    cardId: string,
  ): CollectionAiInsightPricingStats {
    const psa10Catalog = this.readGradePrice(merged, 'PSA 10');
    const rawSpot = this.readGradePrice(merged, 'Raw');
    const sales7d = this.parseCount(merged['7 Day Sales']);
    const sales30d = this.parseCount(merged['30 Day Sales']);
    const change7 =
      typeof merged.gain === 'number' && Number.isFinite(merged.gain)
        ? Number(merged.gain)
        : null;
    const change30 =
      typeof merged.gain_30day === 'number' &&
      Number.isFinite(merged.gain_30day)
        ? Number(merged.gain_30day)
        : null;
    const change90 = this.pctFromPoints(h90);
    const change365 = this.pctFromPoints(h365);

    const histMed = this.trimmedMedianUsdFromHistory(h90);
    const allowCatalog = this.allowsPublishedCatalogPsa10(
      merged,
      matchConfidence,
    );
    const catalogCandidate =
      allowCatalog && psa10Catalog != null && psa10Catalog > 0
        ? psa10Catalog
        : null;

    const histVals = h90
      .map((p) => p.v)
      .filter((v) => typeof v === 'number' && Number.isFinite(v) && v > 0);
    const psa10SpotLowUsd = histVals.length > 0 ? Math.min(...histVals) : null;
    const psa10SpotHighUsd = histVals.length > 0 ? Math.max(...histVals) : null;

    let psa10SpotUsd: number | null = null;
    let psa10PriceConfidence: AiInsightPsa10PriceConfidence | null = null;
    let psa10PricingNote: string | null = null;

    const ratioBad =
      catalogCandidate != null &&
      histMed != null &&
      this.catalogHistoryMedianAnomaly(catalogCandidate, histMed);

    if (
      ratioBad &&
      histMed != null &&
      h90.length >= AI_INSIGHT_MEDIAN_MIN_POINTS
    ) {
      psa10SpotUsd = histMed;
      psa10PriceConfidence = 'medium';
      psa10PricingNote = 'history_median_replaces_catalog_anomaly';
      this.logger.warn(
        `[ai-insight-psa] anomaly_substitution card_id=${cardId} catalog=${catalogCandidate} histMedian90d=${histMed} points90=${h90.length} sales30d=${sales30d ?? 'n/a'}`,
      );
    } else if (
      ratioBad &&
      (histMed == null || h90.length < AI_INSIGHT_MEDIAN_MIN_POINTS)
    ) {
      psa10SpotUsd = null;
      psa10PriceConfidence = 'low';
      psa10PricingNote = 'suppressed_catalog_history_conflict';
      this.logger.warn(
        `[ai-insight-psa] suppressed_conflict card_id=${cardId} catalog=${catalogCandidate} histMedian90d=${histMed ?? 'n/a'} points90=${h90.length}`,
      );
    } else if (catalogCandidate != null) {
      psa10SpotUsd = catalogCandidate;
      psa10PricingNote = 'catalog_psa10_grade_slot';
      const highSales =
        sales30d != null && sales30d >= this.MIN_RELIABLE_SALES_30D;
      psa10PriceConfidence =
        matchConfidence === 'verified' && allowCatalog && highSales
          ? 'high'
          : 'medium';
    } else if (
      histMed != null &&
      h90.length >= AI_INSIGHT_MEDIAN_FALLBACK_MIN_POINTS
    ) {
      psa10SpotUsd = histMed;
      psa10PriceConfidence = 'low';
      psa10PricingNote = 'history_median_thin_catalog_confidence';
    } else {
      psa10SpotUsd = null;
      psa10PriceConfidence = 'low';
      psa10PricingNote =
        psa10Catalog != null && !allowCatalog
          ? 'suppressed_low_sales_or_match'
          : 'insufficient_psa10_series';
    }

    return {
      psa10SpotUsd,
      rawSpotUsd: rawSpot,
      premiumVsRawPct: this.premiumPct(psa10SpotUsd, rawSpot),
      sales7d,
      sales30d,
      change7dPct: change7,
      change30dPct: change30,
      change90dPct: change90,
      change365dPct: change365,
      points90d: h90.length,
      points365d: h365.length,
      psa10PriceConfidence,
      psa10PricingNote,
      psa10SpotLowUsd,
      psa10SpotHighUsd,
      psa10CatalogUsd: psa10Catalog,
      psaTotalPopulation: null,
    };
  }

  private parsePsaTotalPopulationInsight(components: unknown): number | null {
    if (!components || typeof components !== 'object') return null;
    const c = components as Record<string, unknown>;
    const raw = c.psaTotalPopulation;
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0)
      return Math.floor(raw);
    if (typeof raw === 'string' && raw.trim()) {
      const n = Number(raw.trim());
      if (Number.isFinite(n) && n > 0) return Math.floor(n);
    }
    return null;
  }

  async getAiInsightPricingBundle(col: MarketplaceCollection | null): Promise<{
    matched: boolean;
    matchConfidence: 'verified' | 'approximate' | null;
    catalogLabel: string;
    uiConfidence: number | null;
    stats: CollectionAiInsightPricingStats;
  }> {
    if (!col) {
      return {
        matched: false,
        matchConfidence: null,
        catalogLabel: '',
        uiConfidence: null,
        stats: this.emptyInsightStats(),
      };
    }
    if (!this.isConfigured()) {
      return {
        matched: false,
        matchConfidence: null,
        catalogLabel: String(col.displayLabel ?? ''),
        uiConfidence: null,
        stats: this.emptyInsightStats(),
      };
    }
    const resolved = await this.resolveCardForCollection(col);
    if (!resolved.row || !resolved.confidence) {
      return {
        matched: false,
        matchConfidence: null,
        catalogLabel: String(col.displayLabel ?? ''),
        uiConfidence: null,
        stats: this.emptyInsightStats(),
      };
    }
    const cardId = String(resolved.row.card_id ?? '').trim();
    const allPrices = cardId ? await this.fetchAllPricesByCard(cardId) : [];
    const merged =
      allPrices.length > 0
        ? ({ ...resolved.row, prices: allPrices } as CardhedgerCardRow)
        : resolved.row;
    const [h90, h365] = await Promise.all([
      cardId
        ? this.fetchTierHistoryByCard(cardId, 'PSA_10', 90)
        : Promise.resolve([]),
      cardId
        ? this.fetchTierHistoryByCard(cardId, 'PSA_10', 365)
        : Promise.resolve([]),
    ]);
    const statsBase = this.computeInsightStatsFromMerged(
      merged,
      resolved.confidence,
      h90,
      h365,
      cardId,
    );
    const psaPop = this.parsePsaTotalPopulationInsight(col.components);
    const stats: CollectionAiInsightPricingStats = {
      ...statsBase,
      psaTotalPopulation: psaPop,
    };
    const catalogLabel = String(
      merged.description ?? merged.name ?? col.displayLabel ?? '',
    ).trim();
    const uiConfidence = resolved.confidence === 'verified' ? 0.93 : 0.78;
    return {
      matched: true,
      matchConfidence: resolved.confidence,
      catalogLabel,
      uiConfidence,
      stats,
    };
  }

  private historyTierForCollection(
    col: MarketplaceCollection | null | undefined,
  ): string {
    return marketHistoryTierFromComponents(
      (col?.components ?? null) as Record<string, unknown> | null,
    );
  }

  private async rowToPreview(
    row: CardhedgerCardRow,
    query: string,
    confidence: 'verified' | 'approximate',
    pricingTier = 'PSA_10',
  ): Promise<MarketCollectionPreview> {
    const tierU = String(pricingTier ?? 'PSA_10')
      .trim()
      .toUpperCase();
    const chGrade = cardhedgerGradeFromHistoryTier(tierU);
    const isQualifierTier = tierU === 'PSA_AUTH';
    const cardId = String(row.card_id ?? '').trim();
    const [allPrices, tierHistory, compsCached] = await Promise.all([
      cardId ? this.fetchAllPricesByCard(cardId) : Promise.resolve([]),
      cardId
        ? this.fetchTierHistoryByCardOnce(
            cardId,
            tierU,
            CARDHEDGER_PRICES_BY_CARD_MAX_DAYS,
          )
        : Promise.resolve([]),
      cardId ? this.fetchCompsCached(cardId, chGrade) : Promise.resolve(null),
    ]);
    const compsHeadline = compsCached?.headline ?? null;
    const merged = allPrices.length > 0 ? { ...row, prices: allPrices } : row;
    const tierCatalogRaw = this.readGradePrice(merged, chGrade);
    const latestPt = this.latestHistoryPoint(tierHistory);
    const sales7d = this.parseCount(merged['7 Day Sales']);
    const sales30d = this.parseCount(merged['30 Day Sales']);
    const hasReliableSales30 =
      sales30d != null && sales30d >= this.MIN_RELIABLE_SALES_30D;
    const hasMinVerifiedSales =
      this.MIN_VERIFIED_SALES_30D === 0 ||
      (sales30d != null && sales30d >= this.MIN_VERIFIED_SALES_30D);
    const allowTierPricing = isQualifierTier
      ? tierCatalogRaw != null ||
        latestPt != null ||
        compsCached != null ||
        confidence === 'verified'
      : (confidence === 'verified' && hasMinVerifiedSales) || hasReliableSales30;
    const anyTierSignal =
      tierCatalogRaw != null || latestPt != null || compsCached != null;
    let spotUsd: number | null = null;
    let spotPriceBasis:
      | 'comps'
      | 'latest_sale'
      | 'sparse_sale_avg'
      | 'catalog'
      | 'comps_median'
      | null = null;
    let latestSaleAt: number | null = null;
    let headlineCompCount: number | null = null;

    const pickBestTierReference = (): void => {
      const rawPts = compsCached?.rawPoints;
      const skipSparseMeans = hasReliableSales30 && !isQualifierTier;

      if (!skipSparseMeans) {
        const rawSparse = rawPts?.length
          ? this.sparseSalePriceAverage(rawPts, SPARSE_SALE_POINTS_MAX)
          : null;
        if (rawSparse) {
          spotUsd = rawSparse.avg;
          spotPriceBasis = 'sparse_sale_avg';
          latestSaleAt = rawSparse.latestT;
          headlineCompCount = rawSparse.n;
          return;
        }
      }
      const rawPtsForComps = compsCached?.rawPoints ?? [];
      const fromComps = this.pickPublishedUsdFromComps(
        compsHeadline,
        rawPtsForComps,
        hasReliableSales30,
      );
      if (fromComps) {
        spotUsd = fromComps.usd;
        spotPriceBasis = fromComps.spotPriceBasis;
        latestSaleAt = fromComps.latestSaleAt;
        headlineCompCount = fromComps.headlineCompCount;
        return;
      }
      if (!skipSparseMeans) {
        const histSparse = tierHistory.length
          ? this.sparseSalePriceAverage(tierHistory, SPARSE_SALE_POINTS_MAX)
          : null;
        if (histSparse) {
          spotUsd = histSparse.avg;
          spotPriceBasis = 'sparse_sale_avg';
          latestSaleAt = histSparse.latestT;
          headlineCompCount = histSparse.n;
          return;
        }
      }
      if (latestPt) {
        spotUsd = latestPt.v;
        spotPriceBasis = 'latest_sale';
        latestSaleAt = latestPt.t;
        return;
      }
      if (rawPts && rawPts.length > 0) {
        const last = rawPts[rawPts.length - 1];
        if (
          typeof last.v === 'number' &&
          Number.isFinite(last.v) &&
          last.v > 0
        ) {
          spotUsd = last.v;
          spotPriceBasis = 'latest_sale';
          latestSaleAt = last.t;
          return;
        }
      }
      if (tierCatalogRaw != null) {
        spotUsd = tierCatalogRaw;
        spotPriceBasis = 'catalog';
      }
    };

    if (anyTierSignal) {
      pickBestTierReference();
    }

    /** Cardhedger grade-slot catalog can sit far above recent comps TW — prefer comps when divergent. */
    const CATALOG_COMPS_STALE_RATIO = 2;
    if (
      spotUsd != null &&
      spotPriceBasis === 'catalog' &&
      compsHeadline != null &&
      Number.isFinite(compsHeadline.usd) &&
      compsHeadline.usd > 0 &&
      spotUsd / compsHeadline.usd >= CATALOG_COMPS_STALE_RATIO
    ) {
      const rawPtsForComps = compsCached?.rawPoints ?? [];
      const fromComps = this.pickPublishedUsdFromComps(
        compsHeadline,
        rawPtsForComps,
        hasReliableSales30,
      );
      if (fromComps != null && fromComps.usd > 0) {
        spotUsd = fromComps.usd;
        spotPriceBasis = fromComps.spotPriceBasis;
        latestSaleAt = fromComps.latestSaleAt;
        headlineCompCount = fromComps.headlineCompCount;
      }
    }

    const pricingSuppressedReason = !anyTierSignal
      ? 'no_tier_price_in_source'
      : spotUsd == null
        ? 'no_publishable_tier_slot'
        : null;
    const headlineIso =
      latestSaleAt != null ? new Date(latestSaleAt * 1000).toISOString() : null;
    this.logger.debug(
      `cardhedger_preview card_id=${cardId || 'n/a'} tier=${tierU} confidence=${confidence} comps_tw=${compsHeadline?.usd ?? 'n/a'} comp_n=${compsHeadline?.countUsed ?? 'n/a'} spot_basis_mode=${this.PSA10_SPOT_BASIS} tierRaw=${tierCatalogRaw ?? 'null'} latestHist=${latestPt?.v ?? 'null'}@${latestPt?.t ?? 'n/a'} sales30d=${sales30d ?? 'null'} published=${spotUsd ?? 'null'} basis=${spotPriceBasis ?? 'n/a'} salesGate=${allowTierPricing ? 'high' : 'low'} reason=${pricingSuppressedReason ?? 'ok'}`,
    );
    const pricesByGrade: Record<string, number> = {};
    const upsertGrade = (gradeRaw: unknown, priceRaw: unknown) => {
      const grade = String(gradeRaw ?? '').trim();
      const price = this.parsePrice(priceRaw);
      if (!grade || price == null) return;
      pricesByGrade[grade] = price;
    };
    if (Array.isArray(merged.prices)) {
      for (const p of merged.prices) {
        if (typeof p !== 'object' || p == null) continue;
        const pp = p as { grade?: unknown; Grade?: unknown; price?: unknown };
        upsertGrade(pp.grade ?? pp.Grade, pp.price);
      }
    }
    if (Array.isArray(allPrices)) {
      for (const p of allPrices) {
        if (typeof p !== 'object' || p == null) continue;
        const pp = p as { grade?: unknown; Grade?: unknown; price?: unknown };
        upsertGrade(pp.grade ?? pp.Grade, pp.price);
      }
    }
    const basisForPricesByGrade =
      spotPriceBasis != null &&
      ['comps', 'latest_sale', 'sparse_sale_avg', 'catalog', 'comps_median'].includes(
        spotPriceBasis,
      );
    if (spotUsd != null && basisForPricesByGrade) {
      pricesByGrade[chGrade] = spotUsd;
    }
    const mkBand = (v: number | null) =>
      v != null
        ? ({
            avg: v,
            low: v,
            high: v,
            lastUpdated: headlineIso,
            saleCount:
              spotPriceBasis === 'comps' && headlineCompCount != null
                ? headlineCompCount
                : (spotPriceBasis === 'sparse_sale_avg' ||
                    spotPriceBasis === 'comps_median') &&
                    headlineCompCount != null
                  ? headlineCompCount
                  : null,
            approxSaleCount:
              spotPriceBasis === 'comps'
                ? false
                : spotPriceBasis === 'sparse_sale_avg' ||
                    spotPriceBasis === 'comps_median'
                  ? true
                  : null,
            avg1d: null,
            avg7d: null,
            avg30d: null,
            median3d: null,
            median7d: null,
            median30d: null,
          } as const)
        : null;
    return {
      enabled: true,
      searchQuery: query,
      matched: true,
      matchConfidence: confidence,
      card: {
        id: cardId,
        name: String(row.description ?? row.name ?? ''),
        cardNumber: String(row.number ?? ''),
        setName: String(row.set ?? ''),
        variant:
          typeof row.variant === 'string' && row.variant.trim()
            ? row.variant.trim()
            : null,
        setType:
          typeof row.set_type === 'string' && row.set_type.trim()
            ? row.set_type.trim()
            : null,
        category:
          typeof row.category === 'string' && row.category.trim()
            ? row.category.trim()
            : null,
        categoryGroup:
          typeof row.category_group === 'string' && row.category_group.trim()
            ? row.category_group.trim()
            : null,
        setSlug: null,
        image:
          typeof row.image === 'string' && row.image.trim()
            ? row.image.trim()
            : null,
        tcgplayerId: null,
        currency: 'USD',
        market: this.pickCardhedgerMarketField(merged),
        lastUpdated: headlineIso,
        topPrice: allowTierPricing ? spotUsd : null,
        totalSaleCount:
          typeof merged['30 Day Sales'] === 'number'
            ? Number(merged['30 Day Sales'])
            : sales30d,
        hasGraded: anyTierSignal,
        gradedTiersAvailable: [spotUsd != null ? tierU : null].filter(
          (x): x is string => Boolean(x),
        ),
        pricesByGrade,
        sales7d,
        sales30d,
        gainPct7d: typeof merged.gain === 'number' ? Number(merged.gain) : null,
        gainPct30d:
          typeof merged.gain_30day === 'number'
            ? Number(merged.gain_30day)
            : null,
        priceReliability: allowTierPricing ? 'high' : 'low',
        pricingSuppressedReason,
        spotPriceBasis,
        latestSaleAt,
        ebayNearMint: null,
        tcgplayerNearMint: null,
        ebayPsa10: tierU === 'PSA_10' ? mkBand(spotUsd) : null,
        ebayPsa9: null,
        ebayPsaTiers: {
          [tierU]: mkBand(allowTierPricing ? spotUsd : null),
        },
      },
    };
  }

  private async resolveCardForCollection(
    col: MarketplaceCollection | null,
  ): Promise<ResolvedCard> {
    const qForKey = col ? this.buildCollectionQuery(col) : null;
    const cacheKey = col?.collectionKey
      ? `${col.collectionKey}\x1e${qForKey?.psaVariety ?? ''}\x1e${qForKey?.cardhedgerCardId ?? ''}`
      : '';
    if (cacheKey) {
      const cached = this.ttlCache.get<{ result: ResolvedCard }>(
        CardhedgerMarketDataService.NS_RESOLVE,
        cacheKey,
      );
      if (cached) {
        return cached.result;
      }
    }

    const result = await this.resolveCardForCollectionUncached(col);

    if (cacheKey) {
      this.ttlCache.set(
        CardhedgerMarketDataService.NS_RESOLVE,
        cacheKey,
        { result },
        this.RESOLVE_CACHE_TTL_MS,
      );
    }
    return result;
  }

  private pickBestResolvedCardFromSearchResults(
    rows: CardhedgerCardRow[],
    q: {
      query: string;
      cardName: string;
      cardSet: string;
      cardNumber: string;
      cardhedgerCardId: string | null;
      cardhedgerSearchQuery: string | null;
      psaSpecId: string | null;
      listingDisplayTitle: string | null;
      psaVariety: string | null;
      psaSubject: string | null;
      psaBrand: string | null;
      psaYear: string | null;
    },
  ): { row: CardhedgerCardRow; confidence: 'verified' | 'approximate' } | null {
    const genericRef = psaVarietyIsGenericSportRefractorLine(q.psaVariety);
    const specificity = (row: CardhedgerCardRow) =>
      String(row.variant ?? '').trim().length;
    const scored = rows
      .map((r) => ({ r, ...this.scoreCard(r, q) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (genericRef) {
          const d = specificity(b.r) - specificity(a.r);
          if (d !== 0) return d;
        }
        return 0;
      });
    if (scored[0]?.verified) {
      return { row: scored[0].r, confidence: 'verified' };
    }
    const preciseFallback = scored.find(
      (x) => x.numberMatched && x.score >= 150,
    );
    if (preciseFallback) {
      return { row: preciseFallback.r, confidence: 'approximate' };
    }
    const numberOnly = scored.filter((x) => x.numberMatched);
    if (numberOnly.length === 1) {
      return { row: numberOnly[0].r, confidence: 'approximate' };
    }
    return null;
  }

  private async resolveCardForCollectionUncached(
    col: MarketplaceCollection | null,
  ): Promise<ResolvedCard> {
    const q = this.buildCollectionQuery(col);
    const displayLabel = String(col?.displayLabel ?? '').trim();
    const query =
      [
        q.cardhedgerSearchQuery?.trim(),
        q.listingDisplayTitle?.trim(),
        displayLabel,
        q.query?.trim(),
      ].find((s) => typeof s === 'string' && s.length > 0) ?? '';
    if (!query) return { query: '', row: null };

    if (q.cardhedgerCardId) {
      try {
        const body = await this.cardhedger.forwardJson(
          'POST',
          '/v1/cards/card-details',
          {
            body: { card_id: q.cardhedgerCardId },
          },
        );
        const rows = this.parseCardRows(body);
        if (rows[0]) {
          const storedIdOpts = { trustStoredCardhedgerCatalogId: true } as const;
          const strict = this.scoreCard(rows[0], q, storedIdOpts);
          const parallelBad = this.parallelRowFailsExpectation(
            q.psaVariety,
            rows[0],
            storedIdOpts,
          );
          /** Same trust as psaSpecId map: explicit catalog id + parallel check; allow number-strong rows. */
          const trustCardId =
            !parallelBad &&
            (strict.verified || strict.numberMatched);
          if (trustCardId) {
            return {
              query,
              row: rows[0],
              confidence: strict.verified ? 'verified' : 'approximate',
            };
          }
          this.logger.debug(
            `card-details card_id=${q.cardhedgerCardId} not trusted (parallelBad=${parallelBad} verified=${strict.verified} numberMatched=${strict.numberMatched} score=${strict.score}) — search fallback`,
          );
        }
      } catch {
        // fall through to search
      }
    }

    const mappedFromSpec =
      q.psaSpecId && this.psaSpecIdMap.has(q.psaSpecId)
        ? (this.psaSpecIdMap.get(q.psaSpecId) ?? null)
        : null;
    if (mappedFromSpec) {
      try {
        const body = await this.cardhedger.forwardJson(
          'POST',
          '/v1/cards/card-details',
          {
            body: { card_id: mappedFromSpec },
          },
        );
        const rows = this.parseCardRows(body);
        if (rows[0]) {
          const strict = this.scoreCard(rows[0], q);
          if (
            (strict.verified || strict.numberMatched) &&
            !this.parallelRowFailsExpectation(q.psaVariety, rows[0])
          ) {
            return {
              query,
              row: rows[0],
              confidence: strict.verified ? 'verified' : 'approximate',
            };
          }
        }
      } catch {
        // fall through
      }
    }

    const searchCandidates = this.collectCardhedgerSearchCandidates(
      q,
      displayLabel,
    );

    for (const sq of searchCandidates) {
      try {
        const body = await this.cardhedger.forwardJson(
          'POST',
          '/v1/cards/card-search',
          {
            body: {
              search: sq,
              page: 1,
              page_size: CARDHEDGER_CARD_SEARCH_PAGE_SIZE,
            },
          },
        );
        const r = this.parseCardRows(body);
        if (r.length === 0) continue;
        const picked = this.pickBestResolvedCardFromSearchResults(r, q);
        if (picked) {
          return {
            query,
            row: picked.row,
            confidence: picked.confidence,
          };
        }
      } catch {
        // try next candidate
      }
    }
    return { query, row: null };
  }

  async getPreviewForCollection(
    col: MarketplaceCollection | null,
  ): Promise<MarketCollectionPreview> {
    if (!col) {
      return {
        enabled: this.isConfigured(),
        searchQuery: '',
        matched: false,
        message: 'Collection not found',
        card: null,
      };
    }
    if (!this.isConfigured()) {
      const q = this.buildCollectionQuery(col);
      return {
        enabled: false,
        searchQuery: q.query,
        matched: false,
        message: 'Cardhedger is not configured (CARDHEDGER_API_KEY)',
        card: null,
      };
    }

    try {
      const r = await this.resolveCardForCollection(col);
      return this.buildPreviewFromResolved(r, col);
    } catch (e) {
      return {
        enabled: true,
        searchQuery: this.buildCollectionQuery(col).query,
        matched: false,
        message: e instanceof Error ? e.message : String(e),
        card: null,
      };
    }
  }

  private async buildPreviewFromResolved(
    r: ResolvedCard,
    col?: MarketplaceCollection | null,
  ): Promise<MarketCollectionPreview> {
    if (!r.row || !r.confidence) {
      return {
        enabled: true,
        searchQuery: r.query,
        matched: false,
        message: 'No matching Cardhedger card found',
        card: null,
      };
    }
    const tier = this.historyTierForCollection(col ?? null);
    return this.rowToPreview(r.row, r.query, r.confidence, tier);
  }

  async getTierPriceHistoryForCollection(
    col: MarketplaceCollection | null,
    options: {
      tier: string;
      period: MarketHistoryPeriod;
      maxCalendarDays: number;
      maxRequests?: number;
    },
  ): Promise<MarketPriceHistoryResult> {
    const days = Math.min(
      4000,
      Math.max(1, Math.floor(options.maxCalendarDays)),
    );
    const tier = String(options.tier ?? 'PSA_10').trim() || 'PSA_10';
    if (!col) {
      return {
        enabled: this.isConfigured(),
        searchQuery: '',
        matched: false,
        message: 'Collection not found',
        days,
        tier,
        period: options.period,
        points: [],
        source: `cardhedger:${tier}`,
        upstreamRequests: 0,
      };
    }
    if (!this.isConfigured()) {
      return {
        enabled: false,
        searchQuery: this.buildCollectionQuery(col).query,
        matched: false,
        message: 'Cardhedger is not configured (CARDHEDGER_API_KEY)',
        days,
        tier,
        period: options.period,
        points: [],
        source: `cardhedger:${tier}`,
        upstreamRequests: 0,
      };
    }

    const resolved = await this.resolveCardForCollection(col);
    return this.buildHistoryFromResolved(resolved, options);
  }

  private async buildHistoryFromResolved(
    resolved: ResolvedCard,
    options: {
      tier: string;
      period: MarketHistoryPeriod;
      maxCalendarDays: number;
      maxRequests?: number;
    },
  ): Promise<MarketPriceHistoryResult> {
    const days = Math.min(
      4000,
      Math.max(1, Math.floor(options.maxCalendarDays)),
    );
    const tier = String(options.tier ?? 'PSA_10').trim() || 'PSA_10';

    if (!resolved.row || !resolved.confidence) {
      return {
        enabled: true,
        searchQuery: resolved.query,
        matched: false,
        message: 'No matching Cardhedger card found',
        matchConfidence: resolved.confidence,
        days,
        tier,
        period: options.period,
        points: [],
        source: `cardhedger:${tier}`,
        upstreamRequests: 1,
      };
    }

    const resolvedCardId = String(resolved.row.card_id ?? '').trim();

    let history: Array<{ t: number; v: number }> = [];
    let historyUpstreamHits = 0;

    if (resolvedCardId) {
      /**
       * Match {@link rowToPreview}: headline PSA 10 uses `prices-by-card` up to
       * {@link CARDHEDGER_PRICES_BY_CARD_MAX_DAYS}. If we only fetch the UI window (e.g. 90d),
       * sparse/recent series can end on an older daily close while the preview shows the true
       * latest observation from a full-year fetch — chart vs market price diverge.
       */
      const historyFetchDays = Math.max(
        days,
        CARDHEDGER_PRICES_BY_CARD_MAX_DAYS,
      );
      const adaptive = await this.fetchTierHistoryByCardAdaptive(
        resolvedCardId,
        tier,
        historyFetchDays,
      );
      history = adaptive.pts;
      historyUpstreamHits = adaptive.upstreamRequests;
    }

    const historyMerged = await this.augmentPsa10HistoryWithComps(
      resolvedCardId,
      tier,
      history,
    );

    if (historyMerged.length >= 2) {
      const tierU = tier.trim().toUpperCase();
      const compsAugmented =
        tierU !== '' &&
        (historyMerged.length !== history.length ||
          JSON.stringify(historyMerged) !== JSON.stringify(history));
      return {
        enabled: true,
        searchQuery: resolved.query,
        matched: true,
        matchConfidence: resolved.confidence,
        days,
        tier,
        period: options.period,
        points: historyMerged,
        source: compsAugmented
          ? `cardhedger:${tier}:history:comps_sales`
          : `cardhedger:${tier}:history`,
        upstreamRequests: historyUpstreamHits,
      };
    }

    const allPrices = resolvedCardId
      ? await this.fetchAllPricesByCard(resolvedCardId)
      : [];
    const mergedRow =
      allPrices.length > 0
        ? ({ ...resolved.row, prices: allPrices } as CardhedgerCardRow)
        : resolved.row;
    const spot = this.readTierSpot(mergedRow, tier);
    if (spot.usd == null) {
      return {
        enabled: true,
        searchQuery: resolved.query,
        matched: true,
        matchConfidence: resolved.confidence,
        message: `No ${tier} spot price from Cardhedger`,
        days,
        tier,
        period: options.period,
        points: [],
        source: `cardhedger:${tier}`,
        upstreamRequests: 1,
      };
    }
    const catalogSpotPoint = {
      t: Math.floor(Date.now() / 1000),
      v: spot.usd,
    };
    return {
      enabled: true,
      searchQuery: resolved.query,
      matched: true,
      matchConfidence: resolved.confidence,
      days,
      tier,
      period: options.period,
      points: [catalogSpotPoint],
      source: `cardhedger:${tier}:catalog_spot`,
      upstreamRequests: 1,
    };
  }

  /**
   * Resolves the Cardhedger card once and returns both the price preview and tier price history
   * in parallel, avoiding the duplicate resolveCardForCollection call that was happening when
   * getPreviewForCollection and getTierPriceHistoryForCollection were called together.
   */
  async getBundledCardData(
    col: MarketplaceCollection | null,
    options: {
      tier: string;
      period: MarketHistoryPeriod;
      maxCalendarDays: number;
      maxRequests?: number;
    },
  ): Promise<{
    preview: MarketCollectionPreview;
    history: MarketPriceHistoryResult;
  }> {
    if (!col) {
      const [preview, history] = await Promise.all([
        this.getPreviewForCollection(null),
        this.getTierPriceHistoryForCollection(null, options),
      ]);
      return { preview, history };
    }
    if (!this.isConfigured()) {
      const q = this.buildCollectionQuery(col);
      const notConfigured: MarketCollectionPreview = {
        enabled: false,
        searchQuery: q.query,
        matched: false,
        message: 'Cardhedger is not configured (CARDHEDGER_API_KEY)',
        card: null,
      };
      const days = Math.min(
        4000,
        Math.max(1, Math.floor(options.maxCalendarDays)),
      );
      const tier = 'PSA_10';
      const notConfiguredHist: MarketPriceHistoryResult = {
        enabled: false,
        searchQuery: q.query,
        matched: false,
        message: 'Cardhedger is not configured (CARDHEDGER_API_KEY)',
        days,
        tier,
        period: options.period,
        points: [],
        source: `cardhedger:${tier}`,
        upstreamRequests: 0,
      };
      return { preview: notConfigured, history: notConfiguredHist };
    }

    // Resolve once; use result for both preview and history in parallel.
    const resolved = await this.resolveCardForCollection(col);
    const [preview, history] = await Promise.all([
      this.buildPreviewFromResolved(resolved, col).catch(
        (e) =>
          ({
            enabled: true,
            searchQuery: resolved.query,
            matched: false,
            message: e instanceof Error ? e.message : String(e),
            card: null,
          }) satisfies MarketCollectionPreview,
      ),
      this.buildHistoryFromResolved(resolved, options),
    ]);
    return { preview, history };
  }

  async getNearMintHistoryForCollection(
    col: MarketplaceCollection | null,
    options?: { days?: number; maxRequests?: number },
  ): Promise<MarketPriceHistoryResult> {
    const days = Math.min(365, Math.max(1, Math.floor(options?.days ?? 90)));
    return this.getTierPriceHistoryForCollection(col, {
      tier: 'PSA_10',
      period: days <= 7 ? '7d' : days <= 30 ? '30d' : days <= 90 ? '90d' : '1y',
      maxCalendarDays: days,
      maxRequests: options?.maxRequests ?? 1,
    });
  }

  async getBatchMintPreviewsFromTokenIds(
    tokenIds: number[],
  ): Promise<Record<number, MarketCollectionPreview>> {
    const out: Record<number, MarketCollectionPreview> = {};
    const ids = [
      ...new Set((tokenIds ?? []).map((n) => Math.floor(Number(n)))),
    ].filter((n) => Number.isFinite(n) && n >= 0);
    if (ids.length === 0) return out;

    const pack = await this.blockchain.batchRwaMetadata(ids);
    // PSA Public API는 동시 다발 호출에 429가 잘 난다. in-flight 합류 외에도 배치 자체를 순차 처리.
    for (const item of pack.items) {
        const meta = item.metadata;
        if (!meta) {
          out[item.tokenId] = {
            enabled: this.isConfigured(),
            searchQuery: '',
            matched: false,
            message: 'Metadata unavailable',
            card: null,
          };
          continue;
        }
        const graded =
          (meta.properties as Record<string, unknown> | undefined)?.graded ??
          (meta.graded as Record<string, unknown> | undefined);
        const ch = (graded as Record<string, unknown> | undefined)
          ?.cardhedger as Record<string, unknown> | undefined;
        const cardId =
          typeof ch?.cardId === 'string' && ch.cardId.trim()
            ? ch.cardId.trim()
            : '';
        const card = (graded as Record<string, unknown> | undefined)?.card as
          | Record<string, unknown>
          | undefined;
        const qFromCardhedger =
          typeof ch?.searchQuery === 'string' && ch.searchQuery.trim()
            ? ch.searchQuery.trim()
            : '';
        const query =
          qFromCardhedger ||
          [
            String(card?.name ?? ''),
            String(card?.number ?? ''),
            String(card?.set ?? ''),
          ]
            .join(' ')
            .trim();

        const extracted = extractBucketComponentsFromMetadata(meta);

        const psaSpecExtras = (): Record<string, unknown> => {
          const psaObj =
            typeof (graded as Record<string, unknown> | undefined)?.psa ===
              'object' &&
            (graded as Record<string, unknown> | undefined)?.psa != null
              ? (((graded as Record<string, unknown>).psa as Record<
                  string,
                  unknown
                >) ?? null)
              : null;
          const specRaw = psaObj?.specId;
          const spec =
            typeof specRaw === 'number' && Number.isFinite(specRaw)
              ? String(Math.floor(specRaw))
              : typeof specRaw === 'string' && specRaw.trim()
                ? specRaw.trim()
                : '';
          return spec ? { psaSpecId: spec } : {};
        };

        const psaMirror = await this.enrichPsaMirrorFromCertLookup(
          graded as Record<string, unknown> | undefined,
          this.psaMirrorFromGradedBlock(
            graded as Record<string, unknown> | undefined,
          ),
        );

        const componentsPayload: Record<string, unknown> = extracted
          ? {
              ...(extracted as unknown as Record<string, unknown>),
              ...psaSpecExtras(),
              ...psaMirror,
              ...(cardId ? { cardhedgerCardId: cardId } : {}),
            }
          : {
              cardName: String(card?.name ?? ''),
              cardSet: String(card?.set ?? ''),
              cardNumber: String(card?.number ?? ''),
              ...psaSpecExtras(),
              ...psaMirror,
              ...(cardId ? { cardhedgerCardId: cardId } : {}),
            };

        const syntheticCol = {
          collectionKey: `mint_${item.tokenId}`,
          displayLabel: String(meta.name ?? query ?? ''),
          queryUsed: query,
          components: componentsPayload,
          coverImageUrl: null,
          createdAt: new Date(),
        } as MarketplaceCollection;
        out[item.tokenId] = await this.getPreviewForCollection(syntheticCol);
    }
    return out;
  }
}
