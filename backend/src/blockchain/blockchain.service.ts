import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Contract } from 'ethers';
import { TOKENABLE_RWA_CONTRACT } from './constants/injection-tokens';
import { IpfsGatewayResolverService } from './ipfs-gateway-resolver.service';
import { pickRwaAssetDisplayImageRef } from '../marketplace/utils/collection-image.util';

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
  constructor(
    @Inject(TOKENABLE_RWA_CONTRACT)
    private readonly tokenableRwa: Contract,
    private readonly ipfs: IpfsGatewayResolverService,
  ) {}

  /** Used internally by `CollectionService` to enumerate minted token ids. */
  async getRwaInfo(): Promise<{
    name: string;
    symbol: string;
    totalMinted: number;
  }> {
    const [name, symbol, totalMinted] = await Promise.all([
      this.tokenableRwa.name(),
      this.tokenableRwa.symbol(),
      this.tokenableRwa.totalMinted(),
    ]);
    return { name, symbol, totalMinted: Number(totalMinted) };
  }

  async getRwaTokenURI(tokenId: number): Promise<string> {
    try {
      return await this.tokenableRwa.tokenURI(tokenId);
    } catch (e: unknown) {
      if (isErc721InvalidTokenError(e)) {
        throw new NotFoundException(
          `RWA #${tokenId} does not exist on the configured contract (redeploy / contract address changed?)`,
        );
      }
      throw e;
    }
  }

  async getRwaTokensByOwner(address: string): Promise<number[]> {
    const tokenIds: bigint[] = await this.tokenableRwa.tokensOfOwner(address);
    return tokenIds.map(Number);
  }

  /**
   * tokenURI → metadata JSON → browser-safe image URL (all server-side, gateway fallbacks + CID cache).
   */
  async getResolvedRwaAsset(tokenId: number): Promise<{
    tokenId: number;
    tokenURI: string;
    metadata: Record<string, unknown> | null;
    imageUrl: string | null;
  }> {
    const tokenURI = await this.getRwaTokenURI(tokenId);
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
  async batchRwaMetadata(tokenIds: number[]): Promise<{
    items: Array<{
      tokenId: number;
      tokenURI: string | null;
      metadata: Record<string, unknown> | null;
      imageUrl: string | null;
    }>;
  }> {
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
            tokenURI = await this.getRwaTokenURI(tokenId);
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
    return { items };
  }
}
