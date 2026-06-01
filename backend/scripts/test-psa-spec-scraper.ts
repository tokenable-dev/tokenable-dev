/**
 * Quick standalone verification that PsaSpecScraperService can grab the
 * card-only CloudFront image URL from a Cloudflare-protected PSA spec page.
 *
 * Usage:
 *   node_modules/.bin/ts-node scripts/test-psa-spec-scraper.ts 9656727
 */
import { ConfigService } from '@nestjs/config';
import { PsaSpecScraperService } from '../src/psa/psa-spec-scraper.service';

/** Minimal config for standalone script (mirrors `config/psa.config.ts` defaults). */
const scriptConfig = new ConfigService({
  psa: {
    specNavTimeoutMs: Number(process.env.PSA_SPEC_NAV_TIMEOUT_MS) || 120_000,
    specImgTimeoutMs: Number(process.env.PSA_SPEC_IMG_TIMEOUT_MS) || 45_000,
    specNegativeCacheMs:
      Number(process.env.PSA_SPEC_NEGATIVE_CACHE_MS) || 3_600_000,
    specScraperProxy: process.env.PSA_SPEC_SCRAPER_PROXY?.trim() || '',
    specRetryEmpty:
      process.env.PSA_SPEC_RETRY_EMPTY === '1' ||
      process.env.PSA_SPEC_RETRY_EMPTY === 'true',
    specCoverAllowFallback: false,
  },
});

async function main() {
  const specId = process.argv[2] ?? '9656727';

  const svc = new PsaSpecScraperService(scriptConfig);
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
