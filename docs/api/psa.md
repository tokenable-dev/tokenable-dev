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
1. Crop slab image (front required, back optional)
2. Cardhedger OCR + slab OCR to extract cert number candidates
3. Lookup against PSA Public API → return validated metadata + Cardhedger market data

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `slabFront` | file | Yes | Slab front image (JPEG/PNG/WebP, max 15 MB) |
| `slabBack` | file | No | Slab back image |
| `certNumber` | string | No | Manual cert override (digits only or `https://www.psacard.com/cert/…`) — takes priority over OCR |

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

**Response:** Same `PsaAnalyzeResult` shape as `/analyze`.

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

### What can go wrong

| Risk | Effect | Mitigation |
|------|--------|------------|
| **Cloudflare / bot detection** | Challenge never clears or endless “Just a moment…” | Residential or cleaner egress: set `PSA_SPEC_SCRAPER_PROXY`; increase `PSA_SPEC_NAV_TIMEOUT_MS`. Optional `PSA_SPEC_RETRY_EMPTY=1`. |
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
| `PSA_SPEC_RETRY_EMPTY` | `1` / `true`: run a **second** full scrape if the first returns no image (hydration / CF races). |

Cover pipeline **`PSA_SPEC_COVER_ALLOW_FALLBACK`** (in `CollectionService`): when the scraper returns null, allow Cardhedger / TCG / IPFS fallbacks instead of stopping at PSA-only.

**Manual test:** from `backend/`, `pnpm exec ts-node scripts/test-psa-spec-scraper.ts 9656727`.

See also: [guides/troubleshooting.md](../guides/troubleshooting.md)
