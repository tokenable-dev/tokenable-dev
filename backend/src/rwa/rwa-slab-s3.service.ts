import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CatalogCoverS3Service,
  resolveCatalogCoverMime,
} from '../marketplace/collections/catalog-cover-s3.service';
import {
  deriveRwaSlabS3Prefix,
  isPlatformHostedRwaSlabUrl,
  stableRwaSlabObjectKey,
} from './rwa-slab-s3.util';

const SLAB_CACHE_CONTROL = 'public, max-age=86400, must-revalidate';

/**
 * Mint-time PSA slab cache on catalog S3 (display only — on-chain image stays IPFS).
 * Failures are logged and swallowed; mint/upload must never depend on S3.
 */
@Injectable()
export class RwaSlabS3Service {
  private readonly logger = new Logger(RwaSlabS3Service.name);
  private readonly slabPrefix: string;

  constructor(
    private readonly config: ConfigService,
    private readonly catalogCoverS3: CatalogCoverS3Service,
  ) {
    const coverPrefix = (
      this.config.get<string>('CATALOG_COVER_S3_PREFIX') ?? 'covers/'
    ).trim();
    const override = (this.config.get<string>('RWA_SLAB_S3_PREFIX') ?? '').trim();
    this.slabPrefix = override
      ? override.endsWith('/')
        ? override
        : `${override}/`
      : deriveRwaSlabS3Prefix(coverPrefix);
  }

  isConfigured(): boolean {
    return this.catalogCoverS3.isConfigured();
  }

  /** Accept only platform-hosted slab URLs matching cert + chain (ignore spoofed URLs). */
  normalizeTrustedMintSlabUrl(
    url: string | null | undefined,
    chainId: number,
    certNumber: string,
  ): string | null {
    if (!url?.trim() || !this.isConfigured()) return null;
    const base = this.catalogCoverS3.getPublicBaseUrl();
    if (
      !isPlatformHostedRwaSlabUrl(
        url,
        base,
        this.slabPrefix,
        chainId,
        certNumber,
      )
    ) {
      return null;
    }
    return url.trim().split('?')[0] ?? null;
  }

  /**
   * Download once (or use provided buffer) → PutObject. Never throws.
   */
  async ingestMintSlabBestEffort(params: {
    chainId: number;
    certNumber: string;
    sourceUrl?: string;
    buffer?: Buffer;
    contentType?: string;
  }): Promise<string | null> {
    if (!this.isConfigured()) return null;
    const cert = params.certNumber.trim();
    if (!cert) return null;

    try {
      let body = params.buffer;
      let contentType = params.contentType?.trim() || '';

      if (!body?.length) {
        const source = params.sourceUrl?.trim();
        if (!source) return null;
        const downloaded = await this.catalogCoverS3.downloadRemoteImage(source);
        body = downloaded.body;
        contentType = downloaded.contentType;
      }

      if (!body?.length) return null;
      const mime = resolveCatalogCoverMime(contentType, body);
      if (!mime) {
        this.logger.warn(
          `RWA slab S3 skip cert=${cert}: unsupported image type`,
        );
        return null;
      }

      const objectKey = stableRwaSlabObjectKey(
        this.slabPrefix,
        params.chainId,
        cert,
      );
      const put = await this.catalogCoverS3.putBytesAtKey(
        objectKey,
        body,
        mime,
        SLAB_CACHE_CONTROL,
      );
      this.logger.log(
        `RWA slab cached cert=${cert} chain=${params.chainId} → ${put.publicUrl}`,
      );
      return put.publicUrl;
    } catch (e) {
      this.logger.warn(
        `RWA slab S3 ingest failed cert=${params.certNumber} chain=${params.chainId}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      return null;
    }
  }
}
