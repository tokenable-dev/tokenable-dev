/**
 * P3.16 — Identity cache SLO / guardrails (advisory layer).
 */

import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CardhedgerMetricsService } from '../../common/metrics/cardhedger-metrics.service';

export type IdentityDegradationMode = 'normal' | 'throttle' | 'protect';

export interface IdentitySloEvaluation {
  healthScore: number;
  mode: IdentityDegradationMode;
  driftRate: number;
  redisFailureRate: number;
  reconcileSkipRate: number;
  repairCooldownRate: number;
  reasons: string[];
  reconcileRepairMultiplier: number;
  warmupAllowed: boolean;
}

/** Default interval for publishing SLO snapshot to metrics (P3.18). */
const SLO_PUBLISH_INTERVAL_MS = 60_000;

@Injectable()
export class IdentityCacheSloService implements OnModuleInit, OnModuleDestroy {
  private readonly driftWarnRate: number;
  private readonly driftCriticalRate: number;
  private readonly scoreThrottleBelow: number;
  private readonly scoreProtectBelow: number;

  private publishTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly metrics?: CardhedgerMetricsService,
  ) {
    this.driftWarnRate = parseRate(
      config.get<string>('IDENTITY_SLO_DRIFT_WARN_RATE'),
      0.01,
    );
    this.driftCriticalRate = parseRate(
      config.get<string>('IDENTITY_SLO_DRIFT_CRITICAL_RATE'),
      0.05,
    );
    this.scoreThrottleBelow = parseIntConfig(
      config.get<string>('IDENTITY_SLO_SCORE_THROTTLE'),
      80,
    );
    this.scoreProtectBelow = parseIntConfig(
      config.get<string>('IDENTITY_SLO_SCORE_PROTECT'),
      60,
    );
  }

  onModuleInit(): void {
    if (!this.metrics) return;
    this.publishToMetrics();
    this.publishTimer = setInterval(
      () => this.publishToMetrics(),
      SLO_PUBLISH_INTERVAL_MS,
    );
  }

  onModuleDestroy(): void {
    if (this.publishTimer) clearInterval(this.publishTimer);
  }

  /** Publish current evaluation to metrics (SSOT for health + Prometheus). */
  publishToMetrics(): void {
    if (!this.metrics) return;
    const eval_ = this.evaluate();
    this.metrics.recordIdentitySloEvaluation({
      healthScore: eval_.healthScore,
      mode: eval_.mode,
      driftRate: eval_.driftRate,
      redisFailureRate: eval_.redisFailureRate,
      reconcileSkipRate: eval_.reconcileSkipRate,
      reasons: eval_.reasons,
    });
  }

  evaluate(): IdentitySloEvaluation {
    const obs = this.metrics?.getIdentityObservabilityMetrics();
    const cache = this.metrics?.getIdentityCacheMetrics();
    const recon = this.metrics?.getIdentityReconciliationState();

    const hits = (cache?.hits.l1 ?? 0) + (cache?.hits.l2 ?? 0);
    const driftChecks = obs?.driftChecks ?? 0;
    const driftNumerator =
      (obs?.drift.cache_stale ?? 0) + (obs?.drift.cache_phantom ?? 0);
    const driftRate = driftChecks > 0 ? driftNumerator / driftChecks : 0;

    const redisFail = obs
      ? Object.values(obs.redisFailure).reduce(
          (sum, byReason) =>
            sum + Object.values(byReason).reduce((a, b) => a + b, 0),
          0,
        )
      : 0;
    const redisFailureRate = hits > 0 ? redisFail / hits : 0;

    const repairTotal =
      (obs?.cacheRepair.set ?? 0) +
      (obs?.cacheRepair.evict ?? 0) +
      (obs?.cacheRepair.skipped_cooldown ?? 0);
    const repairCooldownRate =
      repairTotal > 0
        ? (obs?.cacheRepair.skipped_cooldown ?? 0) / repairTotal
        : 0;

    const reconSkipped = obs?.reconciliation.skipped ?? 0;
    const reconScanned = recon?.scanned ?? 0;
    const reconcileSkipRate =
      reconScanned > 0 ? reconSkipped / reconScanned : 0;

    let healthScore = 100;
    healthScore -= Math.min(40, driftRate * 400);
    healthScore -= Math.min(25, redisFailureRate * 250);
    healthScore -= Math.min(15, repairCooldownRate * 50);
    healthScore -= Math.min(20, reconcileSkipRate * 40);
    healthScore = Math.max(0, Math.round(healthScore));

    const reasons: string[] = [];
    if (driftRate >= this.driftCriticalRate) {
      reasons.push(`drift_rate_critical=${driftRate.toFixed(4)}`);
    } else if (driftRate >= this.driftWarnRate) {
      reasons.push(`drift_rate_warn=${driftRate.toFixed(4)}`);
    }
    if (redisFailureRate > 0.05) reasons.push('redis_failure_elevated');
    if (reconcileSkipRate > 0.5) reasons.push('reconcile_skip_elevated');
    if (repairCooldownRate > 0.3) reasons.push('repair_cooldown_elevated');

    let mode: IdentityDegradationMode = 'normal';
    let reconcileRepairMultiplier = 1;
    let warmupAllowed = true;

    if (healthScore < this.scoreProtectBelow) {
      mode = 'protect';
      reconcileRepairMultiplier = 0.25;
      warmupAllowed = false;
      reasons.push('mode=protect');
    } else if (healthScore < this.scoreThrottleBelow) {
      mode = 'throttle';
      reconcileRepairMultiplier = 0.5;
      warmupAllowed = false;
      reasons.push('mode=throttle');
    }

    return {
      healthScore,
      mode,
      driftRate,
      redisFailureRate,
      reconcileSkipRate,
      repairCooldownRate,
      reasons,
      reconcileRepairMultiplier,
      warmupAllowed,
    };
  }
}

function parseRate(raw: string | undefined, fallback: number): number {
  const n = Number(raw ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

function parseIntConfig(raw: string | undefined, fallback: number): number {
  const n = Number(raw ?? fallback);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}
