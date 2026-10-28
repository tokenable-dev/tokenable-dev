import { HttpException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  describePricechartingDownloadFailure,
  isRetryablePricechartingDownload,
  PRICECHARTING_CSV_COOLDOWN_CODE,
  PRICECHARTING_CSV_NOT_CONFIGURED_CODE,
  PRICECHARTING_NOT_CONFIGURED_CODE,
  sanitizePricechartingLogText,
} from './pricecharting-errors';
import {
  buildCatalogDownloadUrl,
  normalizeCatalogSourceUrl,
  PricechartingService,
} from './pricecharting.service';

const GUIDE_URL =
  'https://www.pricecharting.com/price-guide/download-custom?category=pokemon-cards';
const ENVOY =
  'upstream connect error or disconnect/reset before headers. reset reason: connection termination';
const SECRET_URL =
  'https://www.pricecharting.com/price-guide/download-custom?t=secret-token&category=pokemon-cards';
const ENCODED_SECRET_URL = encodeURIComponent(SECRET_URL);

function assertNoSecrets(text: string): void {
  expect(text).not.toContain('secret-token');
  expect(text).not.toContain('server-token');
  expect(text).not.toContain('session-secret');
  expect(text).not.toContain('pricecharting.com');
  expect(text).not.toContain('download-custom');
  expect(text).not.toContain('pokemon-cards');
  expect(text).not.toContain('category=');
  expect(text).not.toContain('t=');
}

function mockConfig(map: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string) => map[key],
  } as unknown as ConfigService;
}

function guideService(): PricechartingService {
  return new PricechartingService(
    mockConfig({ PRICECHARTING_API_TOKEN: 'server-token' }),
  );
}

function captureWarns(): string[] {
  const warnings: string[] = [];
  jest.spyOn(Logger.prototype, 'warn').mockImplementation((message: unknown) => {
    warnings.push(String(message));
  });
  return warnings;
}

function parsedWarns(warnings: string[]): Array<Record<string, unknown>> {
  return warnings.map((line) => JSON.parse(line) as Record<string, unknown>);
}

const CSV_GAP_MS = 10 * 60 * 1000;

/** Run a download that may sleep on the shared CSV gap. Does not wait in real time. */
async function downloadWithFakeClock(
  run: () => Promise<Buffer>,
): Promise<Buffer> {
  jest.useFakeTimers();
  const pending = run();
  await jest.advanceTimersByTimeAsync(CSV_GAP_MS * 3);
  return pending;
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
    jest.useRealTimers();
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

  it('retries a guide download once after the csv gap, then keeps the CSV', async () => {
    const warnings = captureWarns();
    let calls = 0;
    const starts: number[] = [];
    globalThis.fetch = jest.fn(async () => {
      starts.push(Date.now());
      calls += 1;
      if (calls === 1) return new Response(ENVOY, { status: 503 });
      return new Response('id,product-name\n1,Box\n', {
        status: 200,
        headers: { 'content-type': 'text/csv' },
      });
    }) as unknown as typeof fetch;

    jest.useFakeTimers();
    const pending = guideService().downloadPriceList(GUIDE_URL);
    await jest.advanceTimersByTimeAsync(0);
    expect(calls).toBe(1);
    await jest.advanceTimersByTimeAsync(CSV_GAP_MS - 1);
    expect(calls).toBe(1);
    await jest.advanceTimersByTimeAsync(1);
    const buf = await pending;

    expect(calls).toBe(2);
    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(CSV_GAP_MS);
    expect(buf.toString('utf8')).toContain('Box');
    const logged = parsedWarns(warnings);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({
      msg: 'pricecharting_csv_download_failed',
      attempt: 1,
      attempts: 2,
      phase: 'http',
      kind: 'http',
      status: 503,
    });
    expect(logged[0]?.reason).toContain('before headers');
    expect(warnings.join('\n')).not.toContain('server-token');
    expect(warnings.join('\n')).not.toContain('download-custom');
  });

  it('does not retry a guide download when the token is rejected', async () => {
    let calls = 0;
    globalThis.fetch = jest.fn(async () => {
      calls += 1;
      return new Response('invalid token', { status: 401 });
    }) as unknown as typeof fetch;

    const svc = new PricechartingService(
      mockConfig({ PRICECHARTING_API_TOKEN: 'server-token' }),
    );
    await expect(svc.downloadPriceList(GUIDE_URL)).rejects.toBeInstanceOf(HttpException);
    expect(calls).toBe(1);
  });

  it('retries a connection reset thrown by fetch and logs the headers phase', async () => {
    const warnings = captureWarns();
    let calls = 0;
    globalThis.fetch = jest.fn(async () => {
      calls += 1;
      if (calls < 2) throw new Error(ENVOY);
      return new Response('id,product-name\n1,Box\n', { status: 200 });
    }) as unknown as typeof fetch;

    const buf = await downloadWithFakeClock(() => guideService().downloadPriceList(GUIDE_URL));

    expect(calls).toBe(2);
    expect(buf.toString('utf8')).toContain('Box');
    const logged = parsedWarns(warnings);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({
      attempt: 1,
      phase: 'headers',
      kind: 'connection_reset',
      status: null,
    });
    expect(logged[0]?.reason).toContain('connection termination');
    expect(warnings.join('\n')).not.toContain('server-token');
  });

  it('retries a reset while reading the body and logs the body phase', async () => {
    const warnings = captureWarns();
    let calls = 0;
    globalThis.fetch = jest.fn(async () => {
      calls += 1;
      if (calls < 2) {
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => {
            throw new Error('terminated');
          },
        };
      }
      return new Response('id,product-name\n1,Box\n', { status: 200 });
    }) as unknown as typeof fetch;

    const buf = await downloadWithFakeClock(() => guideService().downloadPriceList(GUIDE_URL));

    expect(calls).toBe(2);
    expect(buf.toString('utf8')).toContain('Box');
    expect(parsedWarns(warnings)[0]).toMatchObject({
      attempt: 1,
      phase: 'body',
      kind: 'connection_reset',
      status: null,
    });
  });

  it('does not retry HTTP 403 and keeps the status on the log', async () => {
    const warnings = captureWarns();
    let calls = 0;
    globalThis.fetch = jest.fn(async () => {
      calls += 1;
      return new Response('forbidden ?t=server-token&category=pokemon-cards', { status: 403 });
    }) as unknown as typeof fetch;

    await expect(guideService().downloadPriceList(GUIDE_URL)).rejects.toBeInstanceOf(
      HttpException,
    );
    expect(calls).toBe(1);
    const logged = parsedWarns(warnings);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ attempt: 1, phase: 'http', kind: 'http', status: 403 });
    expect(String(logged[0]?.reason)).toContain('forbidden');
    assertNoSecrets(warnings.join('\n'));
  });

  it.each([502, 504])('retries HTTP %s and keeps the status on the log', async (status) => {
    const warnings = captureWarns();
    let calls = 0;
    globalThis.fetch = jest.fn(async () => {
      calls += 1;
      if (calls < 2) return new Response(ENVOY, { status });
      return new Response('id,product-name\n1,Box\n', { status: 200 });
    }) as unknown as typeof fetch;

    const buf = await downloadWithFakeClock(() => guideService().downloadPriceList(GUIDE_URL));

    expect(calls).toBe(2);
    expect(buf.toString('utf8')).toContain('Box');
    expect(parsedWarns(warnings)[0]).toMatchObject({
      attempt: 1,
      phase: 'http',
      kind: 'http',
      status,
    });
    expect(isRetryablePricechartingDownload(
      new HttpException({ message: ENVOY }, status),
    )).toBe(true);
  });

  it.each([400, 429])('does not retry HTTP %s', async (status) => {
    const warnings = captureWarns();
    let calls = 0;
    globalThis.fetch = jest.fn(async () => {
      calls += 1;
      return new Response('no', { status });
    }) as unknown as typeof fetch;

    await expect(guideService().downloadPriceList(GUIDE_URL)).rejects.toBeInstanceOf(
      HttpException,
    );
    expect(calls).toBe(1);
    expect(parsedWarns(warnings)[0]).toMatchObject({
      phase: 'http',
      kind: 'http',
      status,
    });
    expect(isRetryablePricechartingDownload(
      new HttpException({ message: 'no' }, status),
    )).toBe(false);
  });

  it('does not retry HTTP 401', async () => {
    const warnings = captureWarns();
    let calls = 0;
    globalThis.fetch = jest.fn(async () => {
      calls += 1;
      return new Response(`invalid token ${SECRET_URL}`, { status: 401 });
    }) as unknown as typeof fetch;

    await expect(guideService().downloadPriceList(GUIDE_URL)).rejects.toBeInstanceOf(
      HttpException,
    );
    expect(calls).toBe(1);
    expect(parsedWarns(warnings)[0]).toMatchObject({
      phase: 'http',
      kind: 'http',
      status: 401,
    });
    assertNoSecrets(warnings.join('\n'));
    expect(isRetryablePricechartingDownload(
      new HttpException({ message: 'invalid token' }, 401),
    )).toBe(false);
  });

  it('does not retry an abort timeout and logs it as a timeout', async () => {
    const warnings = captureWarns();
    let calls = 0;
    globalThis.fetch = jest.fn(async () => {
      calls += 1;
      const err = new Error('The operation was aborted due to timeout');
      err.name = 'TimeoutError';
      throw err;
    }) as unknown as typeof fetch;

    try {
      await guideService().downloadPriceList(GUIDE_URL);
      fail('expected timeout');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(504);
      const body = (err as HttpException).getResponse() as { message?: string };
      expect(body.message).toContain('did not respond within 120s');
    }
    expect(calls).toBe(1);
    expect(parsedWarns(warnings)[0]).toMatchObject({
      attempt: 1,
      phase: 'headers',
      kind: 'timeout',
      status: null,
    });
  });

  it('does not retry a timeout wrapped in a cause and keeps the current network response', async () => {
    const warnings = captureWarns();
    let calls = 0;
    globalThis.fetch = jest.fn(async () => {
      calls += 1;
      const timeout = new Error('The operation was aborted due to timeout');
      timeout.name = 'TimeoutError';
      const wrapped = new TypeError('fetch failed');
      (wrapped as { cause?: unknown }).cause = timeout;
      throw wrapped;
    }) as unknown as typeof fetch;

    try {
      await guideService().downloadPriceList(GUIDE_URL);
      fail('expected failure');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(503);
      const body = (err as HttpException).getResponse() as { message?: string };
      expect(body.message).toContain('Could not reach PriceCharting (fetch failed)');
      expect(body.message).not.toContain('120s');
    }
    expect(calls).toBe(1);
    expect(parsedWarns(warnings)[0]).toMatchObject({
      phase: 'headers',
      kind: 'timeout',
      status: null,
    });
    expect(isRetryablePricechartingDownload(
      (() => {
        const timeout = new Error('The operation was aborted due to timeout');
        timeout.name = 'TimeoutError';
        const wrapped = new TypeError('fetch failed');
        (wrapped as { cause?: unknown }).cause = timeout;
        return wrapped;
      })(),
    )).toBe(false);
  });

  it('redacts a url inside a body-read failure and still retries', async () => {
    const warnings = captureWarns();
    let calls = 0;
    globalThis.fetch = jest.fn(async () => {
      calls += 1;
      if (calls < 2) {
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => {
            throw new Error(`terminated ${SECRET_URL}`);
          },
        };
      }
      return new Response('id,product-name\n1,Box\n', { status: 200 });
    }) as unknown as typeof fetch;

    const buf = await downloadWithFakeClock(() => guideService().downloadPriceList(GUIDE_URL));

    expect(calls).toBe(2);
    expect(buf.toString('utf8')).toContain('Box');
    expect(parsedWarns(warnings)[0]).toMatchObject({
      phase: 'body',
      kind: 'connection_reset',
      status: null,
    });
    assertNoSecrets(warnings.join('\n'));
  });

  it('redacts nested causes that carry the url, token, and cookie', async () => {
    const warnings = captureWarns();
    let calls = 0;
    globalThis.fetch = jest.fn(async () => {
      calls += 1;
      const inner = new Error(`cookie=session-secret ${ENCODED_SECRET_URL}`);
      const mid = new Error(SECRET_URL);
      (mid as { cause?: unknown }).cause = inner;
      const outer = new Error(ENVOY);
      (outer as { cause?: unknown }).cause = mid;
      if (calls < 2) throw outer;
      return new Response('id,product-name\n1,Box\n', { status: 200 });
    }) as unknown as typeof fetch;

    const buf = await downloadWithFakeClock(() => guideService().downloadPriceList(GUIDE_URL));

    expect(calls).toBe(2);
    expect(buf.toString('utf8')).toContain('Box');
    expect(parsedWarns(warnings)[0]).toMatchObject({
      phase: 'headers',
      kind: 'connection_reset',
      status: null,
    });
    assertNoSecrets(warnings.join('\n'));
  });

  it('logs a successful download without the url or token', async () => {
    const lines: string[] = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      lines.push(String(message));
    });
    let calls = 0;
    globalThis.fetch = jest.fn(async () => {
      calls += 1;
      return new Response('id,product-name\n1,Box\n', { status: 200 });
    }) as unknown as typeof fetch;

    const buf = await guideService().downloadPriceList(GUIDE_URL);

    expect(calls).toBe(1);
    expect(buf.toString('utf8')).toContain('Box');
    expect(lines.join('\n')).toContain('PriceCharting price list downloaded');
    assertNoSecrets(lines.join('\n'));
  });

  it('records a failed guide and still spaces the next guide by ten minutes', async () => {
    jest.useFakeTimers();
    const svc = guideService();
    let calls = 0;
    const starts: number[] = [];
    globalThis.fetch = jest.fn(async () => {
      starts.push(Date.now());
      calls += 1;
      if (calls <= 2) return new Response(ENVOY, { status: 503 });
      return new Response('id,product-name\n1,Box\n', { status: 200 });
    }) as unknown as typeof fetch;

    const first = svc.downloadPriceList(GUIDE_URL).then(
      () => null,
      (err: unknown) => err,
    );
    await jest.advanceTimersByTimeAsync(0);
    expect(calls).toBe(1);
    await jest.advanceTimersByTimeAsync(CSV_GAP_MS - 1);
    expect(calls).toBe(1);
    await jest.advanceTimersByTimeAsync(1);
    const err = await first;
    expect(calls).toBe(2);
    expect(err).toBeInstanceOf(HttpException);
    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(CSV_GAP_MS);

    const next = svc.downloadPriceList(
      'https://www.pricecharting.com/price-guide/download-custom?category=magic-cards',
    );
    await jest.advanceTimersByTimeAsync(CSV_GAP_MS - 1);
    expect(calls).toBe(2);
    await jest.advanceTimersByTimeAsync(1);
    const buf = await next;
    expect(calls).toBe(3);
    expect(buf.toString('utf8')).toContain('Box');
    expect(starts[2]! - starts[1]!).toBeGreaterThanOrEqual(CSV_GAP_MS);
  });

  it('keeps ten minutes between overlapping downloads on one service', async () => {
    jest.useFakeTimers();
    const svc = guideService();
    const starts: number[] = [];
    globalThis.fetch = jest.fn(async () => {
      starts.push(Date.now());
      return new Response('id,product-name\n1,Box\n', { status: 200 });
    }) as unknown as typeof fetch;

    const first = svc.downloadPriceList(GUIDE_URL);
    const second = svc.downloadPriceList(GUIDE_URL);
    await jest.advanceTimersByTimeAsync(0);
    expect(starts).toHaveLength(1);
    await jest.advanceTimersByTimeAsync(CSV_GAP_MS - 1);
    expect(starts).toHaveLength(1);
    await jest.advanceTimersByTimeAsync(1);
    await Promise.all([first, second]);
    expect(starts).toHaveLength(2);
    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(CSV_GAP_MS);
  });

  it('waits out Retry-After when it is longer than ten minutes and does not retry 429', async () => {
    jest.useFakeTimers();
    const svc = guideService();
    let calls = 0;
    globalThis.fetch = jest.fn(async () => {
      calls += 1;
      if (calls === 1) {
        return new Response('slow', {
          status: 429,
          headers: { 'retry-after': '900' },
        });
      }
      return new Response('id,product-name\n1,Box\n', { status: 200 });
    }) as unknown as typeof fetch;

    const first = await svc.downloadPriceList(GUIDE_URL).then(
      () => null,
      (err: unknown) => err,
    );
    expect(first).toBeInstanceOf(HttpException);
    expect((first as HttpException).getStatus()).toBe(429);
    expect(calls).toBe(1);

    const second = svc.downloadPriceList(GUIDE_URL);
    await jest.advanceTimersByTimeAsync(10 * 60 * 1000);
    expect(calls).toBe(1);
    await jest.advanceTimersByTimeAsync(5 * 60 * 1000);
    const buf = await second;
    expect(calls).toBe(2);
    expect(buf.toString('utf8')).toContain('Box');
  });

  it('uses Retry-After on HTTP 503 before the single retry', async () => {
    jest.useFakeTimers();
    let calls = 0;
    const starts: number[] = [];
    globalThis.fetch = jest.fn(async () => {
      starts.push(Date.now());
      calls += 1;
      if (calls === 1) {
        return new Response(ENVOY, {
          status: 503,
          headers: { 'retry-after': '900' },
        });
      }
      return new Response('id,product-name\n1,Box\n', { status: 200 });
    }) as unknown as typeof fetch;

    const pending = guideService().downloadPriceList(GUIDE_URL);
    await jest.advanceTimersByTimeAsync(0);
    expect(calls).toBe(1);
    await jest.advanceTimersByTimeAsync(10 * 60 * 1000);
    expect(calls).toBe(1);
    await jest.advanceTimersByTimeAsync(5 * 60 * 1000);
    const buf = await pending;
    expect(calls).toBe(2);
    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(15 * 60 * 1000);
    expect(buf.toString('utf8')).toContain('Box');
  });

  it('shares the csv gap between the proxy and a guide download', async () => {
    jest.useFakeTimers();
    const svc = new PricechartingService(
      mockConfig({
        PRICECHARTING_API_TOKEN: 'server-token',
        PRICECHARTING_CSV_URL:
          'https://www.pricecharting.com/price-guide/download-custom?category=pokemon-cards',
      }),
    );
    let calls = 0;
    globalThis.fetch = jest.fn(async () => {
      calls += 1;
      return new Response('id,product-name\n1,Box\n', {
        status: 200,
        headers: { 'content-type': 'text/csv' },
      });
    }) as unknown as typeof fetch;

    await svc.forwardCsv();
    const pending = svc.downloadPriceList(GUIDE_URL);
    await jest.advanceTimersByTimeAsync(CSV_GAP_MS - 1);
    expect(calls).toBe(1);
    await jest.advanceTimersByTimeAsync(1);
    const buf = await pending;
    expect(calls).toBe(2);
    expect(buf.toString('utf8')).toContain('Box');
  });
});

describe('describePricechartingDownloadFailure', () => {
  const envoy = new HttpException(
    { statusCode: 503, message: ENVOY },
    503,
  );

  it('keeps an HTTP proxy body distinct from a fetch throw', () => {
    expect(describePricechartingDownloadFailure(envoy)).toMatchObject({
      kind: 'http',
      status: 503,
    });
    expect(describePricechartingDownloadFailure(new Error(ENVOY))).toMatchObject({
      kind: 'connection_reset',
      status: null,
    });
    expect(isRetryablePricechartingDownload(envoy)).toBe(true);
    expect(isRetryablePricechartingDownload(new Error(ENVOY))).toBe(true);
  });

  it('does not retry 403 or an abort timeout', () => {
    const forbidden = new HttpException({ statusCode: 403, message: 'forbidden' }, 403);
    const timeout = new Error('The operation was aborted due to timeout');
    timeout.name = 'TimeoutError';
    const wrapped = new TypeError('fetch failed');
    (wrapped as { cause?: unknown }).cause = timeout;

    expect(isRetryablePricechartingDownload(forbidden)).toBe(false);
    expect(isRetryablePricechartingDownload(timeout)).toBe(false);
    expect(isRetryablePricechartingDownload(wrapped)).toBe(false);
    expect(describePricechartingDownloadFailure(wrapped)).toMatchObject({
      kind: 'timeout',
      status: null,
    });
    expect(describePricechartingDownloadFailure(wrapped).reason).not.toContain('server-token');
  });

  it('strips a full url, an encoded url, and a nested credential from the reason', () => {
    const inner = new Error(`cookie=session-secret ${ENCODED_SECRET_URL} t=secret-token`);
    const outer = new Error(`see ${SECRET_URL} category=pokemon-cards`);
    (outer as { cause?: unknown }).cause = inner;
    const described = describePricechartingDownloadFailure(outer);
    assertNoSecrets(described.reason);
    expect(described.reason).toContain('[redacted-url]');
    expect(described.kind).toBe('network');

    const http = new HttpException({ statusCode: 503, message: `${ENVOY} ${SECRET_URL}` }, 503);
    const httpDescribed = describePricechartingDownloadFailure(http);
    expect(httpDescribed).toMatchObject({ kind: 'http', status: 503 });
    assertNoSecrets(httpDescribed.reason);
    expect(httpDescribed.reason).toContain('before headers');
    expect(isRetryablePricechartingDownload(http)).toBe(true);
  });
});

describe('sanitizePricechartingLogText', () => {
  it('removes the whole url rather than only the token parameter', () => {
    const text = sanitizePricechartingLogText(
      `failed ${SECRET_URL} also ${ENCODED_SECRET_URL} t=secret-token category=pokemon-cards cookie=session-secret`,
    );
    assertNoSecrets(text);
    expect(text).toContain('failed');
    expect(text).toContain('[redacted-url]');
    expect(text).toContain('[redacted-credential]');
  });
});
