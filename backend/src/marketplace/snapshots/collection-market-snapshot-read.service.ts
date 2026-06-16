import { Injectable } from '@nestjs/common';
import { CollectionMarketSnapshot } from '../entities/collection-market-snapshot.entity';
import type {
  CollectionMarketBundle,
  MarketChangePriceSource,
  MarketChangeWindowLabel,
  PriceHistoryDuration,
} from '../collections/collection-market.service';
import type { GradePriceStrip, UsdPoint } from '../utils/collection-market.util';
import { referenceChangeWithBestWindow } from '../utils/collection-market.util';
import { chartHistoryWindowFromCalendarDays } from '../utils/market-grade-strip.util';
import { filterExternalUsdForChartWindow } from '../utils/market-snapshot-normalize.util';
import {
  catalogFromPricesByGradeMap,
  collectionGradeLabelFromHistoryTier,
} from '../utils/cardhedger-grade-catalog.util';
import type { MarketCollectionPreview, MarketPriceHistoryResult } from '../utils/market-reference.types';
import type { MarketHistoryPeriod } from '../utils/price-history-period.util';
import type { MarketSnapshotMeta } from '../utils/market-snapshot.types';
import { CollectionMarketSnapshotService } from './collection-market-snapshot.service';

/** Product default: 1y reference % (fallback to full available history). */
function marketChangePctBestWindow(externalUsd: UsdPoint[]) {
  const r = referenceChangeWithBestWindow(externalUsd);
  return {
    pct: r.pct,
    window: r.window as MarketChangeWindowLabel,
    isFullYear: r.isFullYear,
    spanSec: r.spanSec,
    refUsd: r.refUsd ?? null,
    refAtSec: r.refAtSec ?? null,
  };
}

export type SnapshotBundleResult = {
  bundle: CollectionMarketBundle;
  meta: MarketSnapshotMeta;
};

/**
 * Maps materialized DB snapshots → existing API response shapes.
 * No Cardhedger upstream calls.
 */
@Injectable()
export class CollectionMarketSnapshotReadService {
  constructor(private readonly snapshotService: CollectionMarketSnapshotService) {}

  snapshotMeta(row: CollectionMarketSnapshot): MarketSnapshotMeta {
    const stale = this.snapshotService.isRowStale(row);
    return {
      stale,
      syncedAt: row.syncedAt?.toISOString() ?? null,
      reliabilityScore: row.reliabilityScore,
      marketState: stale && row.syncedAt ? 'stale' : row.marketState,
    };
  }

  previewFromRow(row: CollectionMarketSnapshot): MarketCollectionPreview {
    return (
      row.previewJson ?? {
        enabled: false,
        searchQuery: '',
        matched: false,
        message: 'Snapshot preview unavailable',
        card: null,
      }
    );
  }

  /**
   * Serves GET …/cardhedger/price-history from materialized external_usd_json.
   */
  priceHistoryFromRow(
    row: CollectionMarketSnapshot,
    options: {
      tier?: string;
      period: MarketHistoryPeriod;
      maxCalendarDays: number;
    },
  ): MarketPriceHistoryResult {
    const days = Math.min(
      4000,
      Math.max(1, Math.floor(options.maxCalendarDays)),
    );
    const tier =
      String(options.tier ?? row.historyTier ?? 'PSA_10').trim() || 'PSA_10';
    const preview = this.previewFromRow(row);
    const fullExternal = row.externalUsdJson ?? [];
    const chartWindow = chartHistoryWindowFromCalendarDays(days);
    const points = filterExternalUsdForChartWindow(fullExternal, chartWindow);

    if (!preview.matched || points.length === 0) {
      return {
        enabled: preview.enabled,
        searchQuery: preview.searchQuery,
        matched: preview.matched,
        message:
          preview.message ??
          (points.length === 0
            ? 'Price history unavailable in snapshot'
            : undefined),
        matchConfidence: preview.matchConfidence,
        days,
        tier,
        period: options.period,
        points,
        source: `cardhedger:${tier}:snapshot`,
        upstreamRequests: 0,
        snapshotStale: this.snapshotService.isRowStale(row),
        syncedAt: row.syncedAt?.toISOString(),
      };
    }

    return {
      enabled: true,
      searchQuery: preview.searchQuery,
      matched: true,
      matchConfidence: preview.matchConfidence,
      days,
      tier,
      period: options.period,
      points,
      source: `cardhedger:${tier}:snapshot`,
      upstreamRequests: 0,
      snapshotStale: this.snapshotService.isRowStale(row),
      syncedAt: row.syncedAt?.toISOString(),
    };
  }

  /** Empty price-history payload when no snapshot row exists. */
  emptyPriceHistory(
    options: {
      tier?: string;
      period: MarketHistoryPeriod;
      maxCalendarDays: number;
      message?: string;
    },
  ): MarketPriceHistoryResult {
    const days = Math.min(
      4000,
      Math.max(1, Math.floor(options.maxCalendarDays)),
    );
    const tier = String(options.tier ?? 'PSA_10').trim() || 'PSA_10';
    return {
      enabled: true,
      searchQuery: '',
      matched: false,
      message: options.message ?? 'Market snapshot unavailable',
      days,
      tier,
      period: options.period,
      points: [],
      source: `cardhedger:${tier}:snapshot`,
      upstreamRequests: 0,
    };
  }

  buildBundleFromRow(
    row: CollectionMarketSnapshot,
    priceHistoryDuration: PriceHistoryDuration,
    platformUsd: UsdPoint[],
  ): SnapshotBundleResult {
    const key = row.collectionKey;
    const window = priceHistoryDuration;
    const fullExternal = row.externalUsdJson ?? [];
    const externalUsd = filterExternalUsdForChartWindow(fullExternal, window);
    const historyTier = row.historyTier ?? 'PSA_10';
    const preview = this.previewFromRow(row);

    // % change uses the full materialized series (comps sales back years), not the
    // calendar-trimmed chart window — sparse parallels need older sale anchors.
    const {
      pct: marketChangePct,
      window: resolvedChangeWindow,
      isFullYear: marketChangeIsFullYear,
      spanSec: marketChangeSpanSec,
      refUsd: marketChangeRefUsd,
      refAtSec: marketChangeRefAtSec,
    } = marketChangePctBestWindow(fullExternal);
    const marketChangeSource: MarketChangePriceSource | null =
      marketChangePct != null && externalUsd.length >= 2
        ? historyTier === 'NEAR_MINT'
          ? 'cardhedger_nm'
          : 'cardhedger_graded'
        : 'none';

    const gradePrices: GradePriceStrip = row.gradePricesJson ?? {
      psa10: row.psa10Usd,
      psa9: row.psa9Usd,
      raw: row.rawUsd,
    };

    const meta = this.snapshotMeta(row);

    const { allGradePrices, collectionGrade } = this.gradeCatalogFromPreview(
      preview,
      historyTier,
    );

    return {
      bundle: {
        collectionKey: key,
        categoryLabel: row.categoryLabel,
        marketChangePct,
        marketChangeWindow: resolvedChangeWindow,
        marketChangeIsFullYear,
        marketChangeSpanSec,
        marketChangeRefUsd: marketChangeRefUsd ?? undefined,
        marketChangeRefAtSec: marketChangeRefAtSec ?? undefined,
        marketChangeSource,
        gradePrices,
        allGradePrices,
        collectionGrade,
        historyTier,
        externalUsd,
        platformUsd,
        cardhedgerPreview: preview,
        snapshotStale: meta.stale,
        syncedAt: meta.syncedAt ?? undefined,
        reliabilityScore: meta.reliabilityScore ?? undefined,
      },
      meta,
    };
  }

  private gradeCatalogFromPreview(
    preview: MarketCollectionPreview,
    historyTier: string | null,
  ) {
    const allGradePrices = catalogFromPricesByGradeMap(
      preview.card?.pricesByGrade,
    );
    const collectionGrade = collectionGradeLabelFromHistoryTier(historyTier);
    return { allGradePrices, collectionGrade };
  }
}
