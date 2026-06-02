/* eslint-disable @typescript-eslint/no-base-to-string -- Cardhedger API payloads are loosely typed; string coercion is intentional for keys and logging. */
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  TTL_CACHE_PROVIDER,
  type TtlCacheProvider,
} from '../../common/cache/ttl-cache.interface';
import { CardhedgerMetricsService } from '../../common/metrics/cardhedger-metrics.service';
import { CardhedgerService } from '../../cardhedger/cardhedger.service';
import {
  normalizeForExactCardNumberKey,
  normalizeForExactCatalogMatch,
  primaryCardNumber,
} from '../utils/card-match.util';
import {
  cardhedgerExtraSearchQueries,
  cardhedgerSetAliasTokens,
  hintsLookLikeMegaEvolutionPromo,
  hintsLookLikeSvBlackStarPromo,
} from '../utils/cardhedger-search-alias.util';
import {
  cardhedgerRowMatchesMarketParallelKey,
  marketParallelKeyFromPsaVariety,
} from '../utils/market-parallel-key.util';
import { cardhedgerRowMatchesPsaVariety } from '../utils/cardhedger-psa-variety.util';
import {
  chromeColorTokensIn,
  mergePsaVarietyWithMintVariant,
  psaVarietyIsGenericSportRefractorLine,
  psaVarietyIsIllustrationRareLabel,
  psaVarietyIsSpecialIllustrationRareLabel,
  psaVarietyRequiresNonBaseCardhedgerRow,
} from '../../psa/psa-variety-catalog.util';
import { varietyHintsForSearch } from '../../psa/utils/psa-ocr.util';
import { readPsaSpecIdCardhedgerMapFromConfig } from '../utils/psa-spec-cardhedger-map.util';
import type { MarketplaceCollection } from '../entities/marketplace-collection.entity';
import type { CardhedgerCardRow } from './cardhedger-market-data.types';

/**
 * `POST /v1/cards/card-search` — slightly larger page so niche Brand/Subject lines still surface
 * a usable row after broader PSA-derived queries.
 */
const CARDHEDGER_CARD_SEARCH_PAGE_SIZE = 35;

/**
 * Return type of resolveCardForCollection — shared with CardhedgerMarketDataService
 * for downstream preview/pricing methods.
 */
export type ResolvedCard = {
  query: string;
  row: CardhedgerCardRow | null;
  confidence?: 'verified' | 'approximate';
};

/**
 * Card resolution layer extracted from the CardhedgerMarketDataService god service (P1.6).
 *
 * Responsible for:
 *   - Building search hints from collection components (buildCollectionQuery)
 *   - Executing card-search / card-details against the Cardhedger API
 *   - Scoring and picking the best matching catalog row
 *   - Caching resolved results (NS_RESOLVE, 5-min TTL)
 *
 * Does NOT handle pricing, comps, tier history, mint previews, or AI insight.
 * Those remain in CardhedgerMarketDataService, which injects this service.
 */
@Injectable()
export class CardhedgerResolveService {
  private readonly logger = new Logger(CardhedgerResolveService.name);
  private readonly psaSpecIdMap = new Map<string, string>();
  private readonly RESOLVE_CACHE_TTL_MS = 5 * 60 * 1000;
  private static readonly NS_RESOLVE = 'cardhedger:resolve';

  constructor(
    private readonly cardhedger: CardhedgerService,
    private readonly config: ConfigService,
    @Inject(TTL_CACHE_PROVIDER) private readonly ttlCache: TtlCacheProvider,
    /**
     * Optional so ResolveService can be used in test contexts without the
     * metrics module. When present, all resolution path outcomes are forwarded
     * to the shared per-minute aggregator.
     */
    @Optional() private readonly metrics?: CardhedgerMetricsService,
  ) {
    this.psaSpecIdMap = readPsaSpecIdCardhedgerMapFromConfig(this.config);
  }

  /**
   * Hard cap on the number of card-search candidates evaluated per resolve call.
   * Prevents O(N) API amplification when query generation produces many variants.
   * Config key: CARDHEDGER_MAX_SEARCH_CANDIDATES (default 4, max 20)
   */
  private maxSearchCandidates(): number {
    const raw = Number(
      this.config.get<string>('CARDHEDGER_MAX_SEARCH_CANDIDATES') ?? '4',
    );
    return Number.isFinite(raw) && raw >= 1 ? Math.min(Math.floor(raw), 20) : 4;
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
    /** Bucket parallel facet (`base` or PSA Variety slug) — Cardhedger row must match. */
    marketParallelKey: string;
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
    const mintVariantRaw = comp['mintCardVariant'];
    const psaVariety = mergePsaVarietyWithMintVariant(
      typeof psaVarietyRaw === 'string' ? psaVarietyRaw : null,
      typeof mintVariantRaw === 'string' ? mintVariantRaw : null,
    ) || null;
    const parallelRaw = comp['marketParallelKey'];
    const marketParallelKey =
      typeof parallelRaw === 'string' && parallelRaw.trim()
        ? parallelRaw.trim().toLowerCase()
        : marketParallelKeyFromPsaVariety(psaVariety);
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
      marketParallelKey,
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
   * does not match one long "mint searchQuery".
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

    const promoBlob = [q.cardSet, q.psaBrand, q.cardName, q.query]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    void promoBlob; // assembled for future promo-detection guards
    for (const sq of cardhedgerExtraSearchQueries({
      cardName: q.cardName,
      cardNumber: q.cardNumber,
      cardSet: q.cardSet,
      psaBrand: q.psaBrand,
      psaSubject: q.psaSubject,
    })) {
      push(sq);
    }

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
    if (!cardhedgerRowMatchesPsaVariety(row as Record<string, unknown>, pv)) {
      return true;
    }
    const colorTokens = chromeColorTokensIn(pv);
    if (colorTokens.length > 0) {
      const blob = this.rowParallelBlob(row).toLowerCase();
      if (!colorTokens.every((c) => blob.includes(c))) return true;
    }
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
      marketParallelKey?: string;
    },
    parallelOpts?: { trustStoredCardhedgerCatalogId?: boolean },
  ): { score: number; verified: boolean; numberMatched: boolean } {
    const parallelKey = (hints.marketParallelKey ?? 'base').trim().toLowerCase();
    if (
      !cardhedgerRowMatchesMarketParallelKey(
        row as Record<string, unknown>,
        parallelKey,
        hints.psaVariety,
      )
    ) {
      return { score: 0, verified: false, numberMatched: false };
    }

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
      ...cardhedgerSetAliasTokens(hints.cardSet, hints.psaBrand ?? null),
    ]
      .filter(Boolean)
      .join(' ');
    const nameCoverage = this.coverageRatio(wantNamePool, rowName);
    const setCoverage = this.coverageRatio(wantSetPool, rowSet);
    const nameTokenMatch = nameCoverage >= 0.6;
    const setTokenMatch = setCoverage >= 0.38;

    const nameMatched = nameSubstring || nameTokenMatch;
    const setMatched = setSubstring || setTokenMatch;

    let score = 0;
    if (numberMatched) score += 100;
    if (setMatched) score += 60;
    if (nameMatched) score += 50;

    const pv = hints.psaVariety?.trim() ?? '';
    if (pv && psaVarietyRequiresNonBaseCardhedgerRow(pv)) {
      if (cardhedgerRowMatchesPsaVariety(row as Record<string, unknown>, pv)) {
        score += 40;
        const pvLower = pv.toLowerCase();
        const parallelBlob = this.rowParallelBlob(row).toLowerCase();
        if (parallelBlob.includes(pvLower)) score += 30;
      }
    }
    const hintBlob = [
      hints.cardSet,
      hints.cardName,
      hints.listingDisplayTitle,
      hints.cardhedgerSearchQuery,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (
      /\b(precious\s*metal|pmg)\b/.test(hintBlob) &&
      this.rowLooksLikePreciousMetalGemsRow(row)
    ) {
      score += 35;
    }

    const verified = numberMatched && setMatched && nameMatched;
    return { score, verified, numberMatched };
  }

  private rowLooksLikePreciousMetalGemsRow(row: CardhedgerCardRow): boolean {
    const blob = this.rowParallelBlob(row).toLowerCase();
    return (
      blob.includes('precious metal gems') ||
      blob.includes('precious metal') ||
      /\bpmg\b/.test(blob)
    );
  }

  /** PMG / insert line when PSA Variety or listing copy names a parallel beyond Base. */
  private collectionHintsWantPreciousMetalGems(q: {
    psaVariety: string | null;
    listingDisplayTitle: string | null;
    cardSet: string;
    cardName: string;
    query: string;
    cardhedgerSearchQuery: string | null;
  }): boolean {
    const pv = q.psaVariety?.trim() ?? '';
    if (pv && psaVarietyRequiresNonBaseCardhedgerRow(pv)) return true;
    const blob = [
      q.listingDisplayTitle,
      q.cardSet,
      q.cardName,
      q.query,
      q.cardhedgerSearchQuery,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return /\b(precious\s*metal|pmg)\b/.test(blob);
  }

  /** MEP / EN-ME → Cardhedger `2025 Pokemon Mega Evolution Promo` (#023 Charizard, etc.). */
  private pickMegaEvolutionPromoRow(
    numberMatched: Array<{
      r: CardhedgerCardRow;
      score: number;
      verified: boolean;
      numberMatched: boolean;
    }>,
    q: {
      cardSet: string;
      psaBrand: string | null;
      cardName: string;
    },
  ): CardhedgerCardRow | null {
    if (!hintsLookLikeMegaEvolutionPromo(q)) return null;
    const inSet = numberMatched.filter((x) =>
      String(x.r.set ?? '')
        .toLowerCase()
        .includes('mega evolution promo'),
    );
    if (inSet.length === 0) return null;
    const nameTokens = String(q.cardName ?? '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 2 && !['mega', 'ex'].includes(t));
    const primaryName = nameTokens[0] ?? '';
    const byName = primaryName
      ? inSet.filter((x) =>
          String(x.r.name ?? x.r.description ?? '')
            .toLowerCase()
            .includes(primaryName),
        )
      : inSet;
    const pool = byName.length > 0 ? byName : inSet;
    const base = pool.find(
      (x) => String(x.r.variant ?? '').trim().toLowerCase() === 'base',
    );
    return (base ?? pool[0])!.r;
  }

  /** SVP / EN-SV Black Star promos — multiple `#44` rows (ETB vs PC ETB vs poster). */
  private pickPokemonBlackStarPromoRow(
    numberMatched: Array<{
      r: CardhedgerCardRow;
      score: number;
      verified: boolean;
      numberMatched: boolean;
    }>,
    q: {
      cardSet: string;
      psaBrand: string | null;
      psaVariety: string | null;
      cardName: string;
    },
  ): CardhedgerCardRow | null {
    if (!hintsLookLikeSvBlackStarPromo(q)) {
      return null;
    }
    const inSet = numberMatched.filter((x) =>
      String(x.r.set ?? '')
        .toLowerCase()
        .includes('black star promo'),
    );
    if (inSet.length === 0) return null;
    const pv = String(q.psaVariety ?? '').toLowerCase();
    if (/\bpokemon\s*center\b/.test(pv)) {
      const pc = inSet.find(
        (x) => String(x.r.variant ?? '').toLowerCase() === 'pokemon center',
      );
      if (pc) return pc.r;
    }
    if (/\b(elite\s+trainer|etb)\b/.test(pv)) {
      const etb = inSet.find((x) =>
        /elite\s+trainer|etb/i.test(String(x.r.name ?? x.r.description ?? '')),
      );
      if (etb) return etb.r;
    }
    const base = inSet.find(
      (x) => String(x.r.variant ?? '').trim().toLowerCase() === 'base',
    );
    return (base ?? inSet[0])!.r;
  }

  /**
   * PSA slab with no parallel/insert line (e.g. plain 2018 Topps Chrome #150) — Cardhedger
   * returns many same-number parallels. Prefer `variant: Base` for headline comps.
   */
  private pickBaseWhenPsaOmitsParallel(
    numberOnly: Array<{
      r: CardhedgerCardRow;
      score: number;
      verified: boolean;
    }>,
    psaVariety: string | null,
  ): { row: CardhedgerCardRow; confidence: 'verified' | 'approximate' } | null {
    const pv = psaVariety?.trim() ?? '';
    if (pv && psaVarietyRequiresNonBaseCardhedgerRow(pv)) return null;
    const bases = numberOnly.filter(
      (x) => String(x.r.variant ?? '').trim().toLowerCase() === 'base',
    );
    if (bases.length === 0) return null;
    const best = [...bases].sort((a, b) => b.score - a.score)[0]!;
    return {
      row: best.r,
      confidence: best.verified ? 'verified' : 'approximate',
    };
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
      marketParallelKey: string;
    },
  ): { row: CardhedgerCardRow; confidence: 'verified' | 'approximate' } | null {
    const genericRef = psaVarietyIsGenericSportRefractorLine(q.psaVariety);
    const pvLower = String(q.psaVariety ?? '')
      .trim()
      .toLowerCase();
    const colorHints = chromeColorTokensIn(
      [q.psaVariety, q.listingDisplayTitle, q.cardhedgerSearchQuery]
        .filter(Boolean)
        .join(' '),
    );
    const varietyInRowBlob = (row: CardhedgerCardRow): boolean =>
      Boolean(
        pvLower &&
          this.rowParallelBlob(row).toLowerCase().includes(pvLower),
      );
    const colorHitsInRow = (row: CardhedgerCardRow): number => {
      if (colorHints.length === 0) return 0;
      const blob = this.rowParallelBlob(row).toLowerCase();
      return colorHints.filter((c) => blob.includes(c)).length;
    };
    const specificity = (row: CardhedgerCardRow) =>
      String(row.variant ?? '').trim().length;
    const scored = rows
      .map((r) => ({ r, ...this.scoreCard(r, q) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (colorHints.length > 0) {
          const dc = colorHitsInRow(b.r) - colorHitsInRow(a.r);
          if (dc !== 0) return dc;
        }
        if (pvLower && psaVarietyRequiresNonBaseCardhedgerRow(pvLower)) {
          const d =
            Number(varietyInRowBlob(b.r)) - Number(varietyInRowBlob(a.r));
          if (d !== 0) return d;
        }
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
    if (numberOnly.length > 1) {
      const mep = this.pickMegaEvolutionPromoRow(numberOnly, q);
      if (mep) {
        const hit = numberOnly.find((x) => x.r === mep);
        return {
          row: mep,
          confidence: hit?.verified ? 'verified' : 'approximate',
        };
      }
      const bsp = this.pickPokemonBlackStarPromoRow(numberOnly, q);
      if (bsp) {
        const hit = numberOnly.find((x) => x.r === bsp);
        return {
          row: bsp,
          confidence: hit?.verified ? 'verified' : 'approximate',
        };
      }
      /**
       * Metal Universe #23 (and similar) returns multiple Cardhedger rows (Base vs PMG).
       * Returning null left the UI at N/A even when a strong parallel row exists.
       */
      if (this.collectionHintsWantPreciousMetalGems(q)) {
        const pmg = numberOnly.find((x) =>
          this.rowLooksLikePreciousMetalGemsRow(x.r),
        );
        if (pmg) {
          return {
            row: pmg.r,
            confidence: pmg.verified ? 'verified' : 'approximate',
          };
        }
        const nonBase = numberOnly.find(
          (x) => String(x.r.variant ?? '').trim().toLowerCase() !== 'base',
        );
        if (nonBase) {
          return {
            row: nonBase.r,
            confidence: nonBase.verified ? 'verified' : 'approximate',
          };
        }
      }
      if (q.marketParallelKey === 'base') {
        const baseWhenNoParallel = this.pickBaseWhenPsaOmitsParallel(
          numberOnly,
          q.psaVariety,
        );
        if (baseWhenNoParallel) return baseWhenNoParallel;
      }
      const best = numberOnly[0]!;
      return {
        row: best.r,
        confidence: best.verified ? 'verified' : 'approximate',
      };
    }

    /** Mint bucket sometimes omits card # — still match on name + set tokens. */
    const wantNum = String(q.cardNumber ?? '').trim();
    if (!wantNum && scored[0] && scored[0].score >= 110) {
      return {
        row: scored[0].r,
        confidence: scored[0].verified ? 'verified' : 'approximate',
      };
    }

    return null;
  }

  async resolveCardForCollection(
    col: MarketplaceCollection | null,
  ): Promise<ResolvedCard> {
    const qForKey = col ? this.buildCollectionQuery(col) : null;
    const cacheKey = col?.collectionKey
      ? `${col.collectionKey}\x1e${qForKey?.psaVariety ?? ''}\x1e${qForKey?.cardhedgerCardId ?? ''}`
      : '';
    if (cacheKey) {
      const cached = this.ttlCache.get<{ result: ResolvedCard }>(
        CardhedgerResolveService.NS_RESOLVE,
        cacheKey,
      );
      if (cached) {
        return cached.result;
      }
    }

    const result = await this.resolveCardForCollectionUncached(col);

    if (cacheKey) {
      this.ttlCache.set(
        CardhedgerResolveService.NS_RESOLVE,
        cacheKey,
        { result },
        this.RESOLVE_CACHE_TTL_MS,
      );
    }
    return result;
  }

  private async resolveCardForCollectionUncached(
    col: MarketplaceCollection | null,
  ): Promise<ResolvedCard> {
    const q = this.buildCollectionQuery(col);
    const collectionKey = String(col?.collectionKey ?? '').toLowerCase();
    const displayLabel = String(col?.displayLabel ?? '').trim();
    const query =
      [
        q.cardhedgerSearchQuery?.trim(),
        q.listingDisplayTitle?.trim(),
        displayLabel,
        q.query?.trim(),
      ].find((s) => typeof s === 'string' && s.length > 0) ?? '';
    if (!query) return { query: '', row: null };

    // ── Path 1: stored cardhedgerCardId → card-details direct lookup ──────
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
            const confidence = strict.verified ? 'verified' : 'approximate';
            this.metrics?.recordResolvePath('card_details');
            this.logger.log(
              JSON.stringify({
                msg: 'resolve_path',
                path: 'card_details',
                key: collectionKey,
                cardId: q.cardhedgerCardId,
                confidence,
              }),
            );
            return { query, row: rows[0], confidence };
          }
          this.logger.debug(
            `card-details card_id=${q.cardhedgerCardId} not trusted (parallelBad=${parallelBad} verified=${strict.verified} numberMatched=${strict.numberMatched} score=${strict.score}) — search fallback`,
          );
        }
      } catch (e) {
        // Circuit open or network failure — fall through to next path
        const isCircuitOpen =
          e instanceof Error && e.message.includes('circuit breaker');
        if (isCircuitOpen) this.metrics?.recordResolvePath('circuit_open');
      }
    }

    // ── Path 2: psaSpecId static map → card-details lookup ───────────────
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
            const confidence = strict.verified ? 'verified' : 'approximate';
            this.metrics?.recordResolvePath('spec_id');
            this.logger.log(
              JSON.stringify({
                msg: 'resolve_path',
                path: 'spec_id',
                key: collectionKey,
                specId: q.psaSpecId,
                mappedCardId: mappedFromSpec,
                confidence,
              }),
            );
            return { query, row: rows[0], confidence };
          }
        }
      } catch (e) {
        const isCircuitOpen =
          e instanceof Error && e.message.includes('circuit breaker');
        if (isCircuitOpen) this.metrics?.recordResolvePath('circuit_open');
      }
    }

    // ── Path 3: card-search fallback (capped by CARDHEDGER_MAX_SEARCH_CANDIDATES) ──
    const allSearchCandidates = this.collectCardhedgerSearchCandidates(
      q,
      displayLabel,
    );
    const cap = this.maxSearchCandidates();
    const searchCandidates = allSearchCandidates.slice(0, cap);

    if (allSearchCandidates.length > cap) {
      this.logger.debug(
        JSON.stringify({
          msg: 'resolve_search_candidates_capped',
          key: collectionKey,
          total: allSearchCandidates.length,
          cap,
        }),
      );
    }

    for (let i = 0; i < searchCandidates.length; i++) {
      const sq = searchCandidates[i];
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
          // depth = 1-based index of the first successful candidate
          const depth = i + 1;
          this.metrics?.recordResolvePath('search', depth);
          this.logger.log(
            JSON.stringify({
              msg: 'resolve_path',
              path: 'search',
              key: collectionKey,
              query: sq,
              candidateIndex: i,
              candidateCount: searchCandidates.length,
              cardId: picked.row.id,
              confidence: picked.confidence,
            }),
          );
          return { query, row: picked.row, confidence: picked.confidence };
        }
      } catch (e) {
        const isCircuitOpen =
          e instanceof Error && e.message.includes('circuit breaker');
        if (isCircuitOpen) {
          this.metrics?.recordResolvePath('circuit_open');
          break; // circuit is open — no point trying remaining candidates
        }
        // Other error (network transient) — try next candidate
      }
    }

    this.metrics?.recordResolvePath('none');
    this.logger.log(
      JSON.stringify({
        msg: 'resolve_path',
        path: 'none',
        key: collectionKey,
        query,
        searchCandidateCount: searchCandidates.length,
      }),
    );
    return { query, row: null };
  }
}
