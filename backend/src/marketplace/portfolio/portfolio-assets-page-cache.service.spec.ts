import { PortfolioAssetsPageCacheService } from './portfolio-assets-page-cache.service';
import type { TtlCacheProvider } from '../../common/cache/ttl-cache.interface';

describe('PortfolioAssetsPageCacheService', () => {
  const memory: TtlCacheProvider = {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    clearNamespace: jest.fn(),
  };

  const config = {
    get: jest.fn((key: string) => (key === 'REDIS_URL' ? undefined : undefined)),
  };

  let service: PortfolioAssetsPageCacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PortfolioAssetsPageCacheService(config as never, memory);
  });

  it('buildKey is stable for token order', () => {
    const a = service.buildKey(8453, '0xabc', [3, 1, 2]);
    const b = service.buildKey(8453, '0xabc', [1, 2, 3]);
    expect(a).toBe(b);
    expect(a).toMatch(/^8453:0xabc:[a-f0-9]{20}$/);
  });

  it('buildKey differs by wallet or chain', () => {
    const base = service.buildKey(8453, '0xabc', [1]);
    expect(service.buildKey(8453, '0xdef', [1])).not.toBe(base);
    expect(service.buildKey(1, '0xabc', [1])).not.toBe(base);
  });

  it('get returns memory layer first', async () => {
    const payload = {
      metadataItems: [],
      collectionKeys: {},
      marketItems: [],
      mintPreviews: {},
    };
    (memory.get as jest.Mock).mockReturnValue(payload);
    const hit = await service.get('k1');
    expect(hit).toEqual({ payload, layer: 'memory' });
  });
});
