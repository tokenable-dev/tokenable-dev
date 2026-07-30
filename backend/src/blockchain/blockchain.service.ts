import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Contract } from 'ethers';
import { TOKENABLE_RWA_ABI } from './abis/tokenable-rwa.abi';
import {
  ChainConfigService,
  type SupportedChainId,
} from './chain-config.service';
import { perfNow, perfLog, elapsedMs } from '../common/perf/perf';
import {
  TTL_CACHE_PROVIDER,
  type TtlCacheProvider,
} from '../common/cache/ttl-cache.interface';
import { IpfsGatewayResolverService } from './ipfs-gateway-resolver.service';
import { pickRwaAssetDisplayImageRef } from '../marketplace/utils/collection-image.util';

const ETH_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
/** Owner scans cost ~totalMinted RPC calls each — cache briefly and coalesce. */
const TOKENS_BY_OWNER_CACHE_NS = 'rwa-tokens-by-owner';
const TOKENS_BY_OWNER_CACHE_TTL_MS = 30_000;

/** OpenZeppelin ERC721 — tokenId 미민팅 시 revert */
function isErc721InvalidTokenError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const err = e as { code?: string; reason?: string; shortMessage?: string };
  const blob =
    `${err.code ?? ''} ${err.reason ?? ''} ${err.shortMessage ?? ''}`.toLowerCase();
  return (
    err.code === 'CALL_EXCEPTION' &&
    (blob.includes('invalid token') ||
      blob.includes('nonexistent token') ||
      blob.includes('owner query for nonexistent'))
  );
}

@Injectable()
export class BlockchainService {
  private readonly rwaByChain = new Map<SupportedChainId, Contract>();
  /** Coalesces concurrent owner scans for the same wallet into one RPC pass. */
  private readonly tokensByOwnerInFlight = new Map<string, Promise<number[]>>();

  constructor(
    private readonly chainConfig: ChainConfigService,
    private readonly ipfs: IpfsGatewayResolverService,
    @Inject(TTL_CACHE_PROVIDER) private readonly ttlCache: TtlCacheProvider,
  ) {}

  /** Read-only TokenableRWA for the requested chain (cached per process). */
  private tokenableRwa(chainId?: SupportedChainId): Contract {
    const id = chainId ?? this.chainConfig.getDefaultChainId();
    const cached = this.rwaByChain.get(id);
    if (cached) return cached;
    const address = this.chainConfig.getRwaAddress(id);
    const contract = new Contract(
      address,
      TOKENABLE_RWA_ABI,
      this.chainConfig.createJsonRpcProvider(id),
    );
    this.rwaByChain.set(id, contract);
    return contract;
  }

  /** Used internally by `CollectionService` to enumerate minted token ids. */
  async getRwaInfo(chainId?: SupportedChainId): Promise<{
    name: string;
    symbol: string;
    totalMinted: number;
  }> {
    const rwa = this.tokenableRwa(chainId);
    const [name, symbol, totalMinted] = await Promise.all([
      rwa.name(),
      rwa.symbol(),
      rwa.totalMinted(),
    ]);
    return { name, symbol, totalMinted: Number(totalMinted) };
  }

  /** Returns the current on-chain owner of an RWA token (lowercase). Throws NotFoundException if not minted/burned. */
  async getRwaTokenOwner(
    tokenId: number,
    chainId?: SupportedChainId,
  ): Promise<string> {
    try {
      const owner: string = await this.tokenableRwa(chainId).ownerOf(tokenId);
      return owner.trim().toLowerCase();
    } catch (e: unknown) {
      if (isErc721InvalidTokenError(e)) {
        throw new NotFoundException(`RWA #${tokenId} does not exist on chain`);
      }
      throw e;
    }
  }

  async getRwaTokenURI(
    tokenId: number,
    chainId?: SupportedChainId,
  ): Promise<string> {
    try {
      return await this.tokenableRwa(chainId).tokenURI(tokenId);
    } catch (e: unknown) {
      if (isErc721InvalidTokenError(e)) {
        throw new NotFoundException(
          `RWA #${tokenId} does not exist on the configured contract (redeploy / contract address changed?)`,
        );
      }
      throw e;
    }
  }

  async getRwaTokensByOwner(
    address: string,
    chainId?: SupportedChainId,
  ): Promise<number[]> {
    const normalized = address.trim().toLowerCase();
    if (!ETH_ADDRESS.test(normalized)) {
      throw new BadRequestException('Invalid wallet address');
    }
    const cacheKey = `${chainId ?? this.chainConfig.getDefaultChainId()}:${normalized}`;

    const cached = this.ttlCache.get<number[]>(
      TOKENS_BY_OWNER_CACHE_NS,
      cacheKey,
    );
    if (cached) return cached;

    const inFlight = this.tokensByOwnerInFlight.get(cacheKey);
    if (inFlight) return inFlight;

    const scan = this.scanRwaTokensByOwner(normalized, chainId)
      .then((tokenIds) => {
        this.ttlCache.set(
          TOKENS_BY_OWNER_CACHE_NS,
          cacheKey,
          tokenIds,
          TOKENS_BY_OWNER_CACHE_TTL_MS,
        );
        return tokenIds;
      })
      .finally(() => {
        this.tokensByOwnerInFlight.delete(cacheKey);
      });
    this.tokensByOwnerInFlight.set(cacheKey, scan);
    return scan;
  }

  private async scanRwaTokensByOwner(
    normalized: string,
    chainId?: SupportedChainId,
  ): Promise<number[]> {
    const _t0 = perfNow();
    try {
      const { totalMinted } = await this.getRwaInfo(chainId);
      if (totalMinted <= 0) return [];

      const owners = await this.batchOwnerOf(
        Array.from({ length: totalMinted }, (_, i) => i + 1),
        24,
        chainId,
      );
      const tokenIds: number[] = [];
      for (const [tokenId, owner] of owners) {
        if (owner === normalized) tokenIds.push(tokenId);
      }
      tokenIds.sort((a, b) => a - b);
      return tokenIds;
    } finally {
      perfLog('rpc', 'tokensByOwnerScan', elapsedMs(_t0), {
        address: normalized.slice(0, 10),
        chainId: chainId ?? this.chainConfig.getDefaultChainId(),
      });
    }
  }

  /**
   * `ownerOf` for many token ids (bounded concurrency).
   * Used by portfolio daily snapshot holder discovery.
   */
  async batchOwnerOf(
    tokenIds: number[],
    concurrency = 24,
    chainId?: SupportedChainId,
  ): Promise<Map<number, string>> {
    const _t0 = perfNow();
    const rwa = this.tokenableRwa(chainId);
    const unique = [
      ...new Set(
        tokenIds
          .map((n) => Math.floor(Number(n)))
          .filter((n) => Number.isFinite(n) && n >= 0),
      ),
    ];
    const out = new Map<number, string>();
    if (unique.length === 0) return out;

    const parallel = Math.max(1, Math.min(Math.floor(concurrency), 64));
    for (let i = 0; i < unique.length; i += parallel) {
      const chunk = unique.slice(i, i + parallel);
      const settled = await Promise.allSettled(
        chunk.map(async (tokenId) => {
          const owner: string = await rwa.ownerOf(tokenId);
          return {
            tokenId,
            owner: String(owner).trim().toLowerCase(),
          };
        }),
      );
      for (const s of settled) {
        if (s.status !== 'fulfilled') continue;
        const { tokenId, owner } = s.value;
        if (owner) out.set(tokenId, owner);
      }
    }
    perfLog('rpc', 'batchOwnerOf', elapsedMs(_t0), { count: unique.length });
    return out;
  }

  /**
   * tokenURI → metadata JSON → browser-safe image URL (all server-side, gateway fallbacks + CID cache).
   */
  async getResolvedRwaAsset(
    tokenId: number,
    chainId?: SupportedChainId,
  ): Promise<{
    tokenId: number;
    tokenURI: string;
    metadata: Record<string, unknown> | null;
    imageUrl: string | null;
  }> {
    const tokenURI = await this.getRwaTokenURI(tokenId, chainId);
    if (!tokenURI?.trim()) {
      return { tokenId, tokenURI: '', metadata: null, imageUrl: null };
    }
    try {
      const metadata = await this.ipfs.fetchMetadataJson(tokenURI);
      const ref = pickRwaAssetDisplayImageRef(metadata);
      const imageUrl = ref ? await this.ipfs.resolveImageToHttps(ref) : null;
      return { tokenId, tokenURI, metadata, imageUrl };
    } catch {
      return { tokenId, tokenURI, metadata: null, imageUrl: null };
    }
  }

  async resolveMediaUrl(uri: string): Promise<string | null> {
    return this.ipfs.resolveUriToHttps(uri);
  }

  /**
   * tokenURI + IPFS JSON + resolved image URL (bounded fan-out per token).
   */
  async batchRwaMetadata(
    tokenIds: number[],
    chainId?: SupportedChainId,
  ): Promise<{
    items: Array<{
      tokenId: number;
      tokenURI: string | null;
      metadata: Record<string, unknown> | null;
      imageUrl: string | null;
    }>;
  }> {
    const _t0 = perfNow();
    const unique = [
      ...new Set(tokenIds.map((n) => Math.floor(Number(n)))),
    ].filter((n) => n >= 0);
    const concurrency = 8;
    const items: Array<{
      tokenId: number;
      tokenURI: string | null;
      metadata: Record<string, unknown> | null;
      imageUrl: string | null;
    }> = [];

    for (let i = 0; i < unique.length; i += concurrency) {
      const chunk = unique.slice(i, i + concurrency);
      const settled = await Promise.allSettled(
        chunk.map(async (tokenId) => {
          let tokenURI: string | null = null;
          try {
            tokenURI = await this.getRwaTokenURI(tokenId, chainId);
            if (!tokenURI?.trim()) {
              return {
                tokenId,
                tokenURI: null,
                metadata: null,
                imageUrl: null,
              };
            }
            const metadata = await this.ipfs.fetchMetadataJson(tokenURI);
            const ref = pickRwaAssetDisplayImageRef(metadata);
            const imageUrl = ref
              ? await this.ipfs.resolveImageToHttps(ref)
              : null;
            return { tokenId, tokenURI, metadata, imageUrl };
          } catch {
            return { tokenId, tokenURI, metadata: null, imageUrl: null };
          }
        }),
      );
      for (const s of settled) {
        if (s.status === 'fulfilled') {
          items.push(s.value);
        }
      }
    }

    items.sort((a, b) => a.tokenId - b.tokenId);
    perfLog('rpc', 'batchRwaMetadata', elapsedMs(_t0), { count: unique.length });
    return { items };
  }
}
