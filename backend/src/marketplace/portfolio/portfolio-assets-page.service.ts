import { Injectable } from '@nestjs/common';
import { CollectionMarketService } from '../collections/collection-market.service';
import type { CollectionMarketBundle } from '../collections/collection-market.service';
import { CollectionService } from '../collections/collection.service';
import { RwaAssetResolveService } from '../../blockchain/rwa-asset-resolve.service';
import {
  ChainConfigService,
  type SupportedChainId,
} from '../../blockchain/chain-config.service';
import { CardhedgerMarketDataService } from '../market-data/cardhedger-market-data.service';
import type { MarketCollectionPreview } from '../utils/market-reference.types';
import type { PortfolioHoldingBatchItem } from './portfolio-holding.service';
import { PortfolioHoldingService } from './portfolio-holding.service';
import {
  componentsFromMetadata,
  portfolioSnapshotCanPriceHoldings,
} from '../utils/portfolio-token-price.util';
import { computeMarketBucketKey } from '../utils/bucket-key.util';
import { perfNow, perfLog, elapsedMs } from '../../common/perf/perf';
import {
  PortfolioAssetsPageCacheService,
  type CachedPortfolioAssetsPagePayload,
} from './portfolio-assets-page-cache.service';

const MARKET_KEY_CHUNK = 60;
const KEY_RESOLVE_CONCURRENCY = 8;

export type PortfolioAssetsPageMetadataItem = {
  tokenId: number;
  tokenURI: string | null;
  metadata: Record<string, unknown> | null;
  imageUrl: string | null;
  imageBackUrl: string | null;
};

export type PortfolioAssetsPageResponse = {
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
    private readonly cardhedger: CardhedgerMarketDataService,
    private readonly portfolioHoldings: PortfolioHoldingService,
    private readonly chainConfig: ChainConfigService,
    private readonly pageCache: PortfolioAssetsPageCacheService,
  ) {}

  async loadPage(
    walletAddress: string,
    tokenIds: number[],
    chainId?: SupportedChainId,
  ): Promise<PortfolioAssetsPageResponse> {
    const chain = chainId ?? this.chainConfig.getDefaultChainId();
    const wallet = walletAddress.trim().toLowerCase();
    const uniqueTokenIds = [
      ...new Set(
        tokenIds
          .map((n) => Math.floor(Number(n)))
          .filter((n) => Number.isFinite(n) && n >= 0),
      ),
    ];
    if (uniqueTokenIds.length === 0) {
      return {
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
          cache: cached.layer,
        });
        return { ...cached.payload, holdings };
      }
    }

    const result = await this.loadPageUncached(
      wallet,
      uniqueTokenIds,
      chain,
      _t0,
    );

    if (this.pageCache.isEnabled()) {
      const { holdings, ...cacheable } = result;
      void this.pageCache.set(cacheKey, cacheable as CachedPortfolioAssetsPagePayload);
      void holdings;
    }

    return result;
  }

  private async loadPageUncached(
    wallet: string,
    uniqueTokenIds: number[],
    chain: SupportedChainId,
    _t0: bigint,
  ): Promise<PortfolioAssetsPageResponse> {
    const [metadataPack, holdings] = await Promise.all([
      this.rwaAssetResolve.batchRwaMetadata(uniqueTokenIds, chain),
      this.portfolioHoldings.getHoldingsBatch(wallet, uniqueTokenIds, chain),
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
      chain,
    );

    const uniqueKeys = [
      ...new Set(
        Object.values(collectionKeys)
          .map((k) => k.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];

    const marketItems: PortfolioAssetsPageResponse['marketItems'] = [];
    for (let i = 0; i < uniqueKeys.length; i += MARKET_KEY_CHUNK) {
      const chunk = uniqueKeys.slice(i, i + MARKET_KEY_CHUNK);
      const batch = await this.collectionMarket.batchPortfolioMarketData(chunk, {
        priceHistoryDuration: '365d',
        chainId: chain,
      });
      for (const it of batch.items) {
        marketItems.push({
          collectionKey: it.collectionKey,
          stats: it.stats,
          series: it.series,
        });
      }
    }

    const seriesByKey = new Map<string, CollectionMarketBundle | null>();
    for (const it of marketItems) {
      seriesByKey.set(it.collectionKey.toLowerCase(), it.series);
    }

    const unmatchedTokenIds = uniqueTokenIds.filter((tokenId) => {
      const key = collectionKeys[tokenId]?.toLowerCase();
      if (!key) return true;
      return !portfolioSnapshotCanPriceHoldings(seriesByKey.get(key));
    });

    const mintPreviews =
      unmatchedTokenIds.length > 0
        ? await this.cardhedger.getBatchMintPreviewsFromTokenIds(
            unmatchedTokenIds,
            chain,
          )
        : {};

    perfLog('api', 'portfolioAssetsPage', elapsedMs(_t0), {
      chainId: chain,
      tokenCount: uniqueTokenIds.length,
      collectionKeys: uniqueKeys.length,
      mintPreviews: unmatchedTokenIds.length,
      cache: 'miss',
    });

    return {
      metadataItems,
      collectionKeys,
      marketItems,
      mintPreviews,
      holdings,
    };
  }

  private async resolveCollectionKeys(
    tokenIds: number[],
    metaByToken: Map<number, Record<string, unknown>>,
    chainId: SupportedChainId,
  ): Promise<Record<number, string>> {
    const cached = await this.collectionService.collectionKeysByTokenIds(
      tokenIds,
      chainId,
    );
    const out: Record<number, string> = { ...cached };
    const missing = tokenIds.filter((id) => !out[id]);

    for (let i = 0; i < missing.length; i += KEY_RESOLVE_CONCURRENCY) {
      const chunk = missing.slice(i, i + KEY_RESOLVE_CONCURRENCY);
      await Promise.all(
        chunk.map(async (tokenId) => {
          try {
            const fromApi =
              await this.collectionService.resolveCollectionKeyFromTokenMetadata(
                String(tokenId),
                chainId,
              );
            if (fromApi) {
              out[tokenId] = fromApi.toLowerCase();
              return;
            }
          } catch {
            /* fall through */
          }
          const meta = metaByToken.get(tokenId);
          if (!meta) return;
          const comp = componentsFromMetadata(meta);
          if (!comp) return;
          out[tokenId] = computeMarketBucketKey(comp).toLowerCase();
        }),
      );
    }

    return out;
  }
}
