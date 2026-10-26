import { ConfigService } from '@nestjs/config';
import { PricechartingGuideSchedulerService } from './pricecharting-guide-scheduler.service';

function makeScheduler(env: Record<string, string | undefined>) {
  const config = {
    get: (key: string) => env[key],
  } as ConfigService;
  return new PricechartingGuideSchedulerService(config, {} as never);
}

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
