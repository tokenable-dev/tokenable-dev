import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RwaAssetResolveService } from '../../blockchain/rwa-asset-resolve.service';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { IpfsGatewayResolverService } from '../../blockchain/ipfs-gateway-resolver.service';
import { Order, OrderSide, OrderStatus } from '../entities/order.entity';
import { RwaToken } from '../entities/rwa-token.entity';
import { pickRwaAssetDisplayImageRef } from '../utils/collection-image.util';
import { RwaTokenRegistryService } from './rwa-token-registry.service';

export type AdminListedRwaCardRow = {
  tokenId: number;
  orderHash: string;
  collectionKey: string | null;
  priceUsdc: number;
  displayName: string | null;
  certNumber: string | null;
  displayImageUrl: string | null;
  catalogImageUrl: string | null;
  resolvedImageUrl: string | null;
  offerer: string;
};

@Injectable()
export class RwaTokenAdminService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(RwaToken)
    private readonly rwaTokenRepo: Repository<RwaToken>,
    private readonly config: ConfigService,
    private readonly blockchain: BlockchainService,
    private readonly ipfs: IpfsGatewayResolverService,
    private readonly rwaAssetResolve: RwaAssetResolveService,
    private readonly rwaTokenRegistry: RwaTokenRegistryService,
  ) {}

  private rwaContractAddress(): string {
    return (
      this.config.get<string>('RWA_CONTRACT_ADDRESS')?.trim().toLowerCase() ??
      ''
    );
  }

  private assertImageUrl(url: string): void {
    const t = url.trim();
    if (!t) return;
    if (!/^https?:\/\//i.test(t) && !/^ipfs:\/\//i.test(t)) {
      throw new BadRequestException('Invalid display image URL');
    }
  }

  async listActiveListedCards(): Promise<{ items: AdminListedRwaCardRow[] }> {
    const orders = await this.orderRepo.find({
      where: { status: OrderStatus.ACTIVE, side: OrderSide.ASK },
      order: { tokenId: 'ASC' },
      take: 5_000,
    });

    const byToken = new Map<number, Order>();
    for (const o of orders) {
      const tid = Number(o.tokenId);
      if (!Number.isFinite(tid) || tid < 0) continue;
      if (!byToken.has(tid)) byToken.set(tid, o);
    }

    const contract = this.rwaContractAddress();
    const tokenIds = [...byToken.keys()].sort((a, b) => a - b);
    const registryMap = new Map<number, RwaToken>();
    if (contract && tokenIds.length > 0) {
      const rows = await this.rwaTokenRepo
        .createQueryBuilder('t')
        .where('t.token_contract = :contract', { contract })
        .andWhere('t.token_id IN (:...ids)', {
          ids: tokenIds.map((id) => String(id)),
        })
        .getMany();
      for (const row of rows) {
        const tid = Number(row.tokenId);
        if (Number.isFinite(tid)) registryMap.set(tid, row);
      }
    }

    const items = await Promise.all(
      tokenIds.map(async (tokenId) => {
        const order = byToken.get(tokenId)!;
        const registry = registryMap.get(tokenId);
        const priceUsdc = Number(order.considerationAmount) / 1_000_000;

        let catalogImageUrl: string | null = null;
        let resolvedImageUrl: string | null = null;
        try {
          const raw = await this.blockchain.getResolvedRwaAsset(tokenId);
          catalogImageUrl = raw.imageUrl;
          const resolved =
            await this.rwaAssetResolve.getResolvedRwaAsset(tokenId);
          resolvedImageUrl = resolved.imageUrl;
        } catch {
          /* skip image resolution */
        }

        return {
          tokenId,
          orderHash: order.orderHash,
          collectionKey: order.collectionKey?.trim().toLowerCase() ?? null,
          priceUsdc: Number.isFinite(priceUsdc) ? priceUsdc : 0,
          displayName: registry?.displayName ?? null,
          certNumber: registry?.certNumber ?? null,
          displayImageUrl: registry?.displayImageUrl?.trim() ?? null,
          catalogImageUrl,
          resolvedImageUrl,
          offerer: order.offerer,
        };
      }),
    );

    return { items };
  }

  async updateTokenAdmin(
    tokenId: number,
    patch: {
      displayImageUrl?: string | null;
      displayName?: string | null;
      collectionKey?: string | null;
    },
  ): Promise<RwaToken> {
    const contract = this.rwaContractAddress();
    if (!contract) {
      throw new BadRequestException('RWA contract not configured');
    }

    await this.rwaTokenRegistry.syncTokenFromChain(tokenId);

    const row = await this.rwaTokenRepo.findOne({
      where: { tokenContract: contract, tokenId: String(tokenId) },
    });
    if (!row) {
      throw new NotFoundException(`RWA token #${tokenId} not found in registry`);
    }

    if (patch.displayImageUrl !== undefined) {
      const url = (patch.displayImageUrl ?? '').trim();
      if (url) {
        this.assertImageUrl(url);
        row.displayImageUrl = url;
      } else {
        row.displayImageUrl = null;
      }
    }

    if (patch.displayName !== undefined) {
      const name = (patch.displayName ?? '').trim();
      row.displayName = name || null;
    }

    if (patch.collectionKey !== undefined) {
      const key = (patch.collectionKey ?? '').trim().toLowerCase();
      row.collectionKey = key || null;
    }

    return this.rwaTokenRepo.save(row);
  }

  async previewImageRefFromMetadata(
    tokenId: number,
  ): Promise<{ imageRef: string | null; httpsUrl: string | null }> {
    const tokenURI = await this.blockchain.getRwaTokenURI(tokenId);
    const meta = await this.ipfs.fetchMetadataJson(tokenURI);
    const ref = pickRwaAssetDisplayImageRef(meta) ?? null;
    const httpsUrl = ref ? await this.ipfs.resolveUriToHttps(ref) : null;
    return { imageRef: ref, httpsUrl };
  }
}
