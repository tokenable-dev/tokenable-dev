import { registerAs } from '@nestjs/config';

/**
 * Local dev defaults to 4100 — Cursor/VS Code often forwards localhost:4000.
 * `PORT=4000` in backend/.env is ignored in development (still 4100).
 */
function resolveAppPort(): number {
  const isProd = process.env.NODE_ENV === 'production';
  const fromEnv = clampInt(process.env.PORT, 0, 1, 65_535);

  if (isProd) {
    return fromEnv || 4000;
  }

  if (!fromEnv || fromEnv === 4000) {
    return 4100;
  }

  return fromEnv;
}

export default registerAs('app', () => ({
  port: resolveAppPort(),
  nodeEnv: process.env.NODE_ENV?.trim() || 'development',
  corsOrigin: process.env.CORS_ORIGIN?.trim() || '*',
  isProduction: process.env.NODE_ENV === 'production',
}));

function clampInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = Number(raw ?? fallback);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}
