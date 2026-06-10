import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RwaToken } from '../marketplace/entities/rwa-token.entity';
import { BlockchainService } from './blockchain.service';
import { IpfsGatewayResolverService } from './ipfs-gateway-resolver.service';

@Injectable()
export class RwaAssetResolveService {
  constructor(
    private readonly blockchain: BlockchainService,
    private readonly ipfs: IpfsGatewayResolverService,
    private readonly config: ConfigService,
    @InjectRepository(RwaToken)
    private readonly rwaTokenRepo: Repository<RwaToken>,
  ) {}

  private rwaContractAddress(): string {
    return (
      this.config.get<string>('RWA_CONTRACT_ADDRESS')?.trim().toLowerCase() ??
      ''
    );
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

  async getResolvedRwaAsset(tokenId: number): Promise<{
    tokenId: number;
    tokenURI: string;
    metadata: Record<string, unknown> | null;
    imageUrl: string | null;
    displayImageUrlOverride: string | null;
  }> {
    const base = await this.blockchain.getResolvedRwaAsset(tokenId);
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

    if (contract && base.items.length > 0) {
      const ids = base.items.map((i) => String(i.tokenId));
      const rows = await this.rwaTokenRepo.find({
        where: {
          tokenContract: contract,
          tokenId: In(ids),
        },
        select: ['tokenId', 'displayImageUrl'],
      });
      for (const row of rows) {
        const url = row.displayImageUrl?.trim();
        if (!url) continue;
        const tid = Number(row.tokenId);
        if (Number.isFinite(tid)) overrides.set(tid, url);
      }
    }

    const items = await Promise.all(
      base.items.map(async (item) => {
        const override = overrides.get(item.tokenId) ?? null;
        if (!override) {
          return { ...item, displayImageUrlOverride: null };
        }
        const imageUrl =
          (await this.resolveOverrideToHttps(override)) ?? item.imageUrl;
        return {
          ...item,
          imageUrl,
          displayImageUrlOverride: override,
        };
      }),
    );

    return { items };
  }
}
