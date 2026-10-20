import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, type PutObjectCommandInput, S3Client } from '@aws-sdk/client-s3';

export const PRICECHARTING_ARCHIVE_FAILURE =
  'Database import succeeded, but raw CSV S3 archival failed.';

export type PricechartingArchiveResult = {
  archived: boolean;
  attempted: boolean;
  key: string | null;
  error: string | null;
};

export function skippedPricechartingArchive(): PricechartingArchiveResult {
  return { archived: false, attempted: false, key: null, error: null };
}

/** Production admin imports are the only writers. Local dev must not put objects. */
export function isProductionArchiveWrite(nodeEnv: string | undefined): boolean {
  return nodeEnv === 'production';
}

export function normalizePricechartingS3Prefix(prefix: string): string {
  const trimmed = prefix.trim().replace(/^\/+/, '');
  if (!trimmed || trimmed.includes('..') || trimmed.includes('\\')) {
    throw new Error('PRICECHARTING_S3_PREFIX is not a safe prefix');
  }
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

export function safeArchiveSegment(raw: string): string {
  const segment = raw.trim();
  if (
    !segment ||
    segment === '.' ||
    segment === '..' ||
    segment.includes('/') ||
    segment.includes('\\') ||
    segment.includes('..')
  ) {
    throw new Error('Unsafe PriceCharting archive name');
  }
  return segment;
}

/** `{prefix}{segments}/{last}-{YYYY-MM-DD}.csv`. Same guide and date share one key. */
export function pricechartingArchiveObjectKey(input: {
  prefix: string;
  segments: string[];
  date: string;
}): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new Error('Archive date must be YYYY-MM-DD');
  }
  if (input.segments.length === 0) {
    throw new Error('Archive name is required');
  }
  const prefix = normalizePricechartingS3Prefix(input.prefix);
  const segments = input.segments.map(safeArchiveSegment);
  const slug = segments[segments.length - 1]!;
  return `${prefix}${segments.join('/')}/${slug}-${input.date}.csv`;
}

export async function putPricechartingCsv(options: {
  send: (input: PutObjectCommandInput) => Promise<unknown>;
  bucket: string;
  key: string;
  body: Buffer;
  attempts?: number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<{ ok: true } | { ok: false }> {
  const attempts = options.attempts ?? 3;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await options.send({
        Bucket: options.bucket,
        Key: options.key,
        Body: options.body,
        ContentType: 'text/csv',
      });
      return { ok: true };
    } catch {
      if (attempt === attempts) return { ok: false };
      await sleep(1_000 * attempt);
    }
  }
  return { ok: false };
}

/**
 * Archive runs only after `importCsv` resolves. A thrown import skips S3.
 */
export async function runImportThenArchive<T>(
  importCsv: () => Promise<T>,
  archive: () => Promise<PricechartingArchiveResult>,
): Promise<{ imported: T; archive: PricechartingArchiveResult }> {
  const imported = await importCsv();
  return { imported, archive: await archive() };
}

@Injectable()
export class PricechartingArchive {
  private readonly logger = new Logger(PricechartingArchive.name);
  private readonly client: S3Client | null;
  private sender: (input: PutObjectCommandInput) => Promise<unknown>;

  constructor(private readonly config: ConfigService) {
    const region = (this.config.get<string>('AWS_REGION') ?? '').trim();
    const bucket = (this.config.get<string>('PRICECHARTING_S3_BUCKET') ?? '').trim();
    this.client = bucket && region ? new S3Client({ region }) : null;
    this.sender = (input) => {
      if (!this.client) return Promise.reject(new Error('S3 client missing'));
      return this.client.send(new PutObjectCommand(input));
    };
  }

  /** Tests substitute the AWS call. Production uses the client built above. */
  setSender(send: (input: PutObjectCommandInput) => Promise<unknown>): void {
    this.sender = send;
  }

  async archiveRawCsv(input: {
    segments: string[];
    csvBuffer: Buffer;
    date: string;
    sleep?: (ms: number) => Promise<void>;
  }): Promise<PricechartingArchiveResult> {
    const label = input.segments.join('/');
    const nodeEnv = this.config.get<string>('NODE_ENV') ?? process.env.NODE_ENV;
    let key: string | null = null;
    try {
      key = pricechartingArchiveObjectKey({
        prefix: this.config.get<string>('PRICECHARTING_S3_PREFIX') ?? '',
        segments: input.segments,
        date: input.date,
      });
    } catch {
      key = null;
    }

    if (!isProductionArchiveWrite(nodeEnv)) {
      this.logger.log(
        `PriceCharting raw CSV archive skipped outside production guide=${label} bytes=${input.csvBuffer.length} date=${input.date}`,
      );
      return skippedPricechartingArchive();
    }

    const bucket = (this.config.get<string>('PRICECHARTING_S3_BUCKET') ?? '').trim();
    const region = (this.config.get<string>('AWS_REGION') ?? '').trim();
    if (!bucket || !region || !this.client || !key) {
      this.logger.error(
        `PriceCharting DB import succeeded but S3 raw CSV archival failed guide=${label} key=${key ?? ''} bytes=${input.csvBuffer.length} date=${input.date}`,
      );
      return {
        archived: false,
        attempted: true,
        key,
        error: PRICECHARTING_ARCHIVE_FAILURE,
      };
    }

    const put = await putPricechartingCsv({
      send: this.sender,
      bucket,
      key,
      body: input.csvBuffer,
      sleep: input.sleep,
    });
    if (put.ok) {
      this.logger.log(
        `PriceCharting raw CSV archived to S3 guide=${label} key=${key} bytes=${input.csvBuffer.length} date=${input.date}`,
      );
      return { archived: true, attempted: true, key, error: null };
    }
    this.logger.error(
      `PriceCharting DB import succeeded but S3 raw CSV archival failed guide=${label} key=${key} bytes=${input.csvBuffer.length} date=${input.date}`,
    );
    return {
      archived: false,
      attempted: true,
      key,
      error: PRICECHARTING_ARCHIVE_FAILURE,
    };
  }
}
