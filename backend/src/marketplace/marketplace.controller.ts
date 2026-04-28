import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CardhedgerMarketDataService } from './cardhedger-market-data.service';
import {
  isMarketHistoryPeriod,
  marketPeriodToMaxCalendarDays,
  type MarketHistoryPeriod,
} from './price-history-period.util';
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
import { HiddenAssetsService } from './hidden-assets.service';
import { Order } from './entities/order.entity';
import { MarketplaceService } from './marketplace.service';

@ApiTags('marketplace')
@Controller('marketplace')
export class MarketplaceController {
  constructor(
    private readonly marketplaceService: MarketplaceService,
    private readonly collectionService: CollectionService,
    private readonly collectionMarketService: CollectionMarketService,
    private readonly cardMarketData: CardhedgerMarketDataService,
    private readonly hiddenAssetsService: HiddenAssetsService,
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
  @ApiQuery({ name: 'limit', required: false, description: 'Page size (default 30, max 60)' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Opaque cursor from prior page' })
  @Get('collections')
  listCollections(@Query('limit') limitRaw?: string, @Query('cursor') cursor?: string) {
    const parsed =
      limitRaw != null && String(limitRaw).trim() !== ''
        ? parseInt(String(limitRaw), 10)
        : 30;
    const limit = Number.isFinite(parsed) ? parsed : 30;
    return this.collectionService.listSummariesPaged({
      limit,
      cursor: cursor?.trim() || null,
    });
  }

  @ApiOperation({
    summary:
      'Batch list-row snapshots: Cardhedger-backed grade strip + category + external sparkline when history is available. Pool floor/median/band/vol: use GET …/collections/:key/stats or `marketStats` on each item when present.',
  })
  @ApiBody({ type: BatchMarketSnapshotsDto })
  @Post('collections/market-snapshots')
  batchMarketSnapshots(@Body() body: BatchMarketSnapshotsDto) {
    return this.collectionMarketService.batchListSnapshots(
      body.collectionKeys ?? [],
      body.priceHistoryDuration ?? '365d',
    );
  }

  @ApiOperation({
    summary:
      'Cardhedger-backed preview: matched catalog card + PSA10 spot bands.',
  })
  @ApiParam({ name: 'key', description: 'collection_key' })
  @Get('collections/:key/cardhedger')
  async getCollectionCardhedger(@Param('key') key: string) {
    const k = decodeURIComponent(key).toLowerCase();
    const col = await this.collectionService.findOne(k);
    return this.cardMarketData.getPreviewForCollection(col);
  }

  @ApiOperation({
    summary:
      'Cardhedger AI market brief for this collection (card-match powered).',
  })
  @ApiParam({ name: 'key', description: 'collection_key' })
  @Get('collections/:key/ai-insight')
  async getCollectionAiInsight(@Param('key') key: string) {
    const k = decodeURIComponent(key).toLowerCase();
    const col = await this.collectionService.findOne(k);
    return this.cardMarketData.getAiInsightForCollection(col);
  }

  @ApiOperation({
    summary:
      'Cardhedger-backed PSA10 price history for resolved card.',
  })
  @ApiParam({ name: 'key', description: 'collection_key' })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['7d', '30d', '90d', '1y', 'all'],
    description: 'History window (default 90d)',
  })
  @ApiQuery({
    name: 'maxDays',
    required: false,
    description:
      'Optional post-fetch UTC-day trim (1–4000). Defaults to span implied by `period`.',
  })
  @Get('collections/:key/cardhedger/price-history')
  async getCollectionCardhedgerPriceHistory(
    @Param('key') key: string,
    @Query('period') periodRaw?: string,
    @Query('maxDays') maxDaysRaw?: string,
  ) {
    const k = decodeURIComponent(key).toLowerCase();
    const col = await this.collectionService.findOne(k);
    const periodStr = String(periodRaw ?? '90d');
    const period: MarketHistoryPeriod = isMarketHistoryPeriod(periodStr)
      ? periodStr
      : '90d';
    const parsedMax =
      maxDaysRaw != null && String(maxDaysRaw).trim() !== ''
        ? parseInt(String(maxDaysRaw), 10)
        : NaN;
    const maxCalendarDays = Number.isFinite(parsedMax)
      ? Math.min(4000, Math.max(1, parsedMax))
      : marketPeriodToMaxCalendarDays(period);
    return this.cardMarketData.getTierPriceHistoryForCollection(col, {
      tier: 'PSA_10',
      period,
      maxCalendarDays,
      maxRequests: 5,
    });
  }

  @ApiOperation({
    summary:
      'My Assets: batch resolve Cardhedger PSA10 references from token ids (max 32).',
  })
  @ApiBody({ type: MintPreviewsByTokenIdsDto })
  @Post('cardhedger/mint-previews')
  postMintCardhedgerPreviews(@Body() body: MintPreviewsByTokenIdsDto) {
    return this.cardMarketData.getBatchMintPreviewsFromTokenIds(body.tokenIds ?? []);
  }

  @ApiOperation({
    summary:
      'Chart bundle: platform fills (USDC) + Cardhedger-backed reference prices and window % change. Listing-pool statistics: GET …/collections/:key/stats.',
  })
  @ApiParam({ name: 'key', description: 'collection_key' })
  @Get('collections/:key/market-series')
  getCollectionMarketSeries(
    @Param('key') key: string,
    @Query('priceHistoryDuration') priceHistoryDuration?: string,
    @Query('hintTokenId') hintTokenId?: string,
  ) {
    const d = ['7d', '30d', '90d', '180d', '365d'].includes(String(priceHistoryDuration))
      ? (priceHistoryDuration as '7d' | '30d' | '90d' | '180d' | '365d')
      : '365d';
    const hint =
      hintTokenId != null && /^\d+$/.test(String(hintTokenId).trim())
        ? String(hintTokenId).trim()
        : undefined;
    return this.collectionMarketService.getCollectionMarketBundle(key, d, hint);
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
      'Collection market pool statistics (USDC only): Tukey IQR trim, floor = 10th percentile on trimmed set, volatility = sample stdev on trimmed set. sampleSize < 5 → numeric fields null and isReliable false. `reference.cardhedgerCardId` is metadata only.',
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
      await this.collectionService.ensureCardhedgerCardIdFromListings(k);
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

  @ApiOperation({ summary: 'My Assets: list hidden tokenIds for a wallet' })
  @ApiQuery({ name: 'walletAddress', required: true })
  @Get('my-assets/hidden')
  listHiddenAssetTokenIds(@Query('walletAddress') walletAddress?: string) {
    const w = walletAddress?.trim() ?? '';
    if (!w) throw new BadRequestException('walletAddress is required');
    return this.hiddenAssetsService.listTokenIds(w).then((tokenIds) => ({ tokenIds }));
  }

  @ApiOperation({ summary: 'My Assets: hide token from portfolio view' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['walletAddress', 'tokenId'],
      properties: {
        walletAddress: { type: 'string' },
        tokenId: { type: 'number' },
      },
    },
  })
  @Post('my-assets/hidden')
  hideAsset(@Body() body: { walletAddress?: string; tokenId?: number }) {
    const w = body.walletAddress?.trim() ?? '';
    const tokenId = Number(body.tokenId);
    if (!w) throw new BadRequestException('walletAddress is required');
    if (!Number.isFinite(tokenId) || tokenId < 0) {
      throw new BadRequestException('tokenId must be a non-negative number');
    }
    return this.hiddenAssetsService.hide(w, tokenId);
  }

  @ApiOperation({ summary: 'My Assets: unhide token from portfolio view' })
  @ApiQuery({ name: 'walletAddress', required: true })
  @ApiQuery({ name: 'tokenId', required: true })
  @Patch('my-assets/hidden')
  unhideAsset(
    @Query('walletAddress') walletAddress?: string,
    @Query('tokenId') tokenIdRaw?: string,
  ) {
    const w = walletAddress?.trim() ?? '';
    const tokenId = Number(tokenIdRaw);
    if (!w) throw new BadRequestException('walletAddress is required');
    if (!Number.isFinite(tokenId) || tokenId < 0) {
      throw new BadRequestException('tokenId must be a non-negative number');
    }
    return this.hiddenAssetsService.unhide(w, tokenId);
  }
}
