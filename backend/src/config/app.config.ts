import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: clampInt(process.env.PORT, 4000, 1, 65_535),
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
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}
