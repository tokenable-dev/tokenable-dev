import {
  Body,
  Controller,
  Get,
  NotFoundException,
  BadRequestException,
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
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MarketplaceAdminService } from '../admin/marketplace-admin.service';
import { CardhedgerAiInsightService } from '../market-data/cardhedger-ai-insight.service';
import { CardhedgerMarketDataService } from '../market-data/cardhedger-market-data.service';
import { PortfolioMarketBatchDto } from '../portfolio/dto/portfolio-market-batch.dto';
import { CollectionMarketService } from './collection-market.service';
import { CollectionService } from './collection.service';
import { BatchMarketSnapshotsDto } from './dto/batch-market-snapshots.dto';
import { MintPreviewsByTokenIdsDto } from './dto/mint-previews-by-token-ids.dto';
import { TokenCollectionKeysDto } from './dto/token-collection-keys.dto';
import {
  AdminDeleteCollectionDto,
  AdminPreviewCollectionCoverFromTokenDto,
  AdminSetCollectionCoverDto,
} from './dto/admin-collection-cover.dto';

@ApiTags('marketplace')
@Controller('marketplace')
export class CollectionsController {
  constructor(
    private readonly collectionService: CollectionService,
    private readonly collectionMarketService: CollectionMarketService,
    private readonly cardMarketData: CardhedgerMarketDataService,
    private readonly aiInsight: CardhedgerAiInsightService,
    private readonly marketplaceAdmin: MarketplaceAdminService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Decode URL-encoded path segments (some keys may be percent-encoded) and lowercase for DB lookup. */
  private normalizeKey(raw: string): string {
    return decodeURIComponent(raw).toLowerCase();
  }

  private assertAdminWallet(adminWallet: string): void {
    this.marketplaceAdmin.assertAdminWallet(adminWallet);
  }

  @ApiOperation({ summary: 'Collection list (cursor pagination)' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Page size (default 30, max 60)',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Opaque cursor from prior page',
  })
  @Get('collections')
  listCollections(
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
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
    summary:
      'Portfolio: batch pool stats + market-series bundle per key — same JSON as GET …/collections/:key/stats and GET …/collections/:key/market-series (max 60 keys, server-side concurrency cap).',
  })
  @ApiBody({ type: PortfolioMarketBatchDto })
  @Post('collections/portfolio-market-batch')
  batchPortfolioMarketData(@Body() body: PortfolioMarketBatchDto) {
    const keys = (body.collectionKeys ?? []).map((k) => this.normalizeKey(k));
    const duration = body.priceHistoryDuration ?? '365d';
    return this.collectionMarketService.batchPortfolioMarketData(keys, {
      priceHistoryDuration: duration,
    });
  }

  @ApiOperation({
    summary:
      'Resolve marketplace collection_key by token IDs for portfolio (uses cached rwa_tokens first; read-only metadata hash fallback when missing).',
  })
  @ApiBody({ type: TokenCollectionKeysDto })
  @Post('collections/token-collection-keys')
  async batchTokenCollectionKeys(@Body() body: TokenCollectionKeysDto) {
    const tokenIds = [
      ...new Set((body.tokenIds ?? []).map((n) => Math.floor(Number(n)))),
    ].filter((n) => Number.isFinite(n) && n >= 0);
    if (tokenIds.length === 0) return { items: {} as Record<number, string> };

    const cached = await this.collectionService.collectionKeysByTokenIds(tokenIds);
    const out: Record<number, string> = { ...cached };
    const missing = tokenIds.filter((id) => !out[id]);
    const RESOLVE_CONCURRENCY = 4;
    for (let i = 0; i < missing.length; i += RESOLVE_CONCURRENCY) {
      const chunk = missing.slice(i, i + RESOLVE_CONCURRENCY);
      await Promise.all(
        chunk.map(async (tokenId) => {
          try {
            const k =
              await this.collectionService.resolveCollectionKeyFromTokenMetadata(
                String(tokenId),
              );
            if (k) out[tokenId] = k.toLowerCase();
          } catch {
            // Keep partial success; frontend can still fall back per-token preview.
          }
        }),
      );
    }
    return { items: out };
  }

  @ApiOperation({
    summary:
      'My Assets: batch resolve Cardhedger PSA10 references from token ids (max 32).',
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
    return this.cardMarketData.getBatchMintPreviewsFromTokenIds(
      body.tokenIds ?? [],
    );
  }

  @ApiOperation({
    summary:
      'Cardhedger AI market brief for this collection (card-match powered).',
  })
  @ApiParam({ name: 'key', description: 'collection_key' })
  @Get('collections/:key/ai-insight')
  async getCollectionAiInsight(@Param('key') key: string) {
    const k = this.normalizeKey(key);
    const col = await this.collectionService.findOne(k);
    return this.aiInsight.getAiInsightForCollection(col);
  }

  @ApiOperation({
    summary:
      'Chart bundle: platform fills (USDC) + Cardhedger-backed reference prices and window % change. Includes `cardhedgerPreview` (same Cardhedger resolve as the chart) — prefer this over a separate GET …/cardhedger for collection UIs. Listing-pool statistics: GET …/collections/:key/stats.',
  })
  @ApiParam({ name: 'key', description: 'collection_key' })
  @Get('collections/:key/market-series')
  getCollectionMarketSeries(
    @Param('key') key: string,
    @Query('priceHistoryDuration') priceHistoryDuration?: string,
  ) {
    const d = ['7d', '30d', '90d', '180d', '365d', 'max'].includes(
      String(priceHistoryDuration),
    )
      ? (priceHistoryDuration as
          | '7d'
          | '30d'
          | '90d'
          | '180d'
          | '365d'
          | 'max')
      : '365d';
    return this.collectionMarketService.getCollectionMarketBundle(
      this.normalizeKey(key),
      d,
    );
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
    return this.collectionMarketService.getCollectionMarketStats(
      this.normalizeKey(key),
    );
  }

  @ApiOperation({
    summary:
      'Collection detail + order book (listings + collection bids). `collection` is null when no `marketplace_collections` row yet (same key may still have orders); avoids 404 for client prefetch.',
  })
  @ApiParam({ name: 'key', description: 'collection_key' })
  @Get('collections/:key')
  async getCollection(@Param('key') key: string) {
    const k = this.normalizeKey(key);
    let col = await this.collectionService.findOne(k);
    if (col) {
      await this.collectionService.ensurePsaTotalPopulationFromListings(k);
      // PSA spec pop report (Grade10 + Total) — persisted on components when missing.
      await this.collectionService.ensurePsaSpecPopulationFromApi(k);
      await this.collectionService.ensurePsaCertNumberFromListings(k);
      const cardhedgerUpdated =
        await this.collectionService.ensureCardhedgerCardIdFromListings(k);
      if (cardhedgerUpdated) {
        this.eventEmitter.emit('snapshot.enqueue', { key: k, reason: 'manual' });
      }
      await this.collectionService.ensureListingDisplayTitleFromListings(k);
      col = await this.collectionService.findOne(k);
    }

    const needsFirstCover =
      col != null && !(col.coverImageUrl?.trim() ?? '');

    // Single fetch for asks/bids; share the same promises with cover resolution (no duplicate listing queries).
    const listingsPromise =
      this.collectionService.activeListingsForCollection(k);
    const bidsPromise = this.collectionService.activeBidsForCollection(k);

    const coverFinishPromise = needsFirstCover
      ? Promise.all([listingsPromise, bidsPromise]).then(
          ([listings, collectionBids]) =>
            Promise.race([
              this.collectionService.resolveRepresentativeImageForCollection(
                k,
                {
                  asks: listings,
                  bids: collectionBids,
                },
              ),
              new Promise<null>((resolve) =>
                setTimeout(() => resolve(null), 15_000),
              ),
            ]),
        )
      : Promise.resolve(null);

    const [listings, collectionBids] = await Promise.all([
      listingsPromise,
      bidsPromise,
    ]);
    await coverFinishPromise;

    if (needsFirstCover) {
      const refreshed = await this.collectionService.findOne(k);
      if (refreshed) col = refreshed;
    }

    const representativeImageUrl = col?.coverImageUrl?.trim() ?? null;

    return {
      collection: col ?? null,
      listings,
      collectionBids,
      representativeImageUrl,
    };
  }

  @ApiOperation({
    summary:
      'Admin: set collection cover URL (requires MARKETPLACE_ADMIN_WALLETS wallet in body)',
  })
  @ApiParam({ name: 'key', description: 'collection_key' })
  @Post('collections/:key/admin/cover')
  async adminSetCollectionCover(
    @Param('key') key: string,
    @Body() body: AdminSetCollectionCoverDto,
  ) {
    this.assertAdminWallet(body.adminWallet);
    const k = this.normalizeKey(key);
    try {
      const col = await this.collectionService.setCollectionCoverImageAdmin(
        k,
        body.coverImageUrl,
      );
      return {
        collectionKey: col.collectionKey,
        coverImageUrl: col.coverImageUrl,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'COLLECTION_NOT_FOUND') {
        throw new NotFoundException('Collection not found');
      }
      if (
        msg === 'COLLECTION_COVER_URL_EMPTY' ||
        msg === 'COLLECTION_COVER_URL_INVALID'
      ) {
        throw new BadRequestException('Invalid cover image URL');
      }
      throw e;
    }
  }

  @ApiOperation({
    summary:
      'Admin: resolve cover from token metadata (Cardhedger / PSA / TCG). Optional save=true persists.',
  })
  @ApiParam({ name: 'key', description: 'collection_key' })
  @Post('collections/:key/admin/cover/from-token')
  async adminCollectionCoverFromToken(
    @Param('key') key: string,
    @Body() body: AdminPreviewCollectionCoverFromTokenDto,
  ) {
    this.assertAdminWallet(body.adminWallet);
    const k = this.normalizeKey(key);
    const col = await this.collectionService.findOne(k);
    if (!col) {
      throw new NotFoundException('Collection not found');
    }
    const coverImageUrl =
      await this.collectionService.adminPreviewCoverFromToken(
        body.tokenId.trim(),
        k,
      );
    if (!coverImageUrl) {
      return { coverImageUrl: null, saved: false };
    }
    if (body.save) {
      const updated = await this.collectionService.setCollectionCoverImageAdmin(
        k,
        coverImageUrl,
      );
      return {
        coverImageUrl: updated.coverImageUrl,
        saved: true,
      };
    }
    return { coverImageUrl, saved: false };
  }

  @ApiOperation({
    summary:
      'Admin: permanently delete collection bucket (snapshots, orders, rwa_tokens row, marketplace_collections)',
  })
  @ApiParam({ name: 'key', description: 'collection_key' })
  @Post('collections/:key/admin/delete')
  async adminDeleteCollection(
    @Param('key') key: string,
    @Body() body: AdminDeleteCollectionDto,
  ) {
    this.assertAdminWallet(body.adminWallet);
    const k = this.normalizeKey(key);
    const confirm = body.confirmCollectionKey.trim().toLowerCase();
    if (confirm !== k) {
      throw new BadRequestException(
        'confirmCollectionKey must match the collection key in the URL',
      );
    }
    try {
      return await this.collectionService.adminDeleteCollectionCompletely(k);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'COLLECTION_NOT_FOUND') {
        throw new NotFoundException('Collection not found');
      }
      throw e;
    }
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
