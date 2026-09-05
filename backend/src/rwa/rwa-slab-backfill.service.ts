import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  ChainConfigService,
  type SupportedChainId,
} from '../blockchain/chain-config.service';
import { IpfsGatewayResolverService } from '../blockchain/ipfs-gateway-resolver.service';
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

@Injectable()
export class RwaSlabBackfillService {
  private readonly logger = new Logger(RwaSlabBackfillService.name);

  constructor(
    @InjectRepository(RwaToken)
    private readonly rwaTokens: Repository<RwaToken>,
    private readonly chainConfig: ChainConfigService,
    private readonly ipfs: IpfsGatewayResolverService,
    private readonly rwaSlabS3: RwaSlabS3Service,
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
}
