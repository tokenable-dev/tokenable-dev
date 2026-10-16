import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { runWithPgSessionAdvisoryLock } from '../../database/pg-session-advisory-lock.util';
import { PortfolioDailySnapshotService } from './portfolio-daily-snapshot.service';
import { PORTFOLIO_SNAPSHOT_ADVISORY_LOCK_KEY } from './portfolio-daily-snapshot.types';

@Injectable()
export class PortfolioDailySnapshotSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(PortfolioDailySnapshotSchedulerService.name);
  private captureInFlight = false;

  constructor(
    private readonly portfolioSnapshots: PortfolioDailySnapshotService,
    private readonly config: ConfigService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  cronEnabled(): boolean {
    const raw = this.config.get<string>('PORTFOLIO_SNAPSHOT_CRON_ENABLED');
    if (raw === '1' || raw === 'true') return true;
    if (raw === '0' || raw === 'false') return false;
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  bootstrapEnabled(): boolean {
    const raw = this.config.get<string>('PORTFOLIO_SNAPSHOT_BOOTSTRAP_ENABLED');
    if (raw === '1' || raw === 'true') return true;
    if (raw === '0' || raw === 'false') return false;
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  bootstrapDelayMs(): number {
    const raw = Number(
      this.config.get<string>('PORTFOLIO_SNAPSHOT_BOOTSTRAP_DELAY_MS') ?? '10000',
    );
    if (!Number.isFinite(raw) || raw < 0) return 10_000;
    return Math.min(Math.floor(raw), 120_000);
  }

  onModuleInit(): void {
    if (!this.bootstrapEnabled()) return;
    const delay = this.bootstrapDelayMs();
    setTimeout(() => {
      void this.runCapture('bootstrap');
    }, delay);
  }

  /**
   * Daily capture at 09:20 KST for all on-chain holders + tracked zero-card
   * wallets. Staggered after the 09:00 collection-market prewarm so the three
   * daily jobs (prewarm → portfolio) don't contend for DB/RPC/upstream
   * quota at the same instant. Snapshot slots are keyed by KST date, so the
   * shifted time lands in the same daily slot.
   */
  @Cron('0 20 9 * * *', { timeZone: 'Asia/Seoul' })
  async handleDailyCaptureKst(): Promise<void> {
    if (!this.cronEnabled()) return;
    await this.runCapture('cron');
  }

  private async runCapture(trigger: 'cron' | 'bootstrap'): Promise<void> {
    if (this.captureInFlight) {
      this.logger.warn(
        JSON.stringify({
          msg: 'portfolio_daily_snapshot_skipped',
          reason: 'capture_in_flight',
          trigger,
        }),
      );
      return;
    }

    this.captureInFlight = true;
    let lock: { acquired: boolean };
    try {
      lock = await runWithPgSessionAdvisoryLock(
        this.dataSource,
        PORTFOLIO_SNAPSHOT_ADVISORY_LOCK_KEY,
        async () => {
          try {
            const result =
              await this.portfolioSnapshots.captureAllHoldersDailySnapshots(
                new Date(),
              );
            this.logger.log(
              JSON.stringify({
                msg: 'portfolio_daily_snapshot_run_complete',
                trigger,
                timezone: 'Asia/Seoul',
                ...result,
              }),
            );
          } catch (e) {
            this.logger.error(
              JSON.stringify({
                msg: 'portfolio_daily_snapshot_run_failed',
                trigger,
                error: String(e),
              }),
            );
          }
        },
      );
    } catch (e) {
      // Fail-closed: if the DB is unreachable we cannot safely determine
      // lock ownership, so we skip this run rather than letting all replicas
      // proceed simultaneously.
      this.logger.warn(
        `portfolio snapshot advisory lock unavailable — skipping run: ${String(e)}`,
      );
      return;
    } finally {
      this.captureInFlight = false;
    }

    if (!lock.acquired) {
      this.logger.warn(
        JSON.stringify({
          msg: 'portfolio_daily_snapshot_skipped',
          reason: 'advisory_lock_held',
          trigger,
        }),
      );
    }
  }
}
