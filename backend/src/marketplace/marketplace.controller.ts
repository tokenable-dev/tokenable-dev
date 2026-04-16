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
import { CollectionMarketService } from './collection-market.service';
import { CollectionService } from './collection.service';
import { BatchMarketSnapshotsDto } from './dto/batch-market-snapshots.dto';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CreateOrderDto } from './dto/create-order.dto';
import { FulfillMatchedPairDto } from './dto/fulfill-matched-pair.dto';
import { ReplaceListingDto } from './dto/replace-listing.dto';
import { Order } from './entities/order.entity';
import { MarketplaceService } from './marketplace.service';

@ApiTags('marketplace')
@Controller('marketplace')
export class MarketplaceController {
  constructor(
    private readonly marketplaceService: MarketplaceService,
    private readonly collectionService: CollectionService,
    private readonly collectionMarketService: CollectionMarketService,
  ) {}

  @ApiOperation({ summary: 'Seaport order registration (off-chain DB)' })
  @ApiBody({ type: CreateOrderDto })
  @Post('orders')
  createOrder(@Body() dto: CreateOrderDto): Promise<Order> {
    return this.marketplaceService.createOrder(dto);
  }

  @ApiOperation({
    summary:
      'Replace an active listing (cancel + new order in one DB transaction; keeps Merkle token set stable)',
  })
  @ApiBody({ type: ReplaceListingDto })
  @Post('orders/replace-listing')
  replaceListing(@Body() body: ReplaceListingDto): Promise<Order> {
    return this.marketplaceService.replaceSellerListing(
      body.oldOrderHash,
      body.callerAddress,
      body.order,
    );
  }

  @ApiOperation({ summary: 'Active listings (asks)' })
  @Get('orders')
  findActiveOrders(): Promise<Order[]> {
    return this.marketplaceService.findActiveOrders();
  }

  @ApiOperation({ summary: 'Collection list' })
  @Get('collections')
  listCollections() {
    return this.collectionService.listSummaries();
  }

  @ApiOperation({
    summary: 'Batch list-row snapshots (JustTCG sparkline + grade strip + category)',
  })
  @ApiBody({ type: BatchMarketSnapshotsDto })
  @Post('collections/market-snapshots')
  batchMarketSnapshots(@Body() body: BatchMarketSnapshotsDto) {
    return this.collectionMarketService.batchListSnapshots(
      body.collectionKeys ?? [],
      body.priceHistoryDuration ?? '30d',
    );
  }

  @ApiOperation({
    summary:
      'Dual-series chart data: external (JustTCG, max 180d history) + platform snapshot. Prefer one call on page load; poll GET …/platform-trades for fills only.',
  })
  @ApiParam({ name: 'key', description: 'collection_key' })
  @Get('collections/:key/market-series')
  getCollectionMarketSeries(
    @Param('key') key: string,
    @Query('priceHistoryDuration') priceHistoryDuration?: string,
  ) {
    const d = ['7d', '30d', '90d', '180d'].includes(String(priceHistoryDuration))
      ? (priceHistoryDuration as '7d' | '30d' | '90d' | '180d')
      : '180d';
    return this.collectionMarketService.getCollectionMarketBundle(key, d);
  }

  @ApiOperation({
    summary:
      'Fulfilled listings for this collection (DB): chart points + tape rows for the order book Trades tab.',
  })
  @ApiParam({ name: 'key', description: 'collection_key' })
  @Get('collections/:key/platform-trades')
  getCollectionPlatformTrades(@Param('key') key: string) {
    return this.collectionMarketService.platformTradesForApi(key);
  }

  @ApiOperation({ summary: 'Collection detail + order book (listings + collection bids)' })
  @ApiParam({ name: 'key', description: 'collection_key' })
  @Get('collections/:key')
  async getCollection(@Param('key') key: string) {
    const col = await this.collectionService.findOne(key);
    if (!col) {
      throw new NotFoundException(`Collection not found: ${key}`);
    }
    const [listings, collectionBids, representativeImageUrl] = await Promise.all([
      this.collectionService.activeListingsForCollection(key),
      this.collectionService.activeBidsForCollection(key),
      this.collectionService.resolveRepresentativeImageForCollection(key),
    ]);
    return {
      collection: col,
      listings,
      collectionBids,
      representativeImageUrl,
    };
  }

  @ApiOperation({
    summary:
      'Token IDs for Merkle tree: all minted RWAs in this collection bucket (metadata), not only active asks',
  })
  @ApiParam({ name: 'key', description: 'collection_key' })
  @Get('collections/:key/merkle-set')
  merkleSet(
    @Param('key') key: string,
    @Query('bypassCache') bypassCache?: string,
  ) {
    return this.collectionService.merkleEligibleTokenIds(key, {
      bypassCache: bypassCache === '1' || bypassCache === 'true',
    });
  }

  @ApiOperation({ summary: 'Order history by tokenId' })
  @ApiParam({ name: 'tokenId' })
  @Get('orders/token/:tokenId')
  findByTokenId(@Param('tokenId') tokenId: string): Promise<Order[]> {
    return this.marketplaceService.findByTokenId(tokenId);
  }

  @ApiOperation({ summary: 'Get order by hash' })
  @ApiParam({ name: 'hash' })
  @Get('orders/:hash')
  findOrder(@Param('hash') hash: string): Promise<Order> {
    return this.marketplaceService.findByHash(hash);
  }

  @ApiOperation({ summary: 'Cancel order (offerer only)' })
  @ApiParam({ name: 'hash' })
  @ApiQuery({ name: 'callerAddress' })
  @Patch('orders/:hash/cancel')
  cancelOrder(
    @Param('hash') hash: string,
    @Query('callerAddress') callerAddress: string,
  ): Promise<Order> {
    return this.marketplaceService.cancelOrder(hash, callerAddress);
  }

  @ApiOperation({
    summary: 'Mark single order fulfilled (e.g. fulfillOrder on a listing)',
  })
  @ApiParam({ name: 'hash' })
  @Patch('orders/:hash/fulfill')
  fulfillOrder(@Param('hash') hash: string): Promise<Order> {
    return this.marketplaceService.fulfillOrder(hash);
  }

  @ApiOperation({
    summary:
      'After matchAdvancedOrders(ask + criteria bid), mark both orders fulfilled',
  })
  @ApiBody({ type: FulfillMatchedPairDto })
  @Post('orders/fulfill-matched-pair')
  fulfillMatchedPair(@Body() body: FulfillMatchedPairDto) {
    return this.marketplaceService.fulfillMatchedPair(body.askOrderHash, body.bidOrderHash);
  }
}
