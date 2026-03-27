import { randomBytes } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { BlockchainService } from '../blockchain/blockchain.service';
import { verifyCollectionBidSignature } from './collection-bid.eip712';
import {
  computeMarketBucketKey,
  extractBucketComponentsFromMetadata,
  type MarketBucketComponents,
} from './bucket-key.util';
import { CreateBucketBidDto } from './dto/create-bucket-bid.dto';
import { BucketBid, BucketBidStatus } from './entities/bucket-bid.entity';

const ZERO_ADDR = '0x0000000000000000000000000000000000000000';
const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

const POOL_SEAPORT_MAX_DURATION_SEC = 30 * 24 * 60 * 60;

function normalizeBodyComponents(
  raw: Record<string, unknown>,
): MarketBucketComponents | null {
  const gradingCompany = String(raw.gradingCompany ?? '').trim().toLowerCase();
  const cardName = String(raw.cardName ?? '').trim().toLowerCase();
  const cardSet = String(raw.cardSet ?? '').trim().toLowerCase();
  const gradeScore = String(raw.gradeScore ?? '').trim();
  if (!gradingCompany || !cardName || !gradeScore) return null;
  return {
    gradingCompany: gradingCompany.replace(/\s+/g, ' '),
    cardName: cardName.replace(/\s+/g, ' '),
    cardSet: cardSet.replace(/\s+/g, ' '),
    gradeScore,
  };
}

@Injectable()
export class BucketBidService {
  private readonly logger = new Logger(BucketBidService.name);

  constructor(
    @InjectRepository(BucketBid)
    private readonly bucketBidRepo: Repository<BucketBid>,
    private readonly config: ConfigService,
    private readonly blockchain: BlockchainService,
  ) {}

  private getNftContract(): string {
    return this.config.getOrThrow<string>('NFT_CONTRACT_ADDRESS').toLowerCase();
  }

  private getUsdcAddress(): string {
    return (this.config.get<string>('USDC_CONTRACT_ADDRESS') ?? '').toLowerCase();
  }

  private getChainId(): number {
    const raw = this.config.get<string>('CHAIN_ID');
    if (raw != null && raw !== '') {
      const n = parseInt(raw, 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return 11155111;
  }

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
      throw new BadRequestException(`Failed to fetch NFT metadata (${res.status})`);
    }
    return (await res.json()) as Record<string, unknown>;
  }

  /** 상세 페이지: 버킷 메타 + 활성 풀 입찰 목록 */
  async listByTokenResolved(tokenId: number): Promise<{
    bucketKey: string;
    components: MarketBucketComponents;
    bids: BucketBid[];
  }> {
    const { bucketKey, components } = await this.resolveBucketFromTokenId(tokenId);
    const bids = await this.findActiveByBucketKey(bucketKey);
    return { bucketKey, components, bids };
  }

  /** tokenURI → components + bucketKey (마켓 상세·입찰 생성에 공통) */
  async resolveBucketFromTokenId(
    tokenId: number,
  ): Promise<{ bucketKey: string; components: MarketBucketComponents }> {
    const uri = await this.blockchain.getNftTokenURI(tokenId);
    const meta = await this.fetchIpfsMetadataJson(uri);
    const components = extractBucketComponentsFromMetadata(meta);
    if (!components) {
      throw new BadRequestException(
        'This NFT has no graded metadata (properties.graded) — pool bids are unavailable.',
      );
    }
    return {
      bucketKey: computeMarketBucketKey(components),
      components,
    };
  }

  async findActiveByBucketKey(bucketKey: string): Promise<BucketBid[]> {
    await this.expireStale();
    return this.bucketBidRepo
      .createQueryBuilder('b')
      .where('b.bucket_key = :k', { k: bucketKey.toLowerCase() })
      .andWhere('b.status = :st', { st: BucketBidStatus.ACTIVE })
      .orderBy('CAST(b.consideration_amount AS DECIMAL)', 'DESC')
      .addOrderBy('b.created_at', 'ASC')
      .getMany();
  }

  async create(dto: CreateBucketBidDto): Promise<BucketBid> {
    const tokenContract = this.getNftContract();
    let components: MarketBucketComponents;
    let bucketKey: string;

    if (dto.tokenId != null && dto.tokenId !== '') {
      const resolved = await this.resolveBucketFromTokenId(Number(dto.tokenId));
      components = resolved.components;
      bucketKey = resolved.bucketKey;
    } else if (dto.bucketKey && dto.components && typeof dto.components === 'object') {
      const norm = normalizeBodyComponents(dto.components as Record<string, unknown>);
      if (!norm) {
        throw new BadRequestException('components must include gradingCompany, cardName, gradeScore');
      }
      bucketKey = computeMarketBucketKey(norm);
      if (bucketKey !== dto.bucketKey.toLowerCase()) {
        throw new BadRequestException('bucketKey does not match components');
      }
      components = norm;
    } else {
      throw new BadRequestException(
        'Provide tokenId (recommended) or both bucketKey and matching components',
      );
    }

    const amount = BigInt(dto.considerationAmount);
    if (amount <= 0n) {
      throw new BadRequestException('considerationAmount must be positive');
    }

    const endMs = Number(dto.endTime) * 1000;
    if (!Number.isFinite(endMs) || endMs <= Date.now()) {
      throw new BadRequestException('endTime must be a future Unix timestamp (seconds)');
    }

    const dupNonce = await this.bucketBidRepo.findOne({
      where: {
        buyerOfferer: dto.buyerOfferer.toLowerCase(),
        nonce: dto.nonce,
      },
    });
    if (dupNonce) {
      throw new ConflictException('This nonce was already used for a pool bid');
    }

    const chainId = this.getChainId();
    let recovered: string;
    try {
      recovered = verifyCollectionBidSignature({
        chainId,
        bucketKey64Hex: bucketKey,
        considerationAmount: dto.considerationAmount,
        endTime: dto.endTime,
        buyer: dto.buyerOfferer,
        nonce: dto.nonce,
        signature: dto.signature,
      });
    } catch (e) {
      throw new BadRequestException(
        `Invalid CollectionBid signature: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    if (recovered.toLowerCase() !== dto.buyerOfferer.toLowerCase()) {
      throw new BadRequestException('CollectionBid signature does not match buyerOfferer');
    }

    const startTime = new Date();
    const endTime = new Date(endMs);

    const row = this.bucketBidRepo.create({
      bucketKey,
      tokenContract,
      buyerOfferer: dto.buyerOfferer.toLowerCase(),
      considerationAmount: dto.considerationAmount,
      components: components as unknown as Record<string, unknown>,
      status: BucketBidStatus.ACTIVE,
      startTime,
      endTime,
      fulfilledTokenId: null,
      signature: dto.signature,
      nonce: dto.nonce,
    });

    return this.bucketBidRepo.save(row);
  }

  /**
   * 구매자가 이 tokenId용 Seaport 입찰을 서명하기 위한 파라미터 초안.
   * counter는 클라이언트가 Seaport.getCounter(buyer)로 채운 뒤 서명한다.
   */
  async prepareSeaportBidForPool(
    bidId: number,
    tokenId: number,
  ): Promise<{
    match: boolean;
    bucketBid: BucketBid;
    tokenId: string;
    chainId: number;
    usdcAddress: string;
    nftContract: string;
    /** counter 제외 — 지갑에서 읽어 병합 */
    parametersDraft: Record<string, unknown>;
    buyerMessage: string;
  }> {
    await this.expireStale();
    const bid = await this.bucketBidRepo.findOne({ where: { id: bidId } });
    if (!bid) throw new NotFoundException(`Bucket bid ${bidId} not found`);
    if (bid.status !== BucketBidStatus.ACTIVE) {
      throw new BadRequestException(`Pool bid is ${bid.status}`);
    }

    const { bucketKey } = await this.resolveBucketFromTokenId(tokenId);
    const match = bucketKey === bid.bucketKey;
    if (!match) {
      return {
        match: false,
        bucketBid: bid,
        tokenId: String(tokenId),
        chainId: this.getChainId(),
        usdcAddress: this.getUsdcAddress(),
        nftContract: this.getNftContract(),
        parametersDraft: {},
        buyerMessage:
          'This NFT is not in the same collection bucket (card / set / grade) as this pool bid.',
      };
    }

    const usdc = this.getUsdcAddress();
    if (!usdc) {
      throw new BadRequestException('USDC_CONTRACT_ADDRESS is not configured');
    }

    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    const poolEndSec = BigInt(Math.floor(bid.endTime.getTime() / 1000));
    const maxEnd = nowSec + BigInt(POOL_SEAPORT_MAX_DURATION_SEC);
    const endSec = poolEndSec < maxEnd ? poolEndSec : maxEnd;
    const salt = BigInt('0x' + randomBytes(16).toString('hex'));

    const str = (v: bigint | string) => String(v);
    const buyer = bid.buyerOfferer;

    const parametersDraft = {
      offerer: buyer,
      zone: ZERO_ADDR,
      zoneHash: ZERO_BYTES32,
      startTime: str(nowSec),
      endTime: str(endSec),
      orderType: 0,
      offer: [
        {
          itemType: 1,
          token: usdc,
          identifierOrCriteria: '0',
          startAmount: bid.considerationAmount,
          endAmount: bid.considerationAmount,
        },
      ],
      consideration: [
        {
          itemType: 2,
          token: this.getNftContract(),
          identifierOrCriteria: String(tokenId),
          startAmount: '1',
          endAmount: '1',
          recipient: buyer,
        },
      ],
      totalOriginalConsiderationItems: 1,
      salt: str(salt),
      conduitKey: ZERO_BYTES32,
    };

    return {
      match: true,
      bucketBid: bid,
      tokenId: String(tokenId),
      chainId: this.getChainId(),
      usdcAddress: usdc,
      nftContract: this.getNftContract(),
      parametersDraft,
      buyerMessage:
        'Merge counter from Seaport.getCounter(buyer), sign EIP-712, POST /marketplace/orders with side=bid and bucketBidId.',
    };
  }

  /** Seaport 입찰 체결 시 연결된 풀 매수를 fulfilled 로 */
  async markPoolBidFulfilledIfLinked(order: {
    bucketBidId?: number | null;
    side: string;
    tokenId: string;
  }): Promise<void> {
    if (order.bucketBidId == null || String(order.side).toLowerCase() !== 'bid') {
      return;
    }
    await this.bucketBidRepo.update(
      { id: order.bucketBidId },
      {
        status: BucketBidStatus.FULFILLED,
        fulfilledTokenId: order.tokenId,
      },
    );
  }

  async cancel(id: number, callerAddress: string): Promise<BucketBid> {
    await this.expireStale();
    const bid = await this.bucketBidRepo.findOne({ where: { id } });
    if (!bid) throw new NotFoundException(`Bucket bid ${id} not found`);
    if (bid.status !== BucketBidStatus.ACTIVE) {
      throw new BadRequestException(`Bid is already ${bid.status}`);
    }
    if (bid.buyerOfferer.toLowerCase() !== callerAddress.toLowerCase()) {
      throw new ForbiddenException('Only the buyer can cancel this pool bid');
    }
    bid.status = BucketBidStatus.CANCELLED;
    return this.bucketBidRepo.save(bid);
  }

  /** createOrder(side=bid, bucketBidId) 시 풀 입찰과 Seaport 파라미터 일치 검증 */
  async assertPoolBidMatchesSeaportBid(dto: {
    bucketBidId: number;
    tokenId: string;
    offerer: string;
    considerationAmount: string;
  }): Promise<BucketBid> {
    await this.expireStale();
    const bid = await this.bucketBidRepo.findOne({ where: { id: dto.bucketBidId } });
    if (!bid) throw new NotFoundException(`Bucket bid ${dto.bucketBidId} not found`);
    if (bid.status !== BucketBidStatus.ACTIVE) {
      throw new BadRequestException(`Pool bid is ${bid.status}`);
    }
    if (bid.buyerOfferer.toLowerCase() !== dto.offerer.toLowerCase()) {
      throw new BadRequestException('Seaport offerer must match pool bid buyer');
    }
    if (bid.considerationAmount !== dto.considerationAmount) {
      throw new BadRequestException('USDC amount must match pool bid');
    }
    const { bucketKey } = await this.resolveBucketFromTokenId(Number(dto.tokenId));
    if (bucketKey !== bid.bucketKey) {
      throw new BadRequestException('NFT tokenId is not in the same bucket as this pool bid');
    }
    return bid;
  }

  /**
   * 판매자가 특정 토큰으로 이 풀 입찰과 "논리적으로" 매칭되는지 검증.
   * 온체인 정산은 Seaport token-특정 주문이 필요 — 여기서는 DB·메타 일치만 확인.
   */
  async validateSellerMatch(
    bidId: number,
    tokenId: number,
    sellerAddress: string,
  ): Promise<{
    match: boolean;
    bucketBid: BucketBid;
    tokenOwner: string;
    message: string;
  }> {
    await this.expireStale();
    const bid = await this.bucketBidRepo.findOne({ where: { id: bidId } });
    if (!bid) throw new NotFoundException(`Bucket bid ${bidId} not found`);
    if (bid.status !== BucketBidStatus.ACTIVE) {
      throw new BadRequestException(`Bid is ${bid.status}`);
    }

    const owner = (await this.blockchain.getNftOwner(tokenId)).toLowerCase();
    const seller = sellerAddress.toLowerCase();
    if (owner !== seller) {
      throw new ForbiddenException('sellerAddress is not the owner of this tokenId');
    }

    const { bucketKey } = await this.resolveBucketFromTokenId(tokenId);
    const match = bucketKey === bid.bucketKey;
    const message = match
      ? 'Token metadata matches this pool bid. Next: buyer signs a Seaport bid for this tokenId at this price, or use listing + buy flow.'
      : 'This NFT does not belong to the same logical pool as this bid (card / set / grade differ).';

    return {
      match,
      bucketBid: bid,
      tokenOwner: owner,
      message,
    };
  }

  private async expireStale(): Promise<void> {
    await this.bucketBidRepo.update(
      { status: BucketBidStatus.ACTIVE, endTime: LessThan(new Date()) },
      { status: BucketBidStatus.EXPIRED },
    );
  }
}
