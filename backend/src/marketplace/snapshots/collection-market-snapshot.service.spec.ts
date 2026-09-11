import { CollectionMarketSnapshotService } from './collection-market-snapshot.service';
import type { TtlCacheProvider } from '../../common/cache/ttl-cache.interface';
import type { CollectionMarketSnapshot } from '../entities/collection-market-snapshot.entity';

describe('CollectionMarketSnapshotService price index', () => {
  const snapshotRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  };
  const collectionEnrichment = {};
  const cardMarketData = {};
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'MARKET_SNAPSHOT_PRICE_INDEX_TTL_MS') return '30000';
      return undefined;
    }),
  };
  const snapshotScheduler = {};
  const memory: TtlCacheProvider = {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    clearNamespace: jest.fn(),
  };

  let service: CollectionMarketSnapshotService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CollectionMarketSnapshotService(
      snapshotRepo as never,
      collectionEnrichment as never,
      cardMarketData as never,
      config as never,
      snapshotScheduler as never,
      memory,
    );
  });

  it('loads all snapshot rows once and serves later reads from TTL cache', async () => {
    const row = {
      collectionKey: 'AbC123',
      headlineUsd: 10,
    } as CollectionMarketSnapshot;
    snapshotRepo.find.mockResolvedValue([row]);
    (memory.get as jest.Mock).mockReturnValueOnce(undefined).mockReturnValueOnce(
      new Map([['abc123', row]]),
    );

    const first = await service.getPriceIndex();
    expect(snapshotRepo.find).toHaveBeenCalledTimes(1);
    expect(first.get('abc123')).toBe(row);
    expect(memory.set).toHaveBeenCalled();

    const second = await service.getPriceIndex();
    expect(snapshotRepo.find).toHaveBeenCalledTimes(1);
    expect(second.get('abc123')).toBe(row);
  });

  it('coalesces concurrent loads into one SELECT', async () => {
    let resolveFind: (rows: CollectionMarketSnapshot[]) => void = () => undefined;
    snapshotRepo.find.mockReturnValue(
      new Promise<CollectionMarketSnapshot[]>((resolve) => {
        resolveFind = resolve;
      }),
    );
    (memory.get as jest.Mock).mockReturnValue(undefined);

    const a = service.getPriceIndex();
    const b = service.getPriceIndex();
    resolveFind([]);
    await Promise.all([a, b]);

    expect(snapshotRepo.find).toHaveBeenCalledTimes(1);
  });
});
