import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
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
  constructor(private readonly marketplaceService: MarketplaceService) {}

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
}
