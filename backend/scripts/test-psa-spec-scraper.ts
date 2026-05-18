/**
 * Quick standalone verification that PsaSpecScraperService can grab the
 * card-only CloudFront image URL from a Cloudflare-protected PSA spec page.
 *
 * Usage:
 *   node_modules/.bin/ts-node scripts/test-psa-spec-scraper.ts 9656727
 */
import { PsaSpecScraperService } from '../src/psa/psa-spec-scraper.service';

async function main() {
  const specId = process.argv[2] ?? '9656727';

  const svc = new PsaSpecScraperService();
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
