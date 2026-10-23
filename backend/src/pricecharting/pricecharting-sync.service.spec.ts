import { BadRequestException } from '@nestjs/common';
import { PricechartingSyncService } from './pricecharting-sync.service';

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
