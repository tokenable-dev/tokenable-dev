import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RwaToken } from '../marketplace/entities/rwa-token.entity';
import { pickRwaAssetDisplayImageRef } from '../marketplace/utils/collection-image.util';
import { BlockchainService } from './blockchain.service';
import { ChainConfigService } from './chain-config.service';
import { IpfsGatewayResolverService } from './ipfs-gateway-resolver.service';

type ResolvedAssetPayload = {
  tokenId: number;
  tokenURI: string;
  metadata: Record<string, unknown> | null;
  imageUrl: string | null;
};

@Injectable()
export class RwaAssetResolveService {
  constructor(
    private readonly blockchain: BlockchainService,
    private readonly ipfs: IpfsGatewayResolverService,
    private readonly config: ConfigService,
    private readonly chainConfig: ChainConfigService,
    @InjectRepository(RwaToken)
    private readonly rwaTokenRepo: Repository<RwaToken>,
  ) {}

  private rwaContractAddress(): string {
    return this.chainConfig.getRwaAddress(this.chainConfig.getDefaultChainId());
  }

  private async displayImageOverride(
    tokenId: number,
  ): Promise<string | null> {
    const contract = this.rwaContractAddress();
    if (!contract) return null;
    const row = await this.rwaTokenRepo.findOne({
      where: { tokenContract: contract, tokenId: String(tokenId) },
      select: ['displayImageUrl'],
    });
    const url = row?.displayImageUrl?.trim();
    return url || null;
  }

  private async resolveOverrideToHttps(
    override: string,
  ): Promise<string | null> {
    const ref = override.trim();
    if (!ref) return null;
    if (/^https?:\/\//i.test(ref)) return ref;
    return this.ipfs.resolveUriToHttps(ref);
  }

  /** DB registry row when on-chain tokenURI is unavailable (chain mismatch / redeploy). */
  private async findRegistryRow(tokenId: number): Promise<RwaToken | null> {
    const contract = this.rwaContractAddress();
    if (contract) {
      const scoped = await this.rwaTokenRepo.findOne({
        where: { tokenContract: contract, tokenId: String(tokenId) },
      });
      if (scoped) return scoped;
    }
    return this.rwaTokenRepo.findOne({
      where: { tokenId: String(tokenId) },
    });
  }

  private async resolveFromRegistryRow(
    tokenId: number,
    row: RwaToken,
  ): Promise<ResolvedAssetPayload | null> {
    const displayOverride = row.displayImageUrl?.trim();
    const tokenUri = row.tokenUri?.trim() ?? '';

    if (displayOverride) {
      const imageUrl = await this.resolveOverrideToHttps(displayOverride);
      if (imageUrl) {
        return {
          tokenId,
          tokenURI: tokenUri,
          metadata: null,
          imageUrl,
        };
      }
    }

    if (!tokenUri) return null;

    try {
      const metadata = await this.ipfs.fetchMetadataJson(tokenUri);
      const ref = pickRwaAssetDisplayImageRef(metadata);
      const imageUrl = ref ? await this.ipfs.resolveImageToHttps(ref) : null;
      return {
        tokenId,
        tokenURI: tokenUri,
        metadata,
        imageUrl,
      };
    } catch {
      return {
        tokenId,
        tokenURI: tokenUri,
        metadata: null,
        imageUrl: null,
      };
    }
  }

  private async resolveFromDbRegistry(
    tokenId: number,
  ): Promise<ResolvedAssetPayload | null> {
    const row = await this.findRegistryRow(tokenId);
    if (!row) return null;
    return this.resolveFromRegistryRow(tokenId, row);
  }

  private needsDbFallback(payload: ResolvedAssetPayload): boolean {
    return !payload.tokenURI?.trim() && !payload.imageUrl?.trim();
  }

  private async resolveOnChainOrDb(tokenId: number): Promise<ResolvedAssetPayload> {
    try {
      const onChain = await this.blockchain.getResolvedRwaAsset(tokenId);
      if (!this.needsDbFallback(onChain)) return onChain;
    } catch {
      /* invalid on configured contract — fall through to DB */
    }

    const fromDb = await this.resolveFromDbRegistry(tokenId);
    if (fromDb) return fromDb;

    return {
      tokenId,
      tokenURI: '',
      metadata: null,
      imageUrl: null,
    };
  }

  /**
   * Resolve display image from DB registry only (no on-chain tokenURI fetch).
   * Used for admin card lists where N chain reads would be too slow.
   */
  async resolveAssetFromRegistryRow(
    row: RwaToken,
  ): Promise<{ catalogImageUrl: string | null; resolvedImageUrl: string | null }> {
    const tokenId = Number(row.tokenId);
    if (!Number.isFinite(tokenId) || tokenId < 0) {
      return { catalogImageUrl: null, resolvedImageUrl: null };
    }
    const payload = await this.resolveFromRegistryRow(tokenId, row);
    const imageUrl = payload?.imageUrl ?? null;
    return {
      catalogImageUrl: imageUrl,
      resolvedImageUrl: imageUrl,
    };
  }

  async getResolvedRwaAsset(tokenId: number): Promise<{
    tokenId: number;
    tokenURI: string;
    metadata: Record<string, unknown> | null;
    imageUrl: string | null;
    displayImageUrlOverride: string | null;
  }> {
    const base = await this.resolveOnChainOrDb(tokenId);
    const override = await this.displayImageOverride(tokenId);
    if (!override) {
      return { ...base, displayImageUrlOverride: null };
    }
    const imageUrl = await this.resolveOverrideToHttps(override);
    return {
      ...base,
      imageUrl: imageUrl ?? base.imageUrl,
      displayImageUrlOverride: override,
    };
  }

  async batchRwaMetadata(tokenIds: number[]): Promise<{
    items: Array<{
      tokenId: number;
      tokenURI: string | null;
      metadata: Record<string, unknown> | null;
      imageUrl: string | null;
      displayImageUrlOverride: string | null;
    }>;
  }> {
    const base = await this.blockchain.batchRwaMetadata(tokenIds);
    const contract = this.rwaContractAddress();
    const overrides = new Map<number, string>();
    const registryRows = new Map<number, RwaToken>();

    const ids = base.items.map((i) => String(i.tokenId));
    if (ids.length > 0) {
      const rows = await this.rwaTokenRepo.find({
        where: contract
          ? [
              { tokenContract: contract, tokenId: In(ids) },
              { tokenId: In(ids) },
            ]
          : { tokenId: In(ids) },
      });
      for (const row of rows) {
        const tid = Number(row.tokenId);
        if (!Number.isFinite(tid)) continue;
        if (!registryRows.has(tid)) registryRows.set(tid, row);
        const url = row.displayImageUrl?.trim();
        if (url) overrides.set(tid, url);
      }
    }

    const items = await Promise.all(
      base.items.map(async (item) => {
        let resolved: ResolvedAssetPayload = {
          tokenId: item.tokenId,
          tokenURI: item.tokenURI ?? '',
          metadata: item.metadata,
          imageUrl: item.imageUrl,
        };

        if (this.needsDbFallback(resolved)) {
          const row = registryRows.get(item.tokenId);
          if (row) {
            const fromDb = await this.resolveFromRegistryRow(item.tokenId, row);
            if (fromDb) resolved = fromDb;
          }
        }

        const override = overrides.get(item.tokenId) ?? null;
        if (!override) {
          return {
            tokenId: resolved.tokenId,
            tokenURI: resolved.tokenURI || null,
            metadata: resolved.metadata,
            imageUrl: resolved.imageUrl,
            displayImageUrlOverride: null,
          };
        }
        const imageUrl =
          (await this.resolveOverrideToHttps(override)) ?? resolved.imageUrl;
        return {
          tokenId: resolved.tokenId,
          tokenURI: resolved.tokenURI || null,
          metadata: resolved.metadata,
          imageUrl,
          displayImageUrlOverride: override,
        };
      }),
    );

    return { items };
  }
}
