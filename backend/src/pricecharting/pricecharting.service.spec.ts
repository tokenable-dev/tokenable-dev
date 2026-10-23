import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PRICECHARTING_CSV_COOLDOWN_CODE,
  PRICECHARTING_CSV_NOT_CONFIGURED_CODE,
  PRICECHARTING_NOT_CONFIGURED_CODE,
} from './pricecharting-errors';
import {
  buildCatalogDownloadUrl,
  normalizeCatalogSourceUrl,
  PricechartingService,
} from './pricecharting.service';

function mockConfig(map: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string) => map[key],
  } as unknown as ConfigService;
}

describe('catalog CSV urls', () => {
  it('strips the token before storing and injects the server token for download', () => {
    const raw =
      'https://www.pricecharting.com/price-guide/download-custom?t=secret-token&category=pokemon';
    expect(normalizeCatalogSourceUrl(raw)).toBe(
      'https://www.pricecharting.com/price-guide/download-custom?category=pokemon',
    );
    const download = buildCatalogDownloadUrl(raw, 'server-token');
    expect(download.searchParams.get('t')).toBe('server-token');
    expect(download.searchParams.get('category')).toBe('pokemon');
  });

  it('rejects hosts other than PriceCharting and SportsCardsPro', () => {
    expect(() => normalizeCatalogSourceUrl('https://example.com/file.csv')).toThrow(
      /pricecharting\.com or sportscardspro\.com/,
    );
  });
});

describe('PricechartingService', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('throws when PRICECHARTING_API_TOKEN is missing', async () => {
    const svc = new PricechartingService(mockConfig({}));
    try {
      await svc.forwardJsonGet('/api/product', { id: '6910' });
      fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ServiceUnavailableException);
      const body = (e as ServiceUnavailableException).getResponse() as {
        code?: string;
      };
      expect(body.code).toBe(PRICECHARTING_NOT_CONFIGURED_CODE);
    }
  });

  it('injects t and strips client t on JSON GET', async () => {
    const seen: string[] = [];
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return new Response(
        JSON.stringify({ status: 'success', id: '6910' }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }) as unknown as typeof fetch;

    const svc = new PricechartingService(
      mockConfig({ PRICECHARTING_API_TOKEN: 'server-token-40chars' }),
    );
    const out = await svc.forwardJsonGet('/api/product', {
      id: '6910',
      t: 'client-should-not-win',
    });

    expect(out).toEqual({ status: 'success', id: '6910' });
    expect(seen).toHaveLength(1);
    const u = new URL(seen[0]!);
    expect(u.pathname).toBe('/api/product');
    expect(u.searchParams.get('t')).toBe('server-token-40chars');
    expect(u.searchParams.get('id')).toBe('6910');
  });

  it('throws when CSV URL is missing', async () => {
    const svc = new PricechartingService(
      mockConfig({ PRICECHARTING_API_TOKEN: 'server-token' }),
    );
    try {
      await svc.forwardCsv();
      fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ServiceUnavailableException);
      const body = (e as ServiceUnavailableException).getResponse() as {
        code?: string;
      };
      expect(body.code).toBe(PRICECHARTING_CSV_NOT_CONFIGURED_CODE);
    }
  });

  it('enforces CSV 10-minute cooldown after a successful download', async () => {
    globalThis.fetch = jest.fn(async () => {
      return new Response('id,product-name\n1,Test\n', {
        status: 200,
        headers: { 'content-type': 'text/csv' },
      });
    }) as unknown as typeof fetch;

    const svc = new PricechartingService(
      mockConfig({
        PRICECHARTING_API_TOKEN: 'server-token',
        PRICECHARTING_CSV_URL:
          'https://www.pricecharting.com/price-guide/download-custom?category=pokemon-cards',
      }),
    );

    await svc.forwardCsv();
    try {
      await svc.forwardCsv();
      fail('expected cooldown');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      expect((e as HttpException).getStatus()).toBe(429);
      const body = (e as HttpException).getResponse() as { code?: string };
      expect(body.code).toBe(PRICECHARTING_CSV_COOLDOWN_CODE);
    }
  });
});
