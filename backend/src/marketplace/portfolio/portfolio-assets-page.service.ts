import { Injectable } from '@nestjs/common';
import { CollectionMarketService } from '../collections/collection-market.service';
import type { CollectionMarketBundle } from '../collections/collection-market.service';
import { CollectionService } from '../collections/collection.service';
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
import { PORTFOLIO_ASSETS_PAGE_MAX } from './dto/portfolio-assets-page.dto';

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
  ): Promise<PortfolioAssetsPageResponse> {
    const chain = chainId ?? this.chainConfig.getDefaultChainId();
    const wallet = walletAddress.trim().toLowerCase();

    const ownedTokenIds = await this.resolveOwnedTokenIds(wallet, chain);
    const ownedSet = new Set(ownedTokenIds);

    const requested = [
      ...new Set(
        (tokenIds ?? [])
          .map((n) => Math.floor(Number(n)))
          .filter((n) => Number.isFinite(n) && n >= 0),
      ),
    ].filter((id) => ownedSet.has(id));

    const uniqueTokenIds =
      requested.length > 0
        ? requested
        : ownedTokenIds.slice(0, PORTFOLIO_ASSETS_PAGE_MAX);

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
    const cacheKey = this.pageCache.buildKey(chain, wallet, uniqueTokenIds);

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

  /** DB owner index first; RPC ownerOf scan only when index is empty and incomplete. */
  private async resolveOwnedTokenIds(
    wallet: string,
    chainId: SupportedChainId,
  ): Promise<number[]> {
    const fromDb = await this.ownerIndex.getTokenIdsByOwner(wallet, chainId);
    if (await this.ownerIndex.isIndexReady(chainId)) {
      return this.sortOwnedNewestFirst(fromDb);
    }
    if (fromDb.length > 0) {
      return this.sortOwnedNewestFirst(fromDb);
    }
    const fromChain = await this.blockchain.getRwaTokensByOwner(wallet, chainId);
    return this.sortOwnedNewestFirst(fromChain);
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
    const [metadataPack, holdings, registryKeys, snapshotIndex] = await Promise.all([
      this.rwaAssetResolve.batchPortfolioMetadata(uniqueTokenIds, chain),
      this.portfolioHoldings.getHoldingsBatch(wallet, uniqueTokenIds, chain),
      this.collectionService.collectionKeysByTokenIds(uniqueTokenIds, chain),
      this.collectionMarket.getSnapshotPriceIndex(),
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

    const marketItems = this.collectionMarket.portfolioMarketItemsFromIndex(
      uniqueKeys,
      snapshotIndex,
      '365d',
    );

    perfLog('api', 'portfolioAssetsPage', elapsedMs(_t0), {
      chainId: chain,
      tokenCount: uniqueTokenIds.length,
      collectionKeys: uniqueKeys.length,
      snapshotIndexSize: snapshotIndex.size,
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
