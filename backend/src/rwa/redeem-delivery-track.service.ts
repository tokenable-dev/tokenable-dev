import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Not, Repository } from 'typeorm';
import type { SupportedChainId } from '../blockchain/chain-config.service';
import { NotificationsService } from '../marketplace/notifications/notifications.service';
import {
  VaultRedemption,
  type VaultRedemptionStatus,
} from '../vault/entities/vault-redemption.entity';
import { VaultService } from '../vault/vault.service';
import { fedExBaseUrl, fedExTruthy } from './shipping/fedex-api.util';
import { FedExTrackClient } from './shipping/fedex-track.client';
import {
  isFedExTrackableCarrier,
  isSandboxOnesTrackingNumber,
} from './shipping/fedex-track.util';
import {
  batchReadyForAutoReceipt,
  resolveRedeemAutoReceiptGraceMs,
} from './shipping/redeem-auto-receipt.util';

const TRACK_ELIGIBLE_STATUSES: VaultRedemptionStatus[] = [
  'in_custody',
  'burned',
  'vault_release_pending',
];

/** Postgres session advisory lock — multi-instance cron safety. */
const POLL_ADVISORY_LOCK_KEY = 872314510;
const MAX_TRACK_NUMBERS_PER_POLL = 90;
const MAX_AUTO_BATCHES_PER_POLL = 40;

/**
 * Poll FedEx Track for redeem shipments → set carrier_delivered_at,
 * remind user, then after grace days auto-confirm receipt (→ completed).
 *
 * Gate: FEDEX_TRACK_ENABLED=1 plus FEDEX_TRACK_CLIENT_ID/SECRET (or shared FEDEX_CLIENT_ID/SECRET).
 * Auto receipt: REDEEM_AUTO_RECEIPT_ENABLED (defaults on when Track is on).
 */
@Injectable()
export class RedeemDeliveryTrackService implements OnModuleInit {
  private readonly logger = new Logger(RedeemDeliveryTrackService.name);
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly track: FedExTrackClient,
    private readonly vault: VaultService,
    private readonly notifications: NotificationsService,
    private readonly dataSource: DataSource,
    @InjectRepository(VaultRedemption)
    private readonly redemptions: Repository<VaultRedemption>,
  ) {}

  onModuleInit(): void {
    if (!this.track.enabled()) {
      this.logger.log(
        'Redeem FedEx Track poll disabled (FEDEX_TRACK_ENABLED≠1)',
      );
      return;
    }
    const hasCreds = Boolean(
      (this.config.get<string>('FEDEX_TRACK_CLIENT_ID')?.trim() &&
        this.config.get<string>('FEDEX_TRACK_CLIENT_SECRET')?.trim()) ||
        (this.config.get<string>('FEDEX_CLIENT_ID')?.trim() &&
          this.config.get<string>('FEDEX_CLIENT_SECRET')?.trim()),
    );
    if (!hasCreds) {
      this.logger.warn(
        'FEDEX_TRACK_ENABLED but track OAuth creds incomplete — set FEDEX_TRACK_CLIENT_ID/SECRET (or shared FEDEX_CLIENT_ID/SECRET)',
      );
      return;
    }
    this.logger.log(
      `Redeem FedEx Track armed cron=${process.env.REDEEM_FEDEX_TRACK_CRON || '*/30 * * * *'} graceMs=${this.graceDelayMs()} autoReceipt=${this.autoReceiptEnabled() ? 'on' : 'off'}`,
    );
  }

  private autoReceiptEnabled(): boolean {
    const raw = this.config.get<string>('REDEEM_AUTO_RECEIPT_ENABLED');
    if (raw == null || raw.trim() === '') {
      // Default on when Track is enabled — product wants delivery → grace → complete.
      return this.track.enabled();
    }
    const v = raw.trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }

  /** Grace after carrier delivery. SECONDS env wins (for dev/test); else DAYS. */
  graceDelayMs(): number {
    return resolveRedeemAutoReceiptGraceMs({
      graceSecondsRaw: this.config.get<string>('REDEEM_AUTO_RECEIPT_GRACE_SECONDS'),
      graceDaysRaw: this.config.get<string>('REDEEM_AUTO_RECEIPT_GRACE_DAYS'),
    });
  }

  @Cron(process.env.REDEEM_FEDEX_TRACK_CRON || '*/30 * * * *')
  async pollCron(): Promise<void> {
    if (!this.track.enabled()) return;
    if (this.running) return;
    this.running = true;
    try {
      await this.pollOnce();
    } catch (e) {
      this.logger.error(
        `Redeem FedEx Track poll failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      this.running = false;
    }
  }

  /** Exposed for ops/manual dry-run. */
  async pollOnce(): Promise<{
    tracked: number;
    markedDelivered: number;
    autoConfirmedBatches: number;
    skippedLock?: boolean;
  }> {
    const locked = await this.tryAdvisoryLock();
    if (!locked) {
      this.logger.debug('Redeem FedEx Track poll skipped (advisory lock held)');
      return {
        tracked: 0,
        markedDelivered: 0,
        autoConfirmedBatches: 0,
        skippedLock: true,
      };
    }
    try {
      const trackOut = await this.pollDeliveries();
      const autoOut = this.autoReceiptEnabled()
        ? await this.autoConfirmDueBatches()
        : { autoConfirmedBatches: 0 };
      return { ...trackOut, ...autoOut };
    } finally {
      await this.releaseAdvisoryLock();
    }
  }

  private async pollDeliveries(): Promise<{
    tracked: number;
    markedDelivered: number;
  }> {
    const rows = await this.redemptions.find({
      where: {
        status: In(TRACK_ELIGIBLE_STATUSES),
        trackingNumber: Not(IsNull()),
        carrierDeliveredAt: IsNull(),
        refundStatus: 'none',
      },
      order: { trackingSetAt: 'ASC' },
      take: 400,
    });

    const fedexRows = rows.filter(
      (r) =>
        Boolean(r.trackingNumber?.trim()) &&
        isFedExTrackableCarrier(r.trackingCarrier),
    );
    const byNumber = new Map<string, VaultRedemption[]>();
    for (const row of fedexRows) {
      const key = row.trackingNumber!.replace(/\s+/g, '').toUpperCase();
      const list = byNumber.get(key) ?? [];
      list.push(row);
      byNumber.set(key, list);
    }

    const numbers = [...byNumber.keys()].slice(0, MAX_TRACK_NUMBERS_PER_POLL);
    if (numbers.length === 0) {
      return { tracked: 0, markedDelivered: 0 };
    }

    let results: Awaited<ReturnType<FedExTrackClient['trackByNumbers']>> = [];
    try {
      results = await this.track.trackByNumbers(numbers);
    } catch (e) {
      this.logger.warn(
        `FedEx Track request failed (will still apply sandbox dummy numbers if enabled): ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }

    let markedDelivered = 0;
    const remindedBatches = new Set<string>();

    for (const result of results) {
      if (!result.delivered || !result.deliveredAt) continue;
      const key = result.trackingNumber.replace(/\s+/g, '').toUpperCase();
      markedDelivered += await this.stampCarrierDelivered(
        key,
        result.deliveredAt,
        byNumber,
        remindedBatches,
      );
    }

    if (this.sandboxOnesAsDelivered()) {
      const now = new Date();
      for (const key of numbers) {
        if (!isSandboxOnesTrackingNumber(key)) continue;
        const n = await this.stampCarrierDelivered(
          key,
          now,
          byNumber,
          remindedBatches,
        );
        if (n > 0) {
          this.logger.log(
            `Redeem sandbox dummy tracking=${key} treated as delivered (FedEx Track has no live status for all-1s numbers)`,
          );
        }
        markedDelivered += n;
      }
    }

    return { tracked: numbers.length, markedDelivered };
  }

  /**
   * Sandbox Test keys never report Delivered for dummy numbers like 111111111.
   * Default on when FEDEX_API_BASE_URL is sandbox; override with
   * FEDEX_TRACK_SANDBOX_ONES_DELIVERED=0. Never on production Track host.
   */
  private sandboxOnesAsDelivered(): boolean {
    const raw = this.config.get<string>('FEDEX_TRACK_SANDBOX_ONES_DELIVERED');
    if (raw != null && raw.trim() !== '') {
      return fedExTruthy(this.config, 'FEDEX_TRACK_SANDBOX_ONES_DELIVERED');
    }
    return /sandbox/i.test(fedExBaseUrl(this.config));
  }

  private async stampCarrierDelivered(
    key: string,
    deliveredAt: Date,
    byNumber: Map<string, VaultRedemption[]>,
    remindedBatches: Set<string>,
  ): Promise<number> {
    const matches = byNumber.get(key);
    if (!matches?.length) return 0;
    const pending = matches.filter((r) => !r.carrierDeliveredAt);
    if (pending.length === 0) return 0;

    for (const row of pending) {
      row.carrierDeliveredAt = deliveredAt;
    }
    await this.redemptions.save(pending);

    for (const row of pending) {
      const batchId = row.paymentBatchId;
      if (!batchId || remindedBatches.has(batchId)) continue;
      remindedBatches.add(batchId);
      const chainId = (row.chainId ?? undefined) as
        | SupportedChainId
        | undefined;
      void this.notifications
        .notifyRedeemReceivedReminder({
          ownerWallet: row.ownerWalletAddress,
          paymentBatchId: batchId,
          chainId,
        })
        .catch((e) => {
          this.logger.warn(
            `notifyRedeemReceivedReminder failed batch=${batchId}: ${
              e instanceof Error ? e.message : String(e)
            }`,
          );
        });
    }

    this.logger.log(
      `Redeem carrier delivered tracking=${key} at=${deliveredAt.toISOString()} rows=${pending.length}`,
    );
    return pending.length;
  }

  /**
   * Batches where every row is FedEx-trackable, has carrier_delivered_at,
   * and the latest delivery is older than grace → mark completed (via=auto).
   */
  async autoConfirmDueBatches(): Promise<{ autoConfirmedBatches: number }> {
    const graceMs = this.graceDelayMs();
    const dueBefore = new Date(Date.now() - graceMs);

    const candidates = await this.redemptions
      .createQueryBuilder('r')
      .where('r.payment_batch_id IS NOT NULL')
      .andWhere('r.refund_status = :none', { none: 'none' })
      .andWhere('r.status IN (:...statuses)', {
        statuses: [...TRACK_ELIGIBLE_STATUSES, 'completed'],
      })
      .andWhere('r.tracking_number IS NOT NULL')
      .andWhere("TRIM(r.tracking_number) <> ''")
      .andWhere('r.carrier_delivered_at IS NOT NULL')
      .andWhere('r.carrier_delivered_at <= :dueBefore', { dueBefore })
      .orderBy('r.carrier_delivered_at', 'ASC')
      .take(200)
      .getMany();

    const byBatch = new Map<string, VaultRedemption[]>();
    for (const row of candidates) {
      const id = row.paymentBatchId!;
      const list = byBatch.get(id) ?? [];
      list.push(row);
      byBatch.set(id, list);
    }

    let autoConfirmedBatches = 0;
    let processed = 0;

    for (const [batchId, sample] of byBatch) {
      if (processed >= MAX_AUTO_BATCHES_PER_POLL) break;
      processed += 1;

      const chainId = sample[0].chainId;
      if (chainId == null) continue;

      const allRows = await this.vault.findRedemptionsByBatchId(
        batchId,
        chainId as SupportedChainId,
      );
      const gate = batchReadyForAutoReceipt({
        rows: allRows,
        graceMs: this.graceDelayMs(),
        now: new Date(),
      });
      if (!gate.ok) continue;

      const incomplete = allRows.filter((r) => r.status !== 'completed');
      await this.vault.markUserReceiptConfirmed(
        incomplete.length ? incomplete : allRows,
        { via: 'auto' },
      );
      autoConfirmedBatches += 1;

      void this.notifications
        .notifyRedeemCompleted({
          ownerWallet: allRows[0].ownerWalletAddress,
          paymentBatchId: batchId,
          chainId: chainId as SupportedChainId,
          via: 'auto',
        })
        .catch(() => undefined);

      this.logger.log(
        `Redeem auto-receipt confirmed batch=${batchId} rows=${allRows.length} graceMs=${this.graceDelayMs()}`,
      );
    }

    return { autoConfirmedBatches };
  }

  private async tryAdvisoryLock(): Promise<boolean> {
    const rows = await this.dataSource.query(
      `SELECT pg_try_advisory_lock($1) AS ok`,
      [POLL_ADVISORY_LOCK_KEY],
    );
    return Boolean(rows?.[0]?.ok);
  }

  private async releaseAdvisoryLock(): Promise<void> {
    await this.dataSource.query(`SELECT pg_advisory_unlock($1)`, [
      POLL_ADVISORY_LOCK_KEY,
    ]);
  }
}
