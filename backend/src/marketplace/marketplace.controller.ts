import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PoketraceService } from '../poketrace/poketrace.service';
import { CollectionMarketService } from './collection-market.service';
import { CollectionService } from './collection.service';
import { BatchMarketSnapshotsDto } from './dto/batch-market-snapshots.dto';
import { MintPreviewsByTokenIdsDto } from './dto/mint-previews-by-token-ids.dto';
import { OrdersBatchByTokenDto } from './dto/orders-batch-by-token.dto';
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
    private readonly poketraceService: PoketraceService,
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

  @ApiOperation({
    summary: 'Order history for many token ids in one DB round-trip (payload: list rows only)',
  })
  @ApiBody({ type: OrdersBatchByTokenDto })
  @Post('orders/batch-by-token')
  batchOrdersByToken(@Body() body: OrdersBatchByTokenDto) {
    return this.marketplaceService.findOrdersBatchByTokenIds(body.tokenIds ?? []);
  }

  @ApiOperation({
    summary: 'Active listings (asks) — lightweight rows (no Seaport parameters / signature)',
  })
  @Get('orders')
  findActiveOrders() {
    return this.marketplaceService.findActiveOrderListItems();
  }

  @ApiOperation({ summary: 'Collection list (cursor pagination)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Page size (default 24, max 60)' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Opaque cursor from prior page' })
  @Get('collections')
  listCollections(@Query('limit') limitRaw?: string, @Query('cursor') cursor?: string) {
    const parsed =
      limitRaw != null && String(limitRaw).trim() !== ''
        ? parseInt(String(limitRaw), 10)
        : 24;
    const limit = Number.isFinite(parsed) ? parsed : 24;
    return this.collectionService.listSummariesPaged({
      limit,
      cursor: cursor?.trim() || null,
    });
  }

  @ApiOperation({
    summary:
      'Batch list-row snapshots: JustTCG grade strip + category; sparkline slot is legacy (empty when bundle has no external series). Pool floor/median/band/vol: use GET …/collections/:key/stats or `marketStats` on each item when present.',
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
      'PokeTrace: matched catalog card + raw (Near Mint) eBay/TCGPlayer bands. PSA graded tier prices require a PokeTrace Pro API plan; token stays server-side.',
  })
  @ApiParam({ name: 'key', description: 'collection_key' })
  @Get('collections/:key/poketrace')
  async getCollectionPoketrace(@Param('key') key: string) {
    const k = decodeURIComponent(key).toLowerCase();
    const col = await this.collectionService.findOne(k);
    return this.poketraceService.getPreviewForCollection(col);
  }

  @ApiOperation({
    summary:
      'PokeTrace: Near Mint USD history (eBay) for the resolved catalog card. Upstream may paginate; default 90 calendar days.',
  })
  @ApiParam({ name: 'key', description: 'collection_key' })
  @ApiQuery({
    name: 'days',
    required: false,
    description: 'Calendar days (1–365), default 90',
  })
  @Get('collections/:key/poketrace/nm-history')
  async getCollectionPoketraceNmHistory(
    @Param('key') key: string,
    @Query('days') daysRaw?: string,
  ) {
    const k = decodeURIComponent(key).toLowerCase();
    const col = await this.collectionService.findOne(k);
    const parsed =
      daysRaw != null && String(daysRaw).trim() !== ''
        ? parseInt(String(daysRaw), 10)
        : NaN;
    const days = Number.isFinite(parsed)
      ? Math.min(365, Math.max(1, parsed))
      : 90;
    return this.poketraceService.getNearMintHistoryForCollection(col, {
      days,
    });
  }

  @ApiOperation({
    summary:
      'PokeTrace (My Assets): batch resolve NM bands — server loads IPFS metadata from token ids (max 32).',
  })
  @ApiBody({ type: MintPreviewsByTokenIdsDto })
  @Post('poketrace/mint-previews')
  postMintPoketracePreviews(@Body() body: MintPreviewsByTokenIdsDto) {
    return this.poketraceService.getBatchMintPreviewsFromTokenIds(body.tokenIds ?? []);
  }

  @ApiOperation({
    summary:
      'Chart bundle: platform fills (USDC) + JustTCG grade/category metadata. External “card history” series is empty (`marketChangeSource: none`); use GET …/collections/:key/stats for listing-pool statistics.',
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

  @ApiOperation({
    summary:
      'Collection market pool statistics (USDC only): Tukey IQR trim, floor = 10th percentile on trimmed set, volatility = sample stdev on trimmed set. sampleSize < 5 → numeric fields null and isReliable false. `reference.poketraceCardId` is metadata only.',
  })
  @ApiParam({ name: 'key', description: 'collection_key' })
  @Get('collections/:key/stats')
  getCollectionMarketStats(@Param('key') key: string) {
    const k = decodeURIComponent(key).toLowerCase();
    return this.collectionMarketService.getCollectionMarketStats(k);
  }

  @ApiOperation({
    summary:
      'Collection detail + order book (listings + collection bids). `collection` is null when no `marketplace_collections` row yet (same key may still have orders); avoids 404 for client prefetch.',
  })
  @ApiParam({ name: 'key', description: 'collection_key' })
  @Get('collections/:key')
  async getCollection(@Param('key') key: string) {
    const k = decodeURIComponent(key).toLowerCase();
    let col = await this.collectionService.findOne(k);
    if (col) {
      await this.collectionService.ensurePsaTotalPopulationFromListings(k);
      await this.collectionService.ensurePoketraceCardIdFromListings(k);
      col = await this.collectionService.findOne(k);
    }
    const [listings, collectionBids, representativeImageUrl] = await Promise.all([
      this.collectionService.activeListingsForCollection(k),
      this.collectionService.activeBidsForCollection(k),
      this.collectionService.resolveRepresentativeImageForCollection(k),
    ]);
    return {
      collection: col ?? null,
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

  @ApiOperation({
    summary:
      'Orders for a token: full rows (incl. Seaport parameters). Use activeOnly=true for a single active ask.',
  })
  @ApiParam({ name: 'tokenId' })
  @ApiQuery({
    name: 'activeOnly',
    required: false,
    description: 'When true, returns one active ask or null (still includes parameters for fulfill UI)',
  })
  @Get('orders/token/:tokenId')
  findByTokenId(
    @Param('tokenId') tokenId: string,
    @Query('activeOnly') activeOnly?: string,
  ): Promise<Order[] | Order | null> {
    if (activeOnly === 'true' || activeOnly === '1') {
      return this.marketplaceService.findActiveAskByTokenId(tokenId);
    }
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
