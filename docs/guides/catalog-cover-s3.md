# Catalog cover images (S3)

Marketplace **collection covers** (`marketplace_collections.coverImageUrl`) are stored on AWS S3 under a **stable per-collection key**. This is separate from RWA mint images (Pinata / IPFS).

## Default behavior on collection create

When a collection row is first created (`ensureCollectionForListing` **or** admin `create-from-cert`):

1. Resolve ranked catalog image URLs from metadata (Cardhedger + Pokémon TCG hires when applicable).
   - **Ask-time:** from RWA / IPFS graded meta.
   - **Admin catalog create (no mint):** PSA cert → Cardhedger `details-by-certs` (then `card-details` if needed) attaches `graded.cardhedger`, then the same cover resolve runs. PSA slab photos are **not** used as covers.
2. If catalog S3 env is configured: **download candidates in rank order**, skip images smaller than **400×400** (some Cardhedger `/crop_image` rows are ~180px thumbs), **PutObject** the first adequate (or largest fallback) to the stable key.
3. Persist the **S3 public URL** as `coverImageUrl`.
4. If S3 is not configured, or download/upload fails: fall back to the top remote Cardhedger/TCG URL so create/listing still succeeds.
5. Admin can always replace the cover via URL paste or local file upload (same S3 overwrite model).
6. Re-running admin create for the same cert upgrades an existing too-small S3 cover via the same ingest path.

## Object key (overwrite model)

```
{CATALOG_COVER_S3_PREFIX}{sanitizedCollectionKey}/cover
```

Example: `covers/a1b2c3…/cover`

Admin replace and create-time ingest always **overwrite the same object**. No UUID segment — the public URL stays stable for a collection.

Cache-Control on put: `public, max-age=300, must-revalidate` (covers are overwritable; avoid year-long immutable CDN cache).

Allowed types: JPEG / PNG / WebP, max **8MB**.

### User avatars (same bucket)

Settings profile uploads (`POST /api/auth/avatar`) reuse this bucket / public base:

```
{CATALOG_COVER_S3_PREFIX}user-avatars/{userId}/avatar
```

Example with `CATALOG_COVER_S3_PREFIX=dev/covers/`:

```
dev/covers/user-avatars/{userId}/avatar
```

This stays under the existing IAM scope (`…/dev/covers/*`). Optional override: `USER_AVATAR_S3_PREFIX` (must also be allowed by IAM). Same MIME/size limits as covers.

### RWA mint slab images (Phase 1–3 — sell / custody / bulk mint)

At `POST /api/rwa/upload`, the backend copies the slab image (PSA URL or uploaded file) to:

```
{CATALOG_COVER_S3_PREFIX}rwa-slabs/{chainId}/{certNumber}/slab
{CATALOG_COVER_S3_PREFIX}rwa-slabs/{chainId}/{certNumber}/slab-back
```

Example: `dev/covers/rwa-slabs/84532/84089328/slab` (front) and `…/slab-back` (back).

- On-chain `metadata.image` remains **Pinata / IPFS** (unchanged).
- `displayImageUrl` / `displayImageBackUrl` in upload response + optional `POST /api/rwa/mint` fields → `rwa_tokens.display_image_url` / `display_image_back_url`.
- Partner **bulk mint** stores `slab_display_image_url` and `slab_display_image_back_url` on `bulk_mint_job_items` at prepare and writes to `rwa_tokens` at commit.
- Admin **All cards**: `POST /api/marketplace/admin/rwa-slab/:tokenId/image` (`file` + `face=front|back`) uploads a missing face to the same keys.
- S3 ingest at mint is **best-effort** — upload/mint succeed even when S3 is down. Admin file upload fails if S3 is not configured.
- PSA slab photos may exceed the **8MB catalog-cover cap**. Slab ingest downloads up to **24MB**, then downscales to a **2000px** JPEG before PutObject so `displayImageUrl` still lands. Collection covers stay at 8MB.
- Optional env override: `RWA_SLAB_S3_PREFIX` (default: `rwa-slabs/` nested under `CATALOG_COVER_S3_PREFIX`).

**Maintenance migration** (existing DBs):

```bash
psql "$DATABASE_URL" -f backend/sql/maintenance/add_bulk_mint_slab_display_image_url.sql
psql "$DATABASE_URL" -f backend/sql/maintenance/add_rwa_tokens_display_image_back_url.sql
psql "$DATABASE_URL" -f backend/sql/maintenance/add_bulk_mint_slab_display_image_back_url.sql
```

**Backfill** existing tokens without `display_image_url`:

```bash
curl -X POST \
  -H "Cookie: marketplace_admin=..." \
  -H "x-tokenable-chain-id: 84532" \
  -H "Content-Type: application/json" \
  -d '{"limit": 100, "dryRun": false}' \
  "http://localhost:4100/api/marketplace/admin/rwa-slab/backfill-display-images"
```

Skips rows with no cert, no `token_uri`, no HTTPS image in metadata (`certImageSourceUrl` / Cardhedger), or when S3 ingest fails. Re-run safely — only rows with `display_image_url IS NULL` are scanned.

### Public URL shape

Persisted `coverImageUrl` must be:

```
{CATALOG_COVER_PUBLIC_BASE_URL}/{prefix}{collectionKey}/cover
```

If a row is missing the trailing `/cover`, list/display APIs append it. Markets / collection UI may load covers via:

```
GET /api/marketplace/catalog-covers/asset?src=<urlencoded cover URL>
```

so TextureLoader / canvas reads work even when the S3 bucket has **no CORS** rules (browser `<img>` works without CORS; canvas/WebGL does not).

The **home hero** 3D ring uses static files under `frontend/public/assets/home/landing_*.jpg` — not catalog S3 covers.

### Optional: S3 bucket CORS

Not required for marketplace list/detail `<img>` tags. If you want direct browser→S3 canvas reads later, add a bucket CORS rule allowing `GET` from your frontend origins.

---

## Phase 0 — Bucket setup

1. Create an S3 bucket (example name: `tokenable-catalog-covers`) in a fixed region.
2. Prefer **CloudFront** in front of the bucket for public HTTPS reads. Alternatively allow public read on a fixed prefix only.
3. IAM user/role for the Nest backend with at least:
   - `s3:PutObject`
   - `s3:DeleteObject` (legacy uuid-key cleanup only)
   - scoped to `arn:aws:s3:::YOUR_BUCKET/covers/*` (and `dev/covers/*` if using a dev prefix)
   - User avatars write under `{prefix}user-avatars/*`, so the same `covers/*` / `dev/covers/*` scope covers them. A sibling `avatars/` prefix needs an extra IAM statement.
4. Smoke test: manually upload one object in the AWS console, then open  
   `{CATALOG_COVER_PUBLIC_BASE_URL}/{key}` in a browser.

### Backend env

| Variable | Example | Purpose |
|----------|---------|---------|
| `AWS_REGION` | `ap-northeast-2` | S3 region |
| `AWS_ACCESS_KEY_ID` | … | Optional if instance role is used |
| `AWS_SECRET_ACCESS_KEY` | … | Optional if instance role is used |
| `CATALOG_COVER_S3_BUCKET` | `tokenable-catalog-covers` | Bucket name |
| `CATALOG_COVER_S3_PREFIX` | `dev/covers/` or `covers/` | Key prefix (include trailing `/`) |
| `CATALOG_COVER_PUBLIC_BASE_URL` | `https://dxxxxx.cloudfront.net` | No trailing slash — used to build `coverImageUrl` |

Add the CloudFront / S3 host to Next `images.remotePatterns` if you use `next/image` (S3/`*.amazonaws.com` and `*.cloudfront.net` are already allowed).

---

## Admin replace flow

1. Open `/marketplace/admin/collections`.
2. Expand **Cover image** on a collection.
3. Choose a local file → **Upload to S3 & save** — overwrites `{prefix}{key}/cover`.
4. Or paste an external HTTPS URL → **Save cover URL** — downloads the URL and overwrites the same S3 object (when S3 is configured), then stores the S3 public URL.
5. **Fetch & save** from token metadata uses the same ingest path when saving.

API:

- `POST /api/marketplace/collections/:key/admin/cover/upload` — multipart field `file` → overwrite S3 → persist public URL
- `POST /api/marketplace/collections/:key/admin/cover` — JSON `{ coverImageUrl }` → ingest to S3 (if external) → persist
- `POST /api/marketplace/collections/:key/admin/cover/from-token` — preview / save via metadata resolve

### curl example

```bash
# After admin login cookie is set in the browser, copy Cookie header:
curl -X POST \
  -H "Cookie: marketplace_admin=..." \
  -F "file=@/path/to/card.jpg" \
  "http://localhost:4100/api/marketplace/collections/YOUR_COLLECTION_KEY/admin/cover/upload"
```

---

## Out of scope

- RWA `POST /api/rwa/upload` (Pinata)
- Scraping Collectr / Sports Card Investor into S3
