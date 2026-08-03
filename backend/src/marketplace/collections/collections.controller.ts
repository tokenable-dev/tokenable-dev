import {
  Body,
  Controller,
  Get,
  Headers,
  Header,
  Logger,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
  Param,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Request } from 'express';
import { MarketplaceAdminService } from '../admin/marketplace-admin.service';
import { CardhedgerAiInsightService } from '../market-data/cardhedger-ai-insight.service';
import type { AiInsightPlatformContext } from '../market-data/cardhedger-ai-insight.types';
import { CardhedgerMarketDataService } from '../market-data/cardhedger-market-data.service';
import { PortfolioMarketBatchDto } from '../portfolio/dto/portfolio-market-batch.dto';
import { CATALOG_COVER_MAX_BYTES } from './catalog-cover-s3.service';
import { CatalogCoverS3Service } from './catalog-cover-s3.service';
import { CollectionMarketService } from './collection-market.service';
import { CollectionService } from './collection.service';
import { MintEventListenerService } from './mint-event-listener.service';
import { pickCollectionDisplayImageUrl } from '../utils/collection-image.util';
import { BatchMarketSnapshotsDto } from './dto/batch-market-snapshots.dto';
import { MintPreviewsByTokenIdsDto } from './dto/mint-previews-by-token-ids.dto';
import { TokenCollectionKeysDto } from './dto/token-collection-keys.dto';
import {
  AdminDeleteCollectionDto,
  AdminPreviewCollectionCoverFromTokenDto,
  AdminSetCollectionCoverDto,
  AdminSetCollectionReviewStatusDto,
} from './dto/admin-collection-cover.dto';
import { AdminCreateCatalogCollectionDto } from './dto/admin-create-catalog-collection.dto';
import type { CollectionReviewStatus } from '../entities/marketplace-collection.entity';
import { apiBodyDefault } from '../../swagger/api-body.util';
import { SWAGGER_BODY_EXAMPLES } from '../../swagger/examples';
import { SWAGGER_FIXTURES } from '../../swagger/fixtures';
import { MarketplacePartnersService } from '../partners/marketplace-partners.service';
import {
  CHAIN_ID_HEADER,
  ChainConfigService,
} from '../../blockchain/chain-config.service';
import { ApiChainIdHeader } from '../../swagger/api-headers.util';

/**
 * 컬렉션·시장 데이터·Cardhedger 연동·관리자 커버/삭제.
 */
@ApiTags('marketplace')
@ApiChainIdHeader()
@Controller('marketplace')
export class CollectionsController {
  private readonly logger = new Logger(CollectionsController.name);

  constructor(
    private readonly collectionService: CollectionService,
    private readonly collectionMarketService: CollectionMarketService,
    private readonly cardMarketData: CardhedgerMarketDataService,
    private readonly aiInsight: CardhedgerAiInsightService,
    private readonly marketplaceAdmin: MarketplaceAdminService,
    private readonly eventEmitter: EventEmitter2,
    private readonly mintEventListener: MintEventListenerService,
    private readonly chainConfig: ChainConfigService,
    private readonly partners: MarketplacePartnersService,
    private readonly catalogCoverS3: CatalogCoverS3Service,
  ) {}

  /** Decode URL-encoded path segments (some keys may be percent-encoded) and lowercase for DB lookup. */
  private normalizeKey(raw: string): string {
    return decodeURIComponent(raw).toLowerCase();
  }

  private assertAdminSession(req: Request): void {
    this.marketplaceAdmin.assertAdminSession(req);
  }

  /**
   * Front-end hook after mint tx confirms. Syncs `rwa_tokens` only; collection
   * rows are created when the owner lists the token for sale (first ask).
   */
  @ApiOperation({ summary: '민트 완료 알림 (rwa_tokens 동기화)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['tokenId'],
      properties: { tokenId: { type: 'integer', example: 42 } },
    },
  })
  @Post('collections/on-mint')
  async postOnMint(
    @Body() body: {
      tokenId?: unknown;
    },
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ): Promise<{
    accepted: boolean;
    collectionKey: string | null;
    bootstrapped: boolean;
  }> {
    const tid = Math.floor(Number(body?.tokenId));
    if (!Number.isFinite(tid) || tid < 0) {
      throw new BadRequestException('tokenId is required');
    }

    try {
      const collectionKey = await this.mintEventListener.handleMintedToken(
        tid,
        this.chainConfig.resolveChainId(chainHeader),
      );
      const key = collectionKey?.trim().toLowerCase() || null;
      return {
        accepted: true,
        collectionKey: key,
        bootstrapped: Boolean(key),
      };
    } catch (err: unknown) {
      this.logger.warn(`on-mint bootstrap failed for #${tid}: ${String(err)}`);
      return {
        accepted: true,
        collectionKey: null,
        bootstrapped: false,
      };
    }
  }

  /**
   * Same-origin catalog cover bytes for WebGL / canvas (S3 public bucket has no CORS).
   * Only URLs under `CATALOG_COVER_PUBLIC_BASE_URL` are allowed.
   */
  @ApiOperation({
    summary: 'Proxy catalog cover image (same-origin for WebGL textures)',
  })
  @ApiQuery({
    name: 'src',
    required: true,
    description: 'Absolute catalog cover public URL',
  })
  @Get('catalog-covers/asset')
  @Header('Cache-Control', 'public, max-age=300, must-revalidate')
  async proxyCatalogCoverAsset(
    @Query('src') srcRaw?: string,
  ): Promise<StreamableFile> {
    const src = (srcRaw ?? '').trim();
    if (!src) {
      throw new BadRequestException('src is required');
    }
    if (!this.catalogCoverS3.isConfigured()) {
      throw new ServiceUnavailableException(
        'Catalog cover S3 is not configured (set CATALOG_COVER_S3_BUCKET and CATALOG_COVER_PUBLIC_BASE_URL)',
      );
    }
    try {
      const { body, contentType } =
        await this.catalogCoverS3.fetchAllowedPublicCover(src);
      return new StreamableFile(body, {
        type: contentType,
        disposition: 'inline',
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'CATALOG_COVER_URL_NOT_ALLOWED') {
        throw new BadRequestException('Cover URL is not an allowed catalog cover');
      }
      if (
        msg === 'CATALOG_COVER_FETCH_FAILED' ||
        msg === 'CATALOG_COVER_FILE_EMPTY' ||
        msg === 'CATALOG_COVER_FILE_TYPE_INVALID' ||
        msg === 'CATALOG_COVER_FILE_TOO_LARGE'
      ) {
        throw new BadRequestException('Could not load catalog cover image');
      }
      if (msg === 'CATALOG_COVER_S3_NOT_CONFIGURED') {
        throw new ServiceUnavailableException(
          'Catalog cover S3 is not configured (set CATALOG_COVER_S3_BUCKET and CATALOG_COVER_PUBLIC_BASE_URL)',
        );
      }
      throw e;
    }
  }

  /** 컬렉션 목록 (커서 페이지). Public: active only. Admin cookie + reviewStatus filter for moderation. */
  @ApiOperation({ summary: '컬렉션 목록' })
  @ApiQuery({ name: 'limit', required: false, example: 30, description: '페이지당 건수' })
  @ApiQuery({ name: 'cursor', required: false, example: '', description: '다음 페이지 커서' })
  @ApiQuery({
    name: 'q',
    required: false,
    example: 'charizard',
    description:
      'Free-text search (label, set, player/subject, cert, …). When set, cursor is ignored; max 40 results.',
  })
  @ApiQuery({
    name: 'reviewStatus',
    required: false,
    example: 'active',
    description:
      'Public always active. With admin session: pending_review | active | rejected | all',
  })
  @Get('collections')
  listCollections(
    @Req() req: Request,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
    @Query('q') qRaw?: string,
    @Query('reviewStatus') reviewStatusRaw?: string,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    const parsed =
      limitRaw != null && String(limitRaw).trim() !== ''
        ? parseInt(String(limitRaw), 10)
        : 30;
    const limit = Number.isFinite(parsed) ? parsed : 30;
    const isAdmin = this.marketplaceAdmin.hasAdminSession(req);
    const raw = (reviewStatusRaw ?? '').trim().toLowerCase();
    const allowed = new Set([
      'pending_review',
      'active',
      'rejected',
      'all',
    ]);
    const reviewStatus =
      isAdmin && allowed.has(raw)
        ? (raw as 'pending_review' | 'active' | 'rejected' | 'all')
        : 'active';
    return this.collectionService.listSummariesPaged({
      limit,
      cursor: cursor?.trim() || null,
      chainId: this.chainConfig.resolveChainId(chainHeader),
      reviewStatus,
      q: qRaw?.trim() || null,
    });
  }

  /** Admin: counts by review_status for Collections filter chips */
  @ApiOperation({ summary: '[Admin] 컬렉션 review_status 카운트' })
  @Get('collections/admin/review-counts')
  async adminCollectionReviewCounts(
    @Req() req: Request,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    this.assertAdminSession(req);
    return this.collectionService.countByReviewStatus(
      this.chainConfig.resolveChainId(chainHeader),
    );
  }

  /**
   * Admin: create a collection bucket from a PSA cert (no mint / ask).
   * Starts as pending_review — Approve to show on Markets.
   */
  @ApiOperation({
    summary: '[Admin] PSA cert로 카탈로그 컬렉션 생성 (민트/리스팅 불필요)',
  })
  @ApiBody({ type: AdminCreateCatalogCollectionDto })
  @Post('collections/admin/create-from-cert')
  async adminCreateCatalogCollectionFromCert(
    @Req() req: Request,
    @Body() body: AdminCreateCatalogCollectionDto,
  ) {
    this.assertAdminSession(req);
    try {
      return await this.collectionService.createCatalogCollectionFromPsaCert(
        body.certNumber,
      );
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`admin create-from-cert failed: ${msg}`);
      throw new BadRequestException(
        msg.length > 200 ? 'Failed to create collection from PSA cert' : msg,
      );
    }
  }

  /** 목록용 시장 스냅샷 배치 (등급·스파크라인 등) */
  @ApiOperation({ summary: '컬렉션 목록 시장 스냅샷 배치' })
  @ApiBody(apiBodyDefault(BatchMarketSnapshotsDto, SWAGGER_BODY_EXAMPLES.batchMarketSnapshots))
  @Post('collections/market-snapshots')
  batchMarketSnapshots(
    @Body() body: BatchMarketSnapshotsDto,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    return this.collectionMarketService.batchListSnapshots(
      body.collectionKeys ?? [],
      body.priceHistoryDuration ?? '365d',
      this.chainConfig.resolveChainId(chainHeader),
    );
  }

  /** 포트폴리오용 stats+차트 시리즈 배치 (키당 최대 60) */
  @ApiOperation({ summary: '포트폴리오 시장 데이터 배치' })
  @ApiBody(apiBodyDefault(PortfolioMarketBatchDto, SWAGGER_BODY_EXAMPLES.portfolioMarketBatch))
  @Post('collections/portfolio-market-batch')
  batchPortfolioMarketData(
    @Body() body: PortfolioMarketBatchDto,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    const keys = (body.collectionKeys ?? []).map((k) => this.normalizeKey(k));
    const duration = body.priceHistoryDuration ?? '365d';
    return this.collectionMarketService.batchPortfolioMarketData(keys, {
      priceHistoryDuration: duration,
      chainId: this.chainConfig.resolveChainId(chainHeader),
    });
  }

  /** tokenId → collection_key 매핑 (캐시·메타 fallback) */
  @ApiOperation({ summary: 'tokenId별 collection_key 배치' })
  @ApiBody(apiBodyDefault(TokenCollectionKeysDto, SWAGGER_BODY_EXAMPLES.tokenCollectionKeys))
  @Post('collections/token-collection-keys')
  async batchTokenCollectionKeys(
    @Body() body: TokenCollectionKeysDto,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    const tokenIds = [
      ...new Set((body.tokenIds ?? []).map((n) => Math.floor(Number(n)))),
    ].filter((n) => Number.isFinite(n) && n >= 0);
    if (tokenIds.length === 0) return { items: {} as Record<number, string> };

    const cached = await this.collectionService.collectionKeysByTokenIds(
      tokenIds,
      this.chainConfig.resolveChainId(chainHeader),
    );
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
                this.chainConfig.resolveChainId(chainHeader),
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

  /** RWA card detail trades — platform fills + Cardhedger comps (no collection row required). */
  @ApiOperation({ summary: 'RWA token trades tape (platform + Cardhedger comps)' })
  @ApiParam({ name: 'tokenId', description: 'RWA tokenId', example: 1 })
  @ApiQuery({
    name: 'grade',
    required: false,
    description: 'Cardhedger grade label for comps (e.g. PSA 10). Defaults from mint metadata.',
  })
  @Get('rwa/:tokenId/trades')
  getRwaTokenTrades(
    @Param('tokenId') tokenId: string,
    @Query('grade') grade?: string,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    const id = Number(tokenId);
    if (!Number.isFinite(id) || id < 0) {
      throw new BadRequestException('Invalid token id');
    }
    return this.collectionMarketService.rwaTradesForApi(
      Math.floor(id),
      {
        cardhedgerGrade: grade?.trim() || undefined,
      },
      this.chainConfig.resolveChainId(chainHeader),
    );
  }

  /** My Assets: tokenId별 Cardhedger PSA10 프리뷰 (최대 32) */
  @ApiOperation({ summary: '민트 Cardhedger 프리뷰 배치' })
  @ApiBody(apiBodyDefault(MintPreviewsByTokenIdsDto, SWAGGER_BODY_EXAMPLES.mintPreviews))
  @Post('cardhedger/mint-previews')
  postMintCardhedgerPreviews(
    @Body() body: MintPreviewsByTokenIdsDto,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    return this.cardMarketData.getBatchMintPreviewsFromTokenIds(
      body.tokenIds ?? [],
      this.chainConfig.resolveChainId(chainHeader),
    );
  }

  /** 컬렉션 AI 시장 브리프 */
  @ApiOperation({ summary: '컬렉션 AI 인사이트' })
  @ApiParam({ name: 'key', description: 'collection_key', example: SWAGGER_FIXTURES.collectionKey })
  @Get('collections/:key/ai-insight')
  async getCollectionAiInsight(
    @Param('key') key: string,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    const k = this.normalizeKey(key);
    const chainId = this.chainConfig.resolveChainId(chainHeader);
    const col = await this.collectionService.findOne(k);
    if (!col) {
      return this.aiInsight.getAiInsightForCollection(null);
    }

    const [marketStats, listingPrices] = await Promise.all([
      this.collectionMarketService.getCollectionMarketStats(k, chainId),
      this.collectionMarketService.getActiveListingUsdcPrices(k, chainId),
    ]);

    const platform: AiInsightPlatformContext = {
      activeListingCount: marketStats.sampleSize,
      floorUsd: marketStats.floor,
      medianUsd: marketStats.median,
      sampleSize: marketStats.sampleSize,
      listingPricesUsd: listingPrices,
    };

    return this.aiInsight.getAiInsightForCollection(col, { platform });
  }

  /** 차트용: 플랫폼 체결 + Cardhedger 참조가·기간 변동률 */
  @ApiOperation({ summary: '컬렉션 시장 시리즈 (차트)' })
  @ApiParam({ name: 'key', description: 'collection_key', example: SWAGGER_FIXTURES.collectionKey })
  @ApiQuery({
    name: 'priceHistoryDuration',
    required: false,
    example: '365d',
    description: '가격 이력 기간',
    enum: ['7d', '30d', '90d', '180d', '365d', 'max'],
  })
  @Get('collections/:key/market-series')
  getCollectionMarketSeries(
    @Param('key') key: string,
    @Query('priceHistoryDuration') priceHistoryDuration?: string,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
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
      this.chainConfig.resolveChainId(chainHeader),
    );
  }

  /** Cardhedger 전 등급·전 그레이더 최신가 (차트 grade picker) */
  @ApiOperation({ summary: '컬렉션 Cardhedger 전 등급 카탈로그' })
  @ApiParam({ name: 'key', description: 'collection_key', example: SWAGGER_FIXTURES.collectionKey })
  @ApiQuery({
    name: 'live',
    required: false,
    description: '1/true — prefer live all-prices-by-card over snapshot map',
  })
  @Get('collections/:key/grade-catalog')
  getCollectionGradeCatalog(
    @Param('key') key: string,
    @Query('live') live?: string,
  ) {
    const preferLive = live === '1' || live === 'true';
    return this.collectionMarketService.getCollectionGradeCatalog(
      this.normalizeKey(key),
      { preferLive },
    );
  }

  /** Cardhedger 등급별 가격 시계열 (PSA 10, BGS 9.5, Ungraded, …) */
  @ApiOperation({ summary: '컬렉션 등급별 Cardhedger 가격 시계열' })
  @ApiParam({ name: 'key', description: 'collection_key', example: SWAGGER_FIXTURES.collectionKey })
  @ApiQuery({ name: 'grade', required: true, example: 'PSA 10' })
  @ApiQuery({ name: 'days', required: false, example: 365 })
  @Get('collections/:key/grade-series')
  getCollectionGradePriceSeries(
    @Param('key') key: string,
    @Query('grade') grade?: string,
    @Query('days') days?: string,
  ) {
    if (!grade?.trim()) {
      throw new BadRequestException('grade query parameter is required');
    }
    const daysNum = Number(days ?? 365);
    return this.collectionMarketService.getCollectionGradePriceSeries(
      this.normalizeKey(key),
      grade.trim(),
      Number.isFinite(daysNum) ? daysNum : 365,
    );
  }

  /** Trades 탭: 플랫폼 체결 + Cardhedger comps (최대 100건) */
  @ApiOperation({ summary: '컬렉션 체결·comps (Trades)' })
  @ApiParam({ name: 'key', description: 'collection_key', example: SWAGGER_FIXTURES.collectionKey })
  @ApiQuery({
    name: 'bootstrapTokenId',
    required: false,
    description:
      'When marketplace_collections row is missing, ensure it from this RWA tokenId before Cardhedger comps (e.g. portfolio → list for sale).',
  })
  @ApiQuery({
    name: 'grade',
    required: false,
    description:
      'Cardhedger grade label for comps in the trades tape (e.g. PSA 10, BGS 9.5). Defaults to collection slab tier.',
  })
  @Get('collections/:key/platform-trades')
  getCollectionPlatformTrades(
    @Param('key') key: string,
    @Query('bootstrapTokenId') bootstrapTokenId?: string,
    @Query('grade') grade?: string,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    const tid = bootstrapTokenId != null ? Number(bootstrapTokenId) : NaN;
    const gradeLabel = grade?.trim() || undefined;
    return this.collectionMarketService.platformTradesForApi(
      this.normalizeKey(key),
      {
        bootstrapTokenId:
          Number.isFinite(tid) && tid >= 0 ? Math.floor(tid) : undefined,
        cardhedgerGrade: gradeLabel,
      },
      this.chainConfig.resolveChainId(chainHeader),
    );
  }

  /** listing 풀 통계 (floor·median·변동성 등, USDC) */
  @ApiOperation({ summary: '컬렉션 시장 통계' })
  @ApiParam({ name: 'key', description: 'collection_key', example: SWAGGER_FIXTURES.collectionKey })
  @Get('collections/:key/stats')
  getCollectionMarketStats(
    @Param('key') key: string,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    return this.collectionMarketService.getCollectionMarketStats(
      this.normalizeKey(key),
      this.chainConfig.resolveChainId(chainHeader),
    );
  }

  /** 컬렉션 상세 + 호가 (listings·collection bids) */
  @ApiOperation({ summary: '컬렉션 상세·오더북' })
  @ApiParam({ name: 'key', description: 'collection_key', example: SWAGGER_FIXTURES.collectionKey })
  @Get('collections/:key')
  async getCollection(
    @Param('key') key: string,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    const k = this.normalizeKey(key);
    const chainId = this.chainConfig.resolveChainId(chainHeader);
    let col = await this.collectionService.findOne(k);
    if (col) {
      await this.collectionService.ensurePsaTotalPopulationFromListings(
        k,
        chainId,
      );
      // Mint-only PSA: no live Public API on read (mirror/pop must already be on components).
      await this.collectionService.persistPsaMirrorFromCertToDb(k);
      await this.collectionService.ensurePsaSpecPopulationOnReadIfMissing(k);
      await this.collectionService.ensurePsaCertNumberFromListings(k, {
        chainId,
      });
      const cardhedgerUpdated =
        await this.collectionService.ensureCardhedgerCardIdFromListings(
          k,
          chainId,
        );
      if (cardhedgerUpdated) {
        this.eventEmitter.emit('snapshot.enqueue', { key: k, reason: 'manual' });
      }
      await this.collectionService.ensureListingDisplayTitleFromListings(
        k,
        chainId,
      );
      col = await this.collectionService.findOne(k);
    }

    const [listingsRaw, collectionBids] = await Promise.all([
      this.collectionService.activeListingsForCollection(k, chainId),
      this.collectionService.activeBidsForCollection(k, chainId),
    ]);

    const sellerNames = await this.partners.resolveDisplayNamesByWallets(
      listingsRaw.map((o) => o.offerer),
    );
    const listings = listingsRaw.map((o) =>
      Object.assign(o, {
        sellerDisplayName:
          sellerNames.get(String(o.offerer).toLowerCase()) ?? null,
      }),
    );

    const representativeImageUrl = col
      ? pickCollectionDisplayImageUrl(col.coverImageUrl)
      : null;

    return {
      collection: col ?? null,
      listings,
      collectionBids,
      representativeImageUrl,
    };
  }

  /** 관리자: 커버 이미지 URL 설정 */
  @ApiOperation({ summary: '[Admin] 커버 URL 설정' })
  @ApiParam({ name: 'key', description: 'collection_key', example: SWAGGER_FIXTURES.collectionKey })
  @ApiBody(apiBodyDefault(AdminSetCollectionCoverDto, SWAGGER_BODY_EXAMPLES.adminSetCover))
  @Post('collections/:key/admin/cover')
  async adminSetCollectionCover(
    @Req() req: Request,
    @Param('key') key: string,
    @Body() body: AdminSetCollectionCoverDto,
  ) {
    this.assertAdminSession(req);
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
      if (msg === 'CATALOG_COVER_S3_NOT_CONFIGURED') {
        throw new ServiceUnavailableException(
          'Catalog cover S3 is not configured (set CATALOG_COVER_S3_BUCKET and CATALOG_COVER_PUBLIC_BASE_URL)',
        );
      }
      if (
        msg === 'CATALOG_COVER_FETCH_FAILED' ||
        msg === 'CATALOG_COVER_FILE_TYPE_INVALID' ||
        msg === 'CATALOG_COVER_FILE_TOO_LARGE' ||
        msg === 'CATALOG_COVER_FILE_EMPTY'
      ) {
        throw new BadRequestException(
          msg === 'CATALOG_COVER_FETCH_FAILED'
            ? 'Could not download cover image from the provided URL'
            : msg === 'CATALOG_COVER_FILE_TOO_LARGE'
              ? 'Cover image must be 8MB or smaller'
              : msg === 'CATALOG_COVER_FILE_TYPE_INVALID'
                ? 'Cover image must be JPEG, PNG, or WebP'
                : 'Invalid cover image URL',
        );
      }
      throw e;
    }
  }

  /** 관리자: 로컬 파일을 S3에 업로드하고 coverImageUrl로 저장 */
  @ApiOperation({ summary: '[Admin] 커버 이미지 S3 업로드' })
  @ApiParam({ name: 'key', description: 'collection_key', example: SWAGGER_FIXTURES.collectionKey })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'JPEG / PNG / WebP (max 8MB)' },
      },
    },
  })
  @Post('collections/:key/admin/cover/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: CATALOG_COVER_MAX_BYTES },
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        cb(null, allowed.includes(file.mimetype));
      },
    }),
  )
  async adminUploadCollectionCover(
    @Req() req: Request,
    @Param('key') key: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    this.assertAdminSession(req);
    const k = this.normalizeKey(key);
    try {
      const col = await this.collectionService.uploadCollectionCoverImageAdmin(
        k,
        file as Express.Multer.File,
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
      if (msg === 'CATALOG_COVER_S3_NOT_CONFIGURED') {
        throw new ServiceUnavailableException(
          'Catalog cover S3 is not configured (set CATALOG_COVER_S3_BUCKET and CATALOG_COVER_PUBLIC_BASE_URL)',
        );
      }
      if (
        msg === 'CATALOG_COVER_FILE_EMPTY' ||
        msg === 'CATALOG_COVER_FILE_TOO_LARGE' ||
        msg === 'CATALOG_COVER_FILE_TYPE_INVALID' ||
        msg === 'COLLECTION_COVER_URL_INVALID'
      ) {
        throw new BadRequestException(
          msg === 'CATALOG_COVER_FILE_TOO_LARGE'
            ? 'Cover image must be 8MB or smaller'
            : msg === 'CATALOG_COVER_FILE_TYPE_INVALID'
              ? 'Cover image must be JPEG, PNG, or WebP'
              : 'Invalid cover image upload',
        );
      }
      throw e;
    }
  }

  /** 관리자: Markets 공개 여부 승인/거절 */
  @ApiOperation({ summary: '[Admin] 컬렉션 review_status 설정' })
  @ApiParam({ name: 'key', description: 'collection_key', example: SWAGGER_FIXTURES.collectionKey })
  @ApiBody({ type: AdminSetCollectionReviewStatusDto })
  @Post('collections/:key/admin/review')
  async adminSetCollectionReviewStatus(
    @Req() req: Request,
    @Param('key') key: string,
    @Body() body: AdminSetCollectionReviewStatusDto,
  ) {
    this.assertAdminSession(req);
    const k = this.normalizeKey(key);
    const next = body.reviewStatus as CollectionReviewStatus;
    if (
      next !== 'pending_review' &&
      next !== 'active' &&
      next !== 'rejected'
    ) {
      throw new BadRequestException('Invalid reviewStatus');
    }
    try {
      const col = await this.collectionService.setCollectionReviewStatusAdmin(
        k,
        next,
      );
      return {
        collectionKey: col.collectionKey,
        reviewStatus: col.reviewStatus,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'COLLECTION_NOT_FOUND') {
        throw new NotFoundException('Collection not found');
      }
      throw e;
    }
  }

  /** 관리자: token 메타에서 커버 후보 (save=true 시 저장) */
  @ApiOperation({ summary: '[Admin] token에서 커버 미리보기' })
  @ApiParam({ name: 'key', description: 'collection_key', example: SWAGGER_FIXTURES.collectionKey })
  @ApiBody(apiBodyDefault(AdminPreviewCollectionCoverFromTokenDto, SWAGGER_BODY_EXAMPLES.adminCoverFromToken))
  @Post('collections/:key/admin/cover/from-token')
  async adminCollectionCoverFromToken(
    @Req() req: Request,
    @Param('key') key: string,
    @Body() body: AdminPreviewCollectionCoverFromTokenDto,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    this.assertAdminSession(req);
    const k = this.normalizeKey(key);
    const chainId = this.chainConfig.resolveChainId(chainHeader);
    const col = await this.collectionService.findOne(k);
    if (!col) {
      throw new NotFoundException('Collection not found');
    }
    if (body.upgradeIfBetter) {
      try {
        const result =
          await this.collectionService.upgradeCollectionCoverFromToken(
            k,
            body.tokenId.trim(),
            chainId,
          );
        return {
          coverImageUrl: result.coverImageUrl,
          saved: result.upgraded,
          upgraded: result.upgraded,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg === 'COLLECTION_NOT_FOUND') {
          throw new NotFoundException('Collection not found');
        }
        throw e;
      }
    }

    const coverImageUrl =
      await this.collectionService.adminPreviewCoverFromToken(
        body.tokenId.trim(),
        k,
        chainId,
      );
    if (!coverImageUrl) {
      return { coverImageUrl: null, saved: false };
    }
    if (body.save) {
      try {
        const updated = await this.collectionService.setCollectionCoverImageAdmin(
          k,
          coverImageUrl,
        );
        return {
          coverImageUrl: updated.coverImageUrl,
          saved: true,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg === 'CATALOG_COVER_S3_NOT_CONFIGURED') {
          throw new ServiceUnavailableException(
            'Catalog cover S3 is not configured (set CATALOG_COVER_S3_BUCKET and CATALOG_COVER_PUBLIC_BASE_URL)',
          );
        }
        if (
          msg === 'CATALOG_COVER_FETCH_FAILED' ||
          msg === 'CATALOG_COVER_FILE_TYPE_INVALID' ||
          msg === 'CATALOG_COVER_FILE_TOO_LARGE' ||
          msg === 'CATALOG_COVER_FILE_EMPTY' ||
          msg === 'COLLECTION_COVER_URL_INVALID'
        ) {
          throw new BadRequestException(
            msg === 'CATALOG_COVER_FETCH_FAILED'
              ? 'Could not download cover image from Cardhedger/TCG URL'
              : 'Invalid cover image',
          );
        }
        throw e;
      }
    }
    return { coverImageUrl, saved: false };
  }

  /** 관리자: 컬렉션 버킷 영구 삭제 */
  @ApiOperation({ summary: '[Admin] 컬렉션 삭제' })
  @ApiParam({ name: 'key', description: 'collection_key', example: SWAGGER_FIXTURES.collectionKey })
  @ApiBody(apiBodyDefault(AdminDeleteCollectionDto, SWAGGER_BODY_EXAMPLES.adminDeleteCollection))
  @Post('collections/:key/admin/delete')
  async adminDeleteCollection(
    @Req() req: Request,
    @Param('key') key: string,
    @Body() body: AdminDeleteCollectionDto,
  ) {
    this.assertAdminSession(req);
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

  /** criteria bid용 Merkle 집합 tokenId (버킷 내 전체 민트) */
  @ApiOperation({ summary: 'Merkle eligible tokenId 목록' })
  @ApiParam({ name: 'key', description: 'collection_key', example: SWAGGER_FIXTURES.collectionKey })
  @ApiQuery({ name: 'bypassCache', required: false, example: 'false', description: '1 또는 true 이면 캐시 무시' })
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
