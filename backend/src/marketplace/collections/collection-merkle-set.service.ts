import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { IpfsGatewayResolverService } from '../../blockchain/ipfs-gateway-resolver.service';
import {
  computeMarketBucketKey,
  extractBucketComponentsFromMetadata,
} from '../utils/bucket-key.util';
import { RwaTokenRegistryService } from './rwa-token-registry.service';

/**
 * Merkle leaf discovery for collection criteria bids.
 * Prefers indexed `rwa_tokens` rows; falls back to on-chain + IPFS scan when needed.
 */
@Injectable()
export class CollectionMerkleSetService {
  private readonly cache = new Map<
    string,
    { tokenIds: string[]; expiresAtMs: number }
  >();
  private readonly inflight = new Map<
    string,
    Promise<{ tokenIds: string[] }>
  >();
  private static readonly MERKLE_TOKEN_LOOKUP_ATTEMPTS = 3;

  constructor(
    private readonly config: ConfigService,
    private readonly blockchain: BlockchainService,
    private readonly ipfsResolver: IpfsGatewayResolverService,
    private readonly rwaTokenRegistry: RwaTokenRegistryService,
  ) {}

  private cacheTtlMs(): number {
    return this.config.get<number>('marketplace.merkleSetCacheTtlMs') ?? 45_000;
  }

  private scanConcurrency(): number {
    return this.config.get<number>('marketplace.merkleScanConcurrency') ?? 4;
  }

  private preferRegistry(): boolean {
    return this.config.get<boolean>('marketplace.merklePreferRegistry') !== false;
  }

  invalidateForCollection(collectionKey: string): void {
    const k = collectionKey.toLowerCase();
    for (const cacheKey of [...this.cache.keys()]) {
      if (cacheKey.startsWith(`${k}:`)) {
        this.cache.delete(cacheKey);
      }
    }
    for (const key of [...this.inflight.keys()]) {
      if (key.startsWith(`${k}:`)) {
        this.inflight.delete(key);
      }
    }
  }

  async merkleEligibleTokenIds(
    collectionKey: string,
    options?: { bypassCache?: boolean },
  ): Promise<{ tokenIds: string[] }> {
    const k = collectionKey.toLowerCase();
    const { totalMinted } = await this.blockchain.getRwaInfo();
    const cacheKey = `${k}:${totalMinted}`;

    if (!options?.bypassCache) {
      const hit = this.cache.get(cacheKey);
      if (hit && hit.expiresAtMs > Date.now()) {
        return { tokenIds: hit.tokenIds };
      }
    }

    const existing = this.inflight.get(cacheKey);
    if (existing && !options?.bypassCache) {
      return existing;
    }

    const work = this.resolveMerkleTokenIds(k, totalMinted, options).finally(
      () => {
        if (this.inflight.get(cacheKey) === work) {
          this.inflight.delete(cacheKey);
        }
      },
    );
    if (!options?.bypassCache) {
      this.inflight.set(cacheKey, work);
    }

    const result = await work;
    if (!options?.bypassCache) {
      this.cache.set(cacheKey, {
        tokenIds: result.tokenIds,
        expiresAtMs: Date.now() + this.cacheTtlMs(),
      });
    }
    return result;
  }

  private async resolveMerkleTokenIds(
    collectionKeyLower: string,
    totalMinted: number,
    options?: { bypassCache?: boolean },
  ): Promise<{ tokenIds: string[] }> {
    if (
      !options?.bypassCache &&
      this.preferRegistry()
    ) {
      const fromRegistry =
        await this.rwaTokenRegistry.tokenIdsForCollectionKey(
          collectionKeyLower,
        );
      if (fromRegistry.length > 0) {
        return { tokenIds: fromRegistry };
      }
    }

    const tokenIds = await this.scanMintedTokenIdsForCollectionKey(
      collectionKeyLower,
      totalMinted,
    );
    return { tokenIds };
  }

  private async scanMintedTokenIdsForCollectionKey(
    targetKeyLower: string,
    totalMinted: number,
  ): Promise<string[]> {
    if (totalMinted <= 0) {
      return [];
    }
    const maxId = totalMinted - 1;
    const ids: string[] = [];
    const concurrency = this.scanConcurrency();
    for (let start = 0; start <= maxId; start += concurrency) {
      const end = Math.min(start + concurrency - 1, maxId);
      const chunk: number[] = [];
      for (let tid = start; tid <= end; tid++) {
        chunk.push(tid);
      }
      const flags = await Promise.all(
        chunk.map((tid) =>
          this.mintedTokenBelongsToCollection(tid, targetKeyLower),
        ),
      );
      for (let i = 0; i < chunk.length; i++) {
        if (flags[i]) ids.push(String(chunk[i]));
      }
    }
    ids.sort((a, b) => {
      const ba = BigInt(a);
      const bb = BigInt(b);
      if (ba < bb) return -1;
      if (ba > bb) return 1;
      return 0;
    });
    return ids;
  }

  private async mintedTokenBelongsToCollection(
    tokenId: number,
    targetKeyLower: string,
  ): Promise<boolean> {
    const max = CollectionMerkleSetService.MERKLE_TOKEN_LOOKUP_ATTEMPTS;
    for (let attempt = 0; attempt < max; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 100 * attempt));
      }
      try {
        const uri = await this.blockchain.getRwaTokenURI(tokenId);
        const meta = await this.ipfsResolver.fetchMetadataJson(uri);
        const comp = extractBucketComponentsFromMetadata(meta);
        if (!comp) return false;
        const key = computeMarketBucketKey(comp);
        return key.toLowerCase() === targetKeyLower;
      } catch {
        /* transient RPC / IPFS — retry */
      }
    }
    return false;
  }
}
