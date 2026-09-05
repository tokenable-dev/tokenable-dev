/* eslint-disable @typescript-eslint/no-base-to-string -- Cardhedger API payloads are loosely typed; string coercion is intentional for keys and logging. */
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  TTL_CACHE_PROVIDER,
  type TtlCacheProvider,
} from '../../common/cache/ttl-cache.interface';
import { CardhedgerMetricsService } from '../../common/metrics/cardhedger-metrics.service';
import { CardhedgerService } from '../../cardhedger/cardhedger.service';
import { readCardhedgerFeatureFlags } from '../../config/cardhedger-feature-flags.util';
import {
  cardNumberTokenForCardhedgerSearch,
  cardIdFromPsaCertLookup,
  catalogInsertNumberCompatibleWithRow,
  catalogTcgPrefixedNumberCompatible,
  catalogIdentityNameNeedles,
  catalogProductFamiliesCompatible,
  catalogRowTrustedForMarketData,
  type CatalogTrustHints,
  normalizeForExactCardNumberKey,
  normalizeForExactCatalogMatch,
  primaryCardNumber,
} from '../utils/card-match.util';
import {
  cardhedgerExtraSearchQueries,
  cardhedgerSetAliasTokens,
  hintsLookLikeMegaEvolutionPromo,
  hintsLookLikeOnePieceChampionshipStamp,
  hintsLookLikePrizmRookieSignatures,
  hintsLookLikeSvBlackStarPromo,
  hintsLookLikeSwshBlackStarPromo,
} from '../utils/cardhedger-search-alias.util';
import {
  cardhedgerRowMatchesMarketParallelKey,
  marketParallelKeyFromPsaVariety,
} from '../utils/market-parallel-key.util';
import {
  cardhedgerCatalogVariantSpecificity,
  cardhedgerRowIsPrintFinishOnly,
  cardhedgerRowMatchesPsaVariety,
  psaVarietyHasNamedCollectibleIdentity,
} from '../utils/cardhedger-psa-variety.util';
import {
  chromeColorTokensIn,
  mergePsaVarietyWithMintVariant,
  psaVarietyIndicatesGenericBaseLine,
  psaVarietyIsGenericSportRefractorLine,
  psaVarietyIsPokemonRarityLabel,
  psaVarietyRequiresNonBaseCardhedgerRow,
} from '../../psa/psa-variety-catalog.util';
import { varietyHintsForSearch } from '../../psa/utils/psa-ocr.util';
import type { MarketplaceCollection } from '../entities/marketplace-collection.entity';
import { psaCertNumberFromCollectionRow } from '../utils/collection-row.util';
import type { CardhedgerCardRow } from './cardhedger-market-data.types';
import { CardhedgerCertLookupService } from './cardhedger-cert-lookup.service';

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
  private readonly RESOLVE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
  private static readonly NS_RESOLVE = 'cardhedger:resolve';

  constructor(
    private readonly cardhedger: CardhedgerService,
    private readonly config: ConfigService,
    private readonly certLookup: CardhedgerCertLookupService,
    @Inject(TTL_CACHE_PROVIDER) private readonly ttlCache: TtlCacheProvider,
    /**
     * Optional so ResolveService can be used in test contexts without the
     * metrics module. When present, all resolution path outcomes are forwarded
     * to the shared per-minute aggregator.
     */
    @Optional() private readonly metrics?: CardhedgerMetricsService,
  ) {
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

  private cardhedgerFeatureFlags() {
    return (
      this.config.get<ReturnType<typeof readCardhedgerFeatureFlags>>(
        'marketplace.cardhedgerFeatureFlags',
      ) ?? readCardhedgerFeatureFlags()
    );
  }

  private resolveMatchFirstPilotLogEnabled(): boolean {
    return this.config.get<boolean>(
      'marketplace.cardhedgerResolveMatchFirstPilotLog',
    ) === true;
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
    const componentVariantRaw = comp['variant'];
    const mintOrComponentVariant =
      typeof mintVariantRaw === 'string' && mintVariantRaw.trim()
        ? mintVariantRaw
        : typeof componentVariantRaw === 'string'
          ? componentVariantRaw
          : null;
    const psaVariety = mergePsaVarietyWithMintVariant(
      typeof psaVarietyRaw === 'string' ? psaVarietyRaw : null,
      mintOrComponentVariant,
    ) || null;
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
    const brandOrSet = psaBrand || cardSet || null;
    const parallelRaw = comp['marketParallelKey'];
    const storedParallelKey =
      typeof parallelRaw === 'string' && parallelRaw.trim()
        ? parallelRaw.trim().toLowerCase()
        : null;
    // Re-derive when Variety is packaging / set-name duplicate — stored key may
    // predate those rules and would reject Cardhedger Base rows.
    const computedParallelKey = marketParallelKeyFromPsaVariety(
      psaVariety,
      brandOrSet,
    );
    const varietyForStoredParallel =
      psaVariety ||
      (storedParallelKey && storedParallelKey !== 'base'
        ? storedParallelKey.replace(/_/g, ' ')
        : null);
    const marketParallelKey =
      storedParallelKey &&
      storedParallelKey !== 'base' &&
      varietyForStoredParallel &&
      psaVarietyIndicatesGenericBaseLine(varietyForStoredParallel, brandOrSet)
        ? 'base'
        : storedParallelKey ?? computedParallelKey;
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
    if (q.cardNumber) parts.push(cardNumberTokenForCardhedgerSearch(q.cardNumber));
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
    _displayLabel: string,
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

    // cardhedgerSearchQuery is either admin-set or derived from a CardHedger-formatted
    // cert_info.description — both are the most specific identifier available and should
    // be tried first, before any alias expansions. Placing it here ensures it lands within
    // the default search-candidate cap (CARDHEDGER_MAX_SEARCH_CANDIDATES).
    push(q.cardhedgerSearchQuery);

    /**
     * For known promo card types (MEP, SVP), push Cardhedger-idiomatic aliases first
     * so they are tried within the default cap of 4 before the PSA-forward queries which
     * include raw PSA brand strings like "MEP EN-ME BLACK STAR PROMO" that Cardhedger
     * does not index under that name.
     */
    const extraQueryHints = {
      cardName: q.cardName,
      cardNumber: q.cardNumber,
      cardSet: q.cardSet,
      psaBrand: q.psaBrand,
      psaSubject: q.psaSubject,
      psaVariety: q.psaVariety,
    };
    const isKnownPromoType =
      hintsLookLikeMegaEvolutionPromo(extraQueryHints) ||
      hintsLookLikeSvBlackStarPromo({
        cardSet: q.cardSet,
        psaBrand: q.psaBrand,
      }) ||
      hintsLookLikeSwshBlackStarPromo({
        cardSet: q.cardSet,
        psaBrand: q.psaBrand,
      });
    const isPrizmRookieSignatures = hintsLookLikePrizmRookieSignatures({
      cardSet: q.cardSet,
      psaBrand: q.psaBrand,
      psaVariety: q.psaVariety,
    });
    const isOnePieceChampionship = hintsLookLikeOnePieceChampionshipStamp({
      cardSet: q.cardSet,
      psaBrand: q.psaBrand,
      psaVariety: q.psaVariety,
      cardName: q.cardName,
    });

    // PSA Subject is often `FULL ART/UMBREON VMAX-HYPER`; Cardhedger indexes `Umbreon VMAX`.
    const identityNames = catalogIdentityNameNeedles(
      q.cardName,
      q.psaSubject,
    ).filter(
      (n) =>
        !/[|/]/.test(n) &&
        n.length >= 4 &&
        !psaVarietyIsPokemonRarityLabel(n),
    );
    const identitySetHint =
      cardhedgerSetAliasTokens(q.cardSet, q.psaBrand)[0] ||
      q.psaBrand ||
      q.cardSet;
    const identityNum = q.cardNumber
      ? cardNumberTokenForCardhedgerSearch(q.cardNumber)
      : '';
    for (const n of identityNames.slice(0, 2)) {
      push([n, identityNum, identitySetHint].filter(Boolean).join(' ').trim());
    }

    if (isKnownPromoType || isPrizmRookieSignatures || isOnePieceChampionship) {
      for (const sq of cardhedgerExtraSearchQueries({
        ...extraQueryHints,
        psaYear: q.psaYear,
      })) {
        push(sq);
      }
    }

    push(this.buildPsaForwardCardhedgerSearchQuery(q));

    if (
      q.psaVariety &&
      psaVarietyRequiresNonBaseCardhedgerRow(
        q.psaVariety,
        q.psaBrand || q.cardSet,
      )
    ) {
      push(
        [
          q.cardName || q.psaSubject,
          q.cardNumber ? cardNumberTokenForCardhedgerSearch(q.cardNumber) : '',
          q.psaVariety,
          q.psaBrand || q.cardSet,
        ]
          .map((s) => String(s ?? '').trim())
          .filter(Boolean)
          .join(' '),
      );
    }

    const forwardNoVariety = [
      q.psaSubject,
      q.psaBrand,
      q.psaYear,
      q.cardNumber ? cardNumberTokenForCardhedgerSearch(q.cardNumber) : '',
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

    // For Japanese Pokemon cards, PSA includes "JAPANESE" in brand/set but CardHedger
    // typically omits it. Emit de-japanified variants so they land within the search cap.
    const psaBrandDeJa =
      q.psaBrand && /\bjapanese\b/i.test(q.psaBrand)
        ? q.psaBrand.replace(/\bjapanese\b[\s-]*/gi, '').trim()
        : null;
    if (psaBrandDeJa) {
      const numPart = q.cardNumber ? q.cardNumber.replace(/^#/, '').trim() : '';
      push(
        [q.psaSubject, psaBrandDeJa, q.psaYear, numPart]
          .filter(Boolean)
          .join(' ')
          .trim(),
      );
      push([q.psaSubject, psaBrandDeJa, numPart].filter(Boolean).join(' ').trim());
      push([q.psaSubject, psaBrandDeJa].filter(Boolean).join(' ').trim());
    }

    if (!isKnownPromoType) {
      for (const sq of cardhedgerExtraSearchQueries(extraQueryHints)) {
        push(sq);
      }
    }

    if (q.cardName && q.cardSet) {
      push(
        [q.cardName, q.cardNumber, q.cardSet].filter(Boolean).join(' ').trim(),
      );
    }

    // Do not search Cardhedger with UI titles (`Name · Number · PSA 10`) or
    // collection displayLabel — those changed with card-display-name SSOT and
    // are not catalog strings.
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
    opts?: {
      trustStoredCardhedgerCatalogId?: boolean;
      brandOrSet?: string | null;
    },
  ): boolean {
    if (opts?.trustStoredCardhedgerCatalogId) return false;
    const pv = psaVariety?.trim() ?? '';
    if (!pv) {
      return !cardhedgerRowMatchesPsaVariety(
        row as Record<string, unknown>,
        pv,
      );
    }
    if (!psaVarietyRequiresNonBaseCardhedgerRow(pv, opts?.brandOrSet)) {
      return false;
    }
    /**
     * Pokémon rarity slots (FA / SAR / SIR / MUR / `FULL ART/SUBJECT`) — Cardhedger
     * keeps `variant: "Base"` and omits rarity wording. Allow Base; still reject
     * Master Ball / Reverse Foil siblings.
     */
    if (psaVarietyIsPokemonRarityLabel(pv)) {
      const vr = String(row.variant ?? '').trim().toLowerCase();
      if (vr === '' || vr === 'base') return false;
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
      const colorTokens = chromeColorTokensIn(pv);
      /** PSA `{SPORT} REFRACTOR` with no color → flagship `Refractor` is the default row. */
      if (vr === 'refractor' && colorTokens.length === 0) return false;
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
      psaYear?: string | null;
      marketParallelKey?: string;
    },
    parallelOpts?: { trustStoredCardhedgerCatalogId?: boolean },
  ): { score: number; verified: boolean; numberMatched: boolean } {
    const parallelKey = (hints.marketParallelKey ?? 'base').trim().toLowerCase();
    if (
      !parallelOpts?.trustStoredCardhedgerCatalogId &&
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
    const yearWant =
      String(hints.psaYear ?? '').match(/\b((?:19|20)\d{2})\b/)?.[1] ?? null;
    const rowYear =
      `${rowSet} ${rowName}`.match(/\b((?:19|20)\d{2})\b/)?.[1] ?? null;
    // Same player/# parallel can exist across years — never score a wrong-year hit.
    if (yearWant && rowYear && yearWant !== rowYear) {
      return { score: 0, verified: false, numberMatched: false };
    }

    const wantNum = normalizeForExactCardNumberKey(
      primaryCardNumber(hints.cardNumber),
    );
    const gotName = normalizeForExactCatalogMatch(rowName);
    const gotSet = normalizeForExactCatalogMatch(rowSet);
    const gotNum = normalizeForExactCardNumberKey(primaryCardNumber(rowNum));

    const numberExact = sameNumber(wantNum, gotNum);
    const numberInsertBridge = catalogInsertNumberCompatibleWithRow(
      {
        cardName: hints.cardName,
        cardNumber: hints.cardNumber,
        cardSet: hints.cardSet,
        psaSubject: hints.psaSubject ?? undefined,
        psaBrand: hints.psaBrand ?? undefined,
        psaVariety: hints.psaVariety ?? undefined,
        cardhedgerSearchQuery: hints.cardhedgerSearchQuery ?? undefined,
      },
      row as Record<string, unknown>,
    );
    const numberTcgPrefix = catalogTcgPrefixedNumberCompatible(
      hints.cardNumber,
      rowNum,
    );
    const numberMatched = numberExact || numberInsertBridge || numberTcgPrefix;

    if (
      this.parallelRowFailsExpectation(hints.psaVariety ?? null, row, {
        ...parallelOpts,
        brandOrSet: hints.psaBrand || hints.cardSet || null,
      })
    ) {
      return { score: 0, verified: false, numberMatched: false };
    }

    if (
      !catalogProductFamiliesCompatible(
        {
          cardSet: hints.cardSet,
          psaBrand: hints.psaBrand ?? undefined,
          cardhedgerSearchQuery: hints.cardhedgerSearchQuery ?? undefined,
        },
        row as Record<string, unknown>,
      )
    ) {
      return { score: 0, verified: false, numberMatched: false };
    }

    // Substring path (tight, keeps legacy exact-match wins)
    const nameSubstring = catalogIdentityNameNeedles(
      hints.cardName,
      hints.psaSubject,
    ).some((needle) => {
      const w = normalizeForExactCatalogMatch(needle);
      return Boolean(
        w && gotName && (gotName.includes(w) || w.includes(gotName)),
      );
    });
    const setSubstring = [
      hints.cardSet,
      hints.psaBrand ?? '',
      ...cardhedgerSetAliasTokens(hints.cardSet, hints.psaBrand ?? null),
    ].some((raw) => {
      const w = normalizeForExactCatalogMatch(raw);
      return Boolean(
        w && gotSet && (gotSet.includes(w) || w.includes(gotSet)),
      );
    });

    // Token coverage path — used to tolerate inserted words and abbreviated set codes.
    // We pool cardName/cardSet with cardhedgerSearchQuery (curated long-form) when present,
    // because Cardhedger's row.description often matches the curated query verbatim.
    const wantNamePool = [
      hints.cardName,
      hints.psaSubject ?? '',
      hints.cardhedgerSearchQuery ?? '',
      ...catalogIdentityNameNeedles(hints.cardName, hints.psaSubject),
    ]
      .filter(Boolean)
      .join(' ');
    const wantSetPool = [
      hints.cardSet,
      hints.psaBrand ?? '',
      hints.cardhedgerSearchQuery ?? '',
      // Japanese PSA sets include "JAPANESE" in brand/set while CardHedger typically omits it.
      // Add a de-japanified variant so set token coverage still passes.
      hints.psaBrand && /\bjapanese\b/i.test(hints.psaBrand)
        ? hints.psaBrand.replace(/\bjapanese\b[\s-]*/gi, '').trim()
        : '',
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
    if (numberExact) score += 100;
    else if (numberInsertBridge) score += 90;
    if (setMatched) score += 60;
    if (nameMatched) score += 50;
    if (yearWant && rowYear && yearWant === rowYear) score += 40;

    const pv = hints.psaVariety?.trim() ?? '';
    if (
      pv &&
      psaVarietyRequiresNonBaseCardhedgerRow(
        pv,
        hints.psaBrand || hints.cardSet || null,
      )
    ) {
      if (cardhedgerRowMatchesPsaVariety(row as Record<string, unknown>, pv)) {
        score += 40;
        const spec = cardhedgerCatalogVariantSpecificity(
          row as Record<string, unknown>,
          pv,
        );
        if (spec > 0) score += 25 + spec * 5;
        const pvLower = pv.toLowerCase();
        const parallelBlob = this.rowParallelBlob(row).toLowerCase();
        if (parallelBlob.includes(pvLower)) score += 30;
        /**
         * Insert lines (Rookie Signatures) often catalog as `variant: Base` with the insert
         * name only in `description`. When PSA Variety has no color/parallel token, prefer
         * that Base row over White Sparkle / Gold / Mojo parallels of the same insert.
         */
        const varietyColors = chromeColorTokensIn(pv);
        const rowVariant = String(row.variant ?? '').trim().toLowerCase();
        if (
          varietyColors.length === 0 &&
          (rowVariant === '' || rowVariant === 'base')
        ) {
          score += 25;
        }
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
    if (pv && psaVarietyRequiresNonBaseCardhedgerRow(pv, q.cardSet || null)) {
      return true;
    }
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
    brandOrSet?: string | null,
  ): { row: CardhedgerCardRow; confidence: 'verified' | 'approximate' } | null {
    const pv = psaVariety?.trim() ?? '';
    if (pv && psaVarietyRequiresNonBaseCardhedgerRow(pv, brandOrSet)) {
      return null;
    }
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
    const scoredAll = rows
      .map((r) => ({ r, ...this.scoreCard(r, q) }))
      .filter(
        (x) =>
          x.score > 0 &&
          catalogRowTrustedForMarketData(
            this.trustHintsFromQuery(q),
            x.r as Record<string, unknown>,
          ).ok,
      )
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (colorHints.length > 0) {
          const dc = colorHitsInRow(b.r) - colorHitsInRow(a.r);
          if (dc !== 0) return dc;
        }
        if (pvLower && psaVarietyRequiresNonBaseCardhedgerRow(pvLower, q.psaBrand || q.cardSet)) {
          const dSpec =
            cardhedgerCatalogVariantSpecificity(
              b.r as Record<string, unknown>,
              q.psaVariety,
            ) -
            cardhedgerCatalogVariantSpecificity(
              a.r as Record<string, unknown>,
              q.psaVariety,
            );
          if (dSpec !== 0) return dSpec;
          const d =
            Number(varietyInRowBlob(b.r)) - Number(varietyInRowBlob(a.r));
          if (d !== 0) return d;
        }
        if (genericRef && colorHints.length === 0) {
          const isFlagship = (row: CardhedgerCardRow) =>
            String(row.variant ?? '').trim().toLowerCase() === 'refractor';
          const d = Number(isFlagship(b.r)) - Number(isFlagship(a.r));
          if (d !== 0) return d;
        } else if (genericRef) {
          const d = specificity(b.r) - specificity(a.r);
          if (d !== 0) return d;
        }
        return 0;
      });
    /**
     * PSA named a collectible identity (Master Ball, Silver Prizm, …). A finish-only
     * catalog row (Reverse Foil) must not win. Insert lines cataloged as `variant: Base`
     * (Rookie Signatures) stay eligible when no named-variant row exists.
     */
    let scored = scoredAll;
    if (psaVarietyHasNamedCollectibleIdentity(q.psaVariety)) {
      const identityHits = scoredAll.filter(
        (x) =>
          cardhedgerCatalogVariantSpecificity(
            x.r as Record<string, unknown>,
            q.psaVariety,
          ) > 0,
      );
      if (identityHits.length > 0) {
        scored = identityHits;
      } else {
        const notFinishOnly = scoredAll.filter(
          (x) =>
            !cardhedgerRowIsPrintFinishOnly(x.r as Record<string, unknown>),
        );
        if (notFinishOnly.length === 0) return null;
        scored = notFinishOnly;
      }
    }
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
          q.psaBrand || q.cardSet,
        );
        if (baseWhenNoParallel) return baseWhenNoParallel;
      }
      const best = numberOnly[0]!;
      return {
        row: best.r,
        confidence: best.verified ? 'verified' : 'approximate',
      };
    }

    return null;
  }

  private trustHintsFromQuery(q: {
    cardName: string;
    cardSet: string;
    cardNumber: string;
    cardhedgerSearchQuery: string | null;
    listingDisplayTitle: string | null;
    psaSubject: string | null;
    psaBrand: string | null;
    psaVariety: string | null;
    psaYear: string | null;
  }): CatalogTrustHints {
    return {
      cardName: q.cardName,
      cardNumber: q.cardNumber,
      cardSet: q.cardSet,
      psaSubject: q.psaSubject ?? undefined,
      psaBrand: q.psaBrand ?? undefined,
      psaVariety: q.psaVariety ?? undefined,
      psaYear: q.psaYear ?? undefined,
      cardhedgerSearchQuery: q.cardhedgerSearchQuery ?? undefined,
      listingDisplayTitle: q.listingDisplayTitle ?? undefined,
    };
  }

  private rowTrustedForMarket(
    q: Parameters<CardhedgerResolveService['trustHintsFromQuery']>[0],
    row: CardhedgerCardRow,
  ): boolean {
    return catalogRowTrustedForMarketData(
      this.trustHintsFromQuery(q),
      row as Record<string, unknown>,
    ).ok;
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
        q.query?.trim(),
      ].find((s) => typeof s === 'string' && s.length > 0) ?? '';
    if (!query) return { query: '', row: null };

    // ── Path 0: PSA cert → details-by-certs (variety-compatible catalog row) ──
    // Always try cert before a stored card_id. Mint/OCR IDs and UI-title search
    // can disagree with GemRate; comps must follow the cert catalog row when it
    // fits PSA Variety (including Pokémon rarity → Cardhedger Base).
    if (col) {
      const cert = psaCertNumberFromCollectionRow(col);
      if (cert) {
        try {
          const { row } = await this.certLookup.getCardRowByCert(cert);
          const certCardId = String(row?.card_id ?? '').trim();
          if (row && certCardId) {
            const certVarietyFail = this.parallelRowFailsExpectation(
              q.psaVariety,
              row,
              { brandOrSet: q.psaBrand || q.cardSet || null },
            );
            if (certVarietyFail) {
              this.logger.log(
                JSON.stringify({
                  msg: 'cert_card_id_variety_mismatch',
                  key: collectionKey,
                  cardId: certCardId,
                  psaVariety: q.psaVariety,
                  variant: String(row.variant ?? ''),
                }),
              );
            } else {
              this.metrics?.recordResolvePath('details_by_certs');
              this.logger.log(
                JSON.stringify({
                  msg: 'resolve_path',
                  path: 'details_by_certs',
                  key: collectionKey,
                  cardId: certCardId,
                  confidence: 'verified',
                }),
              );
              return { query, row, confidence: 'verified' };
            }
          }
        } catch (e) {
          this.logger.debug(
            `details-by-certs resolve skipped key=${collectionKey}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
    }

    // ── Path 1: stored cardhedgerCardId → card-details, then PSA Variety gate ──
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
          const storedVarietyFail = this.parallelRowFailsExpectation(
            q.psaVariety,
            rows[0],
            { brandOrSet: q.psaBrand || q.cardSet || null },
          );
          if (storedVarietyFail) {
            this.logger.log(
              JSON.stringify({
                msg: 'stored_card_id_variety_mismatch',
                key: collectionKey,
                cardId: q.cardhedgerCardId,
                psaVariety: q.psaVariety,
                variant: String(rows[0].variant ?? ''),
              }),
            );
          } else {
            const strict = this.scoreCard(rows[0], q);
            const confidence =
              strict.verified && this.rowTrustedForMarket(q, rows[0])
                ? 'verified'
                : 'approximate';
            this.metrics?.recordResolvePath('card_details');
            this.logger.log(
              JSON.stringify({
                msg: 'resolve_path',
                path: 'card_details',
                key: collectionKey,
                cardId: q.cardhedgerCardId,
                confidence,
                score: strict.score,
                numberMatched: strict.numberMatched,
              }),
            );
            return { query, row: rows[0], confidence };
          }
        }
      } catch (e) {
        // Circuit open or network failure — fall through to next path
        const isCircuitOpen =
          e instanceof Error && e.message.includes('circuit breaker');
        if (isCircuitOpen) this.metrics?.recordResolvePath('circuit_open');
      }
    }

    // ── Path 2: card-match-first (optional) → card-search → card-match fallback ──
    // Cert lookup (Path 0) runs when no stored cardhedgerCardId; successful cert writes
    // persist ID so Path 1 serves subsequent reads.
    const flags = this.cardhedgerFeatureFlags();
    const path2Started = Date.now();
    let path2Result: ResolvedCard | null = null;
    let path2ResolvePath: 'search' | 'card_match' | 'card_match_first' | 'none' =
      'none';

    if (flags.cardMatchFirst) {
      const cardMatchFirstResult = await this.tryCardMatchFallback(
        query,
        collectionKey,
        q,
      );
      if (cardMatchFirstResult) {
        path2Result = cardMatchFirstResult;
        path2ResolvePath = 'card_match_first';
      }
    }

    if (!path2Result) {
      const searchResult = await this.tryResolveViaCardSearch(
        q,
        displayLabel,
        collectionKey,
      );
      if (searchResult) {
        path2Result = { ...searchResult.result, query };
        path2ResolvePath = 'search';
        this.metrics?.recordResolvePath('search', searchResult.depth);
        this.logger.log(
          JSON.stringify({
            msg: 'resolve_path',
            path: 'search',
            key: collectionKey,
            query: searchResult.query,
            candidateIndex: searchResult.candidateIndex,
            candidateCount: searchResult.candidateCount,
            cardId: searchResult.result.row?.card_id ?? 'n/a',
            confidence: searchResult.result.confidence,
          }),
        );
      }
    }

    if (!path2Result && !flags.cardMatchFirst) {
      const cardMatchResult = await this.tryCardMatchFallback(
        query,
        collectionKey,
        q,
      );
      if (cardMatchResult) {
        path2Result = cardMatchResult;
        path2ResolvePath = 'card_match';
      }
    }

    const path2DurationMs = Date.now() - path2Started;
    const path2Success = path2Result?.row != null;

    this.metrics?.recordResolvePath2Pilot({
      cardMatchFirstEnabled: flags.cardMatchFirst,
      durationMs: path2DurationMs,
      success: path2Success,
    });

    if (path2Result) {
      if (path2ResolvePath === 'card_match_first') {
        this.metrics?.recordResolvePath('card_match_first');
        this.logger.log(
          JSON.stringify({
            msg: 'resolve_path',
            path: 'card_match_first',
            key: collectionKey,
            query,
            cardId:
              (path2Result.row as { card_id?: unknown })?.card_id ?? 'n/a',
            confidence: path2Result.confidence,
            durationMs: path2DurationMs,
          }),
        );
      } else if (path2ResolvePath === 'card_match') {
        this.metrics?.recordResolvePath('card_match');
        this.logger.log(
          JSON.stringify({
            msg: 'resolve_path',
            path: 'card_match',
            key: collectionKey,
            query,
            cardId:
              (path2Result.row as { card_id?: unknown })?.card_id ?? 'n/a',
            confidence: path2Result.confidence,
            durationMs: path2DurationMs,
          }),
        );
      }

      if (this.resolveMatchFirstPilotLogEnabled()) {
        this.logger.log(
          JSON.stringify({
            msg: 'resolve_path2_pilot',
            key: collectionKey,
            cardMatchFirstEnabled: flags.cardMatchFirst,
            path: path2ResolvePath,
            success: path2Success,
            durationMs: path2DurationMs,
            confidence: path2Result.confidence ?? null,
          }),
        );
      }

      return path2Result;
    }

    this.metrics?.recordResolvePath('none');
    if (this.resolveMatchFirstPilotLogEnabled()) {
      this.logger.log(
        JSON.stringify({
          msg: 'resolve_path2_pilot',
          key: collectionKey,
          cardMatchFirstEnabled: flags.cardMatchFirst,
          path: 'none',
          success: false,
          durationMs: path2DurationMs,
          confidence: null,
        }),
      );
    }
    this.logger.log(
      JSON.stringify({
        msg: 'resolve_path',
        path: 'none',
        key: collectionKey,
        query,
        searchCandidateCount: this.maxSearchCandidates(),
        cardMatchFirstEnabled: flags.cardMatchFirst,
        durationMs: path2DurationMs,
      }),
    );
    return { query, row: null };
  }

  /**
   * Capped `card-search` loop — returns the first scored match or null.
   */
  private async tryResolveViaCardSearch(
    q: ReturnType<CardhedgerResolveService['buildCollectionQuery']>,
    displayLabel: string,
    collectionKey: string,
  ): Promise<{
    result: ResolvedCard;
    depth: number;
    query: string;
    candidateIndex: number;
    candidateCount: number;
  } | null> {
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
          const depth = i + 1;
          return {
            result: {
              query: sq,
              row: picked.row,
              confidence: picked.confidence,
            },
            depth,
            query: sq,
            candidateIndex: i,
            candidateCount: searchCandidates.length,
          };
        }
      } catch (e) {
        const isCircuitOpen =
          e instanceof Error && e.message.includes('circuit breaker');
        if (isCircuitOpen) {
          this.metrics?.recordResolvePath('circuit_open');
          break;
        }
      }
    }

    return null;
  }

  /**
   * AI-powered card matching via `POST /v1/cards/card-match`.
   * Returns a resolved card if the LLM finds a confident match (≥0.5),
   * or null when no match is found or the request fails.
   */
  private async tryCardMatchFallback(
    query: string,
    collectionKey: string,
    q: Parameters<CardhedgerResolveService['trustHintsFromQuery']>[0],
  ): Promise<ResolvedCard | null> {
    if (!query.trim()) return null;
    try {
      const body = await this.cardhedger.forwardJson('POST', '/v1/cards/card-match', {
        body: { query: query.trim(), max_candidates: 10 },
      });
      if (typeof body !== 'object' || body == null) return null;
      const b = body as Record<string, unknown>;
      const match = b.match as Record<string, unknown> | null | undefined;
      if (!match || typeof match !== 'object') return null;

      const aiConfidence =
        typeof match.confidence === 'number' && Number.isFinite(match.confidence)
          ? match.confidence
          : 0;
      if (aiConfidence < 0.5) return null;

      // Map AI confidence to our 'verified' / 'approximate' tiers
      const confidence: 'verified' | 'approximate' = aiConfidence >= 0.7 ? 'verified' : 'approximate';

      // CardMatchResult fields are compatible with CardhedgerCardRow (both Record<string,unknown>).
      // Normalise the key differences so downstream scoring / pricing works unchanged.
      const row: CardhedgerCardRow = {
        ...match,
        // card-match returns card_id at top level (same as card-search)
        card_id: match.card_id,
        // prices array is [{grade, price}] — same shape as card-search
        prices: Array.isArray(match.prices) ? match.prices : [],
      } as CardhedgerCardRow;

      if (!this.rowTrustedForMarket(q, row)) {
        this.logger.warn(
          JSON.stringify({
            msg: 'card_match_rejected',
            key: collectionKey,
            cardId: match.card_id ?? null,
            aiConfidence,
          }),
        );
        return null;
      }

      if (
        this.parallelRowFailsExpectation(q.psaVariety ?? null, row, {
          brandOrSet: q.psaBrand || q.cardSet || null,
        })
      ) {
        this.logger.log(
          JSON.stringify({
            msg: 'card_match_variety_rejected',
            key: collectionKey,
            cardId: match.card_id ?? null,
            psaVariety: q.psaVariety,
            variant: String(row.variant ?? ''),
            aiConfidence,
          }),
        );
        return null;
      }

      this.logger.debug(
        `card_match_fallback key=${collectionKey} ai_confidence=${aiConfidence} mapped=${confidence} card_id=${match.card_id ?? 'n/a'}`,
      );
      return { query, row, confidence };
    } catch (e) {
      const isCircuitOpen = e instanceof Error && e.message.includes('circuit breaker');
      this.logger.debug(
        `card_match_fallback failed key=${collectionKey} circuit=${isCircuitOpen} err=${e instanceof Error ? e.message : String(e)}`,
      );
      return null;
    }
  }
}
