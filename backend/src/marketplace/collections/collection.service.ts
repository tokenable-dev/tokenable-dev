import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { QueryDeepPartialEntity, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { IpfsGatewayResolverService } from '../../blockchain/ipfs-gateway-resolver.service';
import {
  BUCKET_KEY_VERSION,
  computeMarketBucketKey,
  extractOrDiagnoseBucketComponents,
  metaShapeSampleForBucketLog,
} from '../utils/bucket-key.util';
import { marketParallelKeyFromPsaVariety } from '../utils/market-parallel-key.util';
import { mergePsaVarietyWithMintVariant } from '../../psa/psa-variety-catalog.util';
import { specIdStringFromPsaCertBody } from '../../psa/psa-public-api.service';
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
import { MarketplaceCollection } from '../entities/marketplace-collection.entity';
import { RwaToken } from '../entities/rwa-token.entity';
import { PsaCertSnapshotService } from './psa-cert-snapshot.service';
import { RwaTokenRegistryService } from './rwa-token-registry.service';
import { CollectionMerkleSetService } from './collection-merkle-set.service';
import { CollectionBootService } from './collection-boot.service';
import { CollectionComponentsService } from './collection-components.service';
import { CollectionCoverService } from './collection-cover.service';
import { CollectionIdentityService } from './collection-identity.service';
import {
  cardhedgerFromRwaMetadata,
  extractListingDisplayTitleFromMeta,
} from './collection-listing-meta.helpers';

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
}

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
    private readonly config: ConfigService,
    private readonly ipfsResolver: IpfsGatewayResolverService,
    private readonly psaCertSnapshots: PsaCertSnapshotService,
    private readonly rwaTokenRegistry: RwaTokenRegistryService,
    private readonly eventEmitter: EventEmitter2,
    private readonly merkleSet: CollectionMerkleSetService,
    private readonly cover: CollectionCoverService,
    private readonly components: CollectionComponentsService,
    private readonly identity: CollectionIdentityService,
    @Inject(forwardRef(() => CollectionBootService))
    private readonly boot: CollectionBootService,
  ) {}

  async collectionKeysByTokenIds(
    tokenIds: Array<string | number>,
  ): Promise<Record<number, string>> {
    return this.rwaTokenRegistry.collectionKeysByTokenIds(tokenIds);
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
   *
   * Cover: Cardhedger/Pokémon TCG resolve is fire-and-forget in background.
   * PSA cert snapshot upstream refresh is async — listing POST must stay within API timeout.
   */
  async ensureCollectionForListing(tokenId: string): Promise<string | null> {
    const uri = await this.blockchain.getRwaTokenURI(Number(tokenId));
    const meta = await this.ipfsResolver.fetchMetadataJson(uri);
    const extracted = extractOrDiagnoseBucketComponents(meta);
    if (!extracted.ok) {
      this.logger.warn(
        JSON.stringify({
          msg: 'collection_key_pipeline',
          step: 'ensureCollectionForListing',
          outcome: 'extract_bucket_failed',
          tokenId: String(tokenId),
          tokenUriSample:
            typeof uri === 'string'
              ? uri.slice(0, 120)
              : String(uri).slice(0, 120),
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
          step: 'ensureCollectionForListing',
          outcome: 'bucket_key_computed',
          tokenId: String(tokenId),
          collectionKey,
          gradedSource: extracted.gradedSource,
          keyFormatNote:
            'sha256 hex is lowercase in Node crypto; DB stores this string.',
        }),
      );
    }
    const ch = cardhedgerFromRwaMetadata(meta);
    const coverImageUrl = await this.cover.resolveCoverUrlFromMeta(meta);

    const compRecord: Record<string, unknown> = {
      ...(components as unknown as Record<string, unknown>),
    };
    const listingTitle = extractListingDisplayTitleFromMeta(meta);
    if (listingTitle) {
      compRecord.listingDisplayTitle = listingTitle;
    }
    // When identity service is enabled, cardhedgerCardId is NOT written during INSERT.
    // CollectionIdentityService.seedFromMintMetadataOnInsert() handles it post-insert
    // so the identity service remains the sole write authority.
    // When the flag is off, the legacy path writes it directly here (unchanged behavior).
    if (ch.cardId && !this.identity.isEnabled()) {
      compRecord.cardhedgerCardId = ch.cardId;
      if (ch.searchQuery) compRecord.cardhedgerSearchQuery = ch.searchQuery;
    }
    if (ch.psaSpecId) {
      compRecord.psaSpecId = ch.psaSpecId;
    }

    const psaCert = psaCertNumberFromGradedMeta(meta);
    if (psaCert && !compRecord.psaSpecId) {
      try {
        const snap = await this.psaCertSnapshots.fetchCertSnapshotJson(psaCert, {
          allowUpstream: true,
        });
        const specFromCert = snap
          ? specIdStringFromPsaCertBody({ PSACert: snap })
          : null;
        if (specFromCert) {
          compRecord.psaSpecId = specFromCert;
        }
      } catch (e: unknown) {
        this.logger.debug(
          `ensureCollectionForListing #${tokenId}: cert→specId cache lookup failed: ${String(e)}`,
        );
      }
    }

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
      })
      .orIgnore()
      .execute();

    const inserted = (insertResult.identifiers?.length ?? 0) > 0;
    if (!inserted) {
      await this.components.mergePsaPopulationFromMetaIfMissing(
        collectionKey,
        meta,
      );
      // Already delegates to CollectionIdentityService.writeFromMintMetadata when flag is on.
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
    } else {
      // New collection row created. Seed identity state non-blocking.
      // Snapshot correctness does NOT depend on seed completion — the snapshot
      // pipeline uses whatever cardhedgerCardId is in DB at execution time, and
      // falls back to search when null (CardhedgerResolveService handles both paths).
      // When flag is off this is a no-op.
      void this.identity.seedFromMintMetadataOnInsert(collectionKey, meta);
    }

    void this.rwaTokenRegistry.upsertFromMetadata(tokenId, meta, {
      tokenUri: uri,
      collectionKey,
    });
    if (psaCert) {
      this.psaCertSnapshots.scheduleRefreshIfNeeded(psaCert);
    }

    this.enqueueMarketSnapshotRefresh(collectionKey);

    return collectionKey;
  }

  async resolveCollectionKeyFromTokenMetadata(
    tokenId: string,
  ): Promise<string | null> {
    const uri = await this.blockchain.getRwaTokenURI(Number(tokenId));
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

  async listSummariesPaged(input: {
    limit?: number;
    cursor?: string | null;
  }): Promise<{
    items: CollectionSummary[];
    nextCursor: string | null;
  }> {
    const limit = Math.min(Math.max(input.limit ?? 30, 1), 60);
    const qb = this.collectionRepo.createQueryBuilder('c');

    const cur = input.cursor?.trim();
    if (cur) {
      try {
        const { ca, ck } = this.decodeCollectionCursor(cur);
        qb.where(
          '(c.created_at < :ca OR (c.created_at = :ca AND c.collection_key > :ck))',
          { ca, ck },
        );
      } catch {
        /* invalid cursor — ignore */
      }
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
    const countRows = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.collection_key', 'key')
      .addSelect('COUNT(o.id)::int', 'cnt')
      .where('o.collection_key IS NOT NULL')
      .andWhere('o.collection_key IN (:...keys)', { keys })
      .andWhere('o.status = :st', { st: OrderStatus.ACTIVE })
      .andWhere('o.side = :side', { side: OrderSide.ASK })
      .groupBy('o.collection_key')
      .getRawMany<{ key: string; cnt: number }>();

    const countMap = new Map<string, number>();
    for (const r of countRows) {
      countMap.set(String(r.key).toLowerCase(), Number(r.cnt));
    }

    const items: CollectionSummary[] = page.map((c) => {
      const components = enrichCollectionComponentsForApi(
        c.components,
        c.psaCertNumber,
      );
      const coverImageUrl = c.coverImageUrl ?? null;
      return {
        collectionKey: c.collectionKey,
        displayLabel: c.displayLabel,
        queryUsed: c.queryUsed,
        components,
        createdAt: c.createdAt,
        activeListingCount: countMap.get(c.collectionKey.toLowerCase()) ?? 0,
        coverImageUrl,
        displayImageUrl: pickCollectionDisplayImageUrl(coverImageUrl),
      };
    });

    return { items, nextCursor };
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
  ): Promise<boolean> {
    return this.components.ensureMintParallelVarietyFromListings(collectionKey);
  }

  async ensurePsaTotalPopulationFromListings(
    collectionKey: string,
  ): Promise<void> {
    return this.components.ensurePsaTotalPopulationFromListings(collectionKey);
  }

  async ensurePsaSpecPopulationFromApi(
    collectionKey: string,
  ): Promise<void> {
    return this.components.ensurePsaSpecPopulationFromApi(collectionKey);
  }

  async ensureCardhedgerCardIdFromListings(
    collectionKey: string,
  ): Promise<boolean> {
    return this.components.ensureCardhedgerCardIdFromListings(collectionKey);
  }

  async ensurePsaCertNumberFromListings(collectionKey: string): Promise<void> {
    return this.components.ensurePsaCertNumberFromListings(collectionKey);
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
  ): Promise<void> {
    return this.components.ensureListingDisplayTitleFromListings(collectionKey);
  }

  async activeListingsForCollection(collectionKey: string): Promise<Order[]> {
    return this.orderRepo.find({
      where: {
        collectionKey: collectionKey.toLowerCase(),
        status: OrderStatus.ACTIVE,
        side: OrderSide.ASK,
      },
      order: { createdAt: 'ASC' },
      take: this.collectionActiveOrdersCap(),
    });
  }

  async activeBidsForCollection(collectionKey: string): Promise<Order[]> {
    return this.orderRepo.find({
      where: {
        collectionKey: collectionKey.toLowerCase(),
        status: OrderStatus.ACTIVE,
        side: OrderSide.BID,
      },
      order: { createdAt: 'DESC' },
      take: this.collectionActiveOrdersCap(),
    });
  }

  async setCollectionCoverImageAdmin(
    collectionKey: string,
    coverImageUrl: string,
  ): Promise<MarketplaceCollection> {
    return this.cover.setCollectionCoverImageAdmin(collectionKey, coverImageUrl);
  }

  async adminPreviewCoverFromToken(
    tokenId: string,
    collectionKey?: string,
  ): Promise<string | null> {
    return this.cover.adminPreviewCoverFromToken(tokenId, collectionKey);
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

  /**
   * Resolves token metadata from chain (via BlockchainService) for cover retry.
   * Returns null on any failure so callers can gracefully skip.
   */
  async resolveAssetForCoverRetry(
    tokenId: number,
  ): Promise<{ meta: Record<string, unknown> } | null> {
    try {
      const uri = await this.blockchain.getRwaTokenURI(tokenId);
      if (!uri?.trim()) return null;
      const meta = await this.ipfsResolver.fetchMetadataJson(uri);
      return { meta };
    } catch {
      return null;
    }
  }
}
