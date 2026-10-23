import type { LogLevel } from '@nestjs/common';

/**
 * Nest console verbosity. Default `warn` → only `warn` + `error` (no `log` / bootstrap noise).
 * Set `LOG_LEVEL=log` or `verbose` for full Nest `Logger.log` output (local debugging).
 */
export function resolveNestLoggerLevels(): LogLevel[] {
  const raw = process.env.LOG_LEVEL?.trim().toLowerCase() ?? 'warn';
  if (raw === 'verbose' || raw === 'all') {
    return ['error', 'warn', 'log', 'debug', 'verbose'];
  }
  if (raw === 'log' || raw === 'debug') {
    return ['error', 'warn', 'log', 'debug'];
  }
  return ['error', 'warn'];
}

export function isVerboseNestLogging(): boolean {
  const raw = process.env.LOG_LEVEL?.trim().toLowerCase() ?? 'warn';
  return raw === 'verbose' || raw === 'all' || raw === 'log' || raw === 'debug';
}
