import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import {
  PortfolioDailySnapshotService,
  resolveKstDailySnapshotSlot,
} from './portfolio-daily-snapshot.service';

@Injectable()
export class PortfolioDailySnapshotSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(PortfolioDailySnapshotSchedulerService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly portfolioSnapshots: PortfolioDailySnapshotService,
    private readonly config: ConfigService,
  ) {}

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

  bootstrapConcurrency(): number {
    const raw = Number(
      this.config.get<string>('PORTFOLIO_SNAPSHOT_BOOTSTRAP_CONCURRENCY') ?? '2',
    );
    if (!Number.isFinite(raw) || raw < 1) return 2;
    return Math.min(Math.floor(raw), 8);
  }

  onModuleInit(): void {
    if (!this.bootstrapEnabled()) return;
    const delay = this.bootstrapDelayMs();
    setTimeout(() => {
      void this.captureAllLinkedWallets('bootstrap');
    }, delay);
  }

  /** Daily capture at 09:00 KST for all linked wallets. */
  @Cron('0 0 9 * * *', { timeZone: 'Asia/Seoul' })
  async handleDailyCaptureKst(): Promise<void> {
    await this.captureAllLinkedWallets('cron');
  }

  private async linkedWallets(): Promise<string[]> {
    const users = await this.userRepo.find({
      where: { walletAddress: Not(IsNull()) },
      select: ['walletAddress'],
    });
    return [
      ...new Set(
        users
          .map((u) => String(u.walletAddress ?? '').trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
  }

  private async captureAllLinkedWallets(trigger: 'cron' | 'bootstrap'): Promise<void> {
    const wallets = await this.linkedWallets();
    const slot = resolveKstDailySnapshotSlot(new Date());
    const concurrency =
      trigger === 'bootstrap' ? this.bootstrapConcurrency() : 2;

    let ok = 0;
    let failed = 0;
    for (let i = 0; i < wallets.length; i += concurrency) {
      const chunk = wallets.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        chunk.map((wallet) =>
          this.portfolioSnapshots.captureDailySnapshot(wallet, new Date()),
        ),
      );
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) ok++;
        else failed++;
      }
    }

    this.logger.log(
      JSON.stringify({
        msg: 'portfolio_daily_snapshot_captured',
        trigger,
        timezone: 'Asia/Seoul',
        slotDateKst: slot.snapshotDateKst,
        slotAt: slot.snapshotAt.toISOString(),
        wallets: wallets.length,
        ok,
        failed,
      }),
    );
  }
}
