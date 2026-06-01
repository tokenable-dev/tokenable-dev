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
import { OrdersBatchByTokenDto } from './dto/orders-batch-by-token.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { FulfillMatchedPairDto } from './dto/fulfill-matched-pair.dto';
import { ReplaceListingDto } from './dto/replace-listing.dto';
import { Order } from '../entities/order.entity';
import { ListActiveOrdersQueryDto } from './dto/list-active-orders-query.dto';
import { OrdersService } from './orders.service';

@ApiTags('marketplace')
@Controller('marketplace')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @ApiOperation({ summary: 'Seaport order registration (off-chain DB)' })
  @ApiBody({
    type: CreateOrderDto,
    examples: {
      askListing: {
        summary: 'Ask listing (ERC721 token #123 → 150 USDC)',
        value: {
          side: 'ask',
          tokenContract: '0x1234567890abcdef1234567890abcdef12345678',
          tokenId: '123',
          considerationToken: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238',
          considerationAmount: '150000000',
          parameters: {
            offerer: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
            zone: '0x0000000000000000000000000000000000000000',
            offer: [
              {
                itemType: 2,
                token: '0x1234567890abcdef1234567890abcdef12345678',
                identifierOrCriteria: '123',
                startAmount: '1',
                endAmount: '1',
              },
            ],
            consideration: [
              {
                itemType: 1,
                token: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238',
                identifierOrCriteria: '0',
                startAmount: '150000000',
                endAmount: '150000000',
                recipient: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
              },
            ],
            orderType: 0,
            startTime: '1711000000',
            endTime: '1713592000',
            zoneHash:
              '0x0000000000000000000000000000000000000000000000000000000000000000',
            salt: '1234567890123',
            conduitKey:
              '0x0000000000000000000000000000000000000000000000000000000000000000',
            totalOriginalConsiderationItems: 1,
            counter: '0',
          },
          signature: '0x<seaport_signature>',
        },
      },
      collectionBid: {
        summary: 'Collection criteria bid (tokenId must be "0")',
        value: {
          side: 'bid',
          collectionKey:
            'ab5f1f362c9a16151b10159d3d5ca465fe8e23b7ff20169d20bf92188e292bfa',
          tokenContract: '0x1234567890abcdef1234567890abcdef12345678',
          tokenId: '0',
          considerationToken: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238',
          considerationAmount: '150000000',
          parameters: {
            offerer: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
            zone: '0x0000000000000000000000000000000000000000',
            offer: [
              {
                itemType: 1,
                token: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238',
                identifierOrCriteria: '0',
                startAmount: '150000000',
                endAmount: '150000000',
              },
            ],
            consideration: [
              {
                itemType: 4,
                token: '0x1234567890abcdef1234567890abcdef12345678',
                identifierOrCriteria:
                  '0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
                startAmount: '1',
                endAmount: '1',
                recipient: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
              },
            ],
            orderType: 2,
            startTime: '1711000000',
            endTime: '1713592000',
            zoneHash:
              '0x0000000000000000000000000000000000000000000000000000000000000000',
            salt: '2234567890123',
            conduitKey:
              '0x0000000000000000000000000000000000000000000000000000000000000000',
            totalOriginalConsiderationItems: 1,
            counter: '0',
          },
          signature: '0x<seaport_signature>',
        },
      },
    },
  })
  @Post('orders')
  createOrder(@Body() dto: CreateOrderDto): Promise<Order> {
    return this.ordersService.createOrder(dto);
  }

  @ApiOperation({
    summary:
      'Replace an active listing (cancel + new order in one DB transaction; keeps Merkle token set stable)',
  })
  @ApiBody({
    type: ReplaceListingDto,
    examples: {
      replaceAsk: {
        summary: 'Replace active listing price',
        value: {
          oldOrderHash: '0xoldhash...',
          callerAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
          order: {
            side: 'ask',
            tokenContract: '0x1234567890abcdef1234567890abcdef12345678',
            tokenId: '123',
            considerationToken: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238',
            considerationAmount: '145000000',
            parameters: {
              offerer: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
              zone: '0x0000000000000000000000000000000000000000',
              offer: [],
              consideration: [],
              orderType: 0,
              startTime: '1711000000',
              endTime: '1713592000',
              zoneHash:
                '0x0000000000000000000000000000000000000000000000000000000000000000',
              salt: '3234567890123',
              conduitKey:
                '0x0000000000000000000000000000000000000000000000000000000000000000',
              totalOriginalConsiderationItems: 1,
              counter: '0',
            },
            signature: '0x<seaport_signature>',
          },
        },
      },
    },
  })
  @Post('orders/replace-listing')
  replaceListing(@Body() body: ReplaceListingDto): Promise<Order> {
    return this.ordersService.replaceSellerListing(
      body.oldOrderHash,
      body.callerAddress,
      body.order,
    );
  }

  @ApiOperation({
    summary:
      'Order history for many token ids in one DB round-trip (payload: list rows only)',
  })
  @ApiBody({
    type: OrdersBatchByTokenDto,
    examples: {
      byTokens: {
        summary: 'Fetch order histories for token ids',
        value: { tokenIds: [1, 2, 123, 999] },
      },
    },
  })
  @Post('orders/batch-by-token')
  batchOrdersByToken(@Body() body: OrdersBatchByTokenDto) {
    return this.ordersService.findOrdersBatchByTokenIds(body.tokenIds ?? []);
  }

  @ApiOperation({
    summary:
      'Active listings (asks) — lightweight rows (no Seaport parameters / signature)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description:
      'Max rows returned (default server cap from MARKETPLACE_ACTIVE_ORDERS_MAX)',
  })
  @Get('orders')
  findActiveOrders(@Query() query: ListActiveOrdersQueryDto) {
    return this.ordersService.findActiveOrderListItems(query.limit);
  }

  @ApiOperation({
    summary:
      'Orders for a token: full rows (incl. Seaport parameters). Use activeOnly=true for a single active ask.',
  })
  @ApiParam({ name: 'tokenId' })
  @ApiQuery({
    name: 'activeOnly',
    required: false,
    description:
      'When true, returns one active ask or null (still includes parameters for fulfill UI)',
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

  @ApiOperation({ summary: 'Get order by hash' })
  @ApiParam({ name: 'hash' })
  @Get('orders/:hash')
  findOrder(@Param('hash') hash: string): Promise<Order> {
    return this.ordersService.findByHash(hash);
  }

  @ApiOperation({ summary: 'Cancel order (offerer only)' })
  @ApiParam({ name: 'hash' })
  @ApiQuery({ name: 'callerAddress' })
  @Patch('orders/:hash/cancel')
  cancelOrder(
    @Param('hash') hash: string,
    @Query('callerAddress') callerAddress: string,
  ): Promise<Order> {
    return this.ordersService.cancelOrder(hash, callerAddress);
  }

  @ApiOperation({
    summary: 'Mark single order fulfilled (e.g. fulfillOrder on a listing)',
  })
  @ApiParam({ name: 'hash' })
  @Patch('orders/:hash/fulfill')
  fulfillOrder(@Param('hash') hash: string): Promise<Order> {
    return this.ordersService.fulfillOrder(hash);
  }

  @ApiOperation({
    summary:
      'After matchAdvancedOrders(ask + criteria bid), mark both orders fulfilled',
  })
  @ApiBody({
    type: FulfillMatchedPairDto,
    examples: {
      pair: {
        summary: 'Mark matched ask + criteria bid fulfilled',
        value: {
          askOrderHash: '0xaskhash...',
          bidOrderHash: '0xbidhash...',
        },
      },
    },
  })
  @Post('orders/fulfill-matched-pair')
  fulfillMatchedPair(@Body() body: FulfillMatchedPairDto) {
    return this.ordersService.fulfillMatchedPair(
      body.askOrderHash,
      body.bidOrderHash,
    );
  }
}
