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

  private registryMetadataUri(row: RwaToken): string {
    const tokenUri = row.tokenUri?.trim();
    if (tokenUri) return tokenUri;
    const cid = row.metadataCid?.trim();
    if (!cid) return '';
    return /^ipfs:\/\//i.test(cid) ? cid : `ipfs://${cid}`;
  }

  private async fetchMetadataJsonSafe(
    tokenUri: string,
  ): Promise<Record<string, unknown> | null> {
    const uri = tokenUri.trim();
    if (!uri) return null;
    try {
      return await this.ipfs.fetchMetadataJson(uri);
    } catch {
      return null;
    }
  }

  private async resolveImageFromMetadata(
    metadata: Record<string, unknown> | null,
  ): Promise<string | null> {
    if (!metadata) return null;
    const ref = pickRwaAssetDisplayImageRef(metadata);
    return ref ? await this.ipfs.resolveImageToHttps(ref) : null;
  }

  private async ensureMetadata(
    payload: ResolvedAssetPayload,
    row?: RwaToken | null,
  ): Promise<ResolvedAssetPayload> {
    if (payload.metadata) return payload;

    const uris = [
      payload.tokenURI?.trim(),
      row ? this.registryMetadataUri(row) : '',
    ].filter(Boolean) as string[];

    for (const uri of uris) {
      const metadata = await this.fetchMetadataJsonSafe(uri);
      if (!metadata) continue;
      return {
        ...payload,
        tokenURI: payload.tokenURI?.trim() ? payload.tokenURI : uri,
        metadata,
        imageUrl: payload.imageUrl ?? (await this.resolveImageFromMetadata(metadata)),
      };
    }

    return payload;
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
    const tokenUri = this.registryMetadataUri(row);

    let imageUrl: string | null = null;
    if (displayOverride) {
      imageUrl = await this.resolveOverrideToHttps(displayOverride);
    }

    const metadata = tokenUri
      ? await this.fetchMetadataJsonSafe(tokenUri)
      : null;
    if (!imageUrl && metadata) {
      imageUrl = await this.resolveImageFromMetadata(metadata);
    }

    if (!imageUrl && !metadata && !tokenUri) return null;

    return this.ensureMetadata(
      {
        tokenId,
        tokenURI: tokenUri,
        metadata,
        imageUrl,
        imageBackUrl,
      },
      row,
    );
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
    let base = await this.resolveOnChainOrDb(tokenId, chainId);
    const registryRow = await this.findRegistryRow(tokenId, chainId);
    base = await this.ensureMetadata(base, registryRow);
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

  private stubMetadataFromRegistryRow(
    row: RwaToken,
  ): Record<string, unknown> | null {
    const name = row.displayName?.trim();
    const cert = row.certNumber?.trim();
    if (!name && !cert) return null;
    const meta: Record<string, unknown> = {};
    if (name) meta.name = name;
    if (cert) {
      meta.properties = {
        graded: {
          gradingCompany: 'PSA',
          psa: { certNumber: cert },
        },
      };
    }
    return meta;
  }

  private async fetchMetadataJsonByUriMap(
    uris: string[],
  ): Promise<Map<string, Record<string, unknown> | null>> {
    const unique = [...new Set(uris.map((u) => u.trim()).filter(Boolean))];
    const out = new Map<string, Record<string, unknown> | null>();
    const concurrency = 4;
    for (let i = 0; i < unique.length; i += concurrency) {
      const chunk = unique.slice(i, i + concurrency);
      await Promise.all(
        chunk.map(async (uri) => {
          out.set(uri, await this.fetchMetadataJsonSafe(uri));
        }),
      );
    }
    return out;
  }

  /**
   * Portfolio list path — DB registry batch + deduped IPFS metadata reads.
   * No on-chain tokenURI unless the token has no registry row.
   */
  async batchPortfolioMetadata(
    tokenIds: number[],
    chainId?: SupportedChainId,
  ): ReturnType<RwaAssetResolveService['batchRwaMetadata']> {
    return this.batchRwaMetadata(tokenIds, chainId);
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
    const unique = [
      ...new Set(
        tokenIds
          .map((n) => Math.floor(Number(n)))
          .filter((n) => Number.isFinite(n) && n >= 0),
      ),
    ];
    if (unique.length === 0) return { items: [] };

    const contract = this.rwaContractAddress(chainId);
    const overrides = new Map<number, string>();
    const registryRows = new Map<number, RwaToken>();

    if (contract) {
      const rows = await this.rwaTokenRepo.find({
        where: { tokenContract: contract, tokenId: In(unique.map(String)) },
      });
      for (const row of rows) {
        const tid = Number(row.tokenId);
        if (!Number.isFinite(tid)) continue;
        registryRows.set(tid, row);
        const url = row.displayImageUrl?.trim();
        if (url) overrides.set(tid, url);
      }
    }

    const needsOnChain = unique.filter((tokenId) => {
      const row = registryRows.get(tokenId);
      return !row || !this.registryMetadataUri(row);
    });

    const onChainById = new Map<
      number,
      {
        tokenURI: string | null;
        metadata: Record<string, unknown> | null;
        imageUrl: string | null;
      }
    >();
    if (needsOnChain.length > 0) {
      const base = await this.blockchain.batchRwaMetadata(needsOnChain, chainId);
      for (const item of base.items) {
        onChainById.set(item.tokenId, item);
      }
    }

    const registryUris: string[] = [];
    for (const tokenId of unique) {
      const row = registryRows.get(tokenId);
      if (!row) continue;
      const uri = this.registryMetadataUri(row);
      if (uri) registryUris.push(uri);
    }
    const metadataByUri = await this.fetchMetadataJsonByUriMap(registryUris);
    const httpsBackCache = new Map<string, string | null>();

    const items = await Promise.all(
      unique.map(async (tokenId) => {
        const row = registryRows.get(tokenId);
        const registryUri = row ? this.registryMetadataUri(row) : '';

        let metadata: Record<string, unknown> | null = null;
        if (registryUri) {
          metadata = metadataByUri.get(registryUri) ?? null;
        }
        if (!metadata && row) {
          metadata = this.stubMetadataFromRegistryRow(row);
        }
        const onChain = onChainById.get(tokenId);
        if (!metadata) {
          metadata = onChain?.metadata ?? null;
        }

        const override = overrides.get(tokenId) ?? null;
        let imageUrl: string | null = null;
        if (override) {
          imageUrl = await this.resolveOverrideToHttps(override);
        } else if (metadata) {
          imageUrl = await this.resolveImageFromMetadata(metadata);
        } else {
          imageUrl = onChain?.imageUrl ?? null;
        }

        let imageBackUrl: string | null = null;
        const rowBack = row?.displayImageBackUrl?.trim();
        if (rowBack) {
          if (!httpsBackCache.has(rowBack)) {
            httpsBackCache.set(
              rowBack,
              (await this.resolveOverrideToHttps(rowBack)) ?? null,
            );
          }
          imageBackUrl = httpsBackCache.get(rowBack) ?? null;
        }

        const tokenURI = registryUri || onChain?.tokenURI?.trim() || null;

        if (!override) {
          return {
            tokenId,
            tokenURI,
            metadata,
            imageUrl,
            imageBackUrl,
            displayImageUrlOverride: null,
          };
        }

        return {
          tokenId,
          tokenURI,
          metadata,
          imageUrl: imageUrl ?? (await this.resolveImageFromMetadata(metadata)),
          imageBackUrl,
          displayImageUrlOverride: override,
        };
      }),
    );

    items.sort((a, b) => a.tokenId - b.tokenId);
    return { items };
  }
}
