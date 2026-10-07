/**
 * P3.16 — Distributed trace / correlation context for identity cache operations.
 *
 * Logging-only layer — does not alter Decision / Execution / DB semantics.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export type IdentityTracePhase =
  | 'read'
  | 'decision'
  | 'execution'
  | 'db'
  | 'repair'
  | 'reconcile'
  | 'warmup';

export interface IdentityTraceSpan {
  spanId: string;
  phase: IdentityTracePhase;
  parentSpanId?: string;
  collectionKey?: string;
  detail?: string;
  startedAt: number;
}

export interface IdentityTraceStore {
  correlationId: string;
  txId?: string;
  spans: IdentityTraceSpan[];
}

const als = new AsyncLocalStorage<IdentityTraceStore>();

export function generateCorrelationId(): string {
  return randomUUID().slice(0, 12);
}

export function getIdentityTraceStore(): IdentityTraceStore | undefined {
  return als.getStore();
}

export function runWithIdentityCorrelation<T>(
  correlationId: string,
  fn: () => T,
  txId?: string,
): T {
  return als.run({ correlationId, txId, spans: [] }, fn);
}

export async function withIdentitySpan<T>(
  phase: IdentityTracePhase,
  meta: { collectionKey?: string; detail?: string },
  fn: () => Promise<T> | T,
): Promise<T> {
  const store = als.getStore();
  const parentSpanId = store?.spans[store.spans.length - 1]?.spanId;
  const span: IdentityTraceSpan = {
    spanId: randomUUID().slice(0, 8),
    phase,
    parentSpanId,
    collectionKey: meta.collectionKey,
    detail: meta.detail,
    startedAt: Date.now(),
  };
  if (store) store.spans.push(span);
  try {
    return await fn();
  } finally {
    if (store) {
      const idx = store.spans.indexOf(span);
      if (idx >= 0) store.spans.splice(idx, 1);
    }
  }
}

/** Structured suffix for `[identity:*]` logs — enables cid/span filtering. */
export function formatIdentityTraceSuffix(
  extra?: Record<string, string>,
): string {
  const store = als.getStore();
  if (!store) return '';
  const active = store.spans[store.spans.length - 1];
  const parts = [`cid=${store.correlationId}`];
  if (store.txId) parts.push(`tx=${store.txId}`);
  if (active) {
    parts.push(`span=${active.spanId}`);
    parts.push(`phase=${active.phase}`);
    if (active.parentSpanId) parts.push(`parent=${active.parentSpanId}`);
    if (active.collectionKey) parts.push(`key=${active.collectionKey}`);
  }
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v) parts.push(`${k}=${v}`);
    }
  }
  return ` ${parts.join(' ')}`;
}

export function snapshotIdentityTraceChain(): IdentityTraceSpan[] {
  const store = als.getStore();
  return store ? store.spans.map((s) => ({ ...s })) : [];
}
