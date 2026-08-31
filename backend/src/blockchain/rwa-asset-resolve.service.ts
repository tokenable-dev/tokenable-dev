import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RwaToken } from '../marketplace/entities/rwa-token.entity';
import { pickRwaAssetDisplayImageRef } from '../marketplace/utils/collection-image.util';
import { BlockchainService } from './blockchain.service';
import { ChainConfigService, type SupportedChainId } from './chain-config.service';
import { IpfsGatewayResolverService } from './ipfs-gateway-resolver.service';

type ResolvedAssetPayload = {
  tokenId: number;
  tokenURI: string;
  metadata: Record<string, unknown> | null;
  imageUrl: string | null;
  imageBackUrl: string | null;
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

  private rwaContractAddress(chainId?: SupportedChainId): string {
    return this.chainConfig.getRwaAddress(
      chainId ?? this.chainConfig.getDefaultChainId(),
    );
  }

  private async displayImageFields(
    tokenId: number,
    chainId?: SupportedChainId,
  ): Promise<{ front: string | null; back: string | null }> {
    const contract = this.rwaContractAddress(chainId);
    if (!contract) return { front: null, back: null };
    const row = await this.rwaTokenRepo.findOne({
      where: { tokenContract: contract, tokenId: String(tokenId) },
      select: ['displayImageUrl', 'displayImageBackUrl'],
    });
    return {
      front: row?.displayImageUrl?.trim() || null,
      back: row?.displayImageBackUrl?.trim() || null,
    };
  }

  private async resolveOverrideToHttps(
    override: string,
  ): Promise<string | null> {
    const ref = override.trim();
    if (!ref) return null;
    if (/^https?:\/\//i.test(ref)) return ref;
    return this.ipfs.resolveUriToHttps(ref);
  }

  /** DB registry row for this chain's RWA contract only (never cross-chain by tokenId). */
  private async findRegistryRow(
    tokenId: number,
    chainId?: SupportedChainId,
  ): Promise<RwaToken | null> {
    const contract = this.rwaContractAddress(chainId);
    return this.rwaTokenRepo.findOne({
      where: { tokenContract: contract, tokenId: String(tokenId) },
    });
  }

  private async resolveFromRegistryRow(
    tokenId: number,
    row: RwaToken,
  ): Promise<ResolvedAssetPayload | null> {
    const displayOverride = row.displayImageUrl?.trim();
    const imageBackUrl = row.displayImageBackUrl?.trim() || null;
    const tokenUri = row.tokenUri?.trim() ?? '';

    if (displayOverride) {
      const imageUrl = await this.resolveOverrideToHttps(displayOverride);
      if (imageUrl) {
        return {
          tokenId,
          tokenURI: tokenUri,
          metadata: null,
          imageUrl,
          imageBackUrl,
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
        imageBackUrl,
      };
    } catch {
      return {
        tokenId,
        tokenURI: tokenUri,
        metadata: null,
        imageUrl: null,
        imageBackUrl,
      };
    }
  }

  private async resolveFromDbRegistry(
    tokenId: number,
    chainId?: SupportedChainId,
  ): Promise<ResolvedAssetPayload | null> {
    const row = await this.findRegistryRow(tokenId, chainId);
    if (!row) return null;
    return this.resolveFromRegistryRow(tokenId, row);
  }

  private needsDbFallback(payload: ResolvedAssetPayload): boolean {
    return !payload.tokenURI?.trim() && !payload.imageUrl?.trim();
  }

  private async resolveOnChainOrDb(
    tokenId: number,
    chainId?: SupportedChainId,
  ): Promise<ResolvedAssetPayload> {
    try {
      const onChain = await this.blockchain.getResolvedRwaAsset(tokenId, chainId);
      const payload: ResolvedAssetPayload = {
        ...onChain,
        imageBackUrl: null,
      };
      if (!this.needsDbFallback(payload)) return payload;
    } catch {
      /* invalid on configured contract — fall through to DB */
    }

    const fromDb = await this.resolveFromDbRegistry(tokenId, chainId);
    if (fromDb) return fromDb;

    return {
      tokenId,
      tokenURI: '',
      metadata: null,
      imageUrl: null,
      imageBackUrl: null,
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

  async getResolvedRwaAsset(
    tokenId: number,
    chainId?: SupportedChainId,
  ): Promise<{
    tokenId: number;
    tokenURI: string;
    metadata: Record<string, unknown> | null;
    imageUrl: string | null;
    imageBackUrl: string | null;
    displayImageUrlOverride: string | null;
  }> {
    const base = await this.resolveOnChainOrDb(tokenId, chainId);
    const fields = await this.displayImageFields(tokenId, chainId);
    const imageBackUrl =
      (fields.back
        ? await this.resolveOverrideToHttps(fields.back)
        : null) ??
      base.imageBackUrl ??
      null;
    if (!fields.front) {
      return {
        ...base,
        imageBackUrl,
        displayImageUrlOverride: null,
      };
    }
    const imageUrl = await this.resolveOverrideToHttps(fields.front);
    return {
      ...base,
      imageUrl: imageUrl ?? base.imageUrl,
      imageBackUrl,
      displayImageUrlOverride: fields.front,
    };
  }

  async batchRwaMetadata(
    tokenIds: number[],
    chainId?: SupportedChainId,
  ): Promise<{
    items: Array<{
      tokenId: number;
      tokenURI: string | null;
      metadata: Record<string, unknown> | null;
      imageUrl: string | null;
      imageBackUrl: string | null;
      displayImageUrlOverride: string | null;
    }>;
  }> {
    const base = await this.blockchain.batchRwaMetadata(tokenIds, chainId);
    const contract = this.rwaContractAddress(chainId);
    const overrides = new Map<number, string>();
    const registryRows = new Map<number, RwaToken>();

    const ids = base.items.map((i) => String(i.tokenId));
    if (ids.length > 0) {
      const rows = await this.rwaTokenRepo.find({
        where: { tokenContract: contract, tokenId: In(ids) },
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
          imageBackUrl:
            registryRows.get(item.tokenId)?.displayImageBackUrl?.trim() || null,
        };

        if (this.needsDbFallback(resolved)) {
          const row = registryRows.get(item.tokenId);
          if (row) {
            const fromDb = await this.resolveFromRegistryRow(item.tokenId, row);
            if (fromDb) resolved = fromDb;
          }
        }

        const rowBack = registryRows.get(item.tokenId)?.displayImageBackUrl?.trim();
        const imageBackUrl = rowBack
          ? (await this.resolveOverrideToHttps(rowBack)) ?? resolved.imageBackUrl
          : resolved.imageBackUrl;

        const override = overrides.get(item.tokenId) ?? null;
        if (!override) {
          return {
            tokenId: resolved.tokenId,
            tokenURI: resolved.tokenURI || null,
            metadata: resolved.metadata,
            imageUrl: resolved.imageUrl,
            imageBackUrl,
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
          imageBackUrl,
          displayImageUrlOverride: override,
        };
      }),
    );

    return { items };
  }
}
