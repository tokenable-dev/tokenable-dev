import { IdentityCacheDecisionEngine } from './identity-cache-decision.engine';
import type {
  IdentityReplayEvent,
  InvariantViolation,
  ReplayStateDiff,
} from './identity-cache-replay.types';

const decision = new IdentityCacheDecisionEngine();

export function checkReplayInvariants(
  event: IdentityReplayEvent,
  atIndex: number,
  dbValue: string,
  diff: ReplayStateDiff,
  violations: InvariantViolation[],
): void {
  if (!('key' in event)) return;
  const key = event.key.toLowerCase();

  if (
    event.type === 'db_audit_clear' &&
    dbValue !== '' &&
    event.expectedId !== dbValue
  ) {
    violations.push({
      invariant: 'I4_audit_no_erase_newer',
      atIndex,
      key,
      detail: `audit attempted on ${event.expectedId} but db=${dbValue}`,
    });
  }

  if (event.type === 'read_repair') {
    const ctx = event.context;
    if (
      decision.shouldBypassRepairCooldown(ctx) &&
      dbValue !== '' &&
      !diff.aligned
    ) {
      violations.push({
        invariant: 'I5_eventual_convergence',
        atIndex,
        key,
        detail: `populate path did not converge cache=${diff.cacheEffective} db=${dbValue}`,
      });
    }
  }

  if (
    event.type === 'reconcile' &&
    event.allowRepair &&
    dbValue !== '' &&
    !diff.aligned
  ) {
    violations.push({
      invariant: 'I5_eventual_convergence',
      atIndex,
      key,
      detail: `reconcile did not converge cache=${diff.cacheEffective} db=${dbValue}`,
    });
  }
}

export function computeAligned(
  dbValue: string,
  cacheEffective: string | null,
): boolean {
  return dbValue === ''
    ? cacheEffective === null || cacheEffective === ''
    : cacheEffective === dbValue;
}
