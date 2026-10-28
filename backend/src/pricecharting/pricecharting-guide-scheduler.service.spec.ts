import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PRICECHARTING_GUIDE_CRON,
  PRICECHARTING_GUIDE_CRON_TZ,
  PricechartingGuideSchedulerService,
} from './pricecharting-guide-scheduler.service';

function makeScheduler(env: Record<string, string | undefined>) {
  const config = {
    get: (key: string) => env[key],
  } as ConfigService;
  return new PricechartingGuideSchedulerService(config, {} as never);
}

describe('PricechartingGuideSchedulerService schedule', () => {
  it('runs at 04:00 Asia/Seoul', () => {
    const options = Reflect.getMetadata(
      'SCHEDULE_CRON_OPTIONS',
      PricechartingGuideSchedulerService.prototype.handleDailyKst,
    ) as { cronTime?: string; timeZone?: string };
    expect(PRICECHARTING_GUIDE_CRON).toBe('0 0 4 * * *');
    expect(PRICECHARTING_GUIDE_CRON_TZ).toBe('Asia/Seoul');
    expect(options).toEqual(
      expect.objectContaining({
        cronTime: '0 0 4 * * *',
        timeZone: 'Asia/Seoul',
      }),
    );
  });
});

describe('PricechartingGuideSchedulerService.cronEnabled', () => {
  it('runs in production and stays off in development', () => {
    expect(makeScheduler({ NODE_ENV: 'production' }).cronEnabled()).toBe(true);
    expect(makeScheduler({ NODE_ENV: 'development' }).cronEnabled()).toBe(false);
  });

  it('follows PRICECHARTING_GUIDE_CRON_ENABLED over NODE_ENV', () => {
    expect(
      makeScheduler({
        NODE_ENV: 'development',
        PRICECHARTING_GUIDE_CRON_ENABLED: 'true',
      }).cronEnabled(),
    ).toBe(true);
    expect(
      makeScheduler({
        NODE_ENV: 'production',
        PRICECHARTING_GUIDE_CRON_ENABLED: 'false',
      }).cronEnabled(),
    ).toBe(false);
  });
});

describe('PricechartingGuideSchedulerService.run', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('lists failed guide keys and omits the download url', async () => {
    const lines: string[] = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      lines.push(String(message));
    });
    const scheduler = new PricechartingGuideSchedulerService(
      { get: () => undefined } as unknown as ConfigService,
      {
        runAllGuides: async () => ({
          skipped: false,
          results: [
            {
              key: 'video-games',
              ok: false,
              rowCount: null,
              error:
                'upstream connect error https://www.pricecharting.com/price-guide/download-custom?t=secret-token&category=pokemon-cards cookie=session-secret',
            },
            { key: 'pokemon-cards', ok: true, rowCount: 10, error: null },
          ],
        }),
      } as never,
    );

    await scheduler.run('cron');

    const done = lines
      .map((line) => JSON.parse(line) as { msg?: string; failures?: unknown })
      .find((row) => row.msg === 'pricecharting_guide_cron_done');
    expect(done).toMatchObject({
      ok: 1,
      failed: 1,
      failures: [{ key: 'video-games' }],
    });
    const failures = (done as { failures?: Array<{ key?: string; error?: string }> }).failures;
    expect(failures?.[0]?.error).toContain('upstream connect error');
    expect(failures?.[0]?.error).toContain('[redacted-url]');
    const logged = lines.join('\n');
    expect(logged).not.toContain('secret-token');
    expect(logged).not.toContain('session-secret');
    expect(logged).not.toContain('pricecharting.com');
    expect(logged).not.toContain('download-custom');
    expect(logged).not.toContain('pokemon-cards');
    expect(logged).not.toContain('category=');
  });

  it('redacts a url thrown out of the guide run', async () => {
    const errors: string[] = [];
    jest.spyOn(Logger.prototype, 'error').mockImplementation((message: unknown) => {
      errors.push(String(message));
    });
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const scheduler = new PricechartingGuideSchedulerService(
      { get: () => undefined } as unknown as ConfigService,
      {
        runAllGuides: async () => {
          throw new Error(
            'https://www.pricecharting.com/price-guide/download-custom?t=secret-token&category=pokemon-cards',
          );
        },
      } as never,
    );

    await scheduler.run('cron');

    const logged = errors.join('\n');
    expect(logged).toContain('pricecharting_guide_cron_failed');
    expect(logged).toContain('[redacted-url]');
    expect(logged).not.toContain('secret-token');
    expect(logged).not.toContain('pricecharting.com');
    expect(logged).not.toContain('download-custom');
    expect(logged).not.toContain('pokemon-cards');
  });
});
