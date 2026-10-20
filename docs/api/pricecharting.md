# PriceCharting integration

PriceCharting is integrated as a **server-side Prices proxy** so the API token never reaches the browser. Use Swagger (`/api/docs` → tag `pricecharting`) to explore responses before wiring DB ingest.

**Env**

| Variable | Required | Purpose |
|----------|----------|---------|
| `PRICECHARTING_API_TOKEN` | yes (for live calls) | 40-char token from Subscription → API/Download |
| `PRICECHARTING_CSV_URL` | for `/csv` | Full Legendary CSV download URL from the same page |
| `PRICECHARTING_BASE_URL` | no | Default `https://www.pricecharting.com` |
| `PRICECHARTING_HTTP_TIMEOUT_MS` | no | JSON timeout (default 30000) |
| `PRICECHARTING_S3_BUCKET` | production archive | Private bucket for the original CSV. Example `tokenable-pricecharting-raw`. Not created by the app. |
| `PRICECHARTING_S3_PREFIX` | production archive | Key prefix, example `pricecharting/raw/`. |

---

## What we proxy (and what we do not)

| Upstream | Our route | Use |
|----------|-----------|-----|
| `GET /api/product` | `GET /api/pricecharting/product` | Single product (`id` / `upc` / `q`). Same keys as one CSV row. |
| `GET /api/products` | `GET /api/pricecharting/products` | Search, max 20 (`q`). Matching / exploration. |
| Legendary CSV download | `GET /api/pricecharting/csv` | Bulk dump → intended DB source of truth. |

**Not proxied:** Marketplace APIs (`/api/offers`, `offer-publish`, `offer-ship`, `offer-refund`, …). Those automate selling on PriceCharting’s own marketplace and are unrelated to Tokenable vault / Seaport.

---

## Limits

- **JSON:** 1 call / second (upstream hard limit; enforced in-process).
- **CSV:** 1 download / 10 minutes (upstream); files regenerate ~every 24h — daily is enough.
- Nest `@Throttle` also caps per-IP abuse on the proxy.

---

## Price units

- **JSON Prices API:** integer **pennies** (`1732` = $17.32).
- **CSV:** USD with two decimal places (column names match Prices API keys).

---

## Implementation

| Piece | Path |
|-------|------|
| Module | `backend/src/pricecharting/pricecharting.module.ts` |
| Upstream client | `backend/src/pricecharting/pricecharting.service.ts` |
| HTTP + Swagger | `backend/src/pricecharting/controllers/pricecharting-proxy.controller.ts` |
| Stable error codes | `backend/src/pricecharting/pricecharting-errors.ts` |

Clients never send `t`. The service overwrites any client-supplied `t` with `PRICECHARTING_API_TOKEN`.

---

## Catalog (admin CSV)

Independent of `collection_market_snapshots`. Admin upload upserts by PriceCharting / SportsCardsPro product `id`.

| | |
|--|--|
| UI | `/marketplace/admin/pricecharting` |
| Upload | `POST /api/marketplace/admin/pricecharting/import` (multipart `file`, admin session) |
| Status | `GET /api/marketplace/admin/pricecharting/catalog` |
| Register URL | `POST /api/marketplace/admin/pricecharting/sources` `{ label, url }` |
| Remove URL | `DELETE /api/marketplace/admin/pricecharting/sources/:id` |
| Sync one guide | `POST /api/marketplace/admin/pricecharting/sync` `{ key }` — `video-games`, `pokemon-cards`, `magic-cards`, `yugioh-cards`, `one-piece-cards` |
| Table | `pricecharting_products` (prices as integer cents; PSA 10 = `manual_only_price_cents`) |
| Saved URLs | `pricecharting_catalog_sources` (not shown in the admin UI) |
| Price history | `pricecharting_price_history` (`product_id`, Seoul `observed_on`, jsonb cents). Every import writes that date, even when the cents match the previous day. The same date updates that one row. |
| Series | `GET /api/marketplace/admin/pricecharting/products/:id/prices` returns `{ productId, points: [{ observedOn, prices }] }` oldest first. Cents, not dollars. |
| Audit | `pricecharting_import_runs` |

Pokemon / One Piece guide files and sports **set** CSVs all land in the same table. Re-uploading the same id updates prices. Comma CSV and tab-separated files are both accepted (max 50 MB).

The admin page has one button per fixed guide (video games, Pokemon, Magic, Yu-Gi-Oh, One Piece). The server requests `https://www.pricecharting.com/price-guide/download-custom` with the guide's `category` when there is one, and injects `t`. The URL is not sent to the browser. There is no scheduled download. After a successful guide import, the raw CSV is written to `{PRICECHARTING_CSV_DIR or var/pricecharting}/{guide}/{guide}-{YYYY-MM-DD}.csv`. A manual sports-set upload ignores the original filename and writes `sports/{set}/{set}-{YYYY-MM-DD}.csv`, where `{set}` is the most common `console-name` in that file. The same Seoul date overwrites that file. A new date adds another file. The directory is gitignored and excluded from the backend image, so each server keeps its own copies. Production also keeps that directory on the `pricecharting_csv` volume. `pricecharting_products` keeps the latest row. `pricecharting_price_history` keeps the full price set for each Seoul date an import ran, including days the price did not change. Days with no import have no row.

After the database commit succeeds, production (`NODE_ENV=production`) uploads that same original CSV buffer to the private bucket `PRICECHARTING_S3_BUCKET` under `PRICECHARTING_S3_PREFIX`. The object is the bytes from PriceCharting, not a CSV rebuilt from rows. Keys:

- `pricecharting/raw/pokemon-cards/pokemon-cards-2026-10-20.csv`
- `pricecharting/raw/sports/Basketball-Cards-1986-Fleer/Basketball-Cards-1986-Fleer-2026-10-20.csv`

The date is the Seoul calendar day. The same guide or set on the same day overwrites that object. A failed import does not upload. If the commit succeeds and the put still fails after three tries, the import stays committed, `pricecharting_import_runs.error_message` records it, and the admin response includes `imported: true` and `archived: false`. Local and any non-production process does not write this bucket. A local download command is a later phase. The bucket stays private: no public ACL and no CloudFront URL. Reuse `AWS_REGION` and the default AWS credential chain (instance role or the existing keys). IAM needs `s3:PutObject`, `s3:GetObject`, and `s3:DeleteObject` on `arn:aws:s3:::tokenable-pricecharting-raw/pricecharting/raw/*`, plus `s3:ListBucket` on the bucket limited to that prefix. Cover, avatar, and slab permissions stay as they are.

User-facing market prices still read `collection_market_snapshots`. This catalog is not wired into that merge yet.

Purge stored rows if the subscription ends.
