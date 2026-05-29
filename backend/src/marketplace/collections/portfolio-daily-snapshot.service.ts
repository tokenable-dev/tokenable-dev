import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { User } from '../../user/entities/user.entity';
import {
  CollectionMarketBundle,
  CollectionMarketService,
} from './collection-market.service';
import { CardhedgerMarketDataService } from './cardhedger-market-data.service';
import { RwaTokenRegistryService } from './rwa-token-registry.service';
import { PortfolioDailySnapshot } from '../entities/portfolio-daily-snapshot.entity';
import {
  componentsFromMetadata,
  resolveTokenMarkUsd,
} from '../utils/portfolio-token-price.util';
import { computeMarketBucketKey } from '../utils/bucket-key.util';
import type {
  HolderIndex,
  PortfolioDailyCaptureRunResult,
  PortfolioPricingContext,
} from './portfolio-daily-snapshot.types';
import { PortfolioHiddenHoldingService } from './portfolio-hidden-holding.service';

type SnapshotTotals = { totalValueUsd: number; cardCount: number };

/** KST calendar day + 09:00 Asia/Seoul instant for the active daily bucket. */
export type KstDailySnapshotSlot = {
  snapshotDateKst: string;
  snapshotAt: Date;
};

const PORTFOLIO_MARKET_BATCH_KEY_CHUNK = 60;

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

function normalizeWalletAddress(raw: string | null | undefined): string | null {
  const w = String(raw ?? '').trim().toLowerCase();
  if (!w || !/^0x[a-f0-9]{40}$/.test(w)) return null;
  return w;
}

@Injectable()
export class PortfolioDailySnapshotService {
  private readonly logger = new Logger(PortfolioDailySnapshotService.name);
  /** Guard duplicate fallback captures when cron row is missing (rapid API polling). */
  private readonly fallbackGuardMsByWallet = new Map<string, number>();
  private static readonly FALLBACK_GUARD_MS = 60_000;

  constructor(
    @InjectRepository(PortfolioDailySnapshot)
    private readonly snapshotRepo: Repository<PortfolioDailySnapshot>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly config: ConfigService,
    private readonly blockchain: BlockchainService,
    private readonly collectionMarket: CollectionMarketService,
    private readonly cardhedger: CardhedgerMarketDataService,
    private readonly rwaTokenRegistry: RwaTokenRegistryService,
    private readonly portfolioHidden: PortfolioHiddenHoldingService,
  ) {}

  ownerScanConcurrency(): number {
    const raw = Number(
      this.config.get<string>('PORTFOLIO_SNAPSHOT_OWNER_SCAN_CONCURRENCY') ??
        '24',
    );
    if (!Number.isFinite(raw) || raw < 1) return 24;
    return Math.min(Math.floor(raw), 64);
  }

  upsertConcurrency(): number {
    const raw = Number(
      this.config.get<string>('PORTFOLIO_SNAPSHOT_CAPTURE_CONCURRENCY') ?? '8',
    );
    if (!Number.isFinite(raw) || raw < 1) return 8;
    return Math.min(Math.floor(raw), 32);
  }

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

  /**
   * Read-path fallback only: backfill a missed cron slot for the current KST day.
   * Does not overwrite an existing row (cron rows are authoritative history).
   */
  async ensureCurrentSlotSnapshot(
    walletAddress: string,
    reference = new Date(),
  ): Promise<void> {
    const wallet = walletAddress.trim().toLowerCase();
    if (!wallet) return;

    const slot = resolveKstDailySnapshotSlot(reference);
    const existing = await this.snapshotRepo.findOne({
      where: {
        walletAddress: wallet,
        snapshotDateKst: slot.snapshotDateKst,
      },
      select: ['walletAddress', 'snapshotDateKst'],
    });
    if (existing) return;

    const nowMs = Date.now();
    const last = this.fallbackGuardMsByWallet.get(wallet) ?? 0;
    if (nowMs - last < PortfolioDailySnapshotService.FALLBACK_GUARD_MS) return;
    this.fallbackGuardMsByWallet.set(wallet, nowMs);

    await this.captureDailySnapshot(wallet, reference);
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
    await this.upsertSlotTotals(wallet, slot, totals);
    return this.snapshotRepo.findOne({
      where: { walletAddress: wallet, snapshotDateKst: slot.snapshotDateKst },
    });
  }

  /**
   * Production daily capture: on-chain holder index + batch pricing + all candidate wallets.
   * Includes zero-card linked / historical wallets so charts stay continuous after full exit.
   */
  async captureAllHoldersDailySnapshots(
    capturedAt = new Date(),
  ): Promise<PortfolioDailyCaptureRunResult> {
    const started = Date.now();
    const slot = resolveKstDailySnapshotSlot(capturedAt);

    const { totalMinted, holderIndex } = await this.discoverOnChainHolderIndex();
    const additionalWallets = await this.discoverAdditionalWallets(holderIndex);
    const allWallets = [
      ...holderIndex.keys(),
      ...additionalWallets,
    ];

    const allTokenIds = [
      ...new Set([...holderIndex.values()].flat()),
    ];
    const pricing =
      allTokenIds.length > 0
        ? await this.buildPricingContext(allTokenIds)
        : null;

    let snapshotsWritten = 0;
    let failed = 0;
    const concurrency = this.upsertConcurrency();

    for (let i = 0; i < allWallets.length; i += concurrency) {
      const chunk = allWallets.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        chunk.map(async (wallet) => {
          const tokenIds = await this.portfolioHidden.filterVisibleTokenIds(
            wallet,
            holderIndex.get(wallet) ?? [],
          );
          const totals =
            tokenIds.length === 0 || !pricing
              ? { totalValueUsd: 0, cardCount: 0 }
              : this.computeTotalsFromContext(tokenIds, pricing);
          await this.upsertSlotTotals(wallet, slot, totals);
        }),
      );
      for (const r of results) {
        if (r.status === 'fulfilled') snapshotsWritten++;
        else failed++;
      }
    }

    const durationMs = Date.now() - started;
    const result: PortfolioDailyCaptureRunResult = {
      slotDateKst: slot.snapshotDateKst,
      slotAtIso: slot.snapshotAt.toISOString(),
      totalMinted,
      onChainHolders: holderIndex.size,
      additionalZeroOrHistoricalWallets: additionalWallets.length,
      walletsTargeted: allWallets.length,
      snapshotsWritten,
      failed,
      durationMs,
      pricingBatchKeys: pricing?.seriesByKey.size ?? 0,
    };

    this.logger.log(
      JSON.stringify({
        msg: 'portfolio_daily_snapshot_captured',
        ...result,
      }),
    );

    return result;
  }

  private async discoverOnChainHolderIndex(): Promise<{
    totalMinted: number;
    holderIndex: HolderIndex;
  }> {
    const { totalMinted: totalRaw } = await this.blockchain.getRwaInfo();
    const totalMinted = Math.max(0, Math.floor(Number(totalRaw)));
    const holderIndex: HolderIndex = new Map();
    if (totalMinted <= 0) {
      return { totalMinted: 0, holderIndex };
    }

    const tokenIds = Array.from({ length: totalMinted }, (_, i) => i);
    const ownerByToken = await this.blockchain.batchOwnerOf(
      tokenIds,
      this.ownerScanConcurrency(),
    );

    for (const [tokenId, owner] of ownerByToken) {
      const list = holderIndex.get(owner) ?? [];
      list.push(tokenId);
      holderIndex.set(owner, list);
    }

    for (const list of holderIndex.values()) {
      list.sort((a, b) => a - b);
    }

    return { totalMinted, holderIndex };
  }

  /**
   * Wallets that should keep daily rows even with zero on-chain holdings:
   * profile-linked users + any wallet that already has snapshot history.
   */
  private async discoverAdditionalWallets(
    holderIndex: HolderIndex,
  ): Promise<string[]> {
    const extra = new Set<string>();

    const users = await this.userRepo.find({
      where: { walletAddress: Not(IsNull()) },
      select: ['walletAddress'],
    });
    for (const u of users) {
      const w = normalizeWalletAddress(u.walletAddress);
      if (w && !holderIndex.has(w)) extra.add(w);
    }

    const historical = await this.snapshotRepo
      .createQueryBuilder('s')
      .select('DISTINCT s.wallet_address', 'wallet')
      .getRawMany<{ wallet: string }>();
    for (const row of historical) {
      const w = normalizeWalletAddress(row.wallet);
      if (w && !holderIndex.has(w)) extra.add(w);
    }

    return [...extra].sort();
  }

  private async buildPricingContext(
    tokenIds: number[],
  ): Promise<PortfolioPricingContext> {
    const uniqueTokenIds = [
      ...new Set(
        tokenIds
          .map((n) => Math.floor(Number(n)))
          .filter((n) => Number.isFinite(n) && n >= 0),
      ),
    ];

    const metaByToken = new Map<number, Record<string, unknown>>();
    const metadataPack = await this.blockchain.batchRwaMetadata(uniqueTokenIds);
    for (const it of metadataPack.items) {
      if (it.metadata && typeof it.metadata === 'object') {
        metaByToken.set(it.tokenId, it.metadata);
      }
    }

    const tokenToCollection = new Map<number, string>();
    const registryKeys =
      await this.rwaTokenRegistry.collectionKeysByTokenIds(uniqueTokenIds);
    for (const tokenId of uniqueTokenIds) {
      const fromRegistry = registryKeys[tokenId];
      if (fromRegistry) {
        tokenToCollection.set(tokenId, fromRegistry.toLowerCase());
        continue;
      }
      const meta = metaByToken.get(tokenId);
      if (!meta) continue;
      const comp = componentsFromMetadata(meta);
      if (!comp) continue;
      tokenToCollection.set(tokenId, computeMarketBucketKey(comp).toLowerCase());
    }

    const uniqueKeys = [
      ...new Set(
        [...tokenToCollection.values()]
          .map((k) => String(k ?? '').trim().toLowerCase())
          .filter(Boolean),
      ),
    ];

    const seriesByKey = new Map<string, CollectionMarketBundle | null>();
    for (let i = 0; i < uniqueKeys.length; i += PORTFOLIO_MARKET_BATCH_KEY_CHUNK) {
      const chunk = uniqueKeys.slice(i, i + PORTFOLIO_MARKET_BATCH_KEY_CHUNK);
      const batch = await this.collectionMarket.batchPortfolioMarketData(chunk, {
        priceHistoryDuration: '365d',
      });
      for (const it of batch.items) {
        seriesByKey.set(it.collectionKey.toLowerCase(), it.series);
      }
    }

    const missingPreviewTokenIds = uniqueTokenIds.filter((tokenId) => {
      const key = tokenToCollection.get(tokenId);
      if (!key) return true;
      const pv = seriesByKey.get(key)?.cardhedgerPreview;
      return !(pv?.matched && pv?.card);
    });
    const mintPreviews = await this.cardhedger.getBatchMintPreviewsFromTokenIds(
      missingPreviewTokenIds,
    );

    return {
      metaByToken,
      tokenToCollection,
      seriesByKey,
      mintPreviews,
    };
  }

  private computeTotalsFromContext(
    tokenIds: number[],
    ctx: PortfolioPricingContext,
  ): SnapshotTotals {
    let totalValueUsd = 0;
    for (const tokenId of tokenIds) {
      const meta = ctx.metaByToken.get(tokenId);
      if (!meta) continue;
      const key = ctx.tokenToCollection.get(tokenId);
      const series = key ? ctx.seriesByKey.get(key) ?? null : null;
      const usd = resolveTokenMarkUsd(
        meta,
        series,
        ctx.mintPreviews[tokenId],
      );
      if (usd != null && Number.isFinite(usd) && usd > 0) {
        totalValueUsd += usd;
      }
    }
    return { totalValueUsd, cardCount: tokenIds.length };
  }

  private async upsertSlotTotals(
    wallet: string,
    slot: KstDailySnapshotSlot,
    totals: SnapshotTotals,
  ): Promise<void> {
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
  }

  /** Single-wallet path (read fallback / legacy). */
  private async computeWalletTotals(walletAddress: string): Promise<SnapshotTotals> {
    const owned = await this.blockchain.getRwaTokensByOwner(walletAddress);
    const tokenIds = await this.portfolioHidden.filterVisibleTokenIds(
      walletAddress,
      owned,
    );
    if (tokenIds.length === 0) return { totalValueUsd: 0, cardCount: 0 };
    const ctx = await this.buildPricingContext(tokenIds);
    return this.computeTotalsFromContext(tokenIds, ctx);
  }
}
