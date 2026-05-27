import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { CollectionMarketService } from './collection-market.service';
import { CardhedgerMarketDataService } from './cardhedger-market-data.service';
import { RwaTokenRegistryService } from './rwa-token-registry.service';
import { PortfolioDailySnapshot } from '../entities/portfolio-daily-snapshot.entity';
import {
  componentsFromMetadata,
  resolveTokenMarkUsd,
} from '../utils/portfolio-token-price.util';
import { computeMarketBucketKey } from '../utils/bucket-key.util';

type SnapshotTotals = { totalValueUsd: number; cardCount: number };

/** KST calendar day + 09:00 Asia/Seoul instant for the active daily bucket. */
export type KstDailySnapshotSlot = {
  snapshotDateKst: string;
  snapshotAt: Date;
};

/**
 * Maps "now" to the latest completed 09:00 KST checkpoint.
 * e.g. May 27 16:00 → May 27 09:00; May 28 01:00 → still May 27 09:00.
 */
export function resolveKstDailySnapshotSlot(
  reference = new Date(),
): KstDailySnapshotSlot {
  const dateKey = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);

  const todayKey = dateKey(reference);
  const todayNineKst = new Date(`${todayKey}T09:00:00+09:00`);
  if (reference.getTime() >= todayNineKst.getTime()) {
    return { snapshotDateKst: todayKey, snapshotAt: todayNineKst };
  }

  const yesterday = new Date(reference.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayKey = dateKey(yesterday);
  return {
    snapshotDateKst: yesterdayKey,
    snapshotAt: new Date(`${yesterdayKey}T09:00:00+09:00`),
  };
}

@Injectable()
export class PortfolioDailySnapshotService {
  private readonly logger = new Logger(PortfolioDailySnapshotService.name);

  constructor(
    @InjectRepository(PortfolioDailySnapshot)
    private readonly snapshotRepo: Repository<PortfolioDailySnapshot>,
    private readonly blockchain: BlockchainService,
    private readonly collectionMarket: CollectionMarketService,
    private readonly cardhedger: CardhedgerMarketDataService,
    private readonly rwaTokenRegistry: RwaTokenRegistryService,
  ) {}

  async listWalletSnapshots(walletAddress: string, limit = 32) {
    const wallet = walletAddress.trim().toLowerCase();
    if (!wallet) return [];
    return this.snapshotRepo.find({
      where: { walletAddress: wallet },
      order: { snapshotAt: 'DESC' },
      take: Math.max(2, Math.min(120, Math.floor(limit))),
    });
  }

  /** First portfolio view / empty history — seed active 09:00 KST slot (idempotent per day). */
  async ensureBaselineSnapshot(walletAddress: string): Promise<void> {
    const wallet = walletAddress.trim().toLowerCase();
    if (!wallet) return;
    const count = await this.snapshotRepo.count({ where: { walletAddress: wallet } });
    if (count > 0) return;
    await this.captureDailySnapshot(wallet);
  }

  async latest24h(walletAddress: string): Promise<{
    latest: PortfolioDailySnapshot | null;
    prev: PortfolioDailySnapshot | null;
    pnl24hUsd: number | null;
    pnl24hPct: number | null;
  }> {
    const rows = await this.listWalletSnapshots(walletAddress, 2);
    const latest = rows[0] ?? null;
    const prev = rows[1] ?? null;
    if (!latest || !prev || prev.totalValueUsd <= 0) {
      return { latest, prev, pnl24hUsd: null, pnl24hPct: null };
    }
    const pnl24hUsd = latest.totalValueUsd - prev.totalValueUsd;
    const pnl24hPct = (pnl24hUsd / prev.totalValueUsd) * 100;
    return { latest, prev, pnl24hUsd, pnl24hPct };
  }

  async captureDailySnapshot(
    walletAddress: string,
    capturedAt = new Date(),
  ): Promise<PortfolioDailySnapshot | null> {
    const wallet = walletAddress.trim().toLowerCase();
    if (!wallet) return null;
    const totals = await this.computeWalletTotals(wallet);
    const slot = resolveKstDailySnapshotSlot(capturedAt);
    await this.snapshotRepo.upsert(
      {
        walletAddress: wallet,
        snapshotDateKst: slot.snapshotDateKst,
        snapshotAt: slot.snapshotAt,
        totalValueUsd: totals.totalValueUsd,
        cardCount: totals.cardCount,
      },
      ['walletAddress', 'snapshotDateKst'],
    );
    return this.snapshotRepo.findOne({
      where: { walletAddress: wallet, snapshotDateKst: slot.snapshotDateKst },
    });
  }

  private async computeWalletTotals(walletAddress: string): Promise<SnapshotTotals> {
    const tokenIds = await this.blockchain.getRwaTokensByOwner(walletAddress);
    if (tokenIds.length === 0) return { totalValueUsd: 0, cardCount: 0 };

    const metadataPack = await this.blockchain.batchRwaMetadata(tokenIds);
    const metaByToken = new Map<number, Record<string, unknown>>();
    for (const it of metadataPack.items) {
      if (it.metadata && typeof it.metadata === 'object') {
        metaByToken.set(it.tokenId, it.metadata);
      }
    }

    const tokenToCollection: Record<number, string> =
      await this.rwaTokenRegistry.collectionKeysByTokenIds(tokenIds);
    for (const tokenId of tokenIds) {
      if (tokenToCollection[tokenId]) continue;
      const meta = metaByToken.get(tokenId);
      if (!meta) continue;
      const comp = componentsFromMetadata(meta);
      if (!comp) continue;
      tokenToCollection[tokenId] = computeMarketBucketKey(comp).toLowerCase();
    }

    const uniqueKeys = [
      ...new Set(
        Object.values(tokenToCollection)
          .map((k) => String(k ?? '').trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    const batch = await this.collectionMarket.batchPortfolioMarketData(uniqueKeys, {
      priceHistoryDuration: '365d',
    });
    const seriesByKey = new Map(
      batch.items.map((it) => [it.collectionKey.toLowerCase(), it.series]),
    );

    const missingPreviewTokenIds = tokenIds.filter((tokenId) => {
      const key = tokenToCollection[tokenId]?.toLowerCase();
      if (!key) return true;
      const pv = seriesByKey.get(key)?.cardhedgerPreview;
      return !(pv?.matched && pv?.card);
    });
    const mintPreviews = await this.cardhedger.getBatchMintPreviewsFromTokenIds(
      missingPreviewTokenIds,
    );

    let totalValueUsd = 0;
    for (const tokenId of tokenIds) {
      const meta = metaByToken.get(tokenId);
      if (!meta) continue;
      const key = tokenToCollection[tokenId]?.toLowerCase();
      const series = key ? seriesByKey.get(key) ?? null : null;
      const usd = resolveTokenMarkUsd(meta, series ?? null, mintPreviews[tokenId]);
      if (usd != null && Number.isFinite(usd) && usd > 0) totalValueUsd += usd;
    }

    this.logger.debug(
      JSON.stringify({
        msg: 'portfolio_daily_snapshot_computed',
        walletAddress,
        cardCount: tokenIds.length,
        totalValueUsd,
      }),
    );
    return { totalValueUsd, cardCount: tokenIds.length };
  }
}
