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

/**
 * Snapshot-domain HTTP endpoints for collection market data.
 *
 * Relocated from CollectionsController (P1.5) to break the last
 * module-level circular dependency between MarketplaceCollectionsModule
 * and MarketplaceSnapshotsModule.
 *
 * Route paths are IDENTICAL to what was in CollectionsController.
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

  @ApiOperation({
    summary:
      'Cardhedger-backed preview: matched catalog card + PSA10 spot bands.',
  })
  @ApiParam({ name: 'key', description: 'collection_key' })
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

  @ApiOperation({
    summary:
      'Cardhedger PSA10 price history from materialized snapshot (external_usd_json).',
  })
  @ApiParam({ name: 'key', description: 'collection_key' })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['7d', '30d', '90d', '1y'],
    description: 'History window label (default 90d)',
  })
  @ApiQuery({
    name: 'maxDays',
    required: false,
    description:
      'Calendar lookback in days (default from period, max 365 in snapshot).',
  })
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
