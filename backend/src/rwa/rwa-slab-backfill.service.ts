import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { BlockchainService } from '../blockchain/blockchain.service';
import {
  ChainConfigService,
  type SupportedChainId,
} from '../blockchain/chain-config.service';
import { IpfsGatewayResolverService } from '../blockchain/ipfs-gateway-resolver.service';
import { collectionKeyFromGradedMetadata } from '../marketplace/utils/bucket-key.util';
import { psaCertNumberFromGradedMeta } from '../marketplace/utils/collection-image.util';
import { resolveRegistryDisplayName } from '../marketplace/utils/rwa-list-display-name.util';
import { RwaToken } from '../marketplace/entities/rwa-token.entity';
import { RwaSlabS3Service } from './rwa-slab-s3.service';
import { resolveMintSlabSourceUrl } from './rwa-slab-source.util';

export type RwaSlabBackfillResult = {
  scanned: number;
  updated: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
  details: Array<{
    tokenId: string;
    certNumber: string | null;
    outcome: 'updated' | 'skipped' | 'failed' | 'dry_run';
    reason?: string;
    displayImageUrl?: string;
  }>;
};

export type RwaListReadyBackfillResult = {
  scanned: number;
  updated: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
  details: Array<{
    tokenId: string;
    outcome: 'updated' | 'skipped' | 'failed' | 'dry_run';
    reason?: string;
    fields?: string[];
  }>;
};

function metadataCidFromTokenUri(uri: string): string | null {
  const u = uri.trim();
  if (!u.startsWith('ipfs://')) return null;
  const rest = u.slice(7).replace(/^ipfs\//, '');
  const cid = rest.split('/')[0]?.trim();
  return cid || null;
}

@Injectable()
export class RwaSlabBackfillService {
  private readonly logger = new Logger(RwaSlabBackfillService.name);
  private listReadyCronRunning = false;

  constructor(
    @InjectRepository(RwaToken)
    private readonly rwaTokens: Repository<RwaToken>,
    private readonly chainConfig: ChainConfigService,
    private readonly ipfs: IpfsGatewayResolverService,
    private readonly rwaSlabS3: RwaSlabS3Service,
    private readonly blockchain: BlockchainService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Copy slab images to S3 for tokens missing `display_image_url`.
   * Best-effort per row — never throws on individual failures.
   */
  async backfillMissingDisplayImages(params?: {
    limit?: number;
    dryRun?: boolean;
    chainId?: SupportedChainId;
  }): Promise<RwaSlabBackfillResult> {
    const limit = Math.min(Math.max(params?.limit ?? 50, 1), 500);
    const dryRun = params?.dryRun ?? false;
    const chainId = params?.chainId ?? this.chainConfig.getDefaultChainId();
    const tokenContract = this.chainConfig.getRwaAddress(chainId).toLowerCase();

    const rows = await this.rwaTokens.find({
      where: {
        tokenContract,
        displayImageUrl: IsNull(),
        burnedAt: IsNull(),
      },
      order: { metadataSyncedAt: 'DESC' },
      take: limit,
    });

    const result: RwaSlabBackfillResult = {
      scanned: rows.length,
      updated: 0,
      skipped: 0,
      failed: 0,
      dryRun,
      details: [],
    };

    if (!this.rwaSlabS3.isConfigured()) {
      for (const row of rows) {
        result.skipped += 1;
        result.details.push({
          tokenId: row.tokenId,
          certNumber: row.certNumber,
          outcome: 'skipped',
          reason: 's3_not_configured',
        });
      }
      return result;
    }

    for (const row of rows) {
      const cert = row.certNumber?.trim();
      if (!cert) {
        result.skipped += 1;
        result.details.push({
          tokenId: row.tokenId,
          certNumber: row.certNumber,
          outcome: 'skipped',
          reason: 'no_cert_number',
        });
        continue;
      }

      const tokenUri = row.tokenUri?.trim();
      if (!tokenUri) {
        result.skipped += 1;
        result.details.push({
          tokenId: row.tokenId,
          certNumber: cert,
          outcome: 'skipped',
          reason: 'no_token_uri',
        });
        continue;
      }

      let metadata: Record<string, unknown> | null = null;
      try {
        metadata = await this.ipfs.fetchMetadataJson(tokenUri);
      } catch (e) {
        result.failed += 1;
        result.details.push({
          tokenId: row.tokenId,
          certNumber: cert,
          outcome: 'failed',
          reason: `metadata_fetch_failed: ${
            e instanceof Error ? e.message : String(e)
          }`,
        });
        continue;
      }

      const sourceUrl = resolveMintSlabSourceUrl(metadata);
      if (!sourceUrl) {
        result.skipped += 1;
        result.details.push({
          tokenId: row.tokenId,
          certNumber: cert,
          outcome: 'skipped',
          reason: 'no_https_image_source',
        });
        continue;
      }

      if (dryRun) {
        result.details.push({
          tokenId: row.tokenId,
          certNumber: cert,
          outcome: 'dry_run',
        });
        continue;
      }

      const displayImageUrl = await this.rwaSlabS3.ingestMintSlabBestEffort({
        chainId,
        certNumber: cert,
        sourceUrl,
      });

      if (!displayImageUrl) {
        result.failed += 1;
        result.details.push({
          tokenId: row.tokenId,
          certNumber: cert,
          outcome: 'failed',
          reason: 's3_ingest_failed',
        });
        continue;
      }

      const trusted = this.rwaSlabS3.normalizeTrustedMintSlabUrl(
        displayImageUrl,
        chainId,
        cert,
      );
      if (!trusted) {
        result.failed += 1;
        result.details.push({
          tokenId: row.tokenId,
          certNumber: cert,
          outcome: 'failed',
          reason: 'trusted_url_validation_failed',
        });
        continue;
      }

      row.displayImageUrl = trusted;
      await this.rwaTokens.save(row);
      result.updated += 1;
      result.details.push({
        tokenId: row.tokenId,
        certNumber: cert,
        outcome: 'updated',
        displayImageUrl: trusted,
      });
      this.logger.log(
        `Backfilled slab image token #${row.tokenId} cert=${cert}`,
      );
    }

    return result;
  }

  /**
   * Fill incomplete list fields (name, cert, collection_key, image) from
   * token_uri / chain + IPFS. Ops + cron only — not the portfolio request path.
   */
  async backfillListReadyFields(params?: {
    limit?: number;
    dryRun?: boolean;
    chainId?: SupportedChainId;
  }): Promise<RwaListReadyBackfillResult> {
    const limit = Math.min(Math.max(params?.limit ?? 40, 1), 200);
    const dryRun = params?.dryRun ?? false;
    const chainId = params?.chainId ?? this.chainConfig.getDefaultChainId();
    const tokenContract = this.chainConfig.getRwaAddress(chainId).toLowerCase();

    const rows = await this.rwaTokens
      .createQueryBuilder('t')
      .where('LOWER(t.token_contract) = :c', { c: tokenContract })
      .andWhere('t.burned_at IS NULL')
      .andWhere(
        `(t.display_name IS NULL OR BTRIM(t.display_name) = ''
          OR t.display_image_url IS NULL OR BTRIM(t.display_image_url) = ''
          OR t.cert_number IS NULL OR BTRIM(t.cert_number) = ''
          OR t.collection_key IS NULL OR BTRIM(t.collection_key) = '')`,
      )
      .orderBy('t.updated_at', 'ASC')
      .take(limit)
      .getMany();

    const result: RwaListReadyBackfillResult = {
      scanned: rows.length,
      updated: 0,
      skipped: 0,
      failed: 0,
      dryRun,
      details: [],
    };

    for (const row of rows) {
      const tokenIdNum = Number(row.tokenId);
      let tokenUri = row.tokenUri?.trim() || '';
      if (!tokenUri && Number.isFinite(tokenIdNum)) {
        try {
          tokenUri =
            (await this.blockchain.getRwaTokenURI(tokenIdNum, chainId))?.trim() ||
            '';
        } catch (e) {
          result.failed += 1;
          result.details.push({
            tokenId: row.tokenId,
            outcome: 'failed',
            reason: `token_uri_rpc: ${e instanceof Error ? e.message : String(e)}`,
          });
          continue;
        }
      }
      if (!tokenUri) {
        result.skipped += 1;
        result.details.push({
          tokenId: row.tokenId,
          outcome: 'skipped',
          reason: 'no_token_uri',
        });
        continue;
      }

      let metadata: Record<string, unknown> | null = null;
      try {
        metadata = await this.ipfs.fetchMetadataJson(tokenUri);
      } catch (e) {
        result.failed += 1;
        result.details.push({
          tokenId: row.tokenId,
          outcome: 'failed',
          reason: `metadata_fetch_failed: ${
            e instanceof Error ? e.message : String(e)
          }`,
        });
        continue;
      }

      const fields: string[] = [];
      const name = resolveRegistryDisplayName(metadata);
      const currentName = row.displayName?.trim() || '';
      const currentLooksIncomplete =
        !currentName ||
        /\bRaw\b/i.test(currentName) ||
        (!/[·•]/.test(currentName) && !/\bPSA\s+/i.test(currentName));
      if (name && currentLooksIncomplete && name !== currentName) {
        row.displayName = name;
        fields.push('display_name');
      }

      const cert = psaCertNumberFromGradedMeta(metadata)?.trim() || null;
      if (cert && !row.certNumber?.trim()) {
        row.certNumber = cert;
        fields.push('cert_number');
      }

      const collectionKey = collectionKeyFromGradedMetadata(metadata);
      if (collectionKey && !row.collectionKey?.trim()) {
        row.collectionKey = collectionKey;
        fields.push('collection_key');
      }

      if (!row.tokenUri?.trim()) {
        row.tokenUri = tokenUri;
        row.metadataCid = metadataCidFromTokenUri(tokenUri);
        fields.push('token_uri');
      }

      if (!row.displayImageUrl?.trim() && this.rwaSlabS3.isConfigured()) {
        const certForSlab = row.certNumber?.trim();
        const sourceUrl = resolveMintSlabSourceUrl(metadata);
        if (certForSlab && sourceUrl && !dryRun) {
          const displayImageUrl = await this.rwaSlabS3.ingestMintSlabBestEffort({
            chainId,
            certNumber: certForSlab,
            sourceUrl,
          });
          const trusted = displayImageUrl
            ? this.rwaSlabS3.normalizeTrustedMintSlabUrl(
                displayImageUrl,
                chainId,
                certForSlab,
              )
            : null;
          if (trusted) {
            row.displayImageUrl = trusted;
            fields.push('display_image_url');
          }
        } else if (certForSlab && sourceUrl && dryRun) {
          fields.push('display_image_url');
        }
      }

      if (fields.length === 0) {
        result.skipped += 1;
        result.details.push({
          tokenId: row.tokenId,
          outcome: 'skipped',
          reason: 'nothing_to_fill',
        });
        continue;
      }

      if (dryRun) {
        result.details.push({
          tokenId: row.tokenId,
          outcome: 'dry_run',
          fields,
        });
        continue;
      }

      row.metadataSyncedAt = new Date();
      await this.rwaTokens.save(row);
      result.updated += 1;
      result.details.push({
        tokenId: row.tokenId,
        outcome: 'updated',
        fields,
      });
    }

    return result;
  }

  /**
   * Opt-in cron: set RWA_LIST_READY_BACKFILL_ENABLED=1.
   * Small batches so IPFS/RPC stay bounded under multi-user load.
   */
  @Cron('15 */5 * * * *')
  async cronBackfillListReady(): Promise<void> {
    const enabled = this.config.get<string>('RWA_LIST_READY_BACKFILL_ENABLED');
    if (enabled !== '1' && enabled !== 'true') return;
    if (this.listReadyCronRunning) return;
    this.listReadyCronRunning = true;
    try {
      const chainId = this.chainConfig.getDefaultChainId();
      const result = await this.backfillListReadyFields({
        limit: 40,
        dryRun: false,
        chainId,
      });
      if (result.scanned > 0) {
        this.logger.log(
          `list-ready cron scanned=${result.scanned} updated=${result.updated} skipped=${result.skipped} failed=${result.failed}`,
        );
      }
    } catch (e) {
      this.logger.warn(
        `list-ready cron failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      this.listReadyCronRunning = false;
    }
  }
}
