import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { sanitizePricechartingLogText } from './pricecharting-errors';
import { PricechartingSyncService } from './pricecharting-sync.service';

/** 04:00:00 every day. Nest cron is second minute hour day month dow. */
export const PRICECHARTING_GUIDE_CRON = '0 0 4 * * *';
export const PRICECHARTING_GUIDE_CRON_TZ = 'Asia/Seoul';

/**
 * Daily PriceCharting guide refresh. Same download + upsert as the admin
 * 「갱신」 buttons, one guide at a time. Off outside production unless
 * PRICECHARTING_GUIDE_CRON_ENABLED is set.
 */
@Injectable()
export class PricechartingGuideSchedulerService {
  private readonly logger = new Logger(PricechartingGuideSchedulerService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly sync: PricechartingSyncService,
  ) {}

  cronEnabled(): boolean {
    const raw = this.config.get<string>('PRICECHARTING_GUIDE_CRON_ENABLED')?.trim();
    if (raw === '1' || raw === 'true') return true;
    if (raw === '0' || raw === 'false') return false;
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  /** 04:00 Asia/Seoul. Guide files regenerate about once a day. */
  @Cron(PRICECHARTING_GUIDE_CRON, { timeZone: PRICECHARTING_GUIDE_CRON_TZ })
  async handleDailyKst(): Promise<void> {
    if (!this.cronEnabled()) return;
    await this.run('cron');
  }

  async run(trigger: 'cron'): Promise<void> {
    this.logger.log(
      JSON.stringify({
        msg: 'pricecharting_guide_cron_start',
        trigger,
        timezone: 'Asia/Seoul',
      }),
    );
    try {
      const result = await this.sync.runAllGuides();
      this.logger.log(
        JSON.stringify({
          msg: 'pricecharting_guide_cron_done',
          trigger,
          skipped: result.skipped,
          ok: result.results.filter((row) => row.ok).length,
          failed: result.results.filter((row) => !row.ok).length,
          failures: result.results
            .filter((row) => !row.ok)
            .map((row) => ({
              key: row.key,
              error: row.error ? sanitizePricechartingLogText(row.error, 500) : null,
            })),
        }),
      );
    } catch (err) {
      this.logger.error(
        JSON.stringify({
          msg: 'pricecharting_guide_cron_failed',
          trigger,
          error: sanitizePricechartingLogText(
            err instanceof Error ? err.message : 'sync failed',
            500,
          ),
        }),
      );
    }
  }
}
