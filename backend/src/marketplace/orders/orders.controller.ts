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
import { apiBodyDefault } from '../../swagger/api-body.util';
import {
  createAskOrderExample,
  createCollectionBidExample,
  replaceBidExample,
  replaceListingExample,
  SWAGGER_BODY_EXAMPLES,
} from '../../swagger/examples';
import { SWAGGER_FIXTURES } from '../../swagger/fixtures';
import { OrdersBatchByTokenDto } from './dto/orders-batch-by-token.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { FulfillMatchedPairDto } from './dto/fulfill-matched-pair.dto';
import { ReplaceBidDto } from './dto/replace-bid.dto';
import { ReplaceListingDto } from './dto/replace-listing.dto';
import { Order } from '../entities/order.entity';
import { ListActiveOrdersQueryDto } from './dto/list-active-orders-query.dto';
import { ListOrdersByOffererQueryDto } from './dto/list-orders-by-offerer-query.dto';
import { OrdersService } from './orders.service';
import type { OrderListItem } from '../utils/order-list.util';

/**
 * 마켓플레이스 Seaport 주문 — DB 등록·조회·취소·체결.
 */
@ApiTags('marketplace')
@Controller('marketplace')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /** 서명된 Seaport 주문을 DB에 등록 (ask·collection bid) */
  @ApiOperation({ summary: '주문 등록 (오프체인 DB)' })
  @ApiBody({
    type: CreateOrderDto,
    examples: {
      ask: { summary: '판매 listing (ask)', value: createAskOrderExample },
      bid: { summary: '컬렉션 입찰 (bid)', value: createCollectionBidExample },
    },
  })
  @Post('orders')
  createOrder(@Body() dto: CreateOrderDto): Promise<Order> {
    return this.ordersService.createOrder(dto);
  }

  /** 활성 listing 가격/조건 변경 (취소+신규 주문 단일 트랜잭션) */
  @ApiOperation({ summary: 'listing 교체 (취소+신규)' })
  @ApiBody(apiBodyDefault(ReplaceListingDto, replaceListingExample))
  @Post('orders/replace-listing')
  replaceListing(@Body() body: ReplaceListingDto): Promise<Order> {
    return this.ordersService.replaceSellerListing(
      body.oldOrderHash,
      body.callerAddress,
      body.order,
    );
  }

  /** 활성 collection bid 가격/조건 변경 (취소+신규 주문 단일 트랜잭션) */
  @ApiOperation({ summary: 'collection bid 교체 (취소+신규)' })
  @ApiBody(apiBodyDefault(ReplaceBidDto, replaceBidExample))
  @Post('orders/replace-bid')
  replaceBid(@Body() body: ReplaceBidDto): Promise<Order> {
    return this.ordersService.replaceBuyerBid(
      body.oldOrderHash,
      body.callerAddress,
      body.order,
    );
  }

  /** 여러 tokenId 주문 이력 배치 조회 */
  @ApiOperation({ summary: 'tokenId별 주문 이력 배치' })
  @ApiBody(apiBodyDefault(OrdersBatchByTokenDto, SWAGGER_BODY_EXAMPLES.ordersBatchByToken))
  @Post('orders/batch-by-token')
  batchOrdersByToken(@Body() body: OrdersBatchByTokenDto) {
    return this.ordersService.findOrdersBatchByTokenIds(body.tokenIds ?? []);
  }

  /** 지갑이 등록한 collection bid 주문 내역 (active·fulfilled·cancelled 등) */
  @ApiOperation({ summary: '지갑별 collection bid 주문 내역' })
  @ApiQuery({ name: 'offerer', example: SWAGGER_FIXTURES.wallet })
  @ApiQuery({ name: 'side', example: 'bid', enum: ['bid'] })
  @ApiQuery({ name: 'limit', required: false, example: 100 })
  @Get('orders/by-offerer')
  findOrdersByOfferer(
    @Query() query: ListOrdersByOffererQueryDto,
  ): Promise<OrderListItem[]> {
    if (query.side !== 'bid') {
      return Promise.resolve([]);
    }
    return this.ordersService.findCollectionBidsByOfferer(
      query.offerer,
      query.limit,
    );
  }

  /** 활성 ask listing 목록 (경량, parameters 없음) */
  @ApiOperation({ summary: '활성 listing 목록' })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 50,
    description: '최대 건수 (서버 상한 적용)',
  })
  @Get('orders')
  findActiveOrders(@Query() query: ListActiveOrdersQueryDto) {
    return this.ordersService.findActiveOrderListItems(query.limit);
  }

  /** tokenId별 주문 (activeOnly=true 시 활성 ask 1건) */
  @ApiOperation({ summary: 'tokenId별 주문 조회' })
  @ApiParam({ name: 'tokenId', description: 'RWA tokenId', example: '1' })
  @ApiQuery({
    name: 'activeOnly',
    required: false,
    example: 'true',
    description: 'true면 활성 ask 1건만',
  })
  @Get('orders/token/:tokenId')
  findByTokenId(
    @Param('tokenId') tokenId: string,
    @Query('activeOnly') activeOnly?: string,
  ): Promise<Order[] | Order | null> {
    if (activeOnly === 'true' || activeOnly === '1') {
      return this.ordersService.findActiveAskByTokenId(tokenId);
    }
    return this.ordersService.findByTokenId(tokenId);
  }

  /** orderHash로 주문 단건 */
  @ApiOperation({ summary: '주문 hash 조회' })
  @ApiParam({ name: 'hash', description: '주문 hash', example: SWAGGER_FIXTURES.orderHash })
  @Get('orders/:hash')
  findOrder(@Param('hash') hash: string): Promise<Order> {
    return this.ordersService.findByHash(hash);
  }

  /** offerer만 주문 취소 */
  @ApiOperation({ summary: '주문 취소' })
  @ApiParam({ name: 'hash', description: '주문 hash', example: SWAGGER_FIXTURES.orderHash })
  @ApiQuery({ name: 'callerAddress', description: '취소 요청 지갑', example: SWAGGER_FIXTURES.wallet })
  @Patch('orders/:hash/cancel')
  cancelOrder(
    @Param('hash') hash: string,
    @Query('callerAddress') callerAddress: string,
  ): Promise<Order> {
    return this.ordersService.cancelOrder(hash, callerAddress);
  }

  /** 단일 주문 체결 처리 (on-chain fulfill 후) */
  @ApiOperation({ summary: '주문 체결 표시' })
  @ApiParam({ name: 'hash', description: '주문 hash', example: SWAGGER_FIXTURES.orderHash })
  @Patch('orders/:hash/fulfill')
  fulfillOrder(@Param('hash') hash: string): Promise<Order> {
    return this.ordersService.fulfillOrder(hash);
  }

  /** ask+criteria bid 매칭 체결 후 두 주문 모두 fulfilled */
  @ApiOperation({ summary: '매칭 주문 쌍 체결 표시' })
  @ApiBody(apiBodyDefault(FulfillMatchedPairDto, SWAGGER_BODY_EXAMPLES.fulfillMatchedPair))
  @Post('orders/fulfill-matched-pair')
  fulfillMatchedPair(@Body() body: FulfillMatchedPairDto) {
    return this.ordersService.fulfillMatchedPair(
      body.askOrderHash,
      body.bidOrderHash,
    );
  }
}
