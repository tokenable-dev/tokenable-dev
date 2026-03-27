import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CollectionService } from './collection.service';
import { BucketBidService } from './bucket-bid.service';
import type { MarketBucketComponents } from './bucket-key.util';
import { CreateBucketBidDto } from './dto/create-bucket-bid.dto';
import { PrepareBucketFulfillDto } from './dto/prepare-bucket-fulfill.dto';
import { ValidateBucketMatchDto } from './dto/validate-bucket-match.dto';
import { BucketBid } from './entities/bucket-bid.entity';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order } from './entities/order.entity';
import { MarketplaceService } from './marketplace.service';

@ApiTags('marketplace')
@Controller('marketplace')
export class MarketplaceController {
  constructor(
    private readonly marketplaceService: MarketplaceService,
    private readonly bucketBidService: BucketBidService,
    private readonly collectionService: CollectionService,
  ) {}

  /**
   * 판매자가 EIP-712 서명한 Seaport 주문을 백엔드 DB에 등록합니다.
   * 실제 블록체인 트랜잭션은 발생하지 않습니다.
   */
  @ApiOperation({ summary: 'Seaport 판매 주문 등록 (오프체인)' })
  @ApiBody({ type: CreateOrderDto })
  @Post('orders')
  createOrder(@Body() dto: CreateOrderDto): Promise<Order> {
    return this.marketplaceService.createOrder(dto);
  }

  /**
   * 활성 상태의 판매 주문 목록을 반환합니다.
   * 만료된 주문은 자동으로 expired 처리됩니다.
   */
  @ApiOperation({ summary: '활성 판매 주문 목록 조회' })
  @Get('orders')
  findActiveOrders(): Promise<Order[]> {
    return this.marketplaceService.findActiveOrders();
  }

  @ApiOperation({
    summary: '메타 기준 컬렉션 목록',
    description:
      'graded + JustTCG queryUsed 등으로 생성된 논리 컬렉션. 첫 매도(ask) 등록 시 행이 생긴다.',
  })
  @Get('collections')
  listCollections() {
    return this.collectionService.listSummaries();
  }

  @ApiOperation({
    summary: '컬렉션 단건 + 오더북용 데이터',
    description:
      '활성 매도(asks), 풀 매수(pool bids), Seaport 매수(seaport bids), JustTCG 대표 이미지 URL',
  })
  @ApiParam({ name: 'key', description: 'collection_key (64 hex, bucket과 동일)' })
  @Get('collections/:key')
  async getCollection(@Param('key') key: string) {
    const col = await this.collectionService.findOne(key);
    if (!col) {
      throw new NotFoundException(`Collection not found: ${key}`);
    }
    const [listings, seaportBids, representativeImageUrl] = await Promise.all([
      this.collectionService.activeListingsForCollection(key),
      this.collectionService.activeBidsForCollection(key),
      this.collectionService.resolveRepresentativeImageForCollection(key),
    ]);
    const poolBids = await this.bucketBidService.findActiveByBucketKey(
      col.collectionKey.toLowerCase(),
    );
    return {
      collection: col,
      listings,
      poolBids,
      seaportBids,
      representativeImageUrl,
    };
  }

  /**
   * 특정 NFT tokenId의 전체 주문 이력을 반환합니다.
   * (active / fulfilled / cancelled / expired 모두 포함)
   */
  @ApiOperation({ summary: 'tokenId별 전체 주문 이력 조회' })
  @ApiParam({ name: 'tokenId', description: 'NFT Token ID', example: '1' })
  @Get('orders/token/:tokenId')
  findByTokenId(@Param('tokenId') tokenId: string): Promise<Order[]> {
    return this.marketplaceService.findByTokenId(tokenId);
  }

  /**
   * 활성 매수 입찰만 — 가격(USDC 최소단위) 내림차순. 오더북 Bid 측.
   */
  @ApiOperation({ summary: 'tokenId별 활성 매수 입찰 목록 (가격 내림차순)' })
  @ApiParam({ name: 'tokenId', description: 'NFT Token ID', example: '1' })
  @Get('orders/bids/token/:tokenId')
  findActiveBids(@Param('tokenId') tokenId: string): Promise<Order[]> {
    return this.marketplaceService.findActiveBidsByTokenId(tokenId);
  }

  /**
   * Seaport order hash로 단일 주문을 조회합니다.
   * 프론트엔드는 이 주문 데이터로 Seaport.fulfillOrder()를 호출합니다.
   */
  @ApiOperation({ summary: '주문 단건 조회 (orderHash 기준)' })
  @ApiParam({ name: 'hash', description: 'Seaport order hash', example: '0xabc...' })
  @Get('orders/:hash')
  findOrder(@Param('hash') hash: string): Promise<Order> {
    return this.marketplaceService.findByHash(hash);
  }

  /**
   * 판매자가 주문을 취소합니다.
   * callerAddress 쿼리로 판매자 본인 여부를 검증합니다.
   * (실제 서비스에서는 지갑 서명 기반 인증으로 교체 권장)
   */
  @ApiOperation({ summary: '판매 주문 취소' })
  @ApiParam({ name: 'hash', description: 'Seaport order hash' })
  @ApiQuery({ name: 'callerAddress', description: '판매자 지갑 주소', example: '0xD5ab...' })
  @Patch('orders/:hash/cancel')
  cancelOrder(
    @Param('hash') hash: string,
    @Query('callerAddress') callerAddress: string,
  ): Promise<Order> {
    return this.marketplaceService.cancelOrder(hash, callerAddress);
  }

  /**
   * 구매자가 Seaport.fulfillOrder() 온체인 트랜잭션 완료 후 호출합니다.
   * 주문 상태를 fulfilled로 업데이트합니다.
   */
  @ApiOperation({ summary: '구매 완료 처리 (fulfilled 상태로 변경)' })
  @ApiParam({ name: 'hash', description: 'Seaport order hash' })
  @Patch('orders/:hash/fulfill')
  fulfillOrder(@Param('hash') hash: string): Promise<Order> {
    return this.marketplaceService.fulfillOrder(hash);
  }

  /**
   * on-chain 트랜잭션 revert 등으로 잘못된 상태가 된 주문을 active로 복구합니다.
   * offerer(판매자) 본인만 호출 가능합니다.
   */
  @ApiOperation({ summary: '주문 상태 복구 (active로 되돌리기)' })
  @ApiParam({ name: 'hash', description: 'Seaport order hash' })
  @ApiQuery({ name: 'callerAddress', description: '판매자 지갑 주소' })
  @Patch('orders/:hash/reactivate')
  reactivateOrder(
    @Param('hash') hash: string,
    @Query('callerAddress') callerAddress: string,
  ): Promise<Order> {
    return this.marketplaceService.reactivateOrder(hash, callerAddress);
  }

  // ── Pool bids (논리적 버킷 — 같은 카드·등급, tokenId 비특정) ────────────────

  @ApiOperation({
    summary: 'tokenId로 버킷 키·메타·활성 풀 매수 호가',
    description:
      'IPFS 메타의 properties.graded로 버킷을 계산합니다. graded가 없으면 400.',
  })
  @Get('bucket-bids/by-token/:tokenId')
  listBucketBidsByToken(
    @Param('tokenId') tokenId: string,
  ): Promise<{
    bucketKey: string;
    components: MarketBucketComponents;
    bids: BucketBid[];
  }> {
    return this.bucketBidService.listByTokenResolved(Number(tokenId));
  }

  @ApiOperation({
    summary: '풀 매수 호가 등록 (Web2)',
    description:
      'tokenId를 넣으면 서버가 버킷 키를 계산합니다. 온체인 Seaport와 별개 — 체결 시 token-특정 주문이 추가로 필요합니다.',
  })
  @Post('bucket-bids')
  createBucketBid(@Body() dto: CreateBucketBidDto): Promise<BucketBid> {
    return this.bucketBidService.create(dto);
  }

  @ApiOperation({
    summary: '풀 입찰 → 특정 tokenId Seaport 입찰 초안',
    description:
      '판매자가 자신의 tokenId로 체결하려 할 때, 구매자가 서명할 Seaport 파라미터 초안을 받습니다. counter는 클라이언트가 체인에서 읽어 병합합니다.',
  })
  @ApiParam({ name: 'id', description: 'bucket_bids.id' })
  @Post('bucket-bids/:id/prepare-fulfill')
  prepareBucketFulfill(
    @Param('id') id: string,
    @Body() dto: PrepareBucketFulfillDto,
  ) {
    return this.bucketBidService.prepareSeaportBidForPool(
      Number(id),
      Number(dto.tokenId),
    );
  }

  @ApiOperation({ summary: '풀 매수 호가 취소 (매수자만)' })
  @Patch('bucket-bids/:id/cancel')
  cancelBucketBid(
    @Param('id') id: string,
    @Query('callerAddress') callerAddress: string,
  ): Promise<BucketBid> {
    return this.bucketBidService.cancel(Number(id), callerAddress);
  }

  @ApiOperation({
    summary: '판매자·토큰이 풀 입찰과 메타데이터상 일치하는지 검증',
  })
  @Post('bucket-bids/:id/validate-seller')
  validateBucketSellerMatch(
    @Param('id') id: string,
    @Body() dto: ValidateBucketMatchDto,
  ): Promise<{
    match: boolean;
    bucketBid: BucketBid;
    tokenOwner: string;
    message: string;
  }> {
    return this.bucketBidService.validateSellerMatch(
      Number(id),
      Number(dto.tokenId),
      dto.sellerAddress,
    );
  }
}
