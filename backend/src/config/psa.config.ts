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
  specCoverAllowFallback: flag(process.env.PSA_SPEC_COVER_ALLOW_FALLBACK),
  specCloudflareTimeoutMs: clampInt(
    process.env.PSA_SPEC_CLOUDFLARE_TIMEOUT_MS,
    45_000,
    10_000,
    120_000,
  ),
  /** Persistent Chromium profile — survives cf_clearance between runs. */
  specScraperUserDataDir:
    process.env.PSA_SPEC_SCRAPER_USER_DATA_DIR?.trim() ||
    '.psa-chromium-profile',
  /** Installed Chrome channel (`chrome`, `msedge`). Empty → bundled Chromium. */
  specScraperChannel: process.env.PSA_SPEC_SCRAPER_CHANNEL?.trim() || '',
  collectorsCookiesFile:
    process.env.PSA_COLLECTORS_COOKIES_FILE?.trim() ||
    '.psa-collectors-cookies.json',
  /** One-time bootstrap — service auto-refreshes and updates cookies file. */
  collectorsRefreshToken:
    process.env.PSA_COLLECTORS_REFRESH_TOKEN?.trim() || '',
  /** Refresh DSR when expiry is within this window (default 48h). */
  collectorsAuthRefreshLeadMs: clampInt(
    process.env.PSA_COLLECTORS_AUTH_REFRESH_LEAD_MS,
    172_800_000,
    3_600_000,
    30 * 86_400_000,
  ),
  /** Background OAuth refresh every 6h (set `0` / `false` to disable). */
  collectorsAuthRefreshCron:
    process.env.PSA_COLLECTORS_AUTH_REFRESH_CRON !== '0' &&
    process.env.PSA_COLLECTORS_AUTH_REFRESH_CRON !== 'false',
  /** Match the browser that issued `cf_clearance` when possible. */
  specScraperUserAgent: process.env.PSA_SPEC_SCRAPER_USER_AGENT?.trim() || '',
  /** Scrape psacard.com/cert for PSA Estimate when Public API omits it. */
  certEstimateScrapeEnabled:
    process.env.PSA_CERT_ESTIMATE_SCRAPE_ENABLED !== '0' &&
    process.env.PSA_CERT_ESTIMATE_SCRAPE_ENABLED !== 'false',
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
