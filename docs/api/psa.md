# PSA API

**Controller:** `backend/src/psa/psa.controller.ts`  
**Base path:** `/api/psa`  
**Swagger tag:** `psa`

Analyzes graded card slabs using OCR and looks up the result against the **PSA Public API**. Used in the Vault (mint) flow.

---

## Routes

### `POST /api/psa/analyze`

**Content-Type:** `multipart/form-data`

Runs the full pipeline:
1. Cardhedger **details-by-cert-ocr** on slab image(s) → cert candidates
2. PSA Public API lookup (first successful cert in candidate list)
3. Cardhedger mint enrichment

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `slabFront` | file | Yes | Slab front image (JPEG/PNG/WebP, max 15 MB) |
| `slabBack` | file | No | Slab back image |
| `certNumber` | string | No | Manual cert hint — used **only when OCR finds no cert** (OCR wins if present) |

**Response:** `PsaAnalyzeResult`

```json
{
  "certNumber": "83179580",
  "cardName": "Pikachu",
  "cardSet": "Base Set",
  "cardNumber": "58",
  "gradeScore": "10",
  "gradingCompany": "psa",
  "psaSpecId": "1234567",
  "psaTotalPopulation": 500,
  "imageUrl": "https://...",
  "cardhedgerCardId": "1745765714667x...",
  "cardhedgerSearchQuery": "Pikachu 1999 Base Set"
}
```

---

### `POST /api/psa/analyze-by-cert`

**Content-Type:** `application/json`

Performs PSA lookup by cert number only, without slab images.

**Request body:**

```json
{ "certNumber": "83179580" }
```

Accepts cert number digits or full PSA cert URL (`https://www.psacard.com/cert/83179580`).

- Uses **only** the requested cert (no OCR).
- Rejects PSA responses where `PSACert.CertNumber` ≠ requested cert (**400**).
- Parses grade from `CardGrade` (string or number) and `GradeDescription`.

**Response:** Same `PsaAnalyzeResult` shape as `/analyze`.

**Mint:** Vault preview works for any PSA grade; `POST /api/rwa/upload` accepts **PSA 10 only**.

---

## Related Environment Variables

| Variable | Purpose |
|----------|---------|
| `PSA_PUBLIC_API_TOKEN` | PSA Public API bearer token (optional — cert lookup degrades gracefully without it) |
| `CARDHEDGER_API_KEY` | Used for Cardhedger OCR and card-match enrichment |

## Troubleshooting

- **500 on deployed server:** Check backend logs for `PSA analyze failed:`. Common causes:
  - `sharp` native module issue (Dockerfile uses `node:22-bookworm-slim` to avoid Alpine musl incompatibility)
  - OOM on small instances
  - Outbound HTTPS blocked
  - Upload size exceeds Nginx `client_max_body_size` or Multer limit (15 MB)
- Verify `sharp` in container: `node -e "require('sharp'); console.log('ok')"`

---

## PSA spec page scraper (collection covers)

**Code:** `backend/src/psa/psa-spec-scraper.service.ts`  
**Called from:** `CollectionService.fetchCatalogImageFromMeta` when PSA `specId` (or cert → API → spec) is known.

Headless Chromium opens **`https://www.psacard.com/spec/psa/{specId}`** (with and without grading query params) because PSA serves **card-only** art on CloudFront (`d1htnxwo4o0jhw.cloudfront.net/spec/{specId}/…`) only in HTML after Cloudflare’s JS challenge—plain `fetch` gets 403.

**Collection bootstrap (mint + first ask):** `ensureCollectionForListing` resolves `components.psaSpecId` from mint metadata or PSA Public API cert lookup (`77349241` → `2427023`) **before** the row is shown. Cover resolution tries spec scrape first; Cardhedger/TCG fallback runs only when `PSA_SPEC_COVER_ALLOW_FALLBACK=1`. Mint (`on-mint`) waits up to ~25s for the first spec cover; listing keeps cover work async so `POST /orders` stays within the frontend API timeout.

### What can go wrong

| Risk | Effect | Mitigation |
|------|--------|------------|
| **Collectors sign-in redirect** | Headless browser lands on `app.collectors.com/signin` | Set `PSA_COLLECTORS_REFRESH_TOKEN` in `.env`; restart backend (boot refresh). |
| **Cloudflare / bot detection** | Challenge never clears | Set `PSA_SPEC_SCRAPER_PROXY`; increase `PSA_SPEC_NAV_TIMEOUT_MS`. |
| **PSA layout / CDN URL shape change** | No `img` matches selector / regex | Logs `no_image`; operational alert on rate; falls back only if `PSA_SPEC_COVER_ALLOW_FALLBACK=1` in `CollectionService` (then Cardhedger / Pokémon TCG / metadata image). |
| **No image for that spec** | PSA page exists but asset missing | Same as above; persist other pipeline sources. |
| **Chromium missing in deploy** | Log mentions `Executable doesn't exist` | Run `pnpm run install:browsers` in image (see backend README / Dockerfile). |
| **Transient timeout** | Nav or image wait exceeded | Default nav retry inside scraper; tune timeouts; shorter **negative** cache via `PSA_SPEC_NEGATIVE_CACHE_MS` (e.g. `120000`) so retries happen sooner after blips. |
| **Process-level negative cache** | A failed spec is not re-scraped for 1h | Lower `PSA_SPEC_NEGATIVE_CACHE_MS`, or restart process to clear in-memory cache. Successes still cache 24h. |

### Environment variables (scraper)

| Variable | Purpose |
|----------|---------|
| `PSA_SPEC_NAV_TIMEOUT_MS` | Default `120000` — first paint / Cloudflare wait budget per navigation. |
| `PSA_SPEC_IMG_TIMEOUT_MS` | Default `45000` — wait for spec `img` / DOM scan after load. |
| `PSA_SPEC_SCRAPER_PROXY` | Playwright browser proxy `server` URL (e.g. `http://user:pass@host:port`). |
| `PSA_SPEC_NEGATIVE_CACHE_MS` | How long to cache a **failed** scrape per `specId` (default 1h). |
| `PSA_COLLECTORS_COOKIES_FILE` | Runtime cache (default `.psa-collectors-cookies.json`). Auto-written by session refresh — do not commit. |
| `PSA_COLLECTORS_REFRESH_TOKEN` | **Required (local + production):** refresh JWT. Login script prints this once; paste into `.env`. |
| `PSA_COLLECTORS_AUTH_REFRESH_LEAD_MS` | Refresh when DSR expires within this window (default 48h). |
| `PSA_COLLECTORS_AUTH_REFRESH_CRON` | Set `0` / `false` to disable background refresh (default on). |
| `PSA_SPEC_SCRAPER_USER_DATA_DIR` | Persistent Chromium profile (default `.psa-chromium-profile`) — keeps `cf_clearance` between runs. |
| `PSA_SPEC_SCRAPER_CHANNEL` | Installed browser channel, e.g. `chrome` (recommended on macOS). |
| `PSA_SPEC_CLOUDFLARE_TIMEOUT_MS` | Max wait for Cloudflare challenge to clear (default 45s). |
| `PSA_SPEC_AUTH_BLOCKED_CACHE_MS` | Cache TTL after sign-in redirect (default 5m; shorter than generic `PSA_SPEC_NEGATIVE_CACHE_MS`). |

**Setup (local and production — same model):**

1. Once: `pnpm exec ts-node scripts/psa-collectors-login.ts` → copy printed `PSA_COLLECTORS_REFRESH_TOKEN` into `backend/.env` (local) or `~/.env.production.backend` (EC2).
2. `pnpm run install:browsers` (local, once).
3. Start backend — it seeds/syncs the cookies file from env, refreshes DSR on boot, and scrapes spec pages.

You do **not** need to re-run the login script for daily dev. `.psa-collectors-cookies.json` and `.psa-chromium-profile/` are gitignored runtime caches (Cloudflare + DSR), not source of truth.

**Production (EC2):** use `docker-compose.ec2.yml` — mounts `/var/lib/tokenable` for cookies + Chromium profile. Set `REDIS_URL=redis://redis:6379` in secrets (not `127.0.0.1`).

Validate session: `pnpm exec ts-node scripts/test-psa-collectors-refresh.ts`  
Validate scrape: `pnpm exec ts-node scripts/test-psa-spec-scraper.ts 9656727`.

See also: [guides/troubleshooting.md](../guides/troubleshooting.md)
