import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PricechartingSyncService } from './pricecharting-sync.service';

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

  /** 10:00 Asia/Seoul. Guide files regenerate about once a day. */
  @Cron('0 0 10 * * *', { timeZone: 'Asia/Seoul' })
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
        }),
      );
    } catch (err) {
      this.logger.error(
        JSON.stringify({
          msg: 'pricecharting_guide_cron_failed',
          trigger,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}
