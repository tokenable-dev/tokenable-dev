/**
 * P3.19 / P3.21 — Structured logging + dedup unit tests.
 */

import { Logger } from '@nestjs/common';
import { IdentityLogDeduper } from './identity-log-sampler';
import { IdentityStructuredLogger } from './identity-structured-logger';

describe('IdentityLogDeduper (P3.19)', () => {
  it('suppresses duplicate key+outcome within 10s', () => {
    const deduper = new IdentityLogDeduper();
    expect(deduper.shouldEmit('key-a', 'identity_cache_drift:cache_stale')).toBe(
      true,
    );
    expect(
      deduper.shouldEmit('key-a', 'identity_cache_drift:cache_stale'),
    ).toBe(false);
    expect(
      deduper.shouldEmit('key-b', 'identity_cache_drift:cache_stale'),
    ).toBe(true);
  });
});

describe('IdentityStructuredLogger (P3.19 / P3.21)', () => {
  it('emits JSON with event contract fields and traceId', () => {
    const logger = new Logger('test');
    const lines: string[] = [];
    jest.spyOn(logger, 'log').mockImplementation((msg) => {
      lines.push(String(msg));
    });

    const structured = new IdentityStructuredLogger();
    structured.logRepair(logger, 'info', {
      key: 'col-1',
      outcome: 'set',
      context: 'read_sync',
    });

    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(parsed.event).toBe('identity_cache_repair');
    expect(parsed.key).toBe('col-1');
    expect(parsed.outcome).toBe('set');
    expect(parsed.context).toBe('read_sync');
    expect(typeof parsed.traceId).toBe('string');
    expect(String(parsed.traceId).length).toBeGreaterThan(0);
  });

  it('deduplicates identical events within window', () => {
    const logger = new Logger('test');
    let count = 0;
    jest.spyOn(logger, 'warn').mockImplementation(() => {
      count++;
    });

    const structured = new IdentityStructuredLogger();
    const payload = {
      key: 'col-2',
      outcome: 'cache_stale',
      driftKind: 'cache_stale',
      context: 'read_sync' as const,
    };
    structured.logDrift(logger, 'warn', payload);
    structured.logDrift(logger, 'warn', payload);
    expect(count).toBe(1);
  });
});
