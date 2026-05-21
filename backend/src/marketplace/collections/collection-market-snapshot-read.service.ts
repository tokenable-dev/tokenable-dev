import { Injectable } from '@nestjs/common';
import { CollectionMarketSnapshot } from '../entities/collection-market-snapshot.entity';
import type {
  CollectionMarketBundle,
  MarketChangePriceSource,
  MarketChangeWindowLabel,
  PriceHistoryDuration,
} from './collection-market.service';
import type { GradePriceStrip, UsdPoint } from '../utils/collection-market.util';
import { percentChangeReferenceOverLagSec } from '../utils/collection-market.util';
import {
  nmHistoryDaysForBundleWindow,
} from '../utils/market-grade-strip.util';
import { filterExternalUsdByDays } from '../utils/market-snapshot-normalize.util';
import type { MarketCollectionPreview, MarketPriceHistoryResult } from '../utils/market-reference.types';
import type { MarketHistoryPeriod } from '../utils/price-history-period.util';
import type { MarketSnapshotMeta } from '../utils/market-snapshot.types';
import { CollectionMarketSnapshotService } from './collection-market-snapshot.service';

const SEC_DAY = 86_400;

const MARKET_CHANGE_LAG_CHAIN: readonly {
  lagSec: number;
  window: MarketChangeWindowLabel;
}[] = [
  { lagSec: 365 * SEC_DAY, window: '365d' },
  { lagSec: 180 * SEC_DAY, window: '180d' },
  { lagSec: 90 * SEC_DAY, window: '90d' },
  { lagSec: 30 * SEC_DAY, window: '30d' },
  { lagSec: 7 * SEC_DAY, window: '7d' },
  { lagSec: SEC_DAY, window: '24h' },
];

function marketChangePctWithFallback(
  externalUsd: UsdPoint[],
  preferred: PriceHistoryDuration,
): { pct: number | null; window: MarketChangeWindowLabel } {
  const startIdx = MARKET_CHANGE_LAG_CHAIN.findIndex(
    (e) => e.window === preferred,
  );
  const from = startIdx >= 0 ? startIdx : 0;
  for (let i = from; i < MARKET_CHANGE_LAG_CHAIN.length; i++) {
    const { lagSec, window } = MARKET_CHANGE_LAG_CHAIN[i]!;
    const pct = percentChangeReferenceOverLagSec(externalUsd, lagSec);
    if (pct != null) return { pct, window };
  }
  return { pct: null, window: preferred };
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
    const points = filterExternalUsdByDays(fullExternal, days);

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
    const maxDays = nmHistoryDaysForBundleWindow(window);
    const fullExternal = row.externalUsdJson ?? [];
    const externalUsd = filterExternalUsdByDays(fullExternal, maxDays);
    const historyTier = row.historyTier ?? 'PSA_10';
    const preview = this.previewFromRow(row);

    const { pct: marketChangePct, window: resolvedChangeWindow } =
      marketChangePctWithFallback(externalUsd, window);
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

    return {
      bundle: {
        collectionKey: key,
        categoryLabel: row.categoryLabel,
        marketChangePct,
        marketChangeWindow: resolvedChangeWindow,
        marketChangeSource,
        gradePrices,
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
}
