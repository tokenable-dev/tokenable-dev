import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { IpfsGatewayResolverService } from '../../blockchain/ipfs-gateway-resolver.service';
import { RwaToken } from '../entities/rwa-token.entity';
import { psaCertNumberFromGradedMeta } from '../utils/collection-image.util';

function metadataCidFromTokenUri(uri: string): string | null {
  const u = uri.trim();
  if (!u.startsWith('ipfs://')) return null;
  const rest = u.slice(7).replace(/^ipfs\//, '');
  const cid = rest.split('/')[0]?.trim();
  return cid || null;
}

@Injectable()
export class RwaTokenRegistryService {
  private readonly logger = new Logger(RwaTokenRegistryService.name);

  constructor(
    @InjectRepository(RwaToken)
    private readonly repo: Repository<RwaToken>,
    private readonly blockchain: BlockchainService,
    private readonly ipfsResolver: IpfsGatewayResolverService,
    private readonly config: ConfigService,
  ) {}

  private rwaContractAddress(): string {
    return (
      this.config.get<string>('RWA_CONTRACT_ADDRESS')?.trim().toLowerCase() ??
      ''
    );
  }

  async upsertFromMetadata(
    tokenId: string | number,
    meta: Record<string, unknown>,
    opts?: { tokenUri?: string; collectionKey?: string | null },
  ): Promise<void> {
    const contract = this.rwaContractAddress();
    if (!contract) return;
    const tid = String(tokenId).trim();
    if (!tid) return;

    const cert = psaCertNumberFromGradedMeta(meta) ?? null;
    const displayName =
      typeof meta.name === 'string' && meta.name.trim()
        ? meta.name.trim()
        : null;
    const tokenUri = opts?.tokenUri?.trim() || null;
    const metadataCid = tokenUri ? metadataCidFromTokenUri(tokenUri) : null;

    await this.repo.upsert(
      {
        tokenContract: contract,
        tokenId: tid,
        certNumber: cert,
        tokenUri,
        metadataCid,
        displayName,
        collectionKey: opts?.collectionKey?.toLowerCase() ?? null,
        metadataSyncedAt: new Date(),
      },
      ['tokenContract', 'tokenId'],
    );
  }

  async syncTokenFromChain(
    tokenId: number,
    collectionKey?: string | null,
  ): Promise<void> {
    const contract = this.rwaContractAddress();
    if (!contract) return;
    try {
      const tokenUri = await this.blockchain.getRwaTokenURI(tokenId);
      const meta = await this.ipfsResolver.fetchMetadataJson(tokenUri);
      await this.upsertFromMetadata(tokenId, meta, {
        tokenUri,
        collectionKey: collectionKey ?? null,
      });
    } catch (e) {
      this.logger.debug(
        `rwa_tokens sync skip #${tokenId}: ${String(e).slice(0, 120)}`,
      );
    }
  }

  /** Scan `0..totalMinted-1` on the configured RWA contract (boot / admin). */
  async syncAllMintedFromChain(): Promise<{ scanned: number; upserted: number }> {
    const contract = this.rwaContractAddress();
    if (!contract) return { scanned: 0, upserted: 0 };
    const { totalMinted: total } = await this.blockchain.getRwaInfo();
    let upserted = 0;
    for (let id = 0; id < total; id++) {
      try {
        await this.syncTokenFromChain(id);
        upserted++;
      } catch {
        /* skip */
      }
    }
    return { scanned: total, upserted };
  }

  async collectionKeysByTokenIds(
    tokenIds: Array<string | number>,
  ): Promise<Record<number, string>> {
    const contract = this.rwaContractAddress();
    const out: Record<number, string> = {};
    if (!contract) return out;

    const ids = [
      ...new Set(tokenIds.map((id) => Math.floor(Number(id)))),
    ].filter((id) => Number.isFinite(id) && id >= 0);
    if (ids.length === 0) return out;

    const rows = await this.repo.find({
      where: {
        tokenContract: contract,
        tokenId: In(ids.map((id) => String(id))),
      },
      select: ['tokenId', 'collectionKey'],
    });

    for (const row of rows) {
      const tokenId = Number(row.tokenId);
      const key = row.collectionKey?.trim().toLowerCase();
      if (!Number.isFinite(tokenId) || !key) continue;
      out[tokenId] = key;
    }
    return out;
  }
}
