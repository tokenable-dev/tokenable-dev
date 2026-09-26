import type { DataSource } from 'typeorm';

export type PgSessionAdvisoryLockResult<T> =
  | { acquired: false }
  | { acquired: true; value: T };

/**
 * Session advisory lock on one dedicated connection (lock + unlock same session).
 * Pool checkout per `dataSource.query()` can leave locks on other sessions and
 * exhaust Postgres `max_connections` under cron load.
 */
export async function runWithPgSessionAdvisoryLock<T>(
  dataSource: DataSource,
  lockKey: number,
  fn: () => Promise<T>,
): Promise<PgSessionAdvisoryLockResult<T>> {
  const qr = dataSource.createQueryRunner();
  await qr.connect();
  try {
    const rows = (await qr.query(`SELECT pg_try_advisory_lock($1) AS ok`, [
      lockKey,
    ])) as { ok: boolean }[];
    if (!rows[0]?.ok) {
      return { acquired: false };
    }
    const value = await fn();
    return { acquired: true, value };
  } finally {
    try {
      await qr.query(`SELECT pg_advisory_unlock($1)`, [lockKey]);
    } catch {
      // Best-effort; connection release ends the session anyway.
    }
    await qr.release();
  }
}
