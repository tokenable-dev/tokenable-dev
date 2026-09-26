/**
 * P3.16 — Optional cache warm-up job (read-through populate only).
 *
 * Uses readOrResolve — no direct execute / write semantics.
 * Skips when reconciliation tick is in flight or SLO disallows warmup.
 */

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CollectionIdentityService } from './collection-identity.service';
import { IdentityCacheReconciliationService } from './identity-cache-reconciliation.service';
import { IdentityCacheSloService } from './identity-cache-slo.service';
import {
  generateCorrelationId,
  runWithIdentityCorrelation,
  withIdentitySpan,
} from './identity-trace.context';

@Injectable()
export class IdentityCacheWarmupService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(IdentityCacheWarmupService.name);

  private readonly intervalMs: number;
  private readonly batchSize: number;
  private readonly maxReadsPerTick: number;
  private readonly jobEnabled: boolean;

  private timer: NodeJS.Timeout | null = null;
  private tickInFlight = false;

  constructor(
    private readonly config: ConfigService,
    private readonly identity: CollectionIdentityService,
    @Optional() private readonly reconciliation?: IdentityCacheReconciliationService,
    @Optional() private readonly slo?: IdentityCacheSloService,
  ) {
    this.intervalMs = clampInt(
      config.get<string>('IDENTITY_WARMUP_INTERVAL_MS'),
      270_000,
      60_000,
      600_000,
    );
    this.batchSize = clampInt(
      config.get<string>('IDENTITY_WARMUP_BATCH_SIZE'),
      30,
      5,
      200,
    );
    this.maxReadsPerTick = clampInt(
      config.get<string>('IDENTITY_WARMUP_MAX_READS'),
      30,
      1,
      500,
    );
    const flag = config.get<string>('IDENTITY_WARMUP_ENABLED') ?? 'false';
    this.jobEnabled = flag === 'true' || flag === '1';
  }

  onModuleInit(): void {
    if (!this.jobEnabled) {
      this.logger.debug('[identity:warmup] job=disabled');
      return;
    }
    this.timer = setInterval(() => {
      void this.runTick();
    }, this.intervalMs);
    this.logger.debug(
      `[identity:warmup] job=enabled intervalMs=${this.intervalMs}`,
    );
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  isTickInFlight(): boolean {
    return this.tickInFlight;
  }

  private async runTick(): Promise<void> {
    if (!this.identity.isEnabled()) return;
    if (this.tickInFlight) return;
    if (this.reconciliation?.isTickInFlight()) return;

    const slo = this.slo?.evaluate();
    if (slo && !slo.warmupAllowed) return;

    this.tickInFlight = true;
    const cid = generateCorrelationId();

    try {
      await runWithIdentityCorrelation(cid, async () =>
        withIdentitySpan('warmup', { detail: 'tick' }, async () => {
          const keys = this.identity
            .getHotKeySnapshotMruFirst()
            .slice(0, this.batchSize);
          let reads = 0;
          for (const key of keys) {
            if (reads >= this.maxReadsPerTick) break;
            await withIdentitySpan(
              'read',
              { collectionKey: key, detail: 'warmup_read' },
              () => this.identity.readOrResolve(key),
            );
            reads++;
          }
        }),
      );
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Identity warmup tick failed: ${detail}`);
    } finally {
      this.tickInFlight = false;
    }
  }
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
