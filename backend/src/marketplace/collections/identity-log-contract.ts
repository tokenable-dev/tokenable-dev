/**
 * P3.19 / P3.21 — Identity cache logging contract.
 *
 * Schema + CI validation only — no runtime ownership enforcement.
 */

import type { IdentityConsistencyContext } from './identity-cache-consistency.types';

/** Central enum — all identity log events MUST use these values. */
export enum IdentityLogEventType {
  Drift = 'identity_cache_drift',
  Repair = 'identity_cache_repair',
  Write = 'identity_cache_write',
  Reconcile = 'identity_cache_reconcile',
  Fallback = 'identity_log_fallback',
}

export type IdentityLogContext =
  | IdentityConsistencyContext
  | 'write'
  | 'reconcile'
  | 'warmup';

export type IdentityLogLevel = 'debug' | 'info' | 'warn';

/** Structured log payload (traceId required after normalization). */
export interface IdentityLogEvent {
  event: IdentityLogEventType;
  key?: string;
  outcome: string;
  context?: IdentityLogContext;
  driftKind?: string;
  durationMs?: number;
  traceId: string;
  detail?: string;
  scanned?: number;
  hotKeys?: number;
  coverage?: number;
  hit?: number;
  miss?: number;
  repair?: number;
  skipped?: number;
}

/** Emitted when schema validation fails — never silent (P3.21). */
export interface IdentityLogFallbackEvent {
  event: IdentityLogEventType.Fallback;
  originalEvent: string;
  reason: 'schema_invalid';
  traceId: string;
  detail?: string;
  key?: string;
}

/** Returns fallback traceId when ALS correlation is absent. */
export function resolveIdentityTraceId(
  key: string | undefined,
  existing?: string,
): string {
  if (existing?.trim()) return existing.trim();
  const storeKey = key?.trim() || '*';
  return `no-trace:${storeKey}`;
}

/**
 * Schema validation — used by CI / contract tests and optional runtime fallback.
 * Returns error message or null when valid.
 */
export function validateIdentityLogEvent(
  event: IdentityLogEvent,
): string | null {
  if (!Object.values(IdentityLogEventType).includes(event.event)) {
    return `invalid event: ${String(event.event)}`;
  }
  if (event.event === IdentityLogEventType.Fallback) {
    return 'fallback events are not validated via validateIdentityLogEvent';
  }
  if (typeof event.outcome !== 'string' || event.outcome.length === 0) {
    return 'missing outcome';
  }
  if (typeof event.traceId !== 'string' || event.traceId.length === 0) {
    return 'missing traceId';
  }
  if (
    event.event === IdentityLogEventType.Drift &&
    (!event.driftKind || event.driftKind.length === 0)
  ) {
    return 'drift event requires driftKind';
  }
  const keylessReconcile =
    event.event === IdentityLogEventType.Reconcile &&
    (event.outcome === 'tick_complete' || event.outcome === 'tick_failed');
  if (!keylessReconcile && (!event.key || event.key.length === 0)) {
    return 'missing key';
  }
  return null;
}

/** Legacy patterns banned from production code (CI guard). */
export const IDENTITY_LEGACY_LOG_PATTERN =
  /\[identity:(drift|repair|read|engine)\]/;

export function findLegacyIdentityLogPatterns(source: string): string[] {
  const hits: string[] = [];
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (IDENTITY_LEGACY_LOG_PATTERN.test(lines[i]!)) {
      hits.push(`line ${i + 1}: ${lines[i]!.trim()}`);
    }
  }
  return hits;
}
