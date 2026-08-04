import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import sharp from 'sharp';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

export const CATALOG_COVER_MAX_BYTES = 8 * 1024 * 1024;

/**
 * Cardhedger sometimes returns `/crop_image` assets that are only ~180–260px
 * (thumbnails). Prefer sources at least this large when ingesting to S3.
 */
export const CATALOG_COVER_MIN_WIDTH = 400;
export const CATALOG_COVER_MIN_HEIGHT = 400;

/** Stable per-collection object key — admin replaces overwrite this object. */
export function stableCatalogCoverObjectKey(
  prefix: string,
  collectionKey: string,
): string {
  const p = prefix.endsWith('/') ? prefix : `${prefix}/`;
  return `${p}${sanitizeCollectionKeyForS3(collectionKey)}/cover`;
}

export function sanitizeCollectionKeyForS3(collectionKey: string): string {
  const raw = collectionKey.trim().toLowerCase();
  const safe = raw.replace(/[^a-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  return safe.slice(0, 180) || 'collection';
}

export function joinCatalogCoverPublicUrl(
  publicBaseUrl: string,
  objectKey: string,
): string {
  const base = publicBaseUrl.trim().replace(/\/+$/, '');
  const key = objectKey.replace(/^\/+/, '');
  return `${base}/${key}`;
}

export function catalogCoverObjectKeyFromPublicUrl(
  publicUrl: string,
  publicBaseUrl: string,
): string | null {
  const base = publicBaseUrl.trim().replace(/\/+$/, '');
  const url = publicUrl.trim();
  if (!base || !url.toLowerCase().startsWith(base.toLowerCase() + '/')) {
    return null;
  }
  return url.slice(base.length + 1).replace(/^\/+/, '') || null;
}

/**
 * Stable object keys end with `/cover`. Older rows sometimes stored the
 * collection folder URL without that suffix (S3 returns 403 for the folder).
 */
export function normalizeCatalogCoverPublicUrl(url: string): string {
  const raw = url.trim();
  if (!raw) return raw;
  try {
    const normalized = raw.startsWith('//') ? `https:${raw}` : raw;
    const u = new URL(normalized);
    if (/\/cover$/i.test(u.pathname)) return u.toString();
    // `{prefix}{collectionKey}` → `{prefix}{collectionKey}/cover`
    if (/\/covers\/[^/]+$/i.test(u.pathname)) {
      u.pathname = `${u.pathname.replace(/\/+$/, '')}/cover`;
      return u.toString();
    }
  } catch {
    /* keep original */
  }
  return raw;
}

export function isAllowedCatalogCoverPublicUrl(
  publicUrl: string,
  publicBaseUrl: string,
): boolean {
  const base = publicBaseUrl.trim().replace(/\/+$/, '');
  if (!base) return false;
  const url = normalizeCatalogCoverPublicUrl(publicUrl).trim();
  return url.toLowerCase().startsWith(`${base.toLowerCase()}/`);
}

/**
 * Nest under the cover prefix so the existing IAM scope
 * (`…/covers/*`, `…/dev/covers/*`) allows PutObject without a new policy.
 * `dev/covers/` → `dev/covers/user-avatars/`.
 */
export function deriveUserAvatarS3Prefix(coverPrefix: string): string {
  const p = coverPrefix.endsWith('/') ? coverPrefix : `${coverPrefix}/`;
  return `${p}user-avatars/`;
}

export function stableUserAvatarObjectKey(
  avatarPrefix: string,
  userId: string,
): string {
  const p = avatarPrefix.endsWith('/') ? avatarPrefix : `${avatarPrefix}/`;
  const id = userId.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '') || 'user';
  return `${p}${id}/avatar`;
}

export function isPlatformHostedAvatarUrl(
  publicUrl: string | null | undefined,
  publicBaseUrl: string,
  avatarPrefix: string,
): boolean {
  const base = publicBaseUrl.trim().replace(/\/+$/, '');
  if (!base || !publicUrl?.trim()) return false;
  const url = publicUrl.trim().split('?')[0] ?? '';
  if (!url.toLowerCase().startsWith(`${base.toLowerCase()}/`)) return false;
  const key = url.slice(base.length + 1).replace(/^\/+/, '');
  const prefix = avatarPrefix.endsWith('/') ? avatarPrefix : `${avatarPrefix}/`;
  return key.toLowerCase().startsWith(prefix.toLowerCase());
}

/** Prefer Content-Type; fall back to magic bytes (Cardhedger CDNs often omit MIME). */
export function resolveCatalogCoverMime(
  declaredMime: string | null | undefined,
  body: Buffer,
): string | null {
  const declared = (declaredMime ?? '').split(';')[0].trim().toLowerCase();
  if (ALLOWED_MIME.has(declared)) {
    return declared === 'image/jpg' ? 'image/jpeg' : declared;
  }
  if (body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    body.length >= 8 &&
    body[0] === 0x89 &&
    body[1] === 0x50 &&
    body[2] === 0x4e &&
    body[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    body.length >= 12 &&
    body.subarray(0, 4).toString('ascii') === 'RIFF' &&
    body.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

@Injectable()
export class CatalogCoverS3Service {
  private readonly logger = new Logger(CatalogCoverS3Service.name);
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly prefix: string;
  private readonly avatarPrefix: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = (this.config.get<string>('CATALOG_COVER_S3_BUCKET') ?? '').trim();
    const prefixRaw = (this.config.get<string>('CATALOG_COVER_S3_PREFIX') ?? 'covers/').trim();
    this.prefix = prefixRaw.endsWith('/') ? prefixRaw : `${prefixRaw}/`;
    const avatarRaw = (this.config.get<string>('USER_AVATAR_S3_PREFIX') ?? '').trim();
    this.avatarPrefix = avatarRaw
      ? avatarRaw.endsWith('/')
        ? avatarRaw
        : `${avatarRaw}/`
      : deriveUserAvatarS3Prefix(this.prefix);
    this.publicBaseUrl = (
      this.config.get<string>('CATALOG_COVER_PUBLIC_BASE_URL') ?? ''
    ).trim().replace(/\/+$/, '');

    const region = (this.config.get<string>('AWS_REGION') ?? '').trim();
    if (this.bucket && this.publicBaseUrl && region) {
      this.client = new S3Client({ region });
    } else {
      this.client = null;
    }
  }

  isConfigured(): boolean {
    return Boolean(this.bucket && this.publicBaseUrl && this.client);
  }

  getPublicBaseUrl(): string {
    return this.publicBaseUrl;
  }

  assertConfigured(): void {
    if (!this.isConfigured() || !this.client) {
      throw new Error('CATALOG_COVER_S3_NOT_CONFIGURED');
    }
  }

  stableObjectKey(collectionKey: string): string {
    return stableCatalogCoverObjectKey(this.prefix, collectionKey);
  }

  publicUrlForCollection(collectionKey: string): string {
    return joinCatalogCoverPublicUrl(
      this.publicBaseUrl,
      this.stableObjectKey(collectionKey),
    );
  }

  validateUploadFile(file: Express.Multer.File | undefined): void {
    if (!file?.buffer?.length) {
      throw new Error('CATALOG_COVER_FILE_EMPTY');
    }
    if (file.size > CATALOG_COVER_MAX_BYTES) {
      throw new Error('CATALOG_COVER_FILE_TOO_LARGE');
    }
    const mime = resolveCatalogCoverMime(file.mimetype, file.buffer);
    if (!mime) {
      throw new Error('CATALOG_COVER_FILE_TYPE_INVALID');
    }
  }

  /**
   * Put (or overwrite) the collection's stable cover object.
   * Key shape: `{prefix}{sanitizedCollectionKey}/cover`
   */
  async putCollectionCoverBytes(
    collectionKey: string,
    body: Buffer,
    contentType: string,
  ): Promise<{ objectKey: string; publicUrl: string }> {
    this.assertConfigured();
    if (!body?.length) {
      throw new Error('CATALOG_COVER_FILE_EMPTY');
    }
    if (body.length > CATALOG_COVER_MAX_BYTES) {
      throw new Error('CATALOG_COVER_FILE_TOO_LARGE');
    }
    const mime = resolveCatalogCoverMime(contentType, body);
    if (!mime) {
      throw new Error('CATALOG_COVER_FILE_TYPE_INVALID');
    }

    const objectKey = this.stableObjectKey(collectionKey);
    await this.client!.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: body,
        ContentType: mime,
        // Overwritable covers — avoid year-long immutable CDN cache.
        CacheControl: 'public, max-age=300, must-revalidate',
      }),
    );

    const publicUrl = joinCatalogCoverPublicUrl(this.publicBaseUrl, objectKey);
    this.logger.log(`Catalog cover put: s3://${this.bucket}/${objectKey}`);
    return { objectKey, publicUrl };
  }

  async uploadCollectionCover(
    collectionKey: string,
    file: Express.Multer.File,
  ): Promise<{ objectKey: string; publicUrl: string }> {
    this.validateUploadFile(file);
    const mime = resolveCatalogCoverMime(file.mimetype, file.buffer)!;
    return this.putCollectionCoverBytes(collectionKey, file.buffer, mime);
  }

  isPlatformHostedAvatarUrl(publicUrl: string | null | undefined): boolean {
    return isPlatformHostedAvatarUrl(
      publicUrl,
      this.publicBaseUrl,
      this.avatarPrefix,
    );
  }

  /**
   * Put (or overwrite) the user's stable avatar object.
   * Key shape: `{avatarPrefix}{userId}/avatar`
   */
  async putUserAvatarBytes(
    userId: string,
    body: Buffer,
    contentType: string,
  ): Promise<{ objectKey: string; publicUrl: string }> {
    this.assertConfigured();
    if (!body?.length) {
      throw new Error('CATALOG_COVER_FILE_EMPTY');
    }
    if (body.length > CATALOG_COVER_MAX_BYTES) {
      throw new Error('CATALOG_COVER_FILE_TOO_LARGE');
    }
    const mime = resolveCatalogCoverMime(contentType, body);
    if (!mime) {
      throw new Error('CATALOG_COVER_FILE_TYPE_INVALID');
    }

    const objectKey = stableUserAvatarObjectKey(this.avatarPrefix, userId);
    await this.client!.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: body,
        ContentType: mime,
        CacheControl: 'public, max-age=300, must-revalidate',
      }),
    );

    const publicUrl = joinCatalogCoverPublicUrl(this.publicBaseUrl, objectKey);
    this.logger.log(`User avatar put: s3://${this.bucket}/${objectKey}`);
    return { objectKey, publicUrl };
  }

  async uploadUserAvatar(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ objectKey: string; publicUrl: string }> {
    this.validateUploadFile(file);
    const mime = resolveCatalogCoverMime(file.mimetype, file.buffer)!;
    return this.putUserAvatarBytes(userId, file.buffer, mime);
  }

  /**
   * Download remote image bytes (no S3 write). Normalizes protocol-relative URLs.
   */
  async downloadRemoteImage(
    sourceUrl: string,
  ): Promise<{ body: Buffer; contentType: string; width: number; height: number }> {
    const url = sourceUrl.trim().startsWith('//')
      ? `https:${sourceUrl.trim()}`
      : sourceUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      throw new Error('CATALOG_COVER_FETCH_FAILED');
    }

    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          'User-Agent': 'TokenableBackend/1.0',
          Accept: 'image/*,*/*',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(20_000),
      });
    } catch (e) {
      this.logger.warn(
        `Catalog cover fetch failed: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      throw new Error('CATALOG_COVER_FETCH_FAILED');
    }

    if (!res.ok) {
      throw new Error('CATALOG_COVER_FETCH_FAILED');
    }

    const body = Buffer.from(await res.arrayBuffer());
    if (!body.length) {
      throw new Error('CATALOG_COVER_FILE_EMPTY');
    }
    if (body.length > CATALOG_COVER_MAX_BYTES) {
      throw new Error('CATALOG_COVER_FILE_TOO_LARGE');
    }
    const contentType = resolveCatalogCoverMime(
      res.headers.get('content-type'),
      body,
    );
    if (!contentType) {
      throw new Error('CATALOG_COVER_FILE_TYPE_INVALID');
    }

    let width = 0;
    let height = 0;
    try {
      const meta = await sharp(body).metadata();
      width = meta.width ?? 0;
      height = meta.height ?? 0;
    } catch {
      throw new Error('CATALOG_COVER_FILE_TYPE_INVALID');
    }

    return { body, contentType, width, height };
  }

  isAdequateCatalogCoverSize(width: number, height: number): boolean {
    return (
      width >= CATALOG_COVER_MIN_WIDTH && height >= CATALOG_COVER_MIN_HEIGHT
    );
  }

  /**
   * Download a remote image (Cardhedger / TCG / etc.) and store it as the
   * collection's stable S3 cover object.
   */
  async ingestRemoteImage(
    collectionKey: string,
    sourceUrl: string,
  ): Promise<{ objectKey: string; publicUrl: string }> {
    this.assertConfigured();
    const downloaded = await this.downloadRemoteImage(sourceUrl);
    return this.putCollectionCoverBytes(
      collectionKey,
      downloaded.body,
      downloaded.contentType,
    );
  }

  /**
   * Try ranked remote URLs until one meets the catalog size floor, then put to S3.
   * If none are large enough, stores the largest downloaded candidate (last resort).
   */
  async ingestBestRemoteImage(
    collectionKey: string,
    sourceUrls: string[],
  ): Promise<{ objectKey: string; publicUrl: string; sourceUrl: string }> {
    this.assertConfigured();
    const unique = [
      ...new Set(
        sourceUrls
          .map((u) => (u.trim().startsWith('//') ? `https:${u.trim()}` : u.trim()))
          .filter((u) => /^https?:\/\//i.test(u)),
      ),
    ];
    if (unique.length === 0) {
      throw new Error('CATALOG_COVER_FETCH_FAILED');
    }

    let fallback: {
      body: Buffer;
      contentType: string;
      sourceUrl: string;
      pixels: number;
    } | null = null;

    for (const sourceUrl of unique) {
      try {
        const downloaded = await this.downloadRemoteImage(sourceUrl);
        const pixels = downloaded.width * downloaded.height;
        if (this.isAdequateCatalogCoverSize(downloaded.width, downloaded.height)) {
          const put = await this.putCollectionCoverBytes(
            collectionKey,
            downloaded.body,
            downloaded.contentType,
          );
          this.logger.log(
            `Catalog cover ingest ok for ${collectionKey}: ${downloaded.width}x${downloaded.height} from ${sourceUrl}`,
          );
          return { ...put, sourceUrl };
        }
        if (!fallback || pixels > fallback.pixels) {
          fallback = {
            body: downloaded.body,
            contentType: downloaded.contentType,
            sourceUrl,
            pixels,
          };
        }
        this.logger.warn(
          `Catalog cover candidate too small for ${collectionKey}: ${downloaded.width}x${downloaded.height} from ${sourceUrl}`,
        );
      } catch (e) {
        this.logger.warn(
          `Catalog cover candidate failed for ${collectionKey}: ${sourceUrl} (${
            e instanceof Error ? e.message : String(e)
          })`,
        );
      }
    }

    if (!fallback) {
      throw new Error('CATALOG_COVER_FETCH_FAILED');
    }

    this.logger.warn(
      `Catalog cover falling back to largest small candidate for ${collectionKey}: ${fallback.sourceUrl}`,
    );
    const put = await this.putCollectionCoverBytes(
      collectionKey,
      fallback.body,
      fallback.contentType,
    );
    return { ...put, sourceUrl: fallback.sourceUrl };
  }

  /**
   * Fetch a cover from our public catalog base (for same-origin WebGL textures).
   * Rejects URLs outside `CATALOG_COVER_PUBLIC_BASE_URL`.
   */
  async fetchAllowedPublicCover(
    publicUrl: string,
  ): Promise<{ body: Buffer; contentType: string }> {
    this.assertConfigured();
    const src = normalizeCatalogCoverPublicUrl(publicUrl);
    if (!isAllowedCatalogCoverPublicUrl(src, this.publicBaseUrl)) {
      throw new Error('CATALOG_COVER_URL_NOT_ALLOWED');
    }

    let res: Response;
    try {
      res = await fetch(src, {
        signal: AbortSignal.timeout(15_000),
        headers: { Accept: 'image/*,*/*' },
      });
    } catch {
      throw new Error('CATALOG_COVER_FETCH_FAILED');
    }
    if (!res.ok) {
      throw new Error('CATALOG_COVER_FETCH_FAILED');
    }

    const ab = await res.arrayBuffer();
    const body = Buffer.from(ab);
    if (!body.length) {
      throw new Error('CATALOG_COVER_FILE_EMPTY');
    }
    if (body.length > CATALOG_COVER_MAX_BYTES) {
      throw new Error('CATALOG_COVER_FILE_TOO_LARGE');
    }
    const mime = resolveCatalogCoverMime(res.headers.get('content-type'), body);
    if (!mime) {
      throw new Error('CATALOG_COVER_FILE_TYPE_INVALID');
    }
    return { body, contentType: mime };
  }

  /** Best-effort delete of a legacy/orphan cover we own (e.g. old uuid keys). */
  async tryDeletePublicCoverUrl(publicUrl: string | null | undefined): Promise<void> {
    if (!this.isConfigured() || !this.client || !publicUrl?.trim()) return;
    const key = catalogCoverObjectKeyFromPublicUrl(
      normalizeCatalogCoverPublicUrl(publicUrl),
      this.publicBaseUrl,
    );
    if (!key) return;
    // Never delete the stable key we just overwrote — only clean other keys.
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (e) {
      this.logger.warn(
        `Failed to delete previous catalog cover ${key}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }
}
