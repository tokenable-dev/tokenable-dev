import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readCardhedgerFeatureFlags } from '../../config/cardhedger-feature-flags.util';
import { RwaAssetResolveService } from '../../blockchain/rwa-asset-resolve.service';
import { CardhedgerService } from '../../cardhedger/cardhedger.service';
import { PsaCertSnapshotService } from '../collections/psa-cert-snapshot.service';
import {
  componentsPsaMirrorSufficientForCardhedger,
  mergePsaCertSnapshotIntoMirror,
} from '../utils/psa-components-mirror.util';
import type { MarketplaceCollection } from '../entities/marketplace-collection.entity';
import { psaCertNumberFromGradedMeta } from '../utils/collection-image.util';
import { extractBucketComponentsFromMetadata } from '../utils/bucket-key.util';
import type {
  MarketCollectionPreview,
  MarketCompsSnapshot,
} from '../utils/market-reference.types';
import { marketHistoryTierFromComponents } from '../utils/market-history-tier.util';
import { mergePsaVarietyWithMintVariant } from '../../psa/psa-variety-catalog.util';
import type { CardhedgerCardRow } from './cardhedger-market-data.types';
import { CardhedgerCertLookupService } from './cardhedger-cert-lookup.service';
import { CardhedgerCertPricingService } from './cardhedger-cert-pricing.service';
import type { CardhedgerCertPriceResult } from './cardhedger-cert-price.util';
import { cardhedgerFmvMapKey, type CardhedgerFmvResult } from './cardhedger-fmv.util';
import { CardhedgerResolveService } from './cardhedger-resolve.service';
import {
  CardhedgerPricingService,
  type BuildPreviewOptions,
} from './cardhedger-pricing.service';
import { cardhedgerGradeFromHistoryTier } from '../utils/psa-grade-policy.util';

/**
 * Handles mint/cert/IPFS preview logic: resolves a PSA cert number to a
 * Cardhedger card row, enriches PSA mirror fields from on-chain metadata,
 * and builds `MarketCollectionPreview` for freshly minted RWA tokens.
 */
@Injectable()
export class CardhedgerMintService {
  private readonly logger = new Logger(CardhedgerMintService.name);

  constructor(
    private readonly cardhedger: CardhedgerService,
    private readonly rwaAssetResolve: RwaAssetResolveService,
    private readonly config: ConfigService,
    private readonly psaCertSnapshots: PsaCertSnapshotService,
    private readonly certLookup: CardhedgerCertLookupService,
    private readonly certPricing: CardhedgerCertPricingService,
    private readonly resolve: CardhedgerResolveService,
    private readonly pricing: CardhedgerPricingService,
  ) {}

  isConfigured(): boolean {
    try {
      this.cardhedger.assertConfigured();
      return true;
    } catch {
      return false;
    }
  }

  private normalizeCertDigits(cert: string | undefined): string {
    return this.certLookup.normalizeCertDigits(cert);
  }

  async getCardRowByCert(cert: string): Promise<{
    row: CardhedgerCardRow | null;
    certDescription: string | null;
  }> {
    return this.certLookup.getCardRowByCert(cert);
  }

  private async fetchCardRowsByCertsBatch(
    certs: string[],
    descriptionOut?: Map<string, string>,
  ): Promise<Map<string, CardhedgerCardRow>> {
    return this.certLookup.fetchCardRowsByCertsBatch(certs, descriptionOut);
  }

  private async mapInBatches<T, R>(
    input: readonly T[],
    concurrency: number,
    fn: (item: T, idx: number) => Promise<R>,
  ): Promise<R[]> {
    const cap = Math.max(1, Math.min(16, Math.floor(concurrency)));
    const results: R[] = [];
    for (let i = 0; i < input.length; i += cap) {
      const chunk = input.slice(i, i + cap);
      const settled = await Promise.all(
        chunk.map((item, off) => fn(item, i + off)),
      );
      results.push(...settled);
    }
    return results;
  }

  private mintPreviewConcurrency(): number {
    return (
      this.config.get<number>('marketplace.cardhedgerMintPreviewConcurrency') ??
      4
    );
  }

  private mintPreviewUseCertBatch(): boolean {
    const v = this.config.get<boolean>(
      'marketplace.cardhedgerMintPreviewUseCertBatch',
    );
    return v !== false;
  }

  private cardhedgerFeatureFlags() {
    return (
      this.config.get<ReturnType<typeof readCardhedgerFeatureFlags>>(
        'marketplace.cardhedgerFeatureFlags',
      ) ?? readCardhedgerFeatureFlags()
    );
  }

  private previewOptsForMint(
    syntheticCol: MarketplaceCollection,
    batchRow: CardhedgerCardRow | undefined,
    fmvByKey: Map<string, CardhedgerFmvResult | null>,
    certPrice: CardhedgerCertPriceResult | undefined,
    flags: ReturnType<typeof readCardhedgerFeatureFlags>,
  ): BuildPreviewOptions | undefined {
    const tier = marketHistoryTierFromComponents(syntheticCol.components);
    const chGrade = cardhedgerGradeFromHistoryTier(tier);
    const cardId = String(
      batchRow?.card_id ?? syntheticCol.components?.cardhedgerCardId ?? '',
    ).trim();

    const useCertBatch =
      flags.batchPricesByCertEnabled &&
      certPrice != null &&
      certPrice.price != null &&
      certPrice.price > 0;

    const opts: BuildPreviewOptions = {};
    if (flags.mintPreviewSkipComps || useCertBatch) opts.skipComps = true;

    if (useCertBatch) {
      opts.preFetchedCertPrice = certPrice;
      opts.skipCatalogFetches = true;
      opts.skipFmvFetch = true;
      return opts;
    }

    const sparseCertNeedsEstimate =
      flags.batchPricesByCertEnabled &&
      certPrice != null &&
      !(certPrice.price != null && certPrice.price > 0);
    if (sparseCertNeedsEstimate && flags.batchPriceEstimateEnabled && cardId) {
      const est =
        fmvByKey.get(cardhedgerFmvMapKey(cardId, chGrade)) ?? null;
      if (est?.price != null && est.price > 0) {
        opts.skipComps = true;
        opts.skipCatalogFetches = true;
        opts.skipFmvFetch = true;
        opts.preFetchedFmv = est;
        opts.preFetchedEstimate = true;
        return opts;
      }
    }

    if (flags.fmvBatchEnabled) {
      opts.skipFmvFetch = true;
      opts.preFetchedFmv = cardId
        ? (fmvByKey.get(cardhedgerFmvMapKey(cardId, chGrade)) ?? null)
        : null;
    }

    if (
      !flags.fmvBatchEnabled &&
      !flags.mintPreviewSkipComps &&
      !useCertBatch
    ) {
      return undefined;
    }
    return opts;
  }

  private buildMintSyntheticCollection(input: {
    tokenId: number;
    meta: Record<string, unknown>;
    psaMirror: Record<string, unknown>;
    cardhedgerCardIdOverride?: string | null;
  }): MarketplaceCollection {
    const { tokenId, meta, psaMirror, cardhedgerCardIdOverride } = input;
    const graded =
      (meta.properties as Record<string, unknown> | undefined)?.graded ??
      (meta.graded as Record<string, unknown> | undefined);
    const ch = (graded as Record<string, unknown> | undefined)?.cardhedger as
      | Record<string, unknown>
      | undefined;
    const cardIdFromMeta =
      typeof ch?.cardId === 'string' && ch.cardId.trim()
        ? ch.cardId.trim()
        : '';
    const cardhedgerCardId =
      (cardhedgerCardIdOverride?.trim() || '') || cardIdFromMeta;
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
    const psaObj =
      typeof (graded as Record<string, unknown> | undefined)?.psa === 'object' &&
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
    const psaSpecExtras = spec ? { psaSpecId: spec } : {};

    const componentsPayload: Record<string, unknown> = extracted
      ? {
          ...(extracted as unknown as Record<string, unknown>),
          ...psaSpecExtras,
          ...psaMirror,
          ...(cardhedgerCardId ? { cardhedgerCardId } : {}),
        }
      : {
          cardName: String(card?.name ?? ''),
          cardSet: String(card?.set ?? ''),
          cardNumber: String(card?.number ?? ''),
          ...psaSpecExtras,
          ...psaMirror,
          ...(cardhedgerCardId ? { cardhedgerCardId } : {}),
        };

    return {
      collectionKey: `mint_${tokenId}`,
      displayLabel: String(meta.name ?? query ?? ''),
      queryUsed: query,
      components: componentsPayload,
      coverImageUrl: null,
      createdAt: new Date(),
    } as MarketplaceCollection;
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
    const card = graded.card as Record<string, unknown> | undefined;
    const mintVariant =
      typeof card?.variant === 'string' ? card.variant.trim() : '';
    if (mintVariant) out.mintCardVariant = mintVariant;
    const merged = mergePsaVarietyWithMintVariant(
      varietyRaw?.replace(/\s+/g, ' '),
      mintVariant,
    );
    if (merged) out.psaVariety = merged;
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

    if (componentsPsaMirrorSufficientForCardhedger(baseMirror)) {
      const existingEstimate = Number(baseMirror.psaEstimateUsd);
      if (Number.isFinite(existingEstimate) && existingEstimate > 0) {
        return baseMirror;
      }
    }

    const snap = await this.psaCertSnapshots.fetchCertSnapshotJson(certRaw, {
      allowUpstream: false,
    });
    if (!snap) {
      const scraped = await this.psaCertSnapshots.refreshEstimateIfMissing(
        certRaw,
        { allowUpstream: false },
      );
      if (scraped != null) {
        return { ...baseMirror, psaEstimateUsd: scraped };
      }
      return baseMirror;
    }

    const hadVariety = Boolean(String(baseMirror.psaVariety ?? '').trim());
    const extra = mergePsaCertSnapshotIntoMirror(baseMirror, snap);
    if (
      !Number.isFinite(Number(extra.psaEstimateUsd)) ||
      Number(extra.psaEstimateUsd) <= 0
    ) {
      const scraped = await this.psaCertSnapshots.refreshEstimateIfMissing(
        certRaw,
        { allowUpstream: false },
      );
      if (scraped != null) {
        extra.psaEstimateUsd = scraped;
      }
    }
    if (
      !hadVariety &&
      typeof extra.psaVariety === 'string' &&
      String(extra.psaVariety).trim()
    ) {
      this.logger.log(
        'Cardhedger mint preview: psaVariety filled via PSA cert snapshot (IPFS metadata had no PSA Variety)',
      );
    }
    return extra;
  }

  async getBatchMintPreviewsFromTokenIds(
    tokenIds: number[],
  ): Promise<Record<number, MarketCollectionPreview>> {
    const out: Record<number, MarketCollectionPreview> = {};
    const ids = [
      ...new Set((tokenIds ?? []).map((n) => Math.floor(Number(n)))),
    ].filter((n) => Number.isFinite(n) && n >= 0);
    if (ids.length === 0) return out;

    const pack = await this.rwaAssetResolve.batchRwaMetadata(ids);
    const work = pack.items.filter((item) => item.metadata != null);
    const missingMeta = pack.items.filter((item) => !item.metadata);

    for (const item of missingMeta) {
      out[item.tokenId] = {
        enabled: this.isConfigured(),
        searchQuery: '',
        matched: false,
        message: 'Metadata unavailable',
        card: null,
      };
    }

    let certCardByDigits = new Map<string, CardhedgerCardRow>();
    let certPriceByDigits = new Map<string, CardhedgerCertPriceResult>();
    const flags = this.cardhedgerFeatureFlags();

    if (this.mintPreviewUseCertBatch() && work.length > 0) {
      const certs = work
        .map((item) => psaCertNumberFromGradedMeta(item.metadata!))
        .filter((c): c is string => Boolean(c));

      if (flags.batchPricesByCertEnabled && this.isConfigured()) {
        certPriceByDigits = await this.certPricing.fetchPricesByCertsBatch(certs);
        for (const [digits, cp] of certPriceByDigits) {
          if (cp.card) certCardByDigits.set(digits, cp.card);
        }

        if (flags.certPricePilotCompare) {
          const legacyMap = await this.fetchCardRowsByCertsBatch(certs);
          this.certPricing.logPilotPriceDiffs(
            certPriceByDigits,
            legacyMap,
            (row, gradeLabel) =>
              this.pricing.readGradePrice(row, gradeLabel ?? 'PSA 10'),
          );
        }

        const missingIdentity = [
          ...new Set(
            certs
              .map((c) => this.normalizeCertDigits(c))
              .filter((d) => d && !certCardByDigits.has(d)),
          ),
        ];
        if (missingIdentity.length > 0) {
          const fallback = await this.fetchCardRowsByCertsBatch(missingIdentity);
          for (const [k, v] of fallback) certCardByDigits.set(k, v);
        }

        this.logger.log(
          JSON.stringify({
            msg: 'mint_previews_cert_batch',
            certCount: certs.length,
            priced: [...certPriceByDigits.values()].filter((r) => r.price != null)
              .length,
            pilotCompare: flags.certPricePilotCompare,
          }),
        );
      } else {
        certCardByDigits = await this.fetchCardRowsByCertsBatch(certs);
      }
    }

    const psaMirrorByCert = new Map<string, Record<string, unknown>>();

    type MintWork = {
      tokenId: number;
      meta: Record<string, unknown>;
      graded: Record<string, unknown> | undefined;
      certDigits: string;
      batchRow?: CardhedgerCardRow;
      psaMirror: Record<string, unknown>;
      syntheticCol: MarketplaceCollection;
      query: string;
    };

    const workItems = await this.mapInBatches(
      work,
      this.mintPreviewConcurrency(),
      async (item): Promise<MintWork> => {
        const meta = item.metadata!;
        const graded =
          (meta.properties as Record<string, unknown> | undefined)?.graded ??
          (meta.graded as Record<string, unknown> | undefined);
        const certDigits = this.normalizeCertDigits(
          psaCertNumberFromGradedMeta(meta),
        );
        const batchRow = certDigits
          ? certCardByDigits.get(certDigits)
          : undefined;

        let psaMirror = psaMirrorByCert.get(certDigits);
        if (!psaMirror) {
          psaMirror = await this.enrichPsaMirrorFromCertLookup(
            graded as Record<string, unknown> | undefined,
            this.psaMirrorFromGradedBlock(
              graded as Record<string, unknown> | undefined,
            ),
          );
          if (certDigits) psaMirrorByCert.set(certDigits, psaMirror);
        }

        const syntheticCol = this.buildMintSyntheticCollection({
          tokenId: item.tokenId,
          meta,
          psaMirror,
          cardhedgerCardIdOverride:
            typeof batchRow?.card_id === 'string'
              ? batchRow.card_id.trim()
              : null,
        });

        const q = this.resolve.buildCollectionQuery(syntheticCol).query;
        return {
          tokenId: item.tokenId,
          meta,
          graded: graded as Record<string, unknown> | undefined,
          certDigits,
          batchRow,
          psaMirror,
          syntheticCol,
          query: q,
        };
      },
    );

    let fmvByKey = new Map<string, CardhedgerFmvResult | null>();
    if (flags.fmvBatchEnabled && this.isConfigured()) {
      const fmvItems = workItems
        .filter((w) => {
          if (!flags.batchPricesByCertEnabled) return true;
          const cp = w.certDigits ? certPriceByDigits.get(w.certDigits) : undefined;
          return !(cp?.price != null && cp.price > 0);
        })
        .map((w) => {
          const cardId = String(
            w.batchRow?.card_id ??
              w.syntheticCol.components?.cardhedgerCardId ??
              '',
          ).trim();
          if (!cardId) return null;
          const tier = marketHistoryTierFromComponents(w.syntheticCol.components);
          const grade = cardhedgerGradeFromHistoryTier(tier);
          return { card_id: cardId, grade };
        })
        .filter((x): x is { card_id: string; grade: string } => x != null);
      fmvByKey = await this.pricing.fetchFmvBatch(fmvItems);
      this.logger.debug(
        JSON.stringify({
          msg: 'mint_previews_fmv_batch',
          requested: fmvItems.length,
          resolved: fmvByKey.size,
        }),
      );
    }

    if (
      flags.batchPricesByCertEnabled &&
      flags.batchPriceEstimateEnabled &&
      this.isConfigured()
    ) {
      const sparseItems = workItems
        .map((w) => {
          const cp = w.certDigits ? certPriceByDigits.get(w.certDigits) : undefined;
          if (!cp?.card || (cp.price != null && cp.price > 0)) return null;
          const cardId = String(cp.card.card_id ?? '').trim();
          if (!cardId) return null;
          const tier = marketHistoryTierFromComponents(w.syntheticCol.components);
          return { card_id: cardId, grade: cardhedgerGradeFromHistoryTier(tier) };
        })
        .filter((x): x is { card_id: string; grade: string } => x != null);

      if (sparseItems.length > 0) {
        const estimates = await this.certPricing.fetchPriceEstimatesBatch(
          sparseItems,
        );
        for (const [key, est] of estimates) {
          if (est != null) fmvByKey.set(key, est);
        }
        this.logger.debug(
          JSON.stringify({
            msg: 'mint_previews_price_estimate_batch',
            requested: sparseItems.length,
            resolved: estimates.size,
          }),
        );
      }
    }

    await this.mapInBatches(
      workItems,
      this.mintPreviewConcurrency(),
      async (w) => {
        const certPrice = w.certDigits
          ? certPriceByDigits.get(w.certDigits)
          : undefined;
        const previewOpts = this.previewOptsForMint(
          w.syntheticCol,
          w.batchRow,
          fmvByKey,
          certPrice,
          flags,
        );
        if (w.batchRow) {
          out[w.tokenId] = await this.pricing.buildPreviewFromResolved(
            {
              query: w.query,
              row: w.batchRow,
              confidence: 'verified',
            },
            w.syntheticCol,
            previewOpts,
          );
        } else {
          out[w.tokenId] = await this.pricing.getPreviewForCollection(
            w.syntheticCol,
          );
        }
      },
    );

    return out;
  }

  /**
   * Cardhedger comps from on-chain mint metadata when no collection row exists yet
   * (or collection resolve has not seeded `cardhedgerCardId`).
   */
  async getCompsSnapshotForTokenId(
    tokenId: number,
    options?: { gradeLabel?: string; tier?: string; rawCount?: number },
  ): Promise<MarketCompsSnapshot> {
    const id = Math.floor(Number(tokenId));
    if (!Number.isFinite(id) || id < 0) {
      return this.pricing.emptyMarketCompsSnapshot({
        enabled: this.isConfigured(),
        searchQuery: '',
        matched: false,
        message: 'Invalid token id',
      });
    }
    if (!this.isConfigured()) {
      return this.pricing.emptyMarketCompsSnapshot({
        enabled: false,
        searchQuery: '',
        matched: false,
        message: 'Cardhedger is not configured (CARDHEDGER_API_KEY)',
      });
    }

    const pack = await this.rwaAssetResolve.batchRwaMetadata([id]);
    const item = pack.items.find((row) => row.tokenId === id);
    const meta = item?.metadata;
    if (!meta) {
      return this.pricing.emptyMarketCompsSnapshot({
        enabled: true,
        searchQuery: '',
        matched: false,
        message: 'Metadata unavailable',
      });
    }

    const certDigits = this.normalizeCertDigits(
      psaCertNumberFromGradedMeta(meta),
    );
    let batchRow: CardhedgerCardRow | undefined;
    if (certDigits && this.mintPreviewUseCertBatch()) {
      const certMap = await this.fetchCardRowsByCertsBatch([certDigits]);
      batchRow = certMap.get(certDigits);
    }

    const graded =
      (meta.properties as Record<string, unknown> | undefined)?.graded ??
      (meta.graded as Record<string, unknown> | undefined);
    const psaMirror = await this.enrichPsaMirrorFromCertLookup(
      graded as Record<string, unknown> | undefined,
      this.psaMirrorFromGradedBlock(
        graded as Record<string, unknown> | undefined,
      ),
    );

    const syntheticCol = this.buildMintSyntheticCollection({
      tokenId: id,
      meta,
      psaMirror,
      cardhedgerCardIdOverride:
        typeof batchRow?.card_id === 'string' ? batchRow.card_id.trim() : null,
    });

    const gradeLabel = String(options?.gradeLabel ?? '').trim();
    const tier =
      String(options?.tier ?? '').trim() ||
      marketHistoryTierFromComponents(syntheticCol.components);
    const compsOpts = {
      ...(gradeLabel ? { gradeLabel } : { tier }),
      rawCount: options?.rawCount,
    };
    const q = this.resolve.buildCollectionQuery(syntheticCol).query;

    if (batchRow) {
      const cardId =
        typeof batchRow.card_id === 'string' ? batchRow.card_id.trim() : '';
      if (cardId) {
        return this.pricing.getCompsSnapshotByCardIdDirect(cardId, {
          ...compsOpts,
          searchQuery: q,
          catalogRow: batchRow,
        });
      }
    }

    const storedId = String(
      syntheticCol.components?.cardhedgerCardId ?? '',
    ).trim();
    if (storedId) {
      return this.pricing.getCompsSnapshotByCardIdDirect(storedId, {
        ...compsOpts,
        searchQuery: q,
      });
    }

    return this.pricing.getCompsSnapshotForCollection(syntheticCol, compsOpts);
  }
}
