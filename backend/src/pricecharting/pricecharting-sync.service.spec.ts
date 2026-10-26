import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import * as lockUtil from '../database/pg-session-advisory-lock.util';
import { PRICECHARTING_NOT_CONFIGURED_CODE } from './pricecharting-errors';
import {
  PRICECHARTING_GUIDES,
  PricechartingSyncService,
} from './pricecharting-sync.service';

describe('PricechartingSyncService.enqueueOne', () => {
  function makeService() {
    let releaseDownload!: (value: Buffer) => void;
    const download = jest.fn(
      () =>
        new Promise<Buffer>((resolve) => {
          releaseDownload = resolve;
        }),
    );
    const importFile = jest.fn(async () => ({
      rowCount: 1,
      historyCount: 1,
      totalProducts: 1,
      archived: true,
      archiveError: null,
    }));
    const dataSource = {
      query: jest.fn(async () => []),
    };
    const service = new PricechartingSyncService(
      {
        find: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
      } as never,
      { importFile, summary: jest.fn() } as never,
      { downloadPriceList: download } as never,
      dataSource as never,
    );
    jest
      .spyOn(
        service as unknown as {
          runOneLocked: (g: { key: string; label: string }) => Promise<unknown>;
        },
        'runOneLocked',
      )
      .mockImplementation(async (guide) => {
        await download();
        const imported = await importFile();
        return {
          key: guide.key,
          label: guide.label,
          rowCount: imported.rowCount,
          historyCount: imported.historyCount,
          totalProducts: imported.totalProducts,
          imported: true as const,
          archived: imported.archived,
          archiveError: imported.archiveError,
        };
      });
    return { service, releaseDownload: () => releaseDownload(Buffer.from('id\n1\n')) };
  }

  it('returns accept payload and exposes running syncStatus', async () => {
    const { service } = makeService();
    expect(service.enqueueOne('pokemon-cards')).toEqual({
      accepted: true,
      key: 'pokemon-cards',
      label: '포켓몬 카드',
      status: 'running',
    });
    const guides = await service.guides();
    expect(guides.find((g) => g.key === 'pokemon-cards')?.syncStatus).toBe(
      'running',
    );
  });

  it('rejects a second enqueue while one is running', () => {
    const { service } = makeService();
    service.enqueueOne('pokemon-cards');
    expect(() => service.enqueueOne('magic-cards')).toThrow(BadRequestException);
  });

  it('rejects unknown guide keys', () => {
    const { service } = makeService();
    expect(() => service.enqueueOne('not-a-guide')).toThrow(BadRequestException);
  });
});

describe('PricechartingSyncService.runAllGuides', () => {
  function makeService() {
    const dataSource = { query: jest.fn(async () => []) };
    const service = new PricechartingSyncService(
      {} as never,
      { importFile: jest.fn() } as never,
      { downloadPriceList: jest.fn() } as never,
      dataSource as never,
    );
    return service;
  }

  function doneFor(guide: { key: string; label: string }) {
    return {
      key: guide.key,
      label: guide.label,
      rowCount: 2,
      historyCount: 2,
      totalProducts: 2,
      imported: true as const,
      archived: true,
      archiveError: null,
    };
  }

  beforeEach(() => {
    jest
      .spyOn(lockUtil, 'runWithPgSessionAdvisoryLock')
      .mockImplementation(async (_ds, _key, fn) => ({
        acquired: true,
        value: await fn(),
      }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('runs every fixed guide in order', async () => {
    const service = makeService();
    const keys: string[] = [];
    jest
      .spyOn(
        service as unknown as {
          executeGuide: (g: { key: string; label: string }) => Promise<unknown>;
        },
        'executeGuide',
      )
      .mockImplementation(async (guide) => {
        keys.push(guide.key);
        return doneFor(guide);
      });

    const run = await service.runAllGuides({ gapMs: 0 });
    expect(run.skipped).toBe(false);
    expect(keys).toEqual(PRICECHARTING_GUIDES.map((guide) => guide.key));
    expect(run.results.every((row) => row.ok)).toBe(true);
  });

  it('keeps going after one guide fails', async () => {
    const service = makeService();
    jest
      .spyOn(
        service as unknown as {
          executeGuide: (g: { key: string; label: string }) => Promise<unknown>;
        },
        'executeGuide',
      )
      .mockImplementation(async (guide) => {
        if (guide.key === 'magic-cards') throw new Error('upstream down');
        return doneFor(guide);
      });

    const run = await service.runAllGuides({ gapMs: 0 });
    expect(run.results.map((row) => row.key)).toEqual(
      PRICECHARTING_GUIDES.map((guide) => guide.key),
    );
    expect(run.results.find((row) => row.key === 'magic-cards')?.ok).toBe(false);
    expect(run.results.filter((row) => row.ok)).toHaveLength(4);
  });

  it('stops when the API token is missing', async () => {
    const service = makeService();
    const execute = jest.fn(async () => {
      throw new ServiceUnavailableException({
        code: PRICECHARTING_NOT_CONFIGURED_CODE,
        message: 'PRICECHARTING_API_TOKEN is not configured',
      });
    });
    jest
      .spyOn(
        service as unknown as { executeGuide: () => Promise<unknown> },
        'executeGuide',
      )
      .mockImplementation(execute);

    const run = await service.runAllGuides({ gapMs: 0 });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(run.results).toHaveLength(1);
    expect(run.results[0]?.ok).toBe(false);
  });

  it('skips when a sync is already in this process', async () => {
    const service = makeService();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    jest
      .spyOn(
        service as unknown as {
          executeGuide: (g: { key: string; label: string }) => Promise<unknown>;
        },
        'executeGuide',
      )
      .mockImplementation(async (guide) => {
        await gate;
        return doneFor(guide);
      });

    const first = service.runAllGuides({ gapMs: 0 });
    const second = await service.runAllGuides({ gapMs: 0 });
    expect(second).toEqual({ skipped: true, results: [] });
    release();
    const finished = await first;
    expect(finished.skipped).toBe(false);
  });
});
