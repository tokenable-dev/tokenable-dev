import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { IsNull, QueryDeepPartialEntity, QueryFailedError, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { BlockchainService } from '../blockchain/blockchain.service';
import { IpfsGatewayResolverService } from '../blockchain/ipfs-gateway-resolver.service';
import {
  computeMarketBucketKey,
  extractBucketComponentsFromMetadata,
  extractOrDiagnoseBucketComponents,
  metaShapeSampleForBucketLog,
} from './bucket-key.util';
import {
  buildCollectionDisplayLabel,
  extractJustTcgQueryUsed,
} from './collection-label.util';
import {
  extractCollectionRepresentativeImage,
  extractJustTcgProductIdentifiersFromMetadata,
  type JustTcgProductIdentifiers,
} from './collection-image.util';
import { MarketplaceCollection } from './entities/marketplace-collection.entity';
import { Order, OrderSide, OrderStatus } from './entities/order.entity';
import {
  buildPoketraceQueryFromRwaMetadata,
  exactPoketraceCatalogMatch,
} from '../poketrace/poketrace-mint-query.util';
import {
  extractPoketraceCardDataRow,
  PoketraceService,
} from '../poketrace/poketrace.service';

export interface CollectionSummary {
  collectionKey: string;
  displayLabel: string;
  queryUsed: string | null;
  components: Record<string, unknown>;
  createdAt: Date;
  activeListingCount: number;
  /** IPFS 메타의 JustTCG topMatch 등에서만 채움; 외부 가격 API 호출 없음 */
  coverImageUrl: string | null;
}

@Injectable()
export class CollectionService implements OnModuleInit {
  private readonly logger = new Logger(CollectionService.name);

  /**
   * Merkle leaf scans are expensive (IPFS × minted count). Cache by collection + totalMinted so
   * new mints naturally miss; listings of existing tokens stay valid without cache bust.
   */
  private readonly merkleSetCache = new Map<
    string,
    { tokenIds: string[]; expiresAtMs: number }
  >();
  private static readonly MERKLE_SET_CACHE_TTL_MS = 45_000;
  /** Lower parallelism reduces Pinata/IPFS flakes that change the Merkle leaf set between requests. */
  private static readonly MERKLE_SCAN_CONCURRENCY = 4;
  private static readonly MERKLE_TOKEN_LOOKUP_ATTEMPTS = 3;

  constructor(
    @InjectRepository(MarketplaceCollection)
    private readonly collectionRepo: Repository<MarketplaceCollection>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly blockchain: BlockchainService,
    private readonly config: ConfigService,
    private readonly poketrace: PoketraceService,
    private readonly ipfsResolver: IpfsGatewayResolverService,
  ) {}

  async onModuleInit(): Promise<void> {
    const v = this.config.get<string>('MARKETPLACE_PIPELINE_DIAG');
    if (v === '1' || v === 'true') {
      try {
        await this.logNullCollectionKeyActiveAskSummary();
      } catch (e) {
        this.logger.error(`MARKETPLACE_PIPELINE_DIAG boot audit failed: ${String(e)}`);
      }
    }

    const ptAudit = this.config.get<string>('POKETRACE_COLLECTION_AUDIT_ON_BOOT');
    if (ptAudit === '1' || ptAudit === 'true') {
      try {
        await this.auditStalePoketraceCardIdsOnBoot();
      } catch (e) {
        this.logger.error(`POKETRACE_COLLECTION_AUDIT_ON_BOOT failed: ${String(e)}`);
      }
    }
  }

  /**
   * `MARKETPLACE_PIPELINE_DIAG=1` on boot: counts active asks with `collection_key` NULL (root cause for UI↔DB key skew).
   */
  private async logNullCollectionKeyActiveAskSummary(): Promise<void> {
    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.token_id', 'tokenId')
      .addSelect('COUNT(*)::int', 'cnt')
      .where('o.collection_key IS NULL')
      .andWhere("o.side = 'ask'")
      .andWhere("o.status = 'active'")
      .groupBy('o.token_id')
      .orderBy('cnt', 'DESC')
      .limit(50)
      .getRawMany<{ tokenId: string; cnt: number }>();

    const totalNullKeyActiveAsks = await this.orderRepo.count({
      where: { side: OrderSide.ASK, status: OrderStatus.ACTIVE, collectionKey: IsNull() },
    });
    const totalActiveAsks = await this.orderRepo.count({
      where: { side: OrderSide.ASK, status: OrderStatus.ACTIVE },
    });

    this.logger.warn(
      JSON.stringify({
        msg: 'collection_key_pipeline',
        step: 'db_audit_on_boot',
        totalActiveAsks,
        totalActiveAskRowsWithNullCollectionKey: totalNullKeyActiveAsks,
        topTokenIdsGroupedByNullKeyActiveAskCount: rows.map((r) => ({
          tokenId: r.tokenId,
          cnt: Number(r.cnt),
        })),
        note: 'Compare with UI meta-hash: if orders are null-key but UI computes a 64-char key, GET …/stats will return an empty pool for that key.',
      }),
    );
  }

  /**
   * 기존 컬렉션 행에 `psaTotalPopulation`이 없을 때만 메타에서 채움 (첫 민트는 ensure 시 포함됨).
   */
  private async mergePsaPopulationFromMetaIfMissing(
    collectionKey: string,
    meta: Record<string, unknown>,
  ): Promise<void> {
    const fresh = extractBucketComponentsFromMetadata(meta);
    if (fresh?.psaTotalPopulation == null) return;
    const key = collectionKey.toLowerCase();
    const row = await this.collectionRepo.findOne({ where: { collectionKey: key } });
    if (!row) return;
    const comp = row.components as Record<string, unknown>;
    if (comp.psaTotalPopulation != null) return;
    await this.collectionRepo.update(
      { collectionKey: key },
      {
        components: { ...comp, psaTotalPopulation: fresh.psaTotalPopulation },
      },
    );
  }

  /** IPFS 메타에서만 커버 URL 추출 후 DB에 없을 때만 저장 */
  private async persistCoverFromMetaIfMissing(
    collectionKey: string,
    meta: Record<string, unknown>,
  ): Promise<void> {
    const img = extractCollectionRepresentativeImage(meta);
    if (!img) return;
    const key = collectionKey.toLowerCase();
    const row = await this.collectionRepo.findOne({ where: { collectionKey: key } });
    if (!row || row.coverImageUrl) return;
    await this.collectionRepo.update({ collectionKey: key }, { coverImageUrl: img });
  }

  /**
   * 매도(ask) 등록 시: 메타에서 버킷·JustTCG 문구를 읽어 컬렉션 행을 만들고 key 반환.
   * graded 없으면 null (주문은 그대로 저장, 컬렉션 미부여).
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
          tokenUriSample: typeof uri === 'string' ? uri.slice(0, 120) : String(uri).slice(0, 120),
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

    const queryUsed = extractJustTcgQueryUsed(meta);
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
          keyFormatNote: 'sha256 hex is lowercase in Node crypto; DB stores this string.',
        }),
      );
    }
    const coverImageUrl = extractCollectionRepresentativeImage(meta) ?? null;

    const pq = buildPoketraceQueryFromRwaMetadata(meta);
    const compRecord: Record<string, unknown> = {
      ...(components as unknown as Record<string, unknown>),
    };
    if (pq.poketraceCardId?.trim()) {
      compRecord.poketraceCardId = pq.poketraceCardId.trim();
    } else if (pq.approximatePoketraceCardId?.trim()) {
      compRecord.approximatePoketraceCardId = pq.approximatePoketraceCardId.trim();
    }

    const row = this.collectionRepo.create({
      collectionKey,
      displayLabel,
      queryUsed,
      components: compRecord,
      coverImageUrl,
    });
    try {
      await this.collectionRepo.save(row);
    } catch (e) {
      const code =
        e instanceof QueryFailedError
          ? (e as unknown as { driverError?: { code?: string } }).driverError?.code
          : undefined;
      if (code === '23505') {
        await this.persistCoverFromMetaIfMissing(collectionKey, meta);
        await this.mergePsaPopulationFromMetaIfMissing(collectionKey, meta);
        await this.mergePoketraceCardIdFromMetaIfMissing(collectionKey, meta);
      } else {
        throw e;
      }
    }

    return collectionKey;
  }

  async listSummaries(): Promise<CollectionSummary[]> {
    const collections = await this.collectionRepo.find({
      order: { createdAt: 'ASC' },
    });

    const countRows = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.collection_key', 'key')
      .addSelect('COUNT(o.id)::int', 'cnt')
      .where('o.collection_key IS NOT NULL')
      .andWhere('o.status = :st', { st: OrderStatus.ACTIVE })
      .andWhere('o.side = :side', { side: OrderSide.ASK })
      .groupBy('o.collection_key')
      .getRawMany<{ key: string; cnt: number }>();

    const countMap = new Map<string, number>();
    for (const r of countRows) {
      countMap.set(r.key.toLowerCase(), Number(r.cnt));
    }

    return collections.map((c) => ({
      collectionKey: c.collectionKey,
      displayLabel: c.displayLabel,
      queryUsed: c.queryUsed,
      components: c.components,
      createdAt: c.createdAt,
      activeListingCount: countMap.get(c.collectionKey.toLowerCase()) ?? 0,
      coverImageUrl: c.coverImageUrl ?? null,
    }));
  }

  private encodeCollectionCursor(row: { createdAt: Date; collectionKey: string }): string {
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
   * Cursor-paginated collection summaries (stable sort: createdAt DESC, collectionKey ASC).
   * Newest buckets first so a fresh listing appears on page 1 without “load more” to the end.
   */
  async listSummariesPaged(input: {
    limit?: number;
    cursor?: string | null;
  }): Promise<{
    items: CollectionSummary[];
    nextCursor: string | null;
  }> {
    const limit = Math.min(Math.max(input.limit ?? 24, 1), 60);
    const qb = this.collectionRepo.createQueryBuilder('c');

    const cur = input.cursor?.trim();
    if (cur) {
      try {
        const { ca, ck } = this.decodeCollectionCursor(cur);
        /** Keyset page after (ca, ck) for ORDER BY created_at DESC, collection_key ASC */
        qb.where(
          '(c.created_at < :ca OR (c.created_at = :ca AND c.collection_key > :ck))',
          { ca, ck },
        );
      } catch {
        /* invalid cursor — ignore */
      }
    }

    qb.orderBy('c.created_at', 'DESC').addOrderBy('c.collection_key', 'ASC').take(limit + 1);

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

    const items: CollectionSummary[] = page.map((c) => ({
      collectionKey: c.collectionKey,
      displayLabel: c.displayLabel,
      queryUsed: c.queryUsed,
      components: c.components,
      createdAt: c.createdAt,
      activeListingCount: countMap.get(c.collectionKey.toLowerCase()) ?? 0,
      coverImageUrl: c.coverImageUrl ?? null,
    }));

    return { items, nextCursor };
  }

  async findOne(key: string): Promise<MarketplaceCollection | null> {
    return this.collectionRepo.findOne({
      where: { collectionKey: key.toLowerCase() },
    });
  }

  /**
   * DB `components.psaTotalPopulation`이 비어 있을 때, 활성 ask의 IPFS 메타에서 PSA 인구를 읽어 저장.
   * (구버전 컬렉션 행 보강 — 시가총액 등 프론트 계산용)
   */
  async ensurePsaTotalPopulationFromListings(collectionKey: string): Promise<void> {
    const k = collectionKey.toLowerCase();
    const row = await this.collectionRepo.findOne({ where: { collectionKey: k } });
    if (!row) return;
    const comp = row.components as Record<string, unknown>;
    if (typeof comp.psaTotalPopulation === 'number' && comp.psaTotalPopulation > 0) {
      return;
    }

    const asks = await this.activeListingsForCollection(k);
    for (const o of asks) {
      if (!o.tokenId || String(o.tokenId).trim() === '') continue;
      try {
        const uri = await this.blockchain.getRwaTokenURI(Number(o.tokenId));
        const meta = await this.ipfsResolver.fetchMetadataJson(uri);
        const extracted = extractBucketComponentsFromMetadata(meta);
        let pop: number | undefined = extracted?.psaTotalPopulation;
        if (pop == null || !Number.isFinite(pop) || pop <= 0) {
          const graded = (meta.properties as Record<string, unknown> | undefined)?.graded ?? meta.graded;
          const psa =
            graded && typeof graded === 'object'
              ? (graded as Record<string, unknown>).psa
              : undefined;
          const raw =
            psa && typeof psa === 'object'
              ? (psa as Record<string, unknown>).totalPopulation
              : undefined;
          if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
            pop = Math.floor(raw);
          }
        }
        if (pop != null && Number.isFinite(pop) && pop > 0) {
          await this.collectionRepo.update(
            { collectionKey: k },
            { components: { ...comp, psaTotalPopulation: Math.floor(pop) } },
          );
          return;
        }
      } catch {
        /* try next listing */
      }
    }
  }

  /**
   * `components.poketraceCardId` 보강: 활성 ask 메타에서 읽되, **서로 다른 id가 섞이면 저장하지 않음**
   * (PokeTrace 가격은 카탈로그 id만 허용 — 잘못된 단일 id 고정 방지).
   */
  async ensurePoketraceCardIdFromListings(collectionKey: string): Promise<void> {
    const k = collectionKey.toLowerCase();
    const row = await this.collectionRepo.findOne({ where: { collectionKey: k } });
    if (!row) return;
    const comp = row.components as Record<string, unknown>;
    const existing =
      typeof comp.poketraceCardId === 'string' ? comp.poketraceCardId.trim() : '';

    const asks = await this.activeListingsForCollection(k);
    const ids = new Set<string>();
    const approxIds = new Set<string>();
    for (const o of asks) {
      if (!o.tokenId || String(o.tokenId).trim() === '') continue;
      try {
        const uri = await this.blockchain.getRwaTokenURI(Number(o.tokenId));
        const meta = await this.ipfsResolver.fetchMetadataJson(uri);
        const pq = buildPoketraceQueryFromRwaMetadata(meta);
        const pid = pq.poketraceCardId?.trim();
        if (pid) ids.add(pid);
        const aid = pq.approximatePoketraceCardId?.trim();
        if (aid) approxIds.add(aid);
      } catch {
        /* skip */
      }
    }

    const nextComp: Record<string, unknown> = { ...comp };
    let dirty = false;

    if (ids.size > 1) {
      this.logger.warn(
        `Collection ${k}: conflicting poketraceCardId across active listings (${[...ids].join(', ')}); not updating`,
      );
    } else if (ids.size === 1) {
      const only = [...ids][0];
      if (existing !== only) {
        nextComp.poketraceCardId = only;
        delete nextComp.approximatePoketraceCardId;
        dirty = true;
      }
    }

    const existingApprox =
      typeof comp.approximatePoketraceCardId === 'string'
        ? comp.approximatePoketraceCardId.trim()
        : '';
    const hasVerified =
      typeof nextComp.poketraceCardId === 'string' &&
      String(nextComp.poketraceCardId).trim() !== '';
    if (!hasVerified) {
      if (approxIds.size > 1) {
        this.logger.warn(
          `Collection ${k}: conflicting approximatePoketraceCardId across active listings (${[...approxIds].join(', ')}); not updating approximate`,
        );
      } else if (approxIds.size === 1) {
        const onlyA = [...approxIds][0];
        if (existingApprox !== onlyA) {
          nextComp.approximatePoketraceCardId = onlyA;
          dirty = true;
        }
      }
    }

    if (!dirty) return;

    await this.collectionRepo.update(
      { collectionKey: k },
      {
        components: nextComp as QueryDeepPartialEntity<Record<string, unknown>>,
      },
    );
    this.poketrace.invalidateCollectionPoketraceCaches(k);
  }

  /**
   * `components.poketraceCardId` + GET /cards/:id vs bucket `cardName` / `cardSet` / `cardNumber`
   * — **exact normalized triple** only. Mismatch → optional DB strip + cache bust.
   */
  async auditPoketraceCardIdExact(
    collectionKey: string,
    options?: { clearOnMismatch?: boolean },
  ): Promise<{
    checked: boolean;
    ok: boolean;
    cleared: boolean;
    failCodes: string[];
  }> {
    const k = collectionKey.toLowerCase();
    const dbRow = await this.collectionRepo.findOne({ where: { collectionKey: k } });
    if (!dbRow) {
      return {
        checked: false,
        ok: false,
        cleared: false,
        failCodes: ['collection_not_found'],
      };
    }
    const comp = dbRow.components as Record<string, unknown>;
    const pid =
      typeof comp.poketraceCardId === 'string' ? comp.poketraceCardId.trim() : '';
    if (!pid) {
      return { checked: false, ok: true, cleared: false, failCodes: [] };
    }

    const wantName = String(comp.cardName ?? '').trim();
    const wantSet = String(comp.cardSet ?? '').trim();
    const wantNum = String(comp.cardNumber ?? '').trim();
    if (!wantName || !wantSet || !wantNum) {
      this.logger.warn(
        JSON.stringify({
          msg: 'poketrace_collection_audit_skipped',
          collectionKey: k,
          reason: 'incomplete_components_cannot_verify_exact',
        }),
      );
      return {
        checked: true,
        ok: false,
        cleared: false,
        failCodes: ['incomplete_components'],
      };
    }

    let raw: unknown;
    try {
      raw = await this.poketrace.getCardById(pid);
    } catch (e) {
      this.logger.warn(
        JSON.stringify({
          msg: 'poketrace_collection_audit_fetch_failed',
          collectionKey: k,
          poketraceCardId: pid,
          error: e instanceof Error ? e.message : String(e),
        }),
      );
      return {
        checked: true,
        ok: false,
        cleared: false,
        failCodes: ['upstream_fetch_failed'],
      };
    }

    const ptRow = extractPoketraceCardDataRow(raw);
    if (!ptRow) {
      return {
        checked: true,
        ok: false,
        cleared: false,
        failCodes: ['empty_card_payload'],
      };
    }

    const ex = exactPoketraceCatalogMatch(
      { cardName: wantName, cardSet: wantSet, cardNumber: wantNum },
      ptRow,
    );
    if (ex.ok) {
      return { checked: true, ok: true, cleared: false, failCodes: [] };
    }

    this.logger.warn(
      JSON.stringify({
        msg: 'poketrace_collection_id_mismatch',
        collectionKey: k,
        poketraceCardId: pid,
        failCodes: ex.failCodes,
        normalized: ex.normalized,
      }),
    );

    if (options?.clearOnMismatch) {
      const nextComponents: Record<string, unknown> = { ...comp };
      delete nextComponents.poketraceCardId;
      await this.collectionRepo.update(
        { collectionKey: k },
        {
          components: nextComponents as QueryDeepPartialEntity<
            Record<string, unknown>
          >,
        },
      );
      this.poketrace.invalidateCollectionPoketraceCaches(k);
      return { checked: true, ok: false, cleared: true, failCodes: ex.failCodes };
    }

    return { checked: true, ok: false, cleared: false, failCodes: ex.failCodes };
  }

  /** `POKETRACE_COLLECTION_AUDIT_ON_BOOT=1`: clear stale catalog ids that fail the exact triple. */
  private async auditStalePoketraceCardIdsOnBoot(): Promise<void> {
    const rows = await this.collectionRepo.find({ select: ['collectionKey', 'components'] });
    let cleared = 0;
    let mismatchNotCleared = 0;
    let incomplete = 0;
    for (const c of rows) {
      const comp = c.components as Record<string, unknown>;
      if (typeof comp.poketraceCardId !== 'string' || !comp.poketraceCardId.trim()) {
        continue;
      }
      const r = await this.auditPoketraceCardIdExact(c.collectionKey, {
        clearOnMismatch: true,
      });
      if (!r.checked) continue;
      if (r.ok) continue;
      if (r.failCodes.includes('incomplete_components')) {
        incomplete++;
        continue;
      }
      if (r.cleared) cleared++;
      else mismatchNotCleared++;
    }
    this.logger.warn(
      JSON.stringify({
        msg: 'poketrace_collection_boot_audit_summary',
        collectionsTableRows: rows.length,
        stalePoketraceIdsCleared: cleared,
        mismatchesNotCleared: mismatchNotCleared,
        incompleteComponents: incomplete,
      }),
    );
  }

  /** 중복 컬렉션 키 충돌 시 메타에만 있고 DB에 없는 poketrace / approximate id 병합 */
  private async mergePoketraceCardIdFromMetaIfMissing(
    collectionKey: string,
    meta: Record<string, unknown>,
  ): Promise<void> {
    const key = collectionKey.toLowerCase();
    const dbRow = await this.collectionRepo.findOne({ where: { collectionKey: key } });
    if (!dbRow) return;
    const comp = dbRow.components as Record<string, unknown>;
    const pq = buildPoketraceQueryFromRwaMetadata(meta);
    if (typeof comp.poketraceCardId === 'string' && comp.poketraceCardId.trim()) {
      return;
    }
    const pid = pq.poketraceCardId?.trim();
    if (pid) {
      await this.collectionRepo.update(
        { collectionKey: key },
        {
          components: { ...comp, poketraceCardId: pid } as QueryDeepPartialEntity<
            Record<string, unknown>
          >,
        },
      );
      this.poketrace.invalidateCollectionPoketraceCaches(key);
      return;
    }
    if (
      typeof comp.approximatePoketraceCardId === 'string' &&
      comp.approximatePoketraceCardId.trim()
    ) {
      return;
    }
    const apid = pq.approximatePoketraceCardId?.trim();
    if (!apid) return;
    await this.collectionRepo.update(
      { collectionKey: key },
      {
        components: {
          ...comp,
          approximatePoketraceCardId: apid,
        } as QueryDeepPartialEntity<Record<string, unknown>>,
      },
    );
    this.poketrace.invalidateCollectionPoketraceCaches(key);
  }

  async activeListingsForCollection(collectionKey: string): Promise<Order[]> {
    return this.orderRepo.find({
      where: {
        collectionKey: collectionKey.toLowerCase(),
        status: OrderStatus.ACTIVE,
        side: OrderSide.ASK,
      },
      order: { createdAt: 'ASC' },
    });
  }

  /** 같은 컬렉션의 활성 Seaport 매수 입찰 (collection_key는 bid 생성 시 부여됨) */
  async activeBidsForCollection(collectionKey: string): Promise<Order[]> {
    return this.orderRepo.find({
      where: {
        collectionKey: collectionKey.toLowerCase(),
        status: OrderStatus.ACTIVE,
        side: OrderSide.BID,
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Active listing IPFS metadata → JustTCG identifiers (slug / tcgplayerId / variantId).
   */
  async resolveJustTcgProductIdentifiersForCollection(
    collectionKey: string,
  ): Promise<JustTcgProductIdentifiers> {
    const empty: JustTcgProductIdentifiers = {
      cardId: null,
      tcgplayerId: null,
      variantId: null,
    };
    const k = collectionKey.toLowerCase();
    const asks = await this.activeListingsForCollection(k);
    for (const o of asks) {
      // Active asks only (not criteria bids). ERC-721 token id 0 is valid — do not skip.
      if (!o.tokenId || String(o.tokenId).trim() === '') continue;
      try {
        const uri = await this.blockchain.getRwaTokenURI(Number(o.tokenId));
        const meta = await this.ipfsResolver.fetchMetadataJson(uri);
        const ids = extractJustTcgProductIdentifiersFromMetadata(meta);
        if (ids.cardId || ids.tcgplayerId || ids.variantId) return ids;
      } catch {
        /* next listing */
      }
    }
    return empty;
  }

  /**
   * 활성 매도 주문의 IPFS 메타에서 JustTCG 카드 slug (`topMatch.id` / `cardId`).
   */
  async resolveJustTcgCardIdForCollection(collectionKey: string): Promise<string | null> {
    const ids = await this.resolveJustTcgProductIdentifiersForCollection(collectionKey);
    return ids.cardId;
  }

  /**
   * Representative image: DB value; else first active listing IPFS metadata (no JustTCG HTTP).
   */
  async resolveRepresentativeImageForCollection(
    collectionKey: string,
  ): Promise<string | null> {
    const k = collectionKey.toLowerCase();
    const col = await this.findOne(k);
    if (col?.coverImageUrl) {
      return col.coverImageUrl;
    }

    const asks = await this.activeListingsForCollection(k);
    const bids = await this.activeBidsForCollection(k);
    /** Asks: include real token #0. Bids: criteria bids store tokenId sentinel "0" — skip for URI fetch. */
    const askIds = asks
      .map((o) => o.tokenId)
      .filter((id) => id != null && String(id).trim() !== '');
    const bidIds = bids
      .map((o) => o.tokenId)
      .filter((id) => id && id !== '0');
    const tokenIds = [...new Set([...askIds, ...bidIds])];
    for (const tokenId of tokenIds) {
      try {
        const uri = await this.blockchain.getRwaTokenURI(Number(tokenId));
        const meta = await this.ipfsResolver.fetchMetadataJson(uri);
        const img = extractCollectionRepresentativeImage(meta);
        if (img) {
          await this.collectionRepo.update({ collectionKey: k }, { coverImageUrl: img });
          return img;
        }
      } catch {
        /* next */
      }
    }

    return null;
  }

  /**
   * Merkle leaves: every minted RWA whose metadata maps to this collection bucket (not only active asks).
   * Criteria bids stay valid when a new token from the same pool lists — the leaf was already in the tree.
   */
  async merkleEligibleTokenIds(
    collectionKey: string,
    options?: { bypassCache?: boolean },
  ): Promise<{ tokenIds: string[] }> {
    const k = collectionKey.toLowerCase();
    const { totalMinted } = await this.blockchain.getRwaInfo();
    const cacheKey = `${k}:${totalMinted}`;
    const now = Date.now();
    if (!options?.bypassCache) {
      const hit = this.merkleSetCache.get(cacheKey);
      if (hit && hit.expiresAtMs > now) {
        return { tokenIds: hit.tokenIds };
      }
    }

    const tokenIds = await this.scanMintedTokenIdsForCollectionKey(k, totalMinted);
    this.merkleSetCache.set(cacheKey, {
      tokenIds,
      expiresAtMs: now + CollectionService.MERKLE_SET_CACHE_TTL_MS,
    });
    return { tokenIds };
  }

  private async scanMintedTokenIdsForCollectionKey(
    targetKeyLower: string,
    totalMinted: number,
  ): Promise<string[]> {
    if (totalMinted <= 0) {
      return [];
    }
    /** `TokenableRWA.totalMinted()` = `_nextTokenId` → minted ids are `0 .. totalMinted - 1` (not `1..totalMinted`). */
    const maxId = totalMinted - 1;
    const ids: string[] = [];
    const concurrency = CollectionService.MERKLE_SCAN_CONCURRENCY;
    for (let start = 0; start <= maxId; start += concurrency) {
      const end = Math.min(start + concurrency - 1, maxId);
      const chunk: number[] = [];
      for (let tid = start; tid <= end; tid++) {
        chunk.push(tid);
      }
      const flags = await Promise.all(
        chunk.map((tid) => this.mintedTokenBelongsToCollection(tid, targetKeyLower)),
      );
      for (let i = 0; i < chunk.length; i++) {
        if (flags[i]) ids.push(String(chunk[i]));
      }
    }
    ids.sort((a, b) => {
      const ba = BigInt(a);
      const bb = BigInt(b);
      if (ba < bb) return -1;
      if (ba > bb) return 1;
      return 0;
    });
    return ids;
  }

  private async mintedTokenBelongsToCollection(
    tokenId: number,
    targetKeyLower: string,
  ): Promise<boolean> {
    const max = CollectionService.MERKLE_TOKEN_LOOKUP_ATTEMPTS;
    for (let attempt = 0; attempt < max; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 100 * attempt));
      }
      try {
        const uri = await this.blockchain.getRwaTokenURI(tokenId);
        const meta = await this.ipfsResolver.fetchMetadataJson(uri);
        const comp = extractBucketComponentsFromMetadata(meta);
        if (!comp) return false;
        const key = computeMarketBucketKey(comp);
        return key.toLowerCase() === targetKeyLower;
      } catch {
        /* transient RPC / IPFS — retry */
      }
    }
    return false;
  }
}
