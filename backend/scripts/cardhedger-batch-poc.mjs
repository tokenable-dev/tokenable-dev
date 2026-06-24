/**
 * Compare Cardhedger cert lookup APIs for Phase 4 pilot planning.
 *
 * Usage (from backend/):
 *   node scripts/cardhedger-batch-poc.mjs
 *   node scripts/cardhedger-batch-poc.mjs 76676185 50000000 83179580
 *
 * Requires CARDHEDGER_API_KEY in env (reads backend/.env when present).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function loadDotEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === '') {
      process.env[key] = val;
    }
  }
}

loadDotEnv();

const DEFAULT_CERTS = ['76676185', '50000000', '83179580', '12345678', '98765432'];
const certs = (process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_CERTS)
  .map((c) => String(c).replace(/\D/g, ''))
  .filter((c) => c.length >= 7);

const apiKey = process.env.CARDHEDGER_API_KEY?.trim();
const base = (process.env.CARDHEDGER_BASE_URL ?? 'https://api.cardhedger.com').replace(
  /\/$/,
  '',
);

if (!apiKey) {
  console.error('CARDHEDGER_API_KEY is not set (export or add to backend/.env)');
  process.exit(1);
}

async function postJson(upstreamPath, body) {
  const url = `${base}/${upstreamPath.replace(/^\//, '')}`;
  const started = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _raw: text.slice(0, 500) };
  }
  return { status: res.status, ms: Date.now() - started, json };
}

function pickCardSummary(entry) {
  const card = entry?.card ?? entry;
  const certInfo = entry?.cert_info ?? entry?.certificate ?? null;
  return {
    cert: certInfo?.cert ?? entry?.cert ?? null,
    grade: certInfo?.grade ?? entry?.grade ?? null,
    card_id: card?.card_id ?? null,
    description: card?.description ?? card?.name ?? certInfo?.description ?? null,
    price_headline:
      entry?.price ??
      entry?.estimate?.price ??
      (Array.isArray(entry?.prices) && entry.prices.length
        ? entry.prices[entry.prices.length - 1]?.price
        : null),
    card_source: entry?.card_source ?? null,
    match_confidence: entry?.match_confidence ?? null,
    prices_count: Array.isArray(entry?.prices) ? entry.prices.length : 0,
  };
}

function indexByCert(rows, getCert) {
  const map = new Map();
  for (const row of rows) {
    const cert = String(getCert(row) ?? '').replace(/\D/g, '');
    if (cert) map.set(cert, row);
  }
  return map;
}

async function main() {
  console.log(`\nCardhedger cert API PoC — ${certs.length} cert(s)`);
  console.log(`Base: ${base}\n`);

  const [details, batchPrices] = await Promise.all([
    postJson('/v1/cards/details-by-certs', { certs, grader: 'PSA' }),
    postJson('/v1/cards/batch-prices-by-cert', { certs, grader: 'PSA' }),
  ]);

  console.log('── POST /v1/cards/details-by-certs ──');
  console.log(`HTTP ${details.status} in ${details.ms}ms`);
  const detailRows = Array.isArray(details.json?.results)
    ? details.json.results
    : [];
  const detailByCert = indexByCert(detailRows, (r) => r?.cert_info?.cert);
  for (const cert of certs) {
    const row = detailByCert.get(cert);
    console.log(`  ${cert}:`, row ? pickCardSummary(row) : '(missing)');
  }

  console.log('\n── POST /v1/cards/batch-prices-by-cert ──');
  console.log(`HTTP ${batchPrices.status} in ${batchPrices.ms}ms`);
  const priceRows = Array.isArray(batchPrices.json?.results)
    ? batchPrices.json.results
    : Array.isArray(batchPrices.json?.certs)
      ? batchPrices.json.certs
      : [];
  const priceByCert = indexByCert(priceRows, (r) => r?.cert_info?.cert ?? r?.cert);
  for (const cert of certs) {
    const row = priceByCert.get(cert);
    console.log(`  ${cert}:`, row ? pickCardSummary(row) : '(missing)');
  }

  console.log('\n── Diff (card_id match) ──');
  for (const cert of certs) {
    const d = detailByCert.get(cert);
    const p = priceByCert.get(cert);
    const dId = d?.card?.card_id ?? null;
    const pId = p?.card?.card_id ?? null;
    const match =
      dId && pId ? (dId === pId ? 'same' : 'DIFFERENT') : dId || pId ? 'partial' : 'none';
    console.log(`  ${cert}: card_id ${match} | details=${dId ?? '—'} batch=${pId ?? '—'}`);
  }

  console.log('\nRaw top-level keys:');
  console.log('  details-by-certs:', Object.keys(details.json ?? {}));
  console.log('  batch-prices-by-cert:', Object.keys(batchPrices.json ?? {}));
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
