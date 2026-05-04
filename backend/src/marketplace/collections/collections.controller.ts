import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
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
import { CardhedgerAiInsightService } from './cardhedger-ai-insight.service';
import { CardhedgerMarketDataService } from './cardhedger-market-data.service';
import { CollectionMarketService } from './collection-market.service';
import { CollectionService } from './collection.service';
import { BatchMarketSnapshotsDto } from './dto/batch-market-snapshots.dto';
import { MintPreviewsByTokenIdsDto } from './dto/mint-previews-by-token-ids.dto';
import {
  isMarketHistoryPeriod,
  marketPeriodToMaxCalendarDays,
  type MarketHistoryPeriod,
} from '../utils/price-history-period.util';

@ApiTags('marketplace')
@Controller('marketplace')
export class CollectionsController {
  constructor(
    private readonly collectionService: CollectionService,
    private readonly collectionMarketService: CollectionMarketService,
    private readonly cardMarketData: CardhedgerMarketDataService,
    private readonly aiInsight: CardhedgerAiInsightService,
  ) {}

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
  @ApiBody({
    type: BatchMarketSnapshotsDto,
    examples: {
      snapshots: {
        summary: 'Batch fetch collection list snapshots',
        value: {
          collectionKeys: [
            'ab5f1f362c9a16151b10159d3d5ca465fe8e23b7ff20169d20bf92188e292bfa',
            '22028c1276253bbe8118fe2015d8d06bace4d30ed3664c2aacc9943b4ee8aaed',
          ],
          priceHistoryDuration: '90d',
        },
      },
    },
  })
  @Post('collections/market-snapshots')
  batchMarketSnapshots(@Body() body: BatchMarketSnapshotsDto) {
    return this.collectionMarketService.batchListSnapshots(
      body.collectionKeys ?? [],
      body.priceHistoryDuration ?? '365d',
    );
  }

  @ApiOperation({
    summary: 'My Assets: batch resolve Cardhedger PSA10 references from token ids (max 32).',
  })
  @ApiBody({
    type: MintPreviewsByTokenIdsDto,
    examples: {
      mintPreview: {
        summary: 'Resolve Cardhedger previews for owned tokens',
        value: { tokenIds: [101, 102, 103] },
      },
    },
  })
  @Post('cardhedger/mint-previews')
  postMintCardhedgerPreviews(@Body() body: MintPreviewsByTokenIdsDto) {
    return this.cardMarketData.getBatchMintPreviewsFromTokenIds(body.tokenIds ?? []);
  }

  @ApiOperation({
    summary: 'Cardhedger-backed preview: matched catalog card + PSA10 spot bands.',
  })
  @ApiParam({ name: 'key', description: 'collection_key' })
  @Get('collections/:key/cardhedger')
  async getCollectionCardhedger(@Param('key') key: string) {
    const k = decodeURIComponent(key).toLowerCase();
    const col = await this.collectionService.findOne(k);
    return this.cardMarketData.getPreviewForCollection(col);
  }

  @ApiOperation({
    summary: 'Cardhedger AI market brief for this collection (card-match powered).',
  })
  @ApiParam({ name: 'key', description: 'collection_key' })
  @Get('collections/:key/ai-insight')
  async getCollectionAiInsight(@Param('key') key: string) {
    const k = decodeURIComponent(key).toLowerCase();
    const col = await this.collectionService.findOne(k);
    return this.aiInsight.getAiInsightForCollection(col);
  }

  @ApiOperation({
    summary: 'Cardhedger-backed PSA10 price history for resolved card.',
  })
  @ApiParam({ name: 'key', description: 'collection_key' })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['7d', '30d', '90d', '1y'],
    description: 'History window (default 90d)',
  })
  @ApiQuery({
    name: 'maxDays',
    required: false,
    description:
      'Nominal calendar window length passed through to history (default 365). Values above Card Hedge’s documented cap (365) are clamped for upstream calls.',
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

}
