import { Injectable } from '@nestjs/common';
import { CollectionMarketService } from '../collections/collection-market.service';
import type { CollectionMarketBundle } from '../collections/collection-market.service';
import { CollectionService } from '../collections/collection.service';
import { RwaTokenRegistryService } from '../collections/rwa-token-registry.service';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { RwaAssetResolveService } from '../../blockchain/rwa-asset-resolve.service';
import { RwaTokenOwnerIndexService } from '../../blockchain/rwa-token-owner-index.service';
import {
  ChainConfigService,
  type SupportedChainId,
} from '../../blockchain/chain-config.service';
import type { MarketCollectionPreview } from '../utils/market-reference.types';
import type { PortfolioHoldingBatchItem } from './portfolio-holding.service';
import { PortfolioHoldingService } from './portfolio-holding.service';
import { componentsFromMetadata } from '../utils/portfolio-token-price.util';
import { computeMarketBucketKey } from '../utils/bucket-key.util';
import { perfNow, perfLog, elapsedMs } from '../../common/perf/perf';
import {
  PortfolioAssetsPageCacheService,
} from './portfolio-assets-page-cache.service';
import {
  PORTFOLIO_ASSETS_BOOTSTRAP_FIRST_PAINT,
  PORTFOLIO_ASSETS_PAGE_MAX,
} from './dto/portfolio-assets-page.dto';

export type PortfolioAssetsPageLoadOptions = {
  ownedIdsOnly?: boolean;
  bootstrapFirstPage?: boolean;
};

function normalizeLoadPageOptions(
  options?: boolean | PortfolioAssetsPageLoadOptions,
): PortfolioAssetsPageLoadOptions {
  if (typeof options === 'boolean') {
    return { ownedIdsOnly: options };
  }
  return options ?? {};
}

export type PortfolioAssetsPageMetadataItem = {
  tokenId: number;
  tokenURI: string | null;
  metadata: Record<string, unknown> | null;
  imageUrl: string | null;
  imageBackUrl: string | null;
};

export type PortfolioAssetsPageResponse = {
  /** Full owned tokenId list from DB owner index (newest-first). */
  ownedTokenIds: number[];
  metadataItems: PortfolioAssetsPageMetadataItem[];
  collectionKeys: Record<number, string>;
  marketItems: Array<{
    collectionKey: string;
    stats: import('../collections/collection-market.service').CollectionMarketStatsResponse | null;
    series: CollectionMarketBundle | null;
  }>;
  mintPreviews: Record<number, MarketCollectionPreview>;
  holdings: PortfolioHoldingBatchItem[];
};

@Injectable()
export class PortfolioAssetsPageService {
  constructor(
    private readonly rwaAssetResolve: RwaAssetResolveService,
    private readonly collectionService: CollectionService,
    private readonly rwaTokenRegistry: RwaTokenRegistryService,
    private readonly collectionMarket: CollectionMarketService,
    private readonly portfolioHoldings: PortfolioHoldingService,
    private readonly chainConfig: ChainConfigService,
    private readonly pageCache: PortfolioAssetsPageCacheService,
    private readonly ownerIndex: RwaTokenOwnerIndexService,
    private readonly blockchain: BlockchainService,
  ) {}

  async loadPage(
    walletAddress: string,
    tokenIds: number[] | undefined,
    chainId?: SupportedChainId,
    options?: boolean | PortfolioAssetsPageLoadOptions,
  ): Promise<PortfolioAssetsPageResponse> {
    const opts = normalizeLoadPageOptions(options);
    const chain = chainId ?? this.chainConfig.getDefaultChainId();
    const wallet = walletAddress.trim().toLowerCase();

    const ownedTokenIds = opts.bootstrapFirstPage
      ? await this.resolveOwnedTokenIdsForBootstrap(wallet, chain)
      : await this.resolveOwnedTokenIds(wallet, chain, {
          skipOnChainUnion: false,
        });

    if (opts.ownedIdsOnly && !opts.bootstrapFirstPage) {
      return {
        ownedTokenIds,
        metadataItems: [],
        collectionKeys: {},
        marketItems: [],
        mintPreviews: {},
        holdings: [],
      };
    }

    const ownedSet = new Set(ownedTokenIds);

    const requested = [
      ...new Set(
        (tokenIds ?? [])
          .map((n) => Math.floor(Number(n)))
          .filter((n) => Number.isFinite(n) && n >= 0),
      ),
    ].filter((id) => ownedSet.has(id));

    let uniqueTokenIds =
      requested.length > 0
        ? requested
        : ownedTokenIds.slice(0, PORTFOLIO_ASSETS_PAGE_MAX);

    if (opts.bootstrapFirstPage && requested.length === 0) {
      uniqueTokenIds = ownedTokenIds.slice(
        0,
        PORTFOLIO_ASSETS_BOOTSTRAP_FIRST_PAINT,
      );
    }

    if (uniqueTokenIds.length === 0) {
      return {
        ownedTokenIds,
        metadataItems: [],
        collectionKeys: {},
        marketItems: [],
        mintPreviews: {},
        holdings: [],
      };
    }

    const _t0 = perfNow();
    const registryDigest = await this.rwaTokenRegistry.registryIdentityDigest(
      uniqueTokenIds,
      chain,
    );
    const cacheKey = this.pageCache.buildKey(
      chain,
      wallet,
      uniqueTokenIds,
      registryDigest,
    );

    if (this.pageCache.isEnabled()) {
      const cached = await this.pageCache.get(cacheKey);
      if (cached) {
        const holdings = await this.portfolioHoldings.getHoldingsBatch(
          wallet,
          uniqueTokenIds,
          chain,
        );
        perfLog('api', 'portfolioAssetsPage', elapsedMs(_t0), {
          chainId: chain,
          tokenCount: uniqueTokenIds.length,
          ownedCount: ownedTokenIds.length,
          cache: cached.layer,
          source: 'db',
        });
        return { ...cached.payload, ownedTokenIds, holdings };
      }
    }

    const result = await this.loadPageUncached(
      wallet,
      uniqueTokenIds,
      chain,
      _t0,
    );

    if (this.pageCache.isEnabled()) {
      const { holdings, ownedTokenIds: _o, ...cacheable } = result;
      void this.pageCache.set(cacheKey, cacheable);
      void holdings;
      void _o;
    }

    return { ...result, ownedTokenIds };
  }

  /**
   * DB owner index only on the My Assets hot path. Registry heal can take tens
   * of seconds — always run it in the background. Never block empty wallets on
   * a full-supply ownerOf scan (`getRwaTokensByOwner`).
   */
  /**
   * Cold My Assets bootstrap: verify newest-first head and tail in parallel
   * (same RPC count, lower wall-clock before metadata). Skips full supply scan.
   */
  private async resolveOwnedTokenIdsForBootstrap(
    wallet: string,
    chainId: SupportedChainId,
  ): Promise<number[]> {
    void this.blockchain
      .healOwnerRegistryIfIncomplete(chainId)
      .catch(() => undefined);
    const fromDb = await this.ownerIndex.getTokenIdsByOwner(wallet, chainId);
    const onChain = await this.blockchain.listTokenIdsOwnedOnChain(
      wallet,
      chainId,
    );
    const sorted = this.sortOwnedNewestFirst([
      ...new Set([...fromDb, ...onChain]),
    ]);
    if (sorted.length === 0) {
      return [];
    }
    const splitAt = Math.min(
      sorted.length,
      PORTFOLIO_ASSETS_BOOTSTRAP_FIRST_PAINT,
    );
    const head = sorted.slice(0, splitAt);
    const tail = sorted.slice(splitAt);
    const [verifiedHead, verifiedTail] = await Promise.all([
      this.blockchain.filterTokenIdsOwnedByWallet(wallet, head, chainId),
      tail.length > 0
        ? this.blockchain.filterTokenIdsOwnedByWallet(wallet, tail, chainId)
        : Promise.resolve([]),
    ]);
    return this.sortOwnedNewestFirst([...verifiedHead, ...verifiedTail]);
  }

  private async resolveOwnedTokenIds(
    wallet: string,
    chainId: SupportedChainId,
    options?: { skipOnChainUnion?: boolean },
  ): Promise<number[]> {
    void this.blockchain
      .healOwnerRegistryIfIncomplete(chainId)
      .catch(() => undefined);
    const fromDb = await this.ownerIndex.getTokenIdsByOwner(wallet, chainId);
    if (options?.skipOnChainUnion) {
      if (fromDb.length === 0) return [];
      const verifiedDb = await this.blockchain.filterTokenIdsOwnedByWallet(
        wallet,
        fromDb,
        chainId,
      );
      return this.sortOwnedNewestFirst(verifiedDb);
    }
    const onChain = await this.blockchain.listTokenIdsOwnedOnChain(
      wallet,
      chainId,
    );
    const candidates = this.sortOwnedNewestFirst([
      ...new Set([...fromDb, ...onChain]),
    ]);
    if (candidates.length === 0) {
      return [];
    }
    const verified = await this.blockchain.filterTokenIdsOwnedByWallet(
      wallet,
      candidates,
      chainId,
    );
    return this.sortOwnedNewestFirst(verified);
  }

  private sortOwnedNewestFirst(tokenIds: number[]): number[] {
    return [...new Set(tokenIds)]
      .filter((n) => Number.isFinite(n) && n >= 0)
      .sort((a, b) => b - a);
  }

  private async loadPageUncached(
    wallet: string,
    uniqueTokenIds: number[],
    chain: SupportedChainId,
    _t0: bigint,
  ): Promise<PortfolioAssetsPageResponse> {
    const [metadataPack, holdings, registryKeys] = await Promise.all([
      this.rwaAssetResolve.batchPortfolioMetadata(uniqueTokenIds, chain),
      this.portfolioHoldings.getHoldingsBatch(wallet, uniqueTokenIds, chain),
      this.collectionService.collectionKeysByTokenIds(uniqueTokenIds, chain),
    ]);

    const metadataItems: PortfolioAssetsPageMetadataItem[] =
      metadataPack.items.map((it) => ({
        tokenId: it.tokenId,
        tokenURI: it.tokenURI,
        metadata: it.metadata,
        imageUrl: it.imageUrl,
        imageBackUrl: it.imageBackUrl,
      }));

    const metaByToken = new Map<number, Record<string, unknown>>();
    for (const it of metadataItems) {
      if (it.metadata && typeof it.metadata === 'object') {
        metaByToken.set(it.tokenId, it.metadata);
      }
    }

    const collectionKeys = await this.resolveCollectionKeys(
      uniqueTokenIds,
      metaByToken,
      registryKeys,
    );

    const uniqueKeys = [
      ...new Set(
        Object.values(collectionKeys)
          .map((k) => k.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];

    const snapshotRowMap =
      await this.collectionMarket.getSnapshotRowsForKeys(uniqueKeys);

    const marketItems = this.collectionMarket.portfolioMarketItemsFromIndex(
      uniqueKeys,
      snapshotRowMap,
      '365d',
    );

    perfLog('api', 'portfolioAssetsPage', elapsedMs(_t0), {
      chainId: chain,
      tokenCount: uniqueTokenIds.length,
      collectionKeys: uniqueKeys.length,
      snapshotRowsLoaded: snapshotRowMap.size,
      cache: 'miss',
      source: 'db',
    });

    return {
      ownedTokenIds: [],
      metadataItems,
      collectionKeys,
      marketItems,
      mintPreviews: {},
      holdings,
    };
  }

  private async resolveCollectionKeys(
    tokenIds: number[],
    metaByToken: Map<number, Record<string, unknown>>,
    registryKeys: Record<number, string>,
  ): Promise<Record<number, string>> {
    const out: Record<number, string> = {};
    for (const [idStr, key] of Object.entries(registryKeys)) {
      const id = Number(idStr);
      const k = key?.trim().toLowerCase();
      if (Number.isFinite(id) && k) out[id] = k;
    }
    const missing = tokenIds.filter((id) => !out[id]);

    // Portfolio list: never call chain/IPFS for collection keys — that was the
    // 20s+ waterfall. Keys come from rwa_tokens.collection_key or metadata stub;
    // unpriced tokens fall through to deferred mint-preview on the client.
    for (const tokenId of missing) {
      const meta = metaByToken.get(tokenId);
      if (!meta) continue;
      const comp = componentsFromMetadata(meta);
      if (comp) {
        out[tokenId] = computeMarketBucketKey(comp).toLowerCase();
      }
    }

    return out;
  }
}
