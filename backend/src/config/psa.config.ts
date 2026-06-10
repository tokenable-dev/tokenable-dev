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
  /** Shorter cache when PSA redirects to Collectors sign-in (login wall). */
  specAuthBlockedCacheMs: clampInt(
    process.env.PSA_SPEC_AUTH_BLOCKED_CACHE_MS,
    300_000,
    30_000,
    3_600_000,
  ),
  specScraperProxy: process.env.PSA_SPEC_SCRAPER_PROXY?.trim() || '',
  specRetryEmpty: flag(process.env.PSA_SPEC_RETRY_EMPTY),
  specCoverAllowFallback: flag(process.env.PSA_SPEC_COVER_ALLOW_FALLBACK),
  /**
   * Optional Collectors/PSA session cookie string for authenticated spec-page scrapes.
   * Export from a logged-in browser session (Application → Cookies → psacard.com).
   * Format: `name1=value1; name2=value2`
   */
  collectorsSessionCookie: process.env.PSA_COLLECTORS_SESSION_COOKIE?.trim() || '',
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
