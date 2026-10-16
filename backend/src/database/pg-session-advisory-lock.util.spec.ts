import type { DataSource } from 'typeorm';
import { runWithPgSessionAdvisoryLock } from './pg-session-advisory-lock.util';

function fakeDataSource(lockOk: boolean) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const qr = {
    connect: jest.fn(async () => undefined),
    release: jest.fn(async () => undefined),
    query: jest.fn(async (sql: string, params: unknown[]) => {
      calls.push({ sql, params });
      return sql.includes('pg_try_advisory_lock') ? [{ ok: lockOk }] : [];
    }),
  };
  const dataSource = {
    createQueryRunner: jest.fn(() => qr),
    query: jest.fn(),
  } as unknown as DataSource;
  return { dataSource, qr, calls };
}

describe('runWithPgSessionAdvisoryLock', () => {
  it('locks and unlocks on the same dedicated session (not the pool)', async () => {
    const { dataSource, qr, calls } = fakeDataSource(true);
    const result = await runWithPgSessionAdvisoryLock(dataSource, 42, async () => 'done');

    expect(result).toEqual({ acquired: true, value: 'done' });
    expect(dataSource.createQueryRunner).toHaveBeenCalledTimes(1);
    expect((dataSource as unknown as { query: jest.Mock }).query).not.toHaveBeenCalled();
    expect(calls.map((c) => c.sql)).toEqual([
      'SELECT pg_try_advisory_lock($1) AS ok',
      'SELECT pg_advisory_unlock($1)',
    ]);
    expect(qr.release).toHaveBeenCalledTimes(1);
  });

  it('supports the two-int4 key form used by collection snapshots', async () => {
    const { dataSource, calls } = fakeDataSource(true);
    await runWithPgSessionAdvisoryLock(dataSource, [-1051360988, 757733227], async () => null);

    expect(calls).toEqual([
      { sql: 'SELECT pg_try_advisory_lock($1, $2) AS ok', params: [-1051360988, 757733227] },
      { sql: 'SELECT pg_advisory_unlock($1, $2)', params: [-1051360988, 757733227] },
    ]);
  });

  it('skips fn and unlock when the lock is held elsewhere', async () => {
    const { dataSource, qr, calls } = fakeDataSource(false);
    const fn = jest.fn(async () => 'never');
    const result = await runWithPgSessionAdvisoryLock(dataSource, 42, fn);

    expect(result).toEqual({ acquired: false });
    expect(fn).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
    expect(qr.release).toHaveBeenCalledTimes(1);
  });

  it('unlocks and releases even when fn throws', async () => {
    const { dataSource, qr, calls } = fakeDataSource(true);
    await expect(
      runWithPgSessionAdvisoryLock(dataSource, 42, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(calls.map((c) => c.sql)).toContain('SELECT pg_advisory_unlock($1)');
    expect(qr.release).toHaveBeenCalledTimes(1);
  });
});
