import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FxService } from './fx.service';

@Injectable()
export class FxScheduler {
  private readonly logger = new Logger(FxScheduler.name);

  constructor(private readonly fx: FxService) {}

  /** After the ECB 16:00 CET publication, including summer time. */
  @Cron('30 15 * * *', { timeZone: 'UTC' })
  async afterEcbPublication(): Promise<void> {
    await this.run('ecb-publication');
  }

  /** Morning catch-up if the publication window was missed. */
  @Cron('0 1 * * *', { timeZone: 'UTC' })
  async morningCatchUp(): Promise<void> {
    await this.run('morning');
  }

  private async run(trigger: string): Promise<void> {
    try {
      const result = await this.fx.refresh(trigger);
      this.logger.log(JSON.stringify({ msg: 'fx_refresh', trigger, ...result }));
    } catch (err) {
      this.logger.warn(
        `FX refresh failed (${trigger}); keeping the last stored rates: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
