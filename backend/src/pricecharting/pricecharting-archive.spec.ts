import type { PutObjectCommandInput } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import {
  PRICECHARTING_ARCHIVE_FAILURE,
  PricechartingArchive,
  isProductionArchiveWrite,
  pricechartingArchiveObjectKey,
  putPricechartingCsv,
  runImportThenArchive,
  safeArchiveSegment,
} from './pricecharting-archive';

const sleepNow = async () => undefined;

function config(map: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => map[key] } as unknown as ConfigService;
}

describe('pricecharting archive keys', () => {
  it('builds a guide key from the slug and Seoul date', () => {
    expect(
      pricechartingArchiveObjectKey({
        prefix: 'pricecharting/raw/',
        segments: ['pokemon-cards'],
        date: '2026-10-20',
      }),
    ).toBe('pricecharting/raw/pokemon-cards/pokemon-cards-2026-10-20.csv');
  });

  it('builds a sports set key under sports/', () => {
    expect(
      pricechartingArchiveObjectKey({
        prefix: 'pricecharting/raw',
        segments: ['sports', 'Basketball-Cards-1986-Fleer'],
        date: '2026-10-20',
      }),
    ).toBe(
      'pricecharting/raw/sports/Basketball-Cards-1986-Fleer/Basketball-Cards-1986-Fleer-2026-10-20.csv',
    );
  });

  it('uses the same key for the same guide and date', () => {
    const input = {
      prefix: 'pricecharting/raw/',
      segments: ['pokemon-cards'],
      date: '2026-10-20',
    };
    expect(pricechartingArchiveObjectKey(input)).toBe(pricechartingArchiveObjectKey(input));
  });

  it('uses a different key for a different date', () => {
    const on20 = pricechartingArchiveObjectKey({
      prefix: 'pricecharting/raw/',
      segments: ['pokemon-cards'],
      date: '2026-10-20',
    });
    const on21 = pricechartingArchiveObjectKey({
      prefix: 'pricecharting/raw/',
      segments: ['pokemon-cards'],
      date: '2026-10-21',
    });
    expect(on21).not.toBe(on20);
    expect(on21).toBe('pricecharting/raw/pokemon-cards/pokemon-cards-2026-10-21.csv');
  });

  it('rejects path traversal in a segment', () => {
    expect(() => safeArchiveSegment('..')).toThrow(/Unsafe/);
    expect(() => safeArchiveSegment('a/b')).toThrow(/Unsafe/);
    expect(() =>
      pricechartingArchiveObjectKey({
        prefix: 'pricecharting/raw/',
        segments: ['../pokemon-cards'],
        date: '2026-10-20',
      }),
    ).toThrow(/Unsafe/);
  });
});

describe('putPricechartingCsv', () => {
  const body = Buffer.from('id,product-name\n1,Card\n');

  it('uploads the original buffer once with text/csv', async () => {
    const send = jest.fn(async (_input: PutObjectCommandInput) => undefined);
    const result = await putPricechartingCsv({
      send,
      bucket: 'tokenable-pricecharting-raw',
      key: 'pricecharting/raw/pokemon-cards/pokemon-cards-2026-10-20.csv',
      body,
      sleep: sleepNow,
    });
    expect(result).toEqual({ ok: true });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      Bucket: 'tokenable-pricecharting-raw',
      Key: 'pricecharting/raw/pokemon-cards/pokemon-cards-2026-10-20.csv',
      Body: body,
      ContentType: 'text/csv',
    });
  });

  it('retries the same buffer and succeeds on a later attempt', async () => {
    const send = jest
      .fn<Promise<void>, [PutObjectCommandInput]>()
      .mockRejectedValueOnce(new Error('reset'))
      .mockRejectedValueOnce(new Error('reset'))
      .mockResolvedValueOnce(undefined);
    const result = await putPricechartingCsv({
      send,
      bucket: 'tokenable-pricecharting-raw',
      key: 'pricecharting/raw/pokemon-cards/pokemon-cards-2026-10-20.csv',
      body,
      sleep: sleepNow,
    });
    expect(result).toEqual({ ok: true });
    expect(send).toHaveBeenCalledTimes(3);
    expect(send.mock.calls[2]?.[0]?.Body).toBe(body);
  });

  it('stops after three failures', async () => {
    const send = jest.fn(async () => {
      throw new Error('reset');
    });
    const result = await putPricechartingCsv({
      send,
      bucket: 'tokenable-pricecharting-raw',
      key: 'k',
      body,
      sleep: sleepNow,
    });
    expect(result).toEqual({ ok: false });
    expect(send).toHaveBeenCalledTimes(3);
  });
});

describe('PricechartingArchive', () => {
  const body = Buffer.from('original-bytes');

  it('does not write outside production', async () => {
    const archive = new PricechartingArchive(
      config({
        NODE_ENV: 'development',
        AWS_REGION: 'ap-northeast-2',
        PRICECHARTING_S3_BUCKET: 'tokenable-pricecharting-raw',
        PRICECHARTING_S3_PREFIX: 'pricecharting/raw/',
      }),
    );
    const send = jest.fn(async () => undefined);
    archive.setSender(send);
    const result = await archive.archiveRawCsv({
      segments: ['pokemon-cards'],
      csvBuffer: body,
      date: '2026-10-20',
      sleep: sleepNow,
    });
    expect(isProductionArchiveWrite('development')).toBe(false);
    expect(result).toEqual({ archived: false, attempted: false, key: null, error: null });
    expect(send).not.toHaveBeenCalled();
  });

  it('uploads in production', async () => {
    const archive = new PricechartingArchive(
      config({
        NODE_ENV: 'production',
        AWS_REGION: 'ap-northeast-2',
        PRICECHARTING_S3_BUCKET: 'tokenable-pricecharting-raw',
        PRICECHARTING_S3_PREFIX: 'pricecharting/raw/',
      }),
    );
    const send = jest.fn<Promise<void>, [PutObjectCommandInput]>(async () => undefined);
    archive.setSender(send);
    const result = await archive.archiveRawCsv({
      segments: ['pokemon-cards'],
      csvBuffer: body,
      date: '2026-10-20',
      sleep: sleepNow,
    });
    expect(result.archived).toBe(true);
    expect(result.key).toBe('pricecharting/raw/pokemon-cards/pokemon-cards-2026-10-20.csv');
    expect(send.mock.calls[0]?.[0]?.Body).toBe(body);
  });

  it('reports archive failure after retries without throwing', async () => {
    const archive = new PricechartingArchive(
      config({
        NODE_ENV: 'production',
        AWS_REGION: 'ap-northeast-2',
        PRICECHARTING_S3_BUCKET: 'tokenable-pricecharting-raw',
        PRICECHARTING_S3_PREFIX: 'pricecharting/raw/',
      }),
    );
    const send = jest.fn(async () => {
      throw new Error('reset');
    });
    archive.setSender(send);
    const result = await archive.archiveRawCsv({
      segments: ['yugioh-cards'],
      csvBuffer: body,
      date: '2026-10-20',
      sleep: sleepNow,
    });
    expect(send).toHaveBeenCalledTimes(3);
    expect(result.archived).toBe(false);
    expect(result.attempted).toBe(true);
    expect(result.error).toBe(PRICECHARTING_ARCHIVE_FAILURE);
  });
});

describe('runImportThenArchive', () => {
  it('does not archive when the import throws', async () => {
    const archive = jest.fn(async () => ({
      archived: true,
      attempted: true,
      key: 'k',
      error: null,
    }));
    await expect(
      runImportThenArchive(async () => {
        throw new Error('import failed');
      }, archive),
    ).rejects.toThrow('import failed');
    expect(archive).not.toHaveBeenCalled();
  });

  it('archives only after the import resolves', async () => {
    const order: string[] = [];
    const outcome = await runImportThenArchive(
      async () => {
        order.push('import');
        return { runId: 1 };
      },
      async () => {
        order.push('archive');
        return { archived: true, attempted: true, key: 'k', error: null };
      },
    );
    expect(order).toEqual(['import', 'archive']);
    expect(outcome.imported.runId).toBe(1);
    expect(outcome.archive.archived).toBe(true);
  });
});
