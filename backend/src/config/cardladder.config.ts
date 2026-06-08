import { registerAs } from '@nestjs/config';

function flag(raw: string | undefined): boolean {
  return raw === '1' || raw === 'true';
}

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

export default registerAs('cardladder', () => ({
  indexesCacheTtlMs: clampInt(
    process.env.CARDLADDER_INDEXES_CACHE_TTL_MS,
    6 * 60 * 60 * 1000,
    60_000,
    7 * 86_400_000,
  ),
  indexesRefreshIntervalMs: clampInt(
    process.env.CARDLADDER_INDEXES_REFRESH_INTERVAL_MS,
    6 * 60 * 60 * 1000,
    60_000,
    7 * 86_400_000,
  ),
  indexesPrewarmDelayMs: clampInt(
    process.env.CARDLADDER_INDEXES_PREWARM_DELAY_MS,
    5_000,
    0,
    600_000,
  ),
  /** Boot + interval refresh unless CARDLADDER_INDEXES_PREWARM_DISABLED=1 */
  indexesPrewarmEnabled: !flag(process.env.CARDLADDER_INDEXES_PREWARM_DISABLED),
  /** Max wait for an in-flight scrape on cold HTTP reads (avoids proxy socket hang-up). */
  indexesColdWaitMs: clampInt(
    process.env.CARDLADDER_INDEXES_COLD_WAIT_MS,
    8_000,
    0,
    120_000,
  ),
  indexesNavTimeoutMs: clampInt(
    process.env.CARDLADDER_INDEXES_NAV_TIMEOUT_MS,
    60_000,
    10_000,
    180_000,
  ),
  indexesCardsWaitMs: clampInt(
    process.env.CARDLADDER_INDEXES_CARDS_WAIT_MS,
    30_000,
    3_000,
    120_000,
  ),
  indexesScraperProxy: process.env.CARDLADDER_INDEXES_SCRAPER_PROXY?.trim() || '',
}));
