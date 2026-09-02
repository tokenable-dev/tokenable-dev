import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import {
  ChainConfigService,
  type SupportedChainId,
} from '../../blockchain/chain-config.service';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { RwaTokenOwnerIndexService } from '../../blockchain/rwa-token-owner-index.service';
import { User } from '../../user/entities/user.entity';
import {
  CollectionMarketBundle,
  CollectionMarketService,
} from '../collections/collection-market.service';
import { CardhedgerMarketDataService } from '../market-data/cardhedger-market-data.service';
import { RwaTokenRegistryService } from '../collections/rwa-token-registry.service';
import { PortfolioDailySnapshot } from '../entities/portfolio-daily-snapshot.entity';
import {
  componentsFromMetadata,
  resolveTokenMarkUsd,
} from '../utils/portfolio-token-price.util';
import { computeMarketBucketKey } from '../utils/bucket-key.util';
import type {
  HolderIndex,
  PortfolioDailyCaptureChainResult,
  PortfolioDailyCaptureRunResult,
  PortfolioPricingContext,
} from './portfolio-daily-snapshot.types';
import { PortfolioHoldingService } from './portfolio-holding.service';
import { readCardhedgerFeatureFlags } from '../../config/cardhedger-feature-flags.util';

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
  private readonly fallbackGuardMsByWalletChain = new Map<string, number>();
  private static readonly FALLBACK_GUARD_MS = 60_000;

  constructor(
    @InjectRepository(PortfolioDailySnapshot)
    private readonly snapshotRepo: Repository<PortfolioDailySnapshot>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly config: ConfigService,
    private readonly chainConfig: ChainConfigService,
    private readonly blockchain: BlockchainService,
    private readonly ownerIndex: RwaTokenOwnerIndexService,
    private readonly collectionMarket: CollectionMarketService,
    private readonly cardhedger: CardhedgerMarketDataService,
    private readonly rwaTokenRegistry: RwaTokenRegistryService,
    private readonly portfolioHoldings: PortfolioHoldingService,
  ) {}

  private resolveChain(chainId?: SupportedChainId): SupportedChainId {
    return chainId ?? this.chainConfig.getDefaultChainId();
  }

  ownerScanConcurrency(): number {
    const raw = Number(
      this.config.get<string>('PORTFOLIO_SNAPSHOT_OWNER_SCAN_CONCURRENCY') ??
        '4',
    );
    if (!Number.isFinite(raw) || raw < 1) return 4;
    return Math.min(Math.floor(raw), 16);
  }

  upsertConcurrency(): number {
    const raw = Number(
      this.config.get<string>('PORTFOLIO_SNAPSHOT_CAPTURE_CONCURRENCY') ?? '8',
    );
    if (!Number.isFinite(raw) || raw < 1) return 8;
    return Math.min(Math.floor(raw), 32);
  }

  async listWalletSnapshots(
    walletAddress: string,
    limit = 32,
    chainId?: SupportedChainId,
  ) {
    const wallet = walletAddress.trim().toLowerCase();
    if (!wallet) return [];
    const resolved = this.resolveChain(chainId);
    return this.snapshotRepo.find({
      where: { walletAddress: wallet, chainId: resolved },
      order: { snapshotAt: 'DESC' },
      take: Math.max(2, Math.min(120, Math.floor(limit))),
    });
  }

  /** First portfolio view / empty history — seed active 09:00 KST slot (idempotent per day). */
  async ensureBaselineSnapshot(
    walletAddress: string,
    chainId?: SupportedChainId,
  ): Promise<void> {
    const wallet = walletAddress.trim().toLowerCase();
    if (!wallet) return;
    const resolved = this.resolveChain(chainId);
    const count = await this.snapshotRepo.count({
      where: { walletAddress: wallet, chainId: resolved },
    });
    if (count > 0) return;
    await this.captureDailySnapshot(wallet, new Date(), resolved);
  }

  /** Non-blocking read-path fallback (see {@link ensureBaselineSnapshot}). */
  scheduleBaselineSnapshot(
    walletAddress: string,
    chainId?: SupportedChainId,
  ): void {
    void this.ensureBaselineSnapshot(walletAddress, chainId).catch((e) => {
      this.logger.warn(
        `scheduleBaselineSnapshot failed wallet=${walletAddress} chain=${chainId ?? 'default'}: ${e instanceof Error ? e.message : String(e)}`,
      );
    });
  }

  /**
   * Read-path fallback only: backfill a missed cron slot for the current KST day.
   * Does not overwrite an existing row (cron rows are authoritative history).
   */
  async ensureCurrentSlotSnapshot(
    walletAddress: string,
    reference = new Date(),
    chainId?: SupportedChainId,
  ): Promise<void> {
    const wallet = walletAddress.trim().toLowerCase();
    if (!wallet) return;
    const resolved = this.resolveChain(chainId);

    const slot = resolveKstDailySnapshotSlot(reference);
    const existing = await this.snapshotRepo.findOne({
      where: {
        walletAddress: wallet,
        snapshotDateKst: slot.snapshotDateKst,
        chainId: resolved,
      },
      select: ['walletAddress', 'snapshotDateKst', 'chainId'],
    });
    if (existing) return;

    const guardKey = `${wallet}:${resolved}`;
    const nowMs = Date.now();
    const last = this.fallbackGuardMsByWalletChain.get(guardKey) ?? 0;
    if (nowMs - last < PortfolioDailySnapshotService.FALLBACK_GUARD_MS) return;
    this.fallbackGuardMsByWalletChain.set(guardKey, nowMs);

    await this.captureDailySnapshot(wallet, reference, resolved, {
      overwrite: false,
    });
  }

  /** Non-blocking read-path fallback (see {@link ensureCurrentSlotSnapshot}). */
  scheduleCurrentSlotSnapshot(
    walletAddress: string,
    reference = new Date(),
    chainId?: SupportedChainId,
  ): void {
    void this.ensureCurrentSlotSnapshot(walletAddress, reference, chainId).catch(
      (e) => {
        this.logger.warn(
          `scheduleCurrentSlotSnapshot failed wallet=${walletAddress} chain=${chainId ?? 'default'}: ${e instanceof Error ? e.message : String(e)}`,
        );
      },
    );
  }

  /**
   * Overwrite today's KST slot after holdings change (mint / buy / deliver / hide).
   * Optional delay lets RPC `ownerOf` catch up after the transfer.
   * Does not throw — holdings mutations must not fail because of chart recapture.
   */
  async refreshCurrentSlotSnapshot(
    walletAddress: string,
    chainId?: SupportedChainId,
    waitForRpcMs = 0,
  ): Promise<void> {
    const wallets = [walletAddress];
    await this.refreshCurrentSlotSnapshots(wallets, chainId, waitForRpcMs);
  }

  async refreshCurrentSlotSnapshots(
    walletAddresses: string[],
    chainId?: SupportedChainId,
    waitForRpcMs = 0,
  ): Promise<void> {
    const wallets = [
      ...new Set(
        walletAddresses
          .map((w) => w.trim().toLowerCase())
          .filter((w) => w.length > 0),
      ),
    ];
    if (!wallets.length) return;
    if (waitForRpcMs > 0) {
      await new Promise((r) => setTimeout(r, waitForRpcMs));
    }
    try {
      await Promise.all(
        wallets.map((wallet) =>
          this.captureDailySnapshot(wallet, new Date(), chainId),
        ),
      );
    } catch (e) {
      this.logger.warn(
        `refreshCurrentSlotSnapshots failed wallets=${wallets.join(',')} chain=${chainId ?? 'default'}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  scheduleRefreshCurrentSlotSnapshot(
    walletAddress: string,
    chainId?: SupportedChainId,
    waitForRpcMs = 1500,
  ): void {
    void this.refreshCurrentSlotSnapshot(
      walletAddress,
      chainId,
      waitForRpcMs,
    );
  }

  async latest24h(
    walletAddress: string,
    chainId?: SupportedChainId,
  ): Promise<{
    latest: PortfolioDailySnapshot | null;
    prev: PortfolioDailySnapshot | null;
    pnl24hUsd: number | null;
    pnl24hPct: number | null;
  }> {
    const rows = await this.listWalletSnapshots(walletAddress, 2, chainId);
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
    chainId?: SupportedChainId,
    opts?: { overwrite?: boolean },
  ): Promise<PortfolioDailySnapshot | null> {
    const wallet = walletAddress.trim().toLowerCase();
    if (!wallet) return null;
    const resolved = this.resolveChain(chainId);
    const totals = await this.computeWalletTotals(wallet, resolved);
    const slot = resolveKstDailySnapshotSlot(capturedAt);
    if (opts?.overwrite === false) {
      const existing = await this.snapshotRepo.findOne({
        where: {
          walletAddress: wallet,
          snapshotDateKst: slot.snapshotDateKst,
          chainId: resolved,
        },
        select: ['walletAddress', 'snapshotDateKst', 'chainId'],
      });
      if (existing) return existing;
    }
    await this.upsertSlotTotals(wallet, resolved, slot, totals);
    return this.snapshotRepo.findOne({
      where: {
        walletAddress: wallet,
        snapshotDateKst: slot.snapshotDateKst,
        chainId: resolved,
      },
    });
  }

  /**
   * Production daily capture: each configured chain — on-chain holder index +
   * batch pricing + all candidate wallets.
   */
  async captureAllHoldersDailySnapshots(
    capturedAt = new Date(),
  ): Promise<PortfolioDailyCaptureRunResult> {
    const started = Date.now();
    const slot = resolveKstDailySnapshotSlot(capturedAt);
    const chainIds = this.chainConfig.listConfiguredChainIds();
    const chains: PortfolioDailyCaptureChainResult[] = [];

    for (const chainId of chainIds) {
      try {
        chains.push(await this.captureAllHoldersForChain(chainId, capturedAt));
      } catch (e) {
        this.logger.error(
          JSON.stringify({
            msg: 'portfolio_daily_snapshot_chain_failed',
            chainId,
            error: e instanceof Error ? e.message : String(e),
          }),
        );
        chains.push({
          chainId,
          totalMinted: 0,
          onChainHolders: 0,
          additionalZeroOrHistoricalWallets: 0,
          walletsTargeted: 0,
          snapshotsWritten: 0,
          failed: 1,
          pricingBatchKeys: 0,
        });
      }
    }

    const result: PortfolioDailyCaptureRunResult = {
      slotDateKst: slot.snapshotDateKst,
      slotAtIso: slot.snapshotAt.toISOString(),
      chains,
      snapshotsWritten: chains.reduce((n, c) => n + c.snapshotsWritten, 0),
      failed: chains.reduce((n, c) => n + c.failed, 0),
      durationMs: Date.now() - started,
    };

    this.logger.log(
      JSON.stringify({
        msg: 'portfolio_daily_snapshot_captured',
        ...result,
      }),
    );

    return result;
  }

  private async captureAllHoldersForChain(
    chainId: SupportedChainId,
    capturedAt: Date,
  ): Promise<PortfolioDailyCaptureChainResult> {
    const slot = resolveKstDailySnapshotSlot(capturedAt);

    const { totalMinted, holderIndex } =
      await this.discoverOnChainHolderIndex(chainId);
    const additionalWallets = await this.discoverAdditionalWallets(
      holderIndex,
      chainId,
    );
    const allWallets = [...holderIndex.keys(), ...additionalWallets];

    const allTokenIds = [...new Set([...holderIndex.values()].flat())];
    const pricing =
      allTokenIds.length > 0
        ? await this.buildPricingContext(allTokenIds, chainId)
        : null;

    let snapshotsWritten = 0;
    let failed = 0;
    const concurrency = this.upsertConcurrency();

    for (let i = 0; i < allWallets.length; i += concurrency) {
      const chunk = allWallets.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        chunk.map(async (wallet) => {
          const tokenIds = await this.portfolioHoldings.filterVisibleTokenIds(
            wallet,
            holderIndex.get(wallet) ?? [],
            chainId,
          );
          const totals =
            tokenIds.length === 0 || !pricing
              ? { totalValueUsd: 0, cardCount: 0 }
              : this.computeTotalsFromContext(tokenIds, pricing);
          await this.upsertSlotTotals(wallet, chainId, slot, totals);
        }),
      );
      for (const r of results) {
        if (r.status === 'fulfilled') snapshotsWritten++;
        else failed++;
      }
    }

    return {
      chainId,
      totalMinted,
      onChainHolders: holderIndex.size,
      additionalZeroOrHistoricalWallets: additionalWallets.length,
      walletsTargeted: allWallets.length,
      snapshotsWritten,
      failed,
      pricingBatchKeys: pricing?.seriesByKey.size ?? 0,
    };
  }

  private async discoverOnChainHolderIndex(
    chainId: SupportedChainId,
  ): Promise<{
    totalMinted: number;
    holderIndex: HolderIndex;
  }> {
    const { totalMinted: totalRaw } = await this.blockchain.getRwaInfo(chainId);
    const totalMinted = Math.max(0, Math.floor(Number(totalRaw)));
    if (totalMinted <= 0) {
      return { totalMinted: 0, holderIndex: new Map() };
    }

    if (await this.ownerIndex.isIndexReady(chainId)) {
      const holderIndex = await this.ownerIndex.buildHolderIndex(chainId);
      this.logger.debug(
        JSON.stringify({
          msg: 'portfolio_snapshot_holder_index',
          chainId,
          source: 'owner_index_db',
          holders: holderIndex.size,
          totalMinted,
        }),
      );
      return { totalMinted, holderIndex };
    }

    this.logger.warn(
      JSON.stringify({
        msg: 'portfolio_snapshot_holder_index',
        chainId,
        source: 'ownerOf_scan',
        totalMinted,
        hint: 'Enable RWA_OWNER_INDEX_ENABLED=1 and wait for backfill to avoid RPC scan',
      }),
    );

    const tokenIds = Array.from({ length: totalMinted }, (_, i) => i + 1);
    const ownerByToken = await this.blockchain.batchOwnerOf(
      tokenIds,
      this.ownerScanConcurrency(),
      chainId,
    );

    const holderIndex: HolderIndex = new Map();
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
   * profile-linked users + any wallet that already has snapshot history on this chain.
   */
  private async discoverAdditionalWallets(
    holderIndex: HolderIndex,
    chainId: SupportedChainId,
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
      .where('s.chain_id = :chainId', { chainId })
      .getRawMany<{ wallet: string }>();
    for (const row of historical) {
      const w = normalizeWalletAddress(row.wallet);
      if (w && !holderIndex.has(w)) extra.add(w);
    }

    return [...extra].sort();
  }

  private async buildPricingContext(
    tokenIds: number[],
    chainId: SupportedChainId,
  ): Promise<PortfolioPricingContext> {
    const uniqueTokenIds = [
      ...new Set(
        tokenIds
          .map((n) => Math.floor(Number(n)))
          .filter((n) => Number.isFinite(n) && n >= 0),
      ),
    ];

    const metaByToken = new Map<number, Record<string, unknown>>();
    const metadataPack = await this.blockchain.batchRwaMetadata(
      uniqueTokenIds,
      chainId,
    );
    for (const it of metadataPack.items) {
      if (it.metadata && typeof it.metadata === 'object') {
        metaByToken.set(it.tokenId, it.metadata);
      }
    }

    const tokenToCollection = new Map<number, string>();
    const registryKeys =
      await this.rwaTokenRegistry.collectionKeysByTokenIds(
        uniqueTokenIds,
        chainId,
      );
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
        chainId,
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
    if (missingPreviewTokenIds.length > 0) {
      const flags =
        this.config.get<ReturnType<typeof readCardhedgerFeatureFlags>>(
          'marketplace.cardhedgerFeatureFlags',
        ) ?? readCardhedgerFeatureFlags();
      this.logger.log(
        JSON.stringify({
          msg: 'portfolio_snapshot_mint_previews',
          chainId,
          tokenCount: missingPreviewTokenIds.length,
          fmvBatchEnabled: flags.fmvBatchEnabled,
          mintPreviewSkipComps: flags.mintPreviewSkipComps,
        }),
      );
    }
    const mintPreviews = await this.cardhedger.getBatchMintPreviewsFromTokenIds(
      missingPreviewTokenIds,
      chainId,
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
    chainId: SupportedChainId,
    slot: KstDailySnapshotSlot,
    totals: SnapshotTotals,
  ): Promise<void> {
    await this.snapshotRepo.upsert(
      {
        walletAddress: wallet,
        snapshotDateKst: slot.snapshotDateKst,
        chainId,
        snapshotAt: slot.snapshotAt,
        totalValueUsd: totals.totalValueUsd,
        cardCount: totals.cardCount,
      },
      ['walletAddress', 'snapshotDateKst', 'chainId'],
    );
  }

  /** Single-wallet path (read fallback / legacy). */
  private async computeWalletTotals(
    walletAddress: string,
    chainId: SupportedChainId,
  ): Promise<SnapshotTotals> {
    const owned = await this.blockchain.getRwaTokensByOwner(
      walletAddress,
      chainId,
    );
    const tokenIds = await this.portfolioHoldings.filterVisibleTokenIds(
      walletAddress,
      owned,
      chainId,
    );
    if (tokenIds.length === 0) return { totalValueUsd: 0, cardCount: 0 };
    const ctx = await this.buildPricingContext(tokenIds, chainId);
    return this.computeTotalsFromContext(tokenIds, ctx);
  }

  /** Current mark USD per tokenId (vault deliver cost seed, portfolio display). */
  async resolveMarkUsdByTokenIds(
    tokenIds: number[],
    chainId?: SupportedChainId,
  ): Promise<Map<number, number>> {
    const resolved = this.resolveChain(chainId);
    const unique = [
      ...new Set(
        tokenIds
          .map((n) => Math.floor(Number(n)))
          .filter((n) => Number.isFinite(n) && n >= 0),
      ),
    ];
    const out = new Map<number, number>();
    if (unique.length === 0) return out;

    const ctx = await this.buildPricingContext(unique, resolved);
    for (const tokenId of unique) {
      const meta = ctx.metaByToken.get(tokenId);
      if (!meta) continue;
      const key = ctx.tokenToCollection.get(tokenId);
      const series = key ? ctx.seriesByKey.get(key) ?? null : null;
      const usd = resolveTokenMarkUsd(
        meta,
        series,
        ctx.mintPreviews[tokenId] ?? null,
      );
      if (usd != null && Number.isFinite(usd) && usd >= 0) {
        out.set(tokenId, usd);
      }
    }
    return out;
  }
}
