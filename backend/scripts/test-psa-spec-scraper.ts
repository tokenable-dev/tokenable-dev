/**
 * Quick standalone verification that PsaSpecScraperService can grab the
 * card-only CloudFront image URL from a Cloudflare-protected PSA spec page.
 *
 * Usage:
 *   node_modules/.bin/ts-node scripts/test-psa-spec-scraper.ts 9656727
 */
import { ConfigService } from '@nestjs/config';
import { PsaCollectorsSessionService } from '../src/psa/psa-collectors-session.service';
import { PsaSpecScraperService } from '../src/psa/psa-spec-scraper.service';

/** Minimal config for standalone script (mirrors `config/psa.config.ts` defaults). */
const scriptConfig = new ConfigService({
  psa: {
    specNavTimeoutMs: Number(process.env.PSA_SPEC_NAV_TIMEOUT_MS) || 120_000,
    specImgTimeoutMs: Number(process.env.PSA_SPEC_IMG_TIMEOUT_MS) || 45_000,
    specNegativeCacheMs:
      Number(process.env.PSA_SPEC_NEGATIVE_CACHE_MS) || 3_600_000,
    specScraperProxy: process.env.PSA_SPEC_SCRAPER_PROXY?.trim() || '',
    specCoverAllowFallback: false,
    specCloudflareTimeoutMs:
      Number(process.env.PSA_SPEC_CLOUDFLARE_TIMEOUT_MS) || 45_000,
    specScraperUserDataDir:
      process.env.PSA_SPEC_SCRAPER_USER_DATA_DIR?.trim() ||
      '.psa-chromium-profile',
    specScraperChannel: process.env.PSA_SPEC_SCRAPER_CHANNEL?.trim() || '',
    collectorsCookiesFile:
      process.env.PSA_COLLECTORS_COOKIES_FILE?.trim() ||
      '.psa-collectors-cookies.json',
    collectorsRefreshToken:
      process.env.PSA_COLLECTORS_REFRESH_TOKEN?.trim() || '',
    collectorsAuthRefreshLeadMs:
      Number(process.env.PSA_COLLECTORS_AUTH_REFRESH_LEAD_MS) || 172_800_000,
    collectorsAuthRefreshCron:
      process.env.PSA_COLLECTORS_AUTH_REFRESH_CRON !== '0' &&
      process.env.PSA_COLLECTORS_AUTH_REFRESH_CRON !== 'false',
    specScraperUserAgent: process.env.PSA_SPEC_SCRAPER_USER_AGENT?.trim() || '',
  },
});

async function main() {
  const specId = process.argv[2] ?? '9656727';

  const collectorsSession = new PsaCollectorsSessionService(scriptConfig);
  await collectorsSession.onModuleInit();

  const svc = new PsaSpecScraperService(scriptConfig, collectorsSession);
  svc.onModuleInit();

  console.log(`[test] cold scrape specId=${specId} …`);
  let t = Date.now();
  let url = await svc.scrapeSpecImageUrl(specId);
  console.log(`[test]   result (${Date.now() - t}ms):`, url ?? '(null)');

  console.log(`[test] cache hit specId=${specId} …`);
  t = Date.now();
  url = await svc.scrapeSpecImageUrl(specId);
  console.log(`[test]   result (${Date.now() - t}ms):`, url ?? '(null)');

  const extra = process.argv[3];
  if (extra) {
    console.log(`[test] warm browser specId=${extra} …`);
    t = Date.now();
    url = await svc.scrapeSpecImageUrl(extra);
    console.log(`[test]   result (${Date.now() - t}ms):`, url ?? '(null)');
  }

  await svc.onModuleDestroy();
}

main().catch((e) => {
  console.error('test failed:', e);
  process.exit(1);
});
