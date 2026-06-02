import { registerAs } from '@nestjs/config';

function flag(raw: string | undefined): boolean {
  return raw === '1' || raw === 'true';
}

export default registerAs('psa', () => ({
  specNavTimeoutMs: clampInt(process.env.PSA_SPEC_NAV_TIMEOUT_MS, 30_000, 5_000, 120_000),
  specImgTimeoutMs: clampInt(process.env.PSA_SPEC_IMG_TIMEOUT_MS, 15_000, 3_000, 60_000),
  specNegativeCacheMs: clampInt(
    process.env.PSA_SPEC_NEGATIVE_CACHE_MS,
    86_400_000,
    60_000,
    7 * 86_400_000,
  ),
  specScraperProxy: process.env.PSA_SPEC_SCRAPER_PROXY?.trim() || '',
  specRetryEmpty: flag(process.env.PSA_SPEC_RETRY_EMPTY),
  specCoverAllowFallback: flag(process.env.PSA_SPEC_COVER_ALLOW_FALLBACK),
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
