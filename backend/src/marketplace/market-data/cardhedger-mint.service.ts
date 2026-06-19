import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  TTL_CACHE_PROVIDER,
  type TtlCacheProvider,
} from '../../common/cache/ttl-cache.interface';
import { BlockchainService } from '../../blockchain/blockchain.service';
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
import { CardhedgerResolveService } from './cardhedger-resolve.service';
import { CardhedgerPricingService } from './cardhedger-pricing.service';

/**
 * Handles mint/cert/IPFS preview logic: resolves a PSA cert number to a
 * Cardhedger card row, enriches PSA mirror fields from on-chain metadata,
 * and builds `MarketCollectionPreview` for freshly minted RWA tokens.
 */
@Injectable()
export class CardhedgerMintService {
  private readonly logger = new Logger(CardhedgerMintService.name);

  private readonly CERT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour (cert-details batch)
  private static readonly NS_CERT_DETAILS_BATCH = 'cardhedger:certDetailsBatch';
  private static readonly CERT_DETAILS_BATCH_MAX = 100;

  constructor(
    private readonly cardhedger: CardhedgerService,
    private readonly blockchain: BlockchainService,
    private readonly config: ConfigService,
    private readonly psaCertSnapshots: PsaCertSnapshotService,
    @Inject(TTL_CACHE_PROVIDER) private readonly ttlCache: TtlCacheProvider,
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
    const d = String(cert ?? '').replace(/\D/g, '');
    return d.length >= 7 ? d : '';
  }

  /**
   * Cardhedger `POST /v1/cards/details-by-certs` — up to 100 certs per request.
   * Returns cert digits → catalog row (skips entries with no `card`).
   * Additionally captures `cert_info.description` even when `card` is null into
   * the companion `descriptionOut` map (when provided), enabling fallback text search.
   */
  private async fetchCardRowsByCertsBatch(
    certs: string[],
    descriptionOut?: Map<string, string>,
  ): Promise<Map<string, CardhedgerCardRow>> {
    const out = new Map<string, CardhedgerCardRow>();
    if (!this.isConfigured()) return out;

    const unique = [
      ...new Set(
        certs
          .map((c) => this.normalizeCertDigits(c))
          .filter((c) => c.length > 0),
      ),
    ];
    if (unique.length === 0) return out;

    for (let i = 0; i < unique.length; i += CardhedgerMintService.CERT_DETAILS_BATCH_MAX) {
      const chunk = unique.slice(
        i,
        i + CardhedgerMintService.CERT_DETAILS_BATCH_MAX,
      );
      const cacheKey = chunk.join(',');
      const cached = this.ttlCache.get<{
        map: Map<string, CardhedgerCardRow>;
        descriptions?: Map<string, string>;
      }>(
        CardhedgerMintService.NS_CERT_DETAILS_BATCH,
        cacheKey,
      );
      if (cached) {
        for (const [k, v] of cached.map) out.set(k, v);
        if (descriptionOut && cached.descriptions) {
          for (const [k, v] of cached.descriptions) descriptionOut.set(k, v);
        }
        continue;
      }
      const chunkMap = new Map<string, CardhedgerCardRow>();
      const chunkDescriptions = new Map<string, string>();
      try {
        const body = await this.cardhedger.forwardJson(
          'POST',
          '/v1/cards/details-by-certs',
          {
            body: { certs: chunk, grader: 'PSA' },
          },
        );
        const results = Array.isArray(
          (body as { results?: unknown[] } | null)?.results,
        )
          ? ((body as { results: unknown[] }).results ?? [])
          : [];
        for (const raw of results) {
          if (typeof raw !== 'object' || raw == null) continue;
          const row = raw as {
            cert_info?: { cert?: string | number; description?: string };
            card?: CardhedgerCardRow;
          };
          const certDigits = this.normalizeCertDigits(
            String(row.cert_info?.cert ?? ''),
          );
          if (!certDigits) continue;
          // Capture cert_info.description regardless of whether card is present
          const desc =
            typeof row.cert_info?.description === 'string' &&
            row.cert_info.description.trim()
              ? row.cert_info.description.trim()
              : null;
          if (desc) chunkDescriptions.set(certDigits, desc);
          const card = row.card;
          const cardId =
            typeof card?.card_id === 'string' ? card.card_id.trim() : '';
          if (cardId && card) {
            chunkMap.set(certDigits, card);
          }
        }
        // Only cache a successful (even empty-result) upstream response.
        this.ttlCache.set(
          CardhedgerMintService.NS_CERT_DETAILS_BATCH,
          cacheKey,
          { map: chunkMap, descriptions: chunkDescriptions },
          this.CERT_CACHE_TTL_MS,
        );
        for (const [k, v] of chunkMap) out.set(k, v);
        if (descriptionOut) {
          for (const [k, v] of chunkDescriptions) descriptionOut.set(k, v);
        }
      } catch (e) {
        // Upstream failure — skip this chunk without caching so the next
        // request can retry against the live API once it recovers.
        this.logger.warn(
          `details-by-certs batch failed (${chunk.length} certs): ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
    }
    return out;
  }

  /**
   * Resolve a single PSA cert to its Cardhedger catalog row via `details-by-certs`.
   * Also returns `certDescription` (CardHedger-formatted card name) even when the cert
   * is not yet matched to a catalog card (`card: null`). Use `certDescription` as a
   * high-confidence text search query when `row` is null.
   */
  async getCardRowByCert(cert: string): Promise<{
    row: CardhedgerCardRow | null;
    certDescription: string | null;
  }> {
    const digits = this.normalizeCertDigits(cert);
    if (!digits) return { row: null, certDescription: null };
    const descriptions = new Map<string, string>();
    const cardMap = await this.fetchCardRowsByCertsBatch([digits], descriptions);
    return {
      row: cardMap.get(digits) ?? null,
      certDescription: descriptions.get(digits) ?? null,
    };
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

    const snap = await this.psaCertSnapshots.fetchCertSnapshotJson(certRaw);
    if (!snap) {
      const scraped =
        await this.psaCertSnapshots.refreshEstimateIfMissing(certRaw);
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
      const scraped =
        await this.psaCertSnapshots.refreshEstimateIfMissing(certRaw);
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

    const pack = await this.blockchain.batchRwaMetadata(ids);
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
    if (this.mintPreviewUseCertBatch() && work.length > 0) {
      const certs = work
        .map((item) => psaCertNumberFromGradedMeta(item.metadata!))
        .filter((c): c is string => Boolean(c));
      certCardByDigits = await this.fetchCardRowsByCertsBatch(certs);
    }

    const psaMirrorByCert = new Map<string, Record<string, unknown>>();

    await this.mapInBatches(
      work,
      this.mintPreviewConcurrency(),
      async (item) => {
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
        if (batchRow) {
          out[item.tokenId] = await this.pricing.buildPreviewFromResolved(
            {
              query: q,
              row: batchRow,
              confidence: 'verified',
            },
            syntheticCol,
          );
        } else {
          out[item.tokenId] = await this.pricing.getPreviewForCollection(syntheticCol);
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

    const pack = await this.blockchain.batchRwaMetadata([id]);
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
