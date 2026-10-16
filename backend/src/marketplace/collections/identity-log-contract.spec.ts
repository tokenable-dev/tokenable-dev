/**
 * P3.20 / P3.21 — Logging contract tests (CI only).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Logger } from '@nestjs/common';
import {
  findLegacyIdentityLogPatterns,
  IdentityLogEventType,
  resolveIdentityTraceId,
  validateIdentityLogEvent,
} from './identity-log-contract';
import { IdentityStructuredLogger } from './identity-structured-logger';

describe('Identity log contract (CI)', () => {
  it('validateIdentityLogEvent requires traceId and driftKind for drift', () => {
    expect(
      validateIdentityLogEvent({
        event: IdentityLogEventType.Drift,
        key: 'k1',
        outcome: 'cache_stale',
        traceId: 'abc',
      }),
    ).toBe('drift event requires driftKind');

    expect(
      validateIdentityLogEvent({
        event: IdentityLogEventType.Drift,
        key: 'k1',
        outcome: 'cache_stale',
        driftKind: 'cache_stale',
        traceId: 'abc',
      }),
    ).toBeNull();
  });

  it('resolveIdentityTraceId falls back to no-trace:key', () => {
    expect(resolveIdentityTraceId('col-a')).toBe('no-trace:col-a');
    expect(resolveIdentityTraceId(undefined)).toBe('no-trace:*');
    expect(resolveIdentityTraceId('k', 'existing')).toBe('existing');
  });

  it('emits fallback log instead of dropping invalid events (P3.21)', () => {
    const logger = new Logger('test');
    const lines: string[] = [];
    jest.spyOn(logger, 'warn').mockImplementation((msg) => {
      lines.push(String(msg));
    });

    const structured = new IdentityStructuredLogger();
    structured.logWrite(logger, 'info', {
      outcome: 'noop',
      context: 'write',
    });

    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(parsed.event).toBe('identity_log_fallback');
    expect(parsed.originalEvent).toBe('identity_cache_write');
    expect(parsed.reason).toBe('schema_invalid');
    expect(typeof parsed.traceId).toBe('string');
  });

  it('emits traceId on every valid structured log line', () => {
    const logger = new Logger('test');
    const lines: string[] = [];
    jest.spyOn(logger, 'log').mockImplementation((msg) => {
      lines.push(String(msg));
    });

    const structured = new IdentityStructuredLogger();
    structured.logWrite(logger, 'info', {
      key: 'k1',
      outcome: 'accepted',
      context: 'write',
    });

    const parsed = JSON.parse(lines[0]!) as { traceId: string };
    expect(parsed.traceId).toBe('no-trace:k1');
  });
});

describe('Legacy identity log ban (CI)', () => {
  it('src/ contains no banned legacy patterns', () => {
    const srcRoot = path.join(__dirname, '..');
    const hits: string[] = [];

    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.name.endsWith('.ts')) {
          const content = fs.readFileSync(full, 'utf8');
          const fileHits = findLegacyIdentityLogPatterns(content);
          for (const h of fileHits) {
            hits.push(`${path.relative(srcRoot, full)}:${h}`);
          }
        }
      }
    };

    walk(srcRoot);
    expect(hits).toEqual([]);
  });
});
