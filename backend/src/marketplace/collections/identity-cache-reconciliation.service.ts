import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CardhedgerMetricsService } from '../../common/metrics/cardhedger-metrics.service';
import { CollectionIdentityService } from './collection-identity.service';
import type { IdentityReconciliationOutcome } from './identity-cache-consistency.types';
import { IdentityCacheDecisionEngine } from './identity-cache-decision.engine';
import { IdentityCacheExecutionService } from './identity-cache-execution.service';
import { IdentityCacheSloService } from './identity-cache-slo.service';
import { IdentityStructuredLogger } from './identity-structured-logger';
import type { CacheExecutionCommand } from './identity-cache-execution.types';
import {
  generateCorrelationId,
  runWithIdentityCorrelation,
  withIdentitySpan,
} from './identity-trace.context';

export type { IdentityReconciliationOutcome };

export interface IdentityReconciliationRunSummary {
  hotKeyCount: number;
  scanned: number;
  coverageRatio: number;
  hit: number;
  miss: number;
  repair: number;
  skipped: number;
}

/**
 * Proactive identity cache reconciliation (P3.6).
 *
 * Periodically scans a hot-key subset and runs decision → execution repair.
 * DB remains source of truth.
 */
@Injectable()
export class IdentityCacheReconciliationService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(IdentityCacheReconciliationService.name);

  private readonly intervalMs: number;
  private readonly batchSize: number;
  private readonly concurrency: number;
  private readonly maxRepairsPerTick: number;
  private readonly jobEnabled: boolean;

  private timer: NodeJS.Timeout | null = null;
  private tickInFlight = false;
  private repairsThisTick = 0;

  /** Last completed run — exposed for metrics / health. */
  private lastRun: IdentityReconciliationRunSummary | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly identity: CollectionIdentityService,
    private readonly cacheDecision: IdentityCacheDecisionEngine,
    private readonly cacheExecution: IdentityCacheExecutionService,
    private readonly identityLog: IdentityStructuredLogger,
    @Optional() private readonly slo?: IdentityCacheSloService,
    @Optional() private readonly metrics?: CardhedgerMetricsService,
  ) {
    this.intervalMs = clampInt(
      this.config.get<string>('IDENTITY_RECONCILIATION_INTERVAL_MS'),
      180_000,
      60_000,
      300_000,
    );
    this.batchSize = clampInt(
      this.config.get<string>('IDENTITY_RECONCILIATION_BATCH_SIZE'),
      50,
      5,
      500,
    );
    this.concurrency = clampInt(
      this.config.get<string>('IDENTITY_RECONCILIATION_CONCURRENCY'),
      3,
      2,
      4,
    );
    this.maxRepairsPerTick = clampInt(
      this.config.get<string>('IDENTITY_RECONCILIATION_MAX_REPAIRS'),
      20,
      1,
      200,
    );
    const flag = this.config.get<string>('IDENTITY_RECONCILIATION_ENABLED');
    if (flag === '1' || flag === 'true') {
      this.jobEnabled = true;
    } else if (flag === '0' || flag === 'false') {
      this.jobEnabled = false;
    } else {
      this.jobEnabled =
        this.config.get<string>('NODE_ENV') === 'production';
    }
  }

  onModuleInit(): void {
    if (!this.jobEnabled) {
      this.logger.debug('[identity:reconcile] job=disabled');
      return;
    }
    this.timer = setInterval(() => {
      void this.runTick();
    }, this.intervalMs);
    this.logger.debug(
      `[identity:reconcile] job=enabled intervalMs=${this.intervalMs} batchSize=${this.batchSize}`,
    );
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  getLastRunSummary(): IdentityReconciliationRunSummary | null {
    return this.lastRun ? { ...this.lastRun } : null;
  }

  isTickInFlight(): boolean {
    return this.tickInFlight;
  }

  private effectiveMaxRepairs(): number {
    const slo = this.slo?.evaluate();
    const mult = slo?.reconcileRepairMultiplier ?? 1;
    return Math.max(1, Math.floor(this.maxRepairsPerTick * mult));
  }

  private async runTick(): Promise<void> {
    if (!this.identity.isEnabled()) return;
    if (this.tickInFlight) return;

    this.tickInFlight = true;
    this.repairsThisTick = 0;
    const cid = generateCorrelationId();
    const t0 = Date.now();

    try {
      await runWithIdentityCorrelation(cid, () =>
        withIdentitySpan('reconcile', { detail: 'tick' }, async () => {
          const summary = await this.runBatch();
          this.lastRun = summary;
          this.metrics?.recordIdentityReconciliationRun(summary);
          this.slo?.publishToMetrics();

          if (summary.scanned > 0) {
            this.identityLog.logReconcile(
              this.logger,
              'info',
              {
                outcome: 'tick_complete',
                context: 'reconcile',
                scanned: summary.scanned,
                hotKeys: summary.hotKeyCount,
                coverage: Number(summary.coverageRatio.toFixed(2)),
                hit: summary.hit,
                miss: summary.miss,
                repair: summary.repair,
                skipped: summary.skipped,
                durationMs: Date.now() - t0,
              },
              { skipDedup: true },
            );
          }
        }),
      );
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.identityLog.logReconcile(
        this.logger,
        'warn',
        {
          outcome: 'tick_failed',
          context: 'reconcile',
          detail,
        },
      );
    } finally {
      this.tickInFlight = false;
    }
  }

  private async runBatch(): Promise<IdentityReconciliationRunSummary> {
    const hotKeyCount = this.identity.getHotKeyCount();
    const keys = this.identity
      .getHotKeySnapshotMruFirst()
      .slice(0, this.batchSize);
    const scanned = keys.length;
    const coverageRatio = hotKeyCount > 0 ? scanned / hotKeyCount : 0;

    const counts = { hit: 0, miss: 0, repair: 0, skipped: 0 };

    await mapPool(keys, this.concurrency, async (key) => {
      const outcome = await this.reconcileKey(key);
      counts[outcome]++;
      this.metrics?.recordIdentityReconciliation(outcome);
    });

    return {
      hotKeyCount,
      scanned,
      coverageRatio,
      ...counts,
    };
  }

  private async reconcileKey(
    key: string,
  ): Promise<IdentityReconciliationOutcome> {
    try {
      const state = await this.cacheExecution.loadState(key);
      const decision = this.cacheDecision.decideFromState(state);
      const command = this.cacheDecision.buildExecutionCommand(
        key,
        decision.action,
        decision.dbValue,
        false,
      );
      const repairAllowed = (() => {
        const repairSlot = ++this.repairsThisTick;
        return repairSlot <= this.effectiveMaxRepairs();
      })();

      const executeResult =
        !this.cacheDecision.isExecutable(command) || !repairAllowed
          ? { applied: false, skippedCooldown: false }
          : await this.cacheExecution.execute(command);

      this.logRepairResult(key, command, executeResult);

      return this.cacheDecision.reconciliationOutcome(
        decision,
        {
          repaired: executeResult.applied,
          skippedCooldown: executeResult.skippedCooldown,
        },
        repairAllowed,
      );
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.identityLog.logReconcile(
        this.logger,
        'warn',
        {
          key,
          outcome: 'key_failed',
          context: 'reconcile',
          detail,
        },
      );
      return 'skipped';
    }
  }

  private logRepairResult(
    key: string,
    command: CacheExecutionCommand,
    result: { applied: boolean; skippedCooldown: boolean },
  ): void {
    if (result.applied) {
      const outcome =
        command.op === 'delete'
          ? 'evict'
          : command.op === 'replace'
            ? 'replace'
            : 'set';
      this.identityLog.logRepair(this.logger, 'info', {
        key,
        outcome,
        context: 'reconcile',
      });
      return;
    }
    if (result.skippedCooldown) {
      this.identityLog.logRepair(this.logger, 'debug', {
        key,
        outcome: 'skipped_cooldown',
        context: 'reconcile',
      });
    }
  }
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  let idx = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (idx < items.length) {
        const i = idx++;
        await fn(items[i]);
      }
    },
  );
  await Promise.all(workers);
}

function clampInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = Number(raw ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}
