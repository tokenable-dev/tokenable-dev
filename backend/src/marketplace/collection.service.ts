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
import { extractCollectionRepresentativeImage } from './collection-image.util';
import { MarketplaceCollection } from './entities/marketplace-collection.entity';
import { Order, OrderSide, OrderStatus } from './entities/order.entity';

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
  constructor(
    @InjectRepository(MarketplaceCollection)
    private readonly collectionRepo: Repository<MarketplaceCollection>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly blockchain: BlockchainService,
    private readonly config: ConfigService,
  ) {}

  private async fetchIpfsMetadataJson(tokenUri: string): Promise<Record<string, unknown>> {
    let url = tokenUri.trim();
    if (url.startsWith('ipfs://')) {
      const path = url.replace(/^ipfs:\/\//i, '').replace(/^ipfs\//i, '');
      const gw =
        this.config.get<string>('PINATA_GATEWAY') ??
        'chocolate-voluntary-raccoon-677.mypinata.cloud';
      url = `https://${gw}/ipfs/${path}`;
    }
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch NFT metadata (${res.status})`);
    }
    return (await res.json()) as Record<string, unknown>;
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
    const uri = await this.blockchain.getNftTokenURI(Number(tokenId));
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
      } else {
        throw e;
      }
    }

    return collectionKey;
  }

  async listSummaries(): Promise<CollectionSummary[]> {
    const collections = await this.collectionRepo.find({
      order: { createdAt: 'DESC' },
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

  async activeListingsForCollection(collectionKey: string): Promise<Order[]> {
    return this.orderRepo.find({
      where: {
        collectionKey: collectionKey.toLowerCase(),
        status: OrderStatus.ACTIVE,
        side: OrderSide.ASK,
      },
      order: { createdAt: 'DESC' },
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
   * 대표 이미지: DB 저장값 → 없으면 활성 주문 토큰의 IPFS 메타에서만 추출·백필 (JustTCG HTTP API 없음).
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
    const tokenIds = [
      ...asks.map((o) => o.tokenId),
      ...bids.map((o) => o.tokenId),
    ];
    for (const tokenId of tokenIds) {
      try {
        const uri = await this.blockchain.getNftTokenURI(Number(tokenId));
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
}
