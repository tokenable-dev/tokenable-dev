import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  isMarketHistoryPeriod,
  marketPeriodToMaxCalendarDays,
  type MarketHistoryPeriod,
} from '../utils/price-history-period.util';
import { CollectionMarketSnapshotReadService } from './collection-market-snapshot-read.service';
import { CollectionMarketSnapshotSchedulerService } from './collection-market-snapshot-scheduler.service';
import { CollectionMarketSnapshotService } from './collection-market-snapshot.service';
import { SWAGGER_FIXTURES } from '../../swagger/fixtures';

/**
 * 컬렉션 Cardhedger 스냅샷 읽기 — preview·가격 이력 (materialized snapshot).
 * 경로는 기존 CollectionsController 와 동일 (`/api/marketplace/collections/:key/...`).
 */
@ApiTags('marketplace')
@Controller('marketplace')
export class CollectionMarketSnapshotController {
  constructor(
    private readonly snapshotService: CollectionMarketSnapshotService,
    private readonly snapshotRead: CollectionMarketSnapshotReadService,
    private readonly snapshotScheduler: CollectionMarketSnapshotSchedulerService,
  ) {}

  private normalizeKey(raw: string): string {
    return decodeURIComponent(raw).toLowerCase();
  }

  /** Cardhedger 카드 매칭 + PSA10 스팟 밴드 프리뷰 */
  @ApiOperation({ summary: 'Cardhedger 프리뷰' })
  @ApiParam({ name: 'key', description: 'collection_key', example: SWAGGER_FIXTURES.collectionKey })
  @Get('collections/:key/cardhedger')
  async getCollectionCardhedger(@Param('key') key: string) {
    const k = this.normalizeKey(key);
    const row = await this.snapshotService.resolveSnapshotForRead(
      k,
      'cold_start',
    );
    if (row?.previewJson) {
      const stale = this.snapshotService.isRowStale(row);
      this.snapshotService.touchLastViewed(k);
      if (stale) this.snapshotScheduler.enqueue(k, 'stale_swr');
      const preview = this.snapshotRead.previewFromRow(row);
      const meta = this.snapshotRead.snapshotMeta(row);
      return {
        ...preview,
        snapshotStale: meta.stale,
        syncedAt: meta.syncedAt ?? undefined,
        reliabilityScore: meta.reliabilityScore ?? undefined,
      };
    }
    return {
      enabled: true,
      searchQuery: '',
      matched: false,
      message: 'Market snapshot unavailable',
      card: null,
      snapshotStale: true,
    };
  }

  /** 스냅샷 기반 Cardhedger PSA10 가격 이력 */
  @ApiOperation({ summary: 'Cardhedger 가격 이력' })
  @ApiParam({ name: 'key', description: 'collection_key', example: SWAGGER_FIXTURES.collectionKey })
  @ApiQuery({ name: 'period', required: false, example: '90d', description: '차트 기간', enum: ['7d', '30d', '90d', '1y'] })
  @ApiQuery({ name: 'maxDays', required: false, example: 90, description: '최대 달력 일수 (1–365)' })
  @Get('collections/:key/cardhedger/price-history')
  async getCollectionCardhedgerPriceHistory(
    @Param('key') key: string,
    @Query('period') periodRaw?: string,
    @Query('maxDays') maxDaysRaw?: string,
  ) {
    const k = this.normalizeKey(key);
    const periodStr = String(periodRaw ?? '90d');
    const period: MarketHistoryPeriod = isMarketHistoryPeriod(periodStr)
      ? periodStr
      : '90d';
    const parsedMax =
      maxDaysRaw != null && String(maxDaysRaw).trim() !== ''
        ? parseInt(String(maxDaysRaw), 10)
        : NaN;
    const maxCalendarDays = Number.isFinite(parsedMax)
      ? Math.min(365, Math.max(1, parsedMax))
      : marketPeriodToMaxCalendarDays(period);

    const row = await this.snapshotService.resolveSnapshotForRead(
      k,
      'cold_start',
    );

    if (row?.externalUsdJson != null) {
      const stale = this.snapshotService.isRowStale(row);
      this.snapshotService.touchLastViewed(k);
      if (stale) this.snapshotScheduler.enqueue(k, 'stale_swr');
      return this.snapshotRead.priceHistoryFromRow(row, {
        tier: 'PSA_10',
        period,
        maxCalendarDays,
      });
    }

    return this.snapshotRead.emptyPriceHistory({
      tier: 'PSA_10',
      period,
      maxCalendarDays,
    });
  }
}
