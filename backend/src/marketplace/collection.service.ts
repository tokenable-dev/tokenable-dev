import { Injectable } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlockchainService } from '../blockchain/blockchain.service';
import {
  computeMarketBucketKey,
  extractBucketComponentsFromMetadata,
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
import { buildPoketraceQueryFromRwaMetadata } from '../poketrace/poketrace-mint-query.util';
import { PoketraceService } from '../poketrace/poketrace.service';

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
export class CollectionService {
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
  ) {}

  private async fetchIpfsMetadataJson(tokenUri: string): Promise<Record<string, unknown>> {
    let url = tokenUri.trim();
    if (url.startsWith('ipfs://')) {
      const path = url.replace(/^ipfs:\/\//i, '').replace(/^ipfs\//i, '');
      const gw =
        this.config.get<string>('PINATA_GATEWAY') ??
        'gray-immense-roadrunner-588.mypinata.cloud';
      url = `https://${gw}/ipfs/${path}`;
    }

    const maxAttempts = 6;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const res = await fetch(url);
      if (res.ok) {
        return (await res.json()) as Record<string, unknown>;
      }

      const retriable =
        res.status === 429 ||
        res.status === 408 ||
        res.status === 500 ||
        res.status === 502 ||
        res.status === 503 ||
        res.status === 504;
      if (!retriable || attempt === maxAttempts - 1) {
        throw new Error(`Failed to fetch RWA metadata (${res.status})`);
      }

      let delayMs = 900 * Math.pow(2, attempt) + Math.floor(Math.random() * 350);
      const ra = res.headers.get('retry-after');
      if (ra && /^\d+$/.test(ra.trim())) {
        delayMs = Math.max(delayMs, Math.min(60_000, parseInt(ra.trim(), 10) * 1000));
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
    throw new Error('Failed to fetch RWA metadata');
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
    const meta = await this.fetchIpfsMetadataJson(uri);
    const components = extractBucketComponentsFromMetadata(meta);
    if (!components) return null;

    const queryUsed = extractJustTcgQueryUsed(meta);
    const displayLabel = buildCollectionDisplayLabel(components, queryUsed);
    const collectionKey = computeMarketBucketKey(components);
    const coverImageUrl = extractCollectionRepresentativeImage(meta) ?? null;

    const row = this.collectionRepo.create({
      collectionKey,
      displayLabel,
      queryUsed,
      components: components as unknown as Record<string, unknown>,
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
        const meta = await this.fetchIpfsMetadataJson(uri);
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
   * DB `components.poketraceCardId`가 비어 있을 때, 활성 ask IPFS 메타의
   * `properties.graded.poketrace.cardId`를 저장. PokeTrace 검색 대신 GET /cards/:id로 고정 매칭.
   */
  async ensurePoketraceCardIdFromListings(collectionKey: string): Promise<void> {
    const k = collectionKey.toLowerCase();
    const row = await this.collectionRepo.findOne({ where: { collectionKey: k } });
    if (!row) return;
    const comp = row.components as Record<string, unknown>;
    const existing = comp.poketraceCardId;
    if (typeof existing === 'string' && existing.trim().length > 0) {
      return;
    }

    const asks = await this.activeListingsForCollection(k);
    for (const o of asks) {
      if (!o.tokenId || String(o.tokenId).trim() === '') continue;
      try {
        const uri = await this.blockchain.getRwaTokenURI(Number(o.tokenId));
        const meta = await this.fetchIpfsMetadataJson(uri);
        const pid = buildPoketraceQueryFromRwaMetadata(meta).poketraceCardId;
        if (pid && pid.trim()) {
          await this.collectionRepo.update(
            { collectionKey: k },
            { components: { ...comp, poketraceCardId: pid.trim() } },
          );
          this.poketrace.invalidateCollectionPoketraceCaches(k);
          return;
        }
      } catch {
        /* try next listing */
      }
    }
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
      if (!o.tokenId || String(o.tokenId).trim() === '' || o.tokenId === '0') continue;
      try {
        const uri = await this.blockchain.getRwaTokenURI(Number(o.tokenId));
        const meta = await this.fetchIpfsMetadataJson(uri);
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
        const meta = await this.fetchIpfsMetadataJson(uri);
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
        const meta = await this.fetchIpfsMetadataJson(uri);
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
