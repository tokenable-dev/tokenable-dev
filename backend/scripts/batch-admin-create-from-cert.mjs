/**
 * Batch smoke-test POST /marketplace/collections/admin/create-from-cert.
 *
 * Usage (from backend/):
 *   node scripts/batch-admin-create-from-cert.mjs
 *   node scripts/batch-admin-create-from-cert.mjs --dry-run
 *   API_BASE=http://127.0.0.1:4100/api CHAIN_ID=11155111 node scripts/batch-admin-create-from-cert.mjs
 *
 * Reads MARKETPLACE_ADMIN_USERNAME / MARKETPLACE_ADMIN_PASSWORD from backend/.env
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function loadDotEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
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

const CERTS_RAW = `
161820328 137244794 139865465 42549999 53385337 30355728 64087288 77928717
11077327 63147878 65720488 159952650 17950984 113932473 157826132 100593486
68407605 169246779 170944131 121766708 152263356 163652123 92100526 12345678
89421625 127657171 162542529 101239970 63135236 163043413 98203118 80147607
103454176 137839751 165623497 170897847 47181139 64454852 173199044 138983902
46994328 114072566 63179616 41678186 80309312 66218107 63028611 63566677
129563186 63087722 92130818 164014763 78892815 106231459 68133027 115765506
70468165 161565251 146607639 73064683 147535320 83579298 167704194 162209597
165544810 166260413 83297897 137615572 61561322 171849969 51623417 107960360
153256185 14596970 12496970 139887849 139409577 138971300 73451242 61276343
61623412 72726124 61622341 115091982 98515466 66123123 146724030 144784450
77605262 134333877 98545266 166428710 27391794 159717598 164458814 72347232
127726236 93131432 71531900 101352213 125857372 108928638 83727489 94038306
151380671 84198952 84089328 159806544 120570273 158350224 22312323 22312324
22312325 22312333 22312322 12312321 127657170 127657172 86507410 44817447
123123121 123123128 123123125 123123130 123123129 123123127 48785771 123123124
123123123 65797340 64316571 80391475 78253306 44119905 23855877 155824868
58786411 92490215 95853784 139794912 110136262 151876360 76225095 64037849
152036517 153298062 143177038 105841187 127657173
`;

function parseCerts(raw) {
  const out = [];
  const seen = new Set();
  for (const m of raw.match(/\d{7,10}/g) ?? []) {
    if (seen.has(m)) continue;
    seen.add(m);
    out.push(m);
  }
  return out;
}

const dryRun = process.argv.includes('--dry-run');
const apiBase = (process.env.API_BASE ?? 'http://127.0.0.1:4100/api').replace(
  /\/$/,
  '',
);
const chainId = process.env.CHAIN_ID ?? '11155111';
const username =
  process.env.MARKETPLACE_ADMIN_USERNAME?.trim() || 'skyand';
const password =
  process.env.MARKETPLACE_ADMIN_PASSWORD?.trim() || '071725';
const siteAccessPassword =
  process.env.SITE_ACCESS_PASSWORD?.trim() ||
  process.env.SITE_ACCESS_GATE_PASSWORD?.trim() ||
  '717171';
const delayMs = Number(process.env.BATCH_CERT_DELAY_MS ?? '400');

let certs = parseCerts(CERTS_RAW);
const limit = Number(process.env.CERT_LIMIT ?? '0');
if (limit > 0) certs = certs.slice(0, limit);

function formatErr(body, status) {
  if (!body || typeof body !== 'object') return `[${status}] HTTP error`;
  const parts = [];
  const msg = body.message;
  if (Array.isArray(msg)) parts.push(msg.join('; '));
  else if (typeof msg === 'string') parts.push(msg);
  return `[${status}] ${parts.join(' — ') || 'Request failed'}`;
}

function mergeSetCookie(res, jar) {
  const setCookie = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookie) {
    const m = /^([^=]+)=([^;]+)/.exec(c);
    if (m) jar[m[1]] = m[2];
  }
}

async function verifySiteAccess(cookieJar) {
  if (!siteAccessPassword) return;
  const res = await fetch(`${apiBase}/site-access/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: siteAccessPassword }),
  });
  mergeSetCookie(res, cookieJar);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Site access failed: ${formatErr(body, res.status)}`);
  }
}

async function login(cookieJar) {
  const res = await fetch(`${apiBase}/marketplace/admin/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader(cookieJar),
    },
    body: JSON.stringify({ username, password }),
  });
  mergeSetCookie(res, cookieJar);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Admin login failed: ${formatErr(body, res.status)}`);
  }
}

function cookieHeader(jar) {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

async function createFromCert(cookieJar, certNumber) {
  const res = await fetch(
    `${apiBase}/marketplace/collections/admin/create-from-cert`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tokenable-chain-id': String(chainId),
        Cookie: cookieHeader(cookieJar),
      },
      body: JSON.stringify({ certNumber }),
    },
  );
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    return { ok: false, error: formatErr(body, res.status) };
  }
  return {
    ok: true,
    created: body?.created,
    reviewStatus: body?.reviewStatus,
    displayLabel: body?.displayLabel,
    collectionKey: body?.collectionKey,
  };
}

async function main() {
  console.log(`Certs: ${certs.length}, API: ${apiBase}, chain: ${chainId}`);
  if (dryRun) {
    console.log(certs.join('\n'));
    return;
  }

  const jar = {};
  await verifySiteAccess(jar);
  await login(jar);

  const results = [];
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < certs.length; i++) {
    const cert = certs[i];
    process.stdout.write(`[${i + 1}/${certs.length}] ${cert} … `);
    const r = await createFromCert(jar, cert);
    if (r.ok) {
      ok++;
      const tag = r.created ? 'created' : `exists:${r.reviewStatus}`;
      console.log(`OK (${tag})`);
      results.push({ cert, ok: true, detail: tag, label: r.displayLabel });
    } else {
      fail++;
      console.log(`FAIL ${r.error}`);
      results.push({ cert, ok: false, detail: r.error });
    }
    if (i < certs.length - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  const outPath = path.join(ROOT, 'scripts', 'batch-create-from-cert-results.json');
  fs.writeFileSync(outPath, JSON.stringify({ ok, fail, results }, null, 2));
  console.log(`\nDone: ${ok} ok, ${fail} fail → ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
