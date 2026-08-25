import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { QueryDeepPartialEntity, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In } from 'typeorm';
import { BlockchainService } from '../../blockchain/blockchain.service';
import {
  ChainConfigService,
  type SupportedChainId,
} from '../../blockchain/chain-config.service';
import { IpfsGatewayResolverService } from '../../blockchain/ipfs-gateway-resolver.service';
import {
  PsaPublicApiService,
  type PsaCertRecord,
} from '../../psa/psa-public-api.service';
import {
  extractPsaCertImageUrlsFromApiBody,
  extractPsaCertImagesFromGetImagesBody,
} from '../../psa/utils/psa-cert-images.util';
import { buildBulkMintMetadataFromPsaCert } from '../../rwa/bulk-mint/bulk-mint-prepare.util';
import {
  BUCKET_KEY_VERSION,
  computeMarketBucketKey,
  extractOrDiagnoseBucketComponents,
  metaShapeSampleForBucketLog,
} from '../utils/bucket-key.util';
import { marketParallelKeyFromPsaVariety } from '../utils/market-parallel-key.util';
import { mergePsaVarietyWithMintVariant } from '../../psa/psa-variety-catalog.util';
import {
  buildCollectionDisplayLabel,
  extractCollectionQueryUsed,
} from '../utils/collection-label.util';
import {
  pickCollectionDisplayImageUrl,
  pickTrendingSlabImageRef,
  psaCertNumberFromGradedMeta,
} from '../utils/collection-image.util';
import { enrichCollectionComponentsForApi } from '../utils/collection-row.util';
import { CollectionMarketSnapshot } from '../entities/collection-market-snapshot.entity';
import { Order, OrderSide, OrderStatus } from '../entities/order.entity';
import {
  MarketplaceCollection,
  type CollectionReviewStatus,
} from '../entities/marketplace-collection.entity';
import { RwaToken } from '../entities/rwa-token.entity';
import { RwaTokenRegistryService } from './rwa-token-registry.service';
import { CollectionMerkleSetService } from './collection-merkle-set.service';
import { CollectionBootService } from './collection-boot.service';
import { CollectionComponentsService } from './collection-components.service';
import { CollectionCoverService } from './collection-cover.service';
import { CollectionIdentityService } from './collection-identity.service';
import { CARDHEDGER_CARD_ID_SOURCE_PSA_CERT } from '../utils/card-match.util';
import {
  cardhedgerFromRwaMetadata,
  extractListingDisplayTitleFromMeta,
} from './collection-listing-meta.helpers';

export type CatalogCollectionCreateResult = {
  collectionKey: string;
  created: boolean;
  displayLabel: string;
  reviewStatus: CollectionReviewStatus;
  coverImageUrl: string | null;
  psaCertNumber: string | null;
};

export interface CollectionSummary {
  collectionKey: string;
  displayLabel: string;
  queryUsed: string | null;
  components: Record<string, unknown>;
  createdAt: Date;
  activeListingCount: number;
  /** Persisted catalog cover (may be null while slab fallback is used for display). */
  coverImageUrl: string | null;
  /** Resolved UI image: persisted catalog cover only (never PSA cert slab). */
  displayImageUrl: string | null;
  reviewStatus: CollectionReviewStatus;
}

export type CollectionReviewStatusFilter =
  | CollectionReviewStatus
  | 'all';

/**
 * Collection bucket lifecycle facade: CRUD summaries, listing ensure, order reads, admin delete.
 * Cover / components / boot logic live in dedicated services (same public method surface).
 */
@Injectable()
export class CollectionService {
  private readonly logger = new Logger(CollectionService.name);

  constructor(
    @InjectRepository(MarketplaceCollection)
    private readonly collectionRepo: Repository<MarketplaceCollection>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly blockchain: BlockchainService,
    private readonly chainConfig: ChainConfigService,
    private readonly config: ConfigService,
    private readonly ipfsResolver: IpfsGatewayResolverService,
    private readonly rwaTokenRegistry: RwaTokenRegistryService,
    private readonly eventEmitter: EventEmitter2,
    private readonly merkleSet: CollectionMerkleSetService,
    private readonly cover: CollectionCoverService,
    private readonly components: CollectionComponentsService,
    private readonly identity: CollectionIdentityService,
    private readonly psaPublicApi: PsaPublicApiService,
    @Inject(forwardRef(() => CollectionBootService))
    private readonly boot: CollectionBootService,
  ) {}

  async collectionKeysByTokenIds(
    tokenIds: Array<string | number>,
    chainId?: SupportedChainId,
  ): Promise<Record<number, string>> {
    return this.rwaTokenRegistry.collectionKeysByTokenIds(tokenIds, chainId);
  }

  private enqueueMarketSnapshotRefresh(collectionKey: string): void {
    this.eventEmitter.emit('snapshot.enqueue', { key: collectionKey, reason: 'cold_start' });
  }

  private collectionActiveOrdersCap(): number {
    return this.config.get<number>('marketplace.collectionActiveOrdersMax') ?? 2_000;
  }

  async migrateActiveAskBucketKeysToCurrentVersion(): Promise<{
    scanned: number;
    updated: number;
    skipped: number;
  }> {
    return this.boot.migrateActiveAskBucketKeysToCurrentVersion();
  }

  /**
   * 매도(ask) 등록 시: 메타에서 버킷·컬렉션 라벨 문구를 읽어 컬렉션 행을 만들고 key 반환.
   * graded 없으면 null (호출부에서 listing 거부).
   */
  async ensureCollectionForListing(
    tokenId: string,
    chainId?: SupportedChainId,
  ): Promise<string | null> {
    const resolved = chainId ?? this.chainConfig.getDefaultChainId();
    const uri = await this.blockchain.getRwaTokenURI(Number(tokenId), resolved);
    const meta = await this.ipfsResolver.fetchMetadataJson(uri);
    const result = await this.ensureCollectionBucketFromGradedMeta(meta, {
      step: 'ensureCollectionForListing',
      tokenId: String(tokenId),
      tokenUri: typeof uri === 'string' ? uri : String(uri),
      chainId: resolved,
      linkRwaToken: true,
    });
    return result?.collectionKey ?? null;
  }

  /**
   * Admin catalog create: PSA cert → graded identity → marketplace_collections.
   * No mint / ask required. New rows start as `pending_review`.
   */
  async createCatalogCollectionFromPsaCert(
    certNumberRaw: string,
  ): Promise<CatalogCollectionCreateResult> {
    const certNumber = certNumberRaw.trim();
    if (!/^\d{7,10}$/.test(certNumber)) {
      throw new BadRequestException('certNumber must be 7–10 digits');
    }

    const lookup = await this.psaPublicApi.getByCertNumber(certNumber, {
      bypassCache: true,
    });
    if (lookup.status !== 'success' || !lookup.raw) {
      let reason = `PSA lookup failed for cert ${certNumber}`;
      if (lookup.status === 'error') reason = lookup.message;
      else if (lookup.status === 'disabled') {
        reason = 'PSA Public API is unavailable';
      } else if (lookup.status === 'skipped') {
        reason = `PSA lookup skipped: ${lookup.reason}`;
      }
      throw new BadRequestException(reason);
    }

    const psaCert = (lookup.raw as { PSACert?: PsaCertRecord }).PSACert;
    if (!psaCert || typeof psaCert !== 'object') {
      throw new BadRequestException(
        `PSA cert ${certNumber} not found or response missing PSACert`,
      );
    }

    let imageUrl =
      extractPsaCertImageUrlsFromApiBody(lookup.raw, certNumber).front ?? null;
    if (!imageUrl) {
      const imgs = await this.psaPublicApi.getImagesByCertNumber(certNumber);
      if (imgs.status === 'success') {
        imageUrl =
          extractPsaCertImagesFromGetImagesBody(imgs.raw).front ??
          extractPsaCertImagesFromGetImagesBody(imgs.raw).back ??
          null;
      }
    }

    const { metadata } = buildBulkMintMetadataFromPsaCert({
      certNumber,
      psaCert,
      imageUrl: imageUrl ?? '',
    });
    // Cardhedger catalog image (+ cardId) before insert so cover resolve can S3-ingest.
    // PSA slab URLs stay in mint meta but are never used as collection covers.
    const meta = await this.cover.attachCardhedgerFromPsaCert(
      metadata as unknown as Record<string, unknown>,
      certNumber,
    );

    const result = await this.ensureCollectionBucketFromGradedMeta(meta, {
      step: 'createCatalogCollectionFromPsaCert',
      catalogSource: 'admin_psa_cert',
      linkRwaToken: false,
    });
    if (!result) {
      throw new BadRequestException(
        'Could not derive a marketplace collection from this PSA cert (graded identity incomplete)',
      );
    }

    // Guarantee components.cardhedgerCardId before the admin UI refreshes.
    await this.ensureCatalogCardhedgerCardId(
      result.collectionKey,
      meta,
      certNumber,
    );
    // Snapshot cold_start may have raced before id was filled — refresh again.
    this.enqueueMarketSnapshotRefresh(result.collectionKey);

    const row = await this.findOne(result.collectionKey);
    return {
      collectionKey: result.collectionKey,
      created: result.created,
      displayLabel: row?.displayLabel ?? result.displayLabel,
      reviewStatus: (row?.reviewStatus ?? 'pending_review') as CollectionReviewStatus,
      coverImageUrl: row?.coverImageUrl ?? result.coverImageUrl,
      psaCertNumber: row?.psaCertNumber ?? certNumber,
    };
  }

  /**
   * Admin catalog create: ensure `components.cardhedgerCardId` is stored (and
   * identity cache seeded) so review UI does not show "Missing cardhedgerCardId".
   */
  private async ensureCatalogCardhedgerCardId(
    collectionKey: string,
    meta: Record<string, unknown>,
    certNumber: string,
  ): Promise<void> {
    const key = collectionKey.toLowerCase();
    const row = await this.findOne(key);
    if (!row) return;

    const existing = String(row.components?.cardhedgerCardId ?? '').trim();
    if (existing) {
      if (this.identity.isEnabled()) {
        await this.identity.writeFromCertLookup(key, existing, null);
      }
      return;
    }

    let workingMeta = meta;
    let ch = cardhedgerFromRwaMetadata(workingMeta);
    if (!ch.cardId) {
      workingMeta = await this.cover.attachCardhedgerFromPsaCert(
        workingMeta,
        certNumber,
      );
      ch = cardhedgerFromRwaMetadata(workingMeta);
    }
    if (!ch.cardId) {
      this.logger.warn(
        JSON.stringify({
          msg: 'catalog_create_cardhedger_id_missing',
          collectionKey: key,
          certNumber,
        }),
      );
      return;
    }

    if (this.identity.isEnabled()) {
      await this.identity.writeFromCertLookup(key, ch.cardId, ch.searchQuery);
      return;
    }

    await this.collectionRepo.update(
      { collectionKey: key },
      {
        components: {
          ...(row.components ?? {}),
          cardhedgerCardId: ch.cardId,
          cardhedgerCardIdSource: CARDHEDGER_CARD_ID_SOURCE_PSA_CERT,
          ...(ch.searchQuery
            ? { cardhedgerSearchQuery: ch.searchQuery }
            : {}),
          ...(ch.psaSpecId ? { psaSpecId: ch.psaSpecId } : {}),
        } as QueryDeepPartialEntity<Record<string, unknown>>,
      },
    );
  }

  /**
   * Shared insert path for ask-time ensure and admin catalog create.
   * Returns null when graded bucket components cannot be extracted.
   */
  private async ensureCollectionBucketFromGradedMeta(
    meta: Record<string, unknown>,
    opts: {
      step: string;
      tokenId?: string;
      tokenUri?: string;
      chainId?: SupportedChainId;
      linkRwaToken: boolean;
      catalogSource?: string;
    },
  ): Promise<{
    collectionKey: string;
    created: boolean;
    displayLabel: string;
    coverImageUrl: string | null;
  } | null> {
    const extracted = extractOrDiagnoseBucketComponents(meta);
    if (!extracted.ok) {
      this.logger.warn(
        JSON.stringify({
          msg: 'collection_key_pipeline',
          step: opts.step,
          outcome: 'extract_bucket_failed',
          tokenId: opts.tokenId ?? null,
          tokenUriSample: opts.tokenUri?.slice(0, 120) ?? null,
          diagnosis: {
            code: extracted.code,
            gradedSource: extracted.gradedSource,
            detail: extracted.detail,
          },
          metaSample: metaShapeSampleForBucketLog(meta),
        }),
      );
      return null;
    }
    const components = extracted.components;

    const queryUsed = extractCollectionQueryUsed(meta);
    const displayLabel = buildCollectionDisplayLabel(components, queryUsed);
    const collectionKey = computeMarketBucketKey(components);
    const diagOn =
      this.config.get<string>('MARKETPLACE_PIPELINE_DIAG') === '1' ||
      this.config.get<string>('MARKETPLACE_PIPELINE_DIAG') === 'true';
    if (diagOn) {
      this.logger.log(
        JSON.stringify({
          msg: 'collection_key_pipeline',
          step: opts.step,
          outcome: 'bucket_key_computed',
          tokenId: opts.tokenId ?? null,
          collectionKey,
          gradedSource: extracted.gradedSource,
          keyFormatNote:
            'sha256 hex is lowercase in Node crypto; DB stores this string.',
        }),
      );
    }
    const ch = cardhedgerFromRwaMetadata(meta);
    const coverImageUrl = await this.cover.resolveCoverUrlForNewCollection(
      collectionKey,
      meta,
    );

    const compRecord: Record<string, unknown> = {
      ...(components as unknown as Record<string, unknown>),
    };
    if (opts.catalogSource) {
      compRecord.catalogSource = opts.catalogSource;
    }
    const listingTitle = extractListingDisplayTitleFromMeta(meta);
    if (listingTitle) {
      compRecord.listingDisplayTitle = listingTitle;
    }
    // Persist Cardhedger identity on insert so admin review / snapshots are not
    // "Missing cardhedgerCardId" while a fire-and-forget seed races the UI.
    if (ch.cardId) {
      compRecord.cardhedgerCardId = ch.cardId;
      if (opts.catalogSource === 'admin_psa_cert') {
        compRecord.cardhedgerCardIdSource = CARDHEDGER_CARD_ID_SOURCE_PSA_CERT;
      }
    }
    if (ch.searchQuery) {
      compRecord.cardhedgerSearchQuery = ch.searchQuery;
    }
    if (ch.psaSpecId) {
      compRecord.psaSpecId = ch.psaSpecId;
    }

    const psaCert = psaCertNumberFromGradedMeta(meta);

    const trendingSlab = pickTrendingSlabImageRef(meta);
    if (trendingSlab) {
      compRecord.trendingSlabImageUrl = trendingSlab;
    }

    const gradedSrc =
      (meta.properties as Record<string, unknown> | undefined)?.graded ??
      meta.graded;
    if (gradedSrc && typeof gradedSrc === 'object') {
      const g = gradedSrc as Record<string, unknown>;
      const psa = g.psa as Record<string, unknown> | undefined;
      const card = g.card as Record<string, unknown> | undefined;
      if (psa && typeof psa === 'object') {
        const p = psa as Record<string, unknown>;
        const subject = String(
          p.subject ??
            p.Subject ??
            p.cardNameHint ??
            card?.name ??
            '',
        ).trim();
        const brand = String(
          p.brand ?? p.Brand ?? p.setHint ?? card?.set ?? '',
        ).trim();
        const category = String(p.category ?? p.Category ?? '').trim();
        const pvar = String(p.variety ?? p.Variety ?? '').trim();
        const pnum = String(
          p.cardNumber ?? p.CardNumber ?? p.card_number ?? '',
        ).trim();
        const yearRaw = p.year ?? p.Year ?? p.YearIssued;
        const year =
          yearRaw != null && yearRaw !== ''
            ? String(yearRaw).replace(/\D/g, '').slice(0, 4)
            : '';
        const gradeDesc = String(
          p.gradeDescription ?? p.GradeDescription ?? '',
        ).trim();
        const labelType = String(p.labelType ?? p.LabelType ?? '').trim();
        if (subject) compRecord.psaSubject = subject;
        if (brand) compRecord.psaBrand = brand;
        if (category) compRecord.psaCategory = category;
        if (pnum) compRecord.psaCardNumber = pnum;
        if (year) compRecord.psaYear = year;
        if (gradeDesc) compRecord.psaGradeDescription = gradeDesc;
        const gradeLabel = String(p.gradeLabel ?? p.GradeLabel ?? '').trim();
        if (gradeLabel) compRecord.psaGradeLabel = gradeLabel;
        if (labelType) compRecord.psaLabelType = labelType;
        const cv = String(card?.variant ?? '').trim();
        if (cv) compRecord.mintCardVariant = cv;
        const mergedVariety = mergePsaVarietyWithMintVariant(pvar, cv);
        if (mergedVariety) compRecord.psaVariety = mergedVariety;
      } else {
        const cv = String(card?.variant ?? '').trim();
        if (cv) {
          compRecord.mintCardVariant = cv;
          compRecord.psaVariety = mergePsaVarietyWithMintVariant(
            String(compRecord.psaVariety ?? ''),
            cv,
          );
        }
      }
    }

    const parallelKey = marketParallelKeyFromPsaVariety(
      String(compRecord.psaVariety ?? ''),
      String(compRecord.psaBrand ?? compRecord.cardSet ?? ''),
    );
    compRecord.marketParallelKey = parallelKey;

    const insertResult = await this.collectionRepo
      .createQueryBuilder()
      .insert()
      .into(MarketplaceCollection)
      .values({
        collectionKey,
        displayLabel,
        queryUsed,
        components: compRecord as QueryDeepPartialEntity<
          Record<string, unknown>
        >,
        coverImageUrl,
        psaCertNumber: psaCert ?? null,
        marketParallelKey: parallelKey,
        bucketKeyVersion: BUCKET_KEY_VERSION,
        reviewStatus: 'pending_review',
      })
      .orIgnore()
      .execute();

    const inserted = (insertResult.identifiers?.length ?? 0) > 0;
    if (!inserted) {
      await this.components.mergePsaPopulationFromMetaIfMissing(
        collectionKey,
        meta,
      );
      await this.components.mergeCardhedgerCardIdFromMetaIfMissing(
        collectionKey,
        meta,
      );
      await this.components.mergeListingDisplayTitleFromMetaIfMissing(
        collectionKey,
        meta,
      );
      await this.components.mergeTrendingSlabMetaFromMetaIfMissing(
        collectionKey,
        meta,
      );
      await this.components.mergePsaSpecIdFromCertIfMissing(
        collectionKey,
        psaCert,
        meta,
      );
      await this.cover.upgradeCoverFromMetaIfBetter(collectionKey, meta);
    } else if (this.identity.isEnabled()) {
      // Await so cache + DB are warm before snapshot cold_start / admin refresh.
      if (opts.catalogSource === 'admin_psa_cert' && ch.cardId) {
        await this.identity.writeFromCertLookup(
          collectionKey,
          ch.cardId,
          ch.searchQuery,
        );
      } else {
        await this.identity.seedFromMintMetadataOnInsert(collectionKey, meta);
      }
    }

    await this.components.ensurePsaSpecPopulationFromApi(collectionKey, {
      allowUpstream: true,
    });

    if (opts.linkRwaToken && opts.tokenId) {
      void this.rwaTokenRegistry.upsertFromMetadata(opts.tokenId, meta, {
        tokenUri: opts.tokenUri,
        collectionKey,
        chainId: opts.chainId,
      });
      await this.syncTokenActiveAskCollectionKey(
        String(opts.tokenId),
        collectionKey,
        opts.chainId,
      );
    }

    this.enqueueMarketSnapshotRefresh(collectionKey);

    return {
      collectionKey,
      created: inserted,
      displayLabel,
      coverImageUrl,
    };
  }

  /** Keep this token's live ask on the same bucket as the mint metadata. */
  private async syncTokenActiveAskCollectionKey(
    tokenId: string,
    collectionKey: string,
    chainId?: SupportedChainId,
  ): Promise<void> {
    const where: {
      tokenId: string;
      side: OrderSide;
      status: OrderStatus;
      tokenContract?: string;
    } = {
      tokenId,
      side: OrderSide.ASK,
      status: OrderStatus.ACTIVE,
    };
    if (chainId != null) {
      where.tokenContract = this.chainConfig.getRwaAddress(chainId);
    }
    await this.orderRepo.update(where, { collectionKey });
  }

  async resolveCollectionKeyFromTokenMetadata(
    tokenId: string,
    chainId?: SupportedChainId,
  ): Promise<string | null> {
    const resolved = chainId ?? this.chainConfig.getDefaultChainId();
    const uri = await this.blockchain.getRwaTokenURI(Number(tokenId), resolved);
    const meta = await this.ipfsResolver.fetchMetadataJson(uri);
    const extracted = extractOrDiagnoseBucketComponents(meta);
    if (!extracted.ok) return null;
    return computeMarketBucketKey(extracted.components).toLowerCase();
  }

  private encodeCollectionCursor(row: {
    createdAt: Date;
    collectionKey: string;
  }): string {
    const payload = {
      ca: row.createdAt.toISOString(),
      ck: row.collectionKey.toLowerCase(),
    };
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  }

  private decodeCollectionCursor(cursor: string): { ca: Date; ck: string } {
    const j = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      ca: string;
      ck: string;
    };
    return { ca: new Date(j.ca), ck: String(j.ck).toLowerCase() };
  }

  /**
   * Collections visible for the selected chain:
   * - have orders or rwa_tokens on that chain's RWA contract, OR
   * - catalog-only (no orders / rwa_tokens on any chain) — admin-created before mint.
   */
  private chainScopedCollectionSql(rwaContract: string): string {
    return `(
      EXISTS (
        SELECT 1 FROM orders o
        WHERE LOWER(o.collection_key) = LOWER(c.collection_key)
          AND LOWER(o.token_contract) = :rwaContract
      )
      OR EXISTS (
        SELECT 1 FROM rwa_tokens t
        WHERE LOWER(t.collection_key) = LOWER(c.collection_key)
          AND LOWER(t.token_contract) = :rwaContract
      )
      OR (
        NOT EXISTS (
          SELECT 1 FROM orders o2
          WHERE LOWER(o2.collection_key) = LOWER(c.collection_key)
        )
        AND NOT EXISTS (
          SELECT 1 FROM rwa_tokens t2
          WHERE LOWER(t2.collection_key) = LOWER(c.collection_key)
        )
      )
    )`;
  }

  async listSummariesPaged(input: {
    limit?: number;
    cursor?: string | null;
    chainId?: SupportedChainId;
    /** Public callers must pass `active`. Admin may pass pending_review / rejected / all. */
    reviewStatus?: CollectionReviewStatusFilter;
    /**
     * Free-text search (header / discovery). When set, cursor is ignored and
     * results are capped; matches label, queryUsed, components, cert, key.
     */
    q?: string | null;
  }): Promise<{
    items: CollectionSummary[];
    nextCursor: string | null;
  }> {
    const qRaw = (input.q ?? '').trim().slice(0, 80);
    if (qRaw.length > 0) {
      return this.searchSummaries({
        q: qRaw,
        limit: input.limit,
        chainId: input.chainId,
        reviewStatus: input.reviewStatus,
      });
    }

    const limit = Math.min(Math.max(input.limit ?? 30, 1), 60);
    const chainId = input.chainId ?? this.chainConfig.getDefaultChainId();
    const rwaContract = this.chainConfig.getRwaAddress(chainId).toLowerCase();
    const qb = this.collectionRepo.createQueryBuilder('c');

    const cur = input.cursor?.trim();
    const chainFilter = this.chainScopedCollectionSql(rwaContract);
    const reviewFilter = input.reviewStatus ?? 'active';
    const reviewParams =
      reviewFilter === 'all'
        ? {}
        : { reviewStatus: reviewFilter };
    const reviewSql =
      reviewFilter === 'all' ? 'TRUE' : 'c.review_status = :reviewStatus';

    if (cur) {
      try {
        const { ca, ck } = this.decodeCollectionCursor(cur);
        qb.where(
          `${chainFilter} AND ${reviewSql} AND (c.created_at < :ca OR (c.created_at = :ca AND c.collection_key > :ck))`,
          { rwaContract, ca, ck, ...reviewParams },
        );
      } catch {
        qb.where(`${chainFilter} AND ${reviewSql}`, {
          rwaContract,
          ...reviewParams,
        });
      }
    } else {
      qb.where(`${chainFilter} AND ${reviewSql}`, {
        rwaContract,
        ...reviewParams,
      });
    }

    qb.orderBy('c.created_at', 'DESC')
      .addOrderBy('c.collection_key', 'ASC')
      .take(limit + 1);

    const rows = await qb.getMany();
    const page = rows.slice(0, limit);
    const hasMore = rows.length > limit;
    const nextCursor =
      hasMore && page.length > 0
        ? this.encodeCollectionCursor({
            createdAt: page[page.length - 1].createdAt,
            collectionKey: page[page.length - 1].collectionKey,
          })
        : null;

    if (page.length === 0) {
      return { items: [], nextCursor: null };
    }

    const keys = page.map((c) => c.collectionKey.toLowerCase());
    const countMap = await this.activeAskCountsForKeys(keys, rwaContract);

    const items: CollectionSummary[] = page.map((c) =>
      this.toCollectionSummary(c, countMap),
    );

    return { items, nextCursor };
  }

  /**
   * Catalog text search for the header / discovery. Matches display fields and
   * common component facets; ranks by active listing count then recency.
   */
  private async searchSummaries(input: {
    q: string;
    limit?: number;
    chainId?: SupportedChainId;
    reviewStatus?: CollectionReviewStatusFilter;
  }): Promise<{ items: CollectionSummary[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(input.limit ?? 30, 1), 40);
    const chainId = input.chainId ?? this.chainConfig.getDefaultChainId();
    const rwaContract = this.chainConfig.getRwaAddress(chainId).toLowerCase();
    const chainFilter = this.chainScopedCollectionSql(rwaContract);
    const reviewFilter = input.reviewStatus ?? 'active';
    const reviewParams =
      reviewFilter === 'all' ? {} : { reviewStatus: reviewFilter };
    const reviewSql =
      reviewFilter === 'all' ? 'TRUE' : 'c.review_status = :reviewStatus';

    const pattern = `%${CollectionService.escapeIlike(input.q)}%`;
    const matchKey = input.q.length >= 4;
    const searchSql = `(
      c.display_label ILIKE :pat ESCAPE '\\'
      OR COALESCE(c.query_used, '') ILIKE :pat ESCAPE '\\'
      OR COALESCE(c.psa_cert_number, '') ILIKE :pat ESCAPE '\\'
      OR COALESCE(c.components->>'cardName', '') ILIKE :pat ESCAPE '\\'
      OR COALESCE(c.components->>'cardNameDisplay', '') ILIKE :pat ESCAPE '\\'
      OR COALESCE(c.components->>'cardSet', '') ILIKE :pat ESCAPE '\\'
      OR COALESCE(c.components->>'cardSetDisplay', '') ILIKE :pat ESCAPE '\\'
      OR COALESCE(c.components->>'listingDisplayTitle', '') ILIKE :pat ESCAPE '\\'
      OR COALESCE(c.components->>'psaSubject', '') ILIKE :pat ESCAPE '\\'
      OR COALESCE(c.components->>'psaBrand', '') ILIKE :pat ESCAPE '\\'
      OR COALESCE(c.components->>'variant', '') ILIKE :pat ESCAPE '\\'
      OR COALESCE(c.components->>'psaVariety', '') ILIKE :pat ESCAPE '\\'
      ${matchKey ? "OR c.collection_key ILIKE :pat ESCAPE '\\'" : ''}
    )`;

    const rows = await this.collectionRepo
      .createQueryBuilder('c')
      .where(`${chainFilter} AND ${reviewSql} AND ${searchSql}`, {
        rwaContract,
        pat: pattern,
        ...reviewParams,
      })
      .orderBy('c.created_at', 'DESC')
      .addOrderBy('c.collection_key', 'ASC')
      .take(limit)
      .getMany();

    if (rows.length === 0) {
      return { items: [], nextCursor: null };
    }

    const keys = rows.map((c) => c.collectionKey.toLowerCase());
    const countMap = await this.activeAskCountsForKeys(keys, rwaContract);
    const items = rows
      .map((c) => this.toCollectionSummary(c, countMap))
      .sort((a, b) => {
        if (b.activeListingCount !== a.activeListingCount) {
          return b.activeListingCount - a.activeListingCount;
        }
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

    return { items, nextCursor: null };
  }

  /**
   * Similar collections for Card.html `#similar-items`:
   * same card name OR same set name (active only), excluding the current key.
   * When both facets exist, rows matching both are ranked above single-facet hits.
   */
  async findSimilarByNameAndSet(
    collectionKey: string,
    opts?: { limit?: number; chainId?: SupportedChainId },
  ): Promise<{ items: CollectionSummary[] }> {
    const key = decodeURIComponent(collectionKey).trim().toLowerCase();
    const limit = Math.min(Math.max(opts?.limit ?? 12, 1), 24);
    const empty = { items: [] as CollectionSummary[] };
    if (!key) return empty;

    const col = await this.findOne(key);
    if (!col) return empty;

    const components = (col.components ?? {}) as Record<string, unknown>;
    const cardName = [
      components.cardNameDisplay,
      components.cardName,
      components.psaSubject,
    ]
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .find((v) => v.length > 0);
    const cardSet = [
      components.cardSetDisplay,
      components.cardSet,
      components.psaBrand,
    ]
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .find((v) => v.length > 0);

    if (!cardName && !cardSet) return empty;

    const chainId = opts?.chainId ?? this.chainConfig.getDefaultChainId();
    const rwaContract = this.chainConfig.getRwaAddress(chainId).toLowerCase();
    const chainFilter = this.chainScopedCollectionSql(rwaContract);
    const nameSql = `COALESCE(NULLIF(c.components->>'cardNameDisplay', ''), NULLIF(c.components->>'cardName', ''), NULLIF(c.components->>'psaSubject', ''), '')`;
    const setSql = `COALESCE(NULLIF(c.components->>'cardSetDisplay', ''), NULLIF(c.components->>'cardSet', ''), NULLIF(c.components->>'psaBrand', ''), '')`;

    const qb = this.collectionRepo
      .createQueryBuilder('c')
      .where(`${chainFilter} AND c.review_status = :reviewStatus`, {
        rwaContract,
        reviewStatus: 'active',
      })
      .andWhere('c.collection_key != :key', { key });

    if (cardName && cardSet) {
      qb.andWhere(
        `(LOWER(TRIM(${nameSql})) = LOWER(TRIM(:cardName)) OR LOWER(TRIM(${setSql})) = LOWER(TRIM(:cardSet)))`,
        { cardName, cardSet },
      );
    } else if (cardName) {
      qb.andWhere(`LOWER(TRIM(${nameSql})) = LOWER(TRIM(:cardName))`, {
        cardName,
      });
    } else {
      qb.andWhere(`LOWER(TRIM(${setSql})) = LOWER(TRIM(:cardSet))`, {
        cardSet,
      });
    }

    const rows = await qb
      .orderBy('c.created_at', 'DESC')
      .addOrderBy('c.collection_key', 'ASC')
      .take(limit * 3)
      .getMany();

    if (rows.length === 0) return empty;

    const nameNorm = cardName?.toLowerCase() ?? '';
    const setNorm = cardSet?.toLowerCase() ?? '';
    const facetMatchScore = (compsRaw: Record<string, unknown> | null): number => {
      const comps = compsRaw ?? {};
      const n = [
        comps.cardNameDisplay,
        comps.cardName,
        comps.psaSubject,
      ]
        .map((v) => (typeof v === 'string' ? v.trim().toLowerCase() : ''))
        .find((v) => v.length > 0);
      const s = [
        comps.cardSetDisplay,
        comps.cardSet,
        comps.psaBrand,
      ]
        .map((v) => (typeof v === 'string' ? v.trim().toLowerCase() : ''))
        .find((v) => v.length > 0);
      const nameHit = Boolean(nameNorm && n === nameNorm);
      const setHit = Boolean(setNorm && s === setNorm);
      if (nameHit && setHit) return 2;
      if (nameHit || setHit) return 1;
      return 0;
    };

    const keys = rows.map((c) => c.collectionKey.toLowerCase());
    const countMap = await this.activeAskCountsForKeys(keys, rwaContract);
    const ranked = rows.map((c) => ({
      summary: this.toCollectionSummary(c, countMap),
      score: facetMatchScore((c.components ?? {}) as Record<string, unknown>),
    }));
    ranked.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.summary.activeListingCount !== a.summary.activeListingCount) {
        return b.summary.activeListingCount - a.summary.activeListingCount;
      }
      return b.summary.createdAt.getTime() - a.summary.createdAt.getTime();
    });

    return { items: ranked.slice(0, limit).map((r) => r.summary) };
  }

  /** Escape `%`, `_`, and `\` for PostgreSQL ILIKE … ESCAPE '\\'. */
  static escapeIlike(raw: string): string {
    return raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
  }

  private toCollectionSummary(
    c: MarketplaceCollection,
    countMap: Map<string, number>,
  ): CollectionSummary {
    const components = enrichCollectionComponentsForApi(
      c.components,
      c.psaCertNumber,
    );
    const coverImageUrl = pickCollectionDisplayImageUrl(c.coverImageUrl);
    const status = (c.reviewStatus ?? 'active') as CollectionReviewStatus;
    return {
      collectionKey: c.collectionKey,
      displayLabel: c.displayLabel,
      queryUsed: c.queryUsed,
      components,
      createdAt: c.createdAt,
      activeListingCount: countMap.get(c.collectionKey.toLowerCase()) ?? 0,
      coverImageUrl,
      displayImageUrl: coverImageUrl,
      reviewStatus: status,
    };
  }

  async countByReviewStatus(
    chainId?: SupportedChainId,
  ): Promise<Record<CollectionReviewStatus, number>> {
    const resolvedChainId = chainId ?? this.chainConfig.getDefaultChainId();
    const rwaContract = this.chainConfig
      .getRwaAddress(resolvedChainId)
      .toLowerCase();
    const rows = await this.collectionRepo
      .createQueryBuilder('c')
      .select('c.review_status', 'status')
      .addSelect('COUNT(*)::int', 'cnt')
      .where(this.chainScopedCollectionSql(rwaContract), { rwaContract })
      .groupBy('c.review_status')
      .getRawMany<{ status: string; cnt: number }>();
    const out: Record<CollectionReviewStatus, number> = {
      pending_review: 0,
      active: 0,
      rejected: 0,
    };
    for (const r of rows) {
      const s = r.status as CollectionReviewStatus;
      if (s in out) out[s] = Number(r.cnt) || 0;
    }
    return out;
  }

  async setCollectionReviewStatusAdmin(
    collectionKey: string,
    reviewStatus: CollectionReviewStatus,
  ): Promise<MarketplaceCollection> {
    const k = collectionKey.toLowerCase();
    const row = await this.findOne(k);
    if (!row) throw new Error('COLLECTION_NOT_FOUND');
    await this.collectionRepo.update(
      { collectionKey: k },
      { reviewStatus },
    );
    const refreshed = await this.findOne(k);
    if (!refreshed) throw new Error('COLLECTION_NOT_FOUND');
    return refreshed;
  }

  async getReviewStatus(
    collectionKey: string,
  ): Promise<CollectionReviewStatus | null> {
    const row = await this.collectionRepo.findOne({
      where: { collectionKey: collectionKey.toLowerCase() },
      select: ['collectionKey', 'reviewStatus'],
    });
    if (!row) return null;
    return (row.reviewStatus ?? 'active') as CollectionReviewStatus;
  }

  private async activeAskCountsForKeys(
    keys: string[],
    rwaContract: string,
  ): Promise<Map<string, number>> {
    if (keys.length === 0) return new Map();
    const countRows = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.collection_key', 'key')
      .addSelect('COUNT(o.id)::int', 'cnt')
      .where('o.collection_key IS NOT NULL')
      .andWhere('o.collection_key IN (:...keys)', { keys })
      .andWhere('LOWER(o.token_contract) = :rwaContract', { rwaContract })
      .andWhere('o.status = :st', { st: OrderStatus.ACTIVE })
      .andWhere('o.side = :side', { side: OrderSide.ASK })
      .groupBy('o.collection_key')
      .getRawMany<{ key: string; cnt: number }>();

    const countMap = new Map<string, number>();
    for (const r of countRows) {
      countMap.set(String(r.key).toLowerCase(), Number(r.cnt));
    }
    return countMap;
  }

  /** Watchlist / batch UI — preserve caller key order; omit unknown keys. */
  async listSummariesByKeys(
    collectionKeys: string[],
    chainId?: SupportedChainId,
  ): Promise<CollectionSummary[]> {
    const ordered = [
      ...new Set(
        collectionKeys
          .map((k) => decodeURIComponent(k).trim().toLowerCase())
          .filter(Boolean),
      ),
    ].slice(0, 200);
    if (ordered.length === 0) return [];

    const resolvedChainId = chainId ?? this.chainConfig.getDefaultChainId();
    const rwaContract = this.chainConfig
      .getRwaAddress(resolvedChainId)
      .toLowerCase();

    const rows = await this.collectionRepo
      .createQueryBuilder('c')
      .where('c.collection_key IN (:...ordered)', { ordered })
      .andWhere(this.chainScopedCollectionSql(rwaContract), { rwaContract })
      .getMany();
    if (rows.length === 0) return [];

    const rowByKey = new Map(
      rows.map((r) => [r.collectionKey.toLowerCase(), r] as const),
    );

    const countMap = await this.activeAskCountsForKeys(ordered, rwaContract);

    const items: CollectionSummary[] = [];
    for (const key of ordered) {
      const c = rowByKey.get(key);
      if (!c) continue;
      items.push(this.toCollectionSummary(c, countMap));
    }
    return items;
  }

  async findOne(key: string): Promise<MarketplaceCollection | null> {
    const row = await this.collectionRepo.findOne({
      where: { collectionKey: key.toLowerCase() },
    });
    if (!row) return null;
    // UX OPTIMIZATION ONLY (not a correctness requirement):
    // Hydrates cardhedgerCardId from the identity cache when DB has null, reducing
    // the propagation window visible to the collection detail API.
    // The snapshot pipeline uses CollectionEnrichmentService.findOne which reads
    // pure DB state and is correct regardless of this hydration.
    return this.identity.hydrateCardhedgerCardId(row);
  }

  async ensureMintParallelVarietyFromListings(
    collectionKey: string,
    chainId?: SupportedChainId,
  ): Promise<boolean> {
    return this.components.ensureMintParallelVarietyFromListings(
      collectionKey,
      chainId,
    );
  }

  async ensurePsaTotalPopulationFromListings(
    collectionKey: string,
    chainId?: SupportedChainId,
  ): Promise<void> {
    return this.components.ensurePsaTotalPopulationFromListings(
      collectionKey,
      chainId,
    );
  }

  async ensurePsaSpecPopulationFromApi(
    collectionKey: string,
    opts?: { allowUpstream?: boolean },
  ): Promise<void> {
    return this.components.ensurePsaSpecPopulationFromApi(collectionKey, opts);
  }

  /** No-op — Spec pop is filled at collection create, never on detail read. */
  async ensurePsaSpecPopulationOnReadIfMissing(
    _collectionKey: string,
  ): Promise<void> {
    return;
  }

  async persistPsaMirrorFromCertToDb(collectionKey: string): Promise<boolean> {
    return this.components.persistPsaMirrorFromCertToDb(collectionKey, {
      allowUpstream: false,
    });
  }

  async ensureCardhedgerCardIdFromListings(
    collectionKey: string,
    chainId?: SupportedChainId,
  ): Promise<boolean> {
    return this.components.ensureCardhedgerCardIdFromListings(
      collectionKey,
      chainId,
    );
  }

  async ensurePsaCertNumberFromListings(
    collectionKey: string,
    opts?: { schedulePsaRefresh?: boolean; chainId?: SupportedChainId },
  ): Promise<void> {
    return this.components.ensurePsaCertNumberFromListings(collectionKey, opts);
  }

  mergePsaSnapshotIntoComponents(
    col: MarketplaceCollection,
    snap: Record<string, unknown> | null,
  ): MarketplaceCollection {
    return this.components.mergePsaSnapshotIntoComponents(col, snap);
  }

  async refreshPsaPublicSnapshotForCollection(
    collectionKey: string,
    opts?: { allowUpstream?: boolean },
  ): Promise<void> {
    return this.components.refreshPsaPublicSnapshotForCollection(
      collectionKey,
      opts,
    );
  }

  async mergePsaSnapshotIntoComponentsFromDb(
    col: MarketplaceCollection,
  ): Promise<MarketplaceCollection> {
    return this.components.mergePsaSnapshotIntoComponentsFromDb(col);
  }

  async auditCardhedgerCardIdExact(
    collectionKey: string,
    options?: { clearOnMismatch?: boolean },
  ): Promise<{
    checked: boolean;
    ok: boolean;
    cleared: boolean;
    failCodes: string[];
  }> {
    return this.components.auditCardhedgerCardIdExact(collectionKey, options);
  }

  async auditCollectionCardIdExact(
    collectionKey: string,
    options?: { clearOnMismatch?: boolean },
  ): Promise<{
    checked: boolean;
    ok: boolean;
    cleared: boolean;
    failCodes: string[];
  }> {
    return this.components.auditCollectionCardIdExact(collectionKey, options);
  }

  async ensureListingDisplayTitleFromListings(
    collectionKey: string,
    chainId?: SupportedChainId,
  ): Promise<void> {
    return this.components.ensureListingDisplayTitleFromListings(
      collectionKey,
      chainId,
    );
  }

  async activeListingsForCollection(
    collectionKey: string,
    chainId?: SupportedChainId,
  ): Promise<Order[]> {
    const resolved = chainId ?? this.chainConfig.getDefaultChainId();
    const rwa = this.chainConfig.getRwaAddress(resolved).toLowerCase();
    return this.orderRepo
      .createQueryBuilder('o')
      .where('o.collection_key = :key', { key: collectionKey.toLowerCase() })
      .andWhere('o.status = :status', { status: OrderStatus.ACTIVE })
      .andWhere('o.side = :side', { side: OrderSide.ASK })
      .andWhere('LOWER(o.token_contract) = :rwa', { rwa })
      .orderBy('o.created_at', 'ASC')
      .take(this.collectionActiveOrdersCap())
      .getMany();
  }

  async activeBidsForCollection(
    collectionKey: string,
    chainId?: SupportedChainId,
  ): Promise<Order[]> {
    const resolved = chainId ?? this.chainConfig.getDefaultChainId();
    const rwa = this.chainConfig.getRwaAddress(resolved).toLowerCase();
    return this.orderRepo
      .createQueryBuilder('o')
      .where('o.collection_key = :key', { key: collectionKey.toLowerCase() })
      .andWhere('o.status = :status', { status: OrderStatus.ACTIVE })
      .andWhere('o.side = :side', { side: OrderSide.BID })
      .andWhere('LOWER(o.token_contract) = :rwa', { rwa })
      .orderBy('o.created_at', 'DESC')
      .take(this.collectionActiveOrdersCap())
      .getMany();
  }

  async setCollectionCoverImageAdmin(
    collectionKey: string,
    coverImageUrl: string,
  ): Promise<MarketplaceCollection> {
    return this.cover.setCollectionCoverImageAdmin(collectionKey, coverImageUrl);
  }

  async uploadCollectionCoverImageAdmin(
    collectionKey: string,
    file: Express.Multer.File,
  ): Promise<MarketplaceCollection> {
    return this.cover.uploadCollectionCoverImageAdmin(collectionKey, file);
  }

  async adminPreviewCoverFromToken(
    tokenId: string,
    collectionKey?: string,
    chainId?: SupportedChainId,
  ): Promise<string | null> {
    return this.cover.adminPreviewCoverFromToken(tokenId, collectionKey, chainId);
  }

  async upgradeCollectionCoverFromToken(
    collectionKey: string,
    tokenId: string,
    chainId?: SupportedChainId,
  ): Promise<{ coverImageUrl: string | null; upgraded: boolean }> {
    return this.cover.upgradeCoverFromToken(collectionKey, tokenId, chainId);
  }

  async adminDeleteCollectionCompletely(collectionKey: string): Promise<{
    collectionKey: string;
    deletedSnapshots: number;
    deletedOrders: number;
    deletedRwaTokens: number;
    deletedCollection: boolean;
  }> {
    const k = collectionKey.toLowerCase();
    const row = await this.findOne(k);
    if (!row) {
      throw new Error('COLLECTION_NOT_FOUND');
    }

    const result = await this.collectionRepo.manager.transaction(async (em) => {
      const snapRes = await em.delete(CollectionMarketSnapshot, {
        collectionKey: k,
      });
      const orderRes = await em.delete(Order, { collectionKey: k });
      const rwaRes = await em.delete(RwaToken, { collectionKey: k });
      const colRes = await em.delete(MarketplaceCollection, {
        collectionKey: k,
      });
      return {
        deletedSnapshots: snapRes.affected ?? 0,
        deletedOrders: orderRes.affected ?? 0,
        deletedRwaTokens: rwaRes.affected ?? 0,
        deletedCollection: (colRes.affected ?? 0) > 0,
      };
    });

    this.merkleSet.invalidateForCollection(k);

    this.logger.warn(
      `[Admin] deleted collection ${k}: snapshots=${result.deletedSnapshots} orders=${result.deletedOrders} rwa_tokens=${result.deletedRwaTokens}`,
    );

    return { collectionKey: k, ...result };
  }

  merkleEligibleTokenIds(
    collectionKey: string,
    options?: { bypassCache?: boolean },
  ): Promise<{ tokenIds: string[] }> {
    return this.merkleSet.merkleEligibleTokenIds(collectionKey, options);
  }

  /**
   * Merge additional component fields for a newly bootstrapped mint.
   * Only updates fields not already set — idempotent.
   * Used by MintEventListenerService when identity service is disabled.
   */
  async mergeComponentsForMintBootstrap(
    collectionKey: string,
    patch: Record<string, string>,
  ): Promise<void> {
    const k = collectionKey.toLowerCase();
    const col = await this.collectionRepo.findOne({
      where: { collectionKey: k },
    });
    if (!col) return;
    const comp = (col.components ?? {}) as Record<string, unknown>;
    let dirty = false;
    const next: Record<string, unknown> = { ...comp };
    for (const [key, value] of Object.entries(patch)) {
      if (!next[key] && value) {
        next[key] = value;
        dirty = true;
      }
    }
    if (!dirty) return;
    await this.collectionRepo.update(
      { collectionKey: k },
      { components: next as QueryDeepPartialEntity<Record<string, unknown>> },
    );
  }

}
