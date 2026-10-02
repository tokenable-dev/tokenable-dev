# RWA display images (mint → token → collection)

**Status:** Canonical mental model for image URLs.  
**Related:** [`portfolio-list-materialization.md`](./portfolio-list-materialization.md), [`vault-lifecycle.md`](./vault-lifecycle.md), [`catalog-cover-s3.md`](../guides/catalog-cover-s3.md).

Complexity here is **domain complexity**, not accidental layering: a PSA slab photo, a Cardhedger catalog scan, and a collection marketing cover serve different UIs. Do not collapse them into one URL.

## Three layers (do not merge)

| Layer | What users see | SSOT | Typical URL shape |
|-------|----------------|------|-------------------|
| **A. Mint input** | Vault OCR preview, `POST /rwa/upload` body | User `File` → else PSA CloudFront → else Cardhedger `card.image` → else placeholder | Ephemeral / remote HTTPS |
| **B. Token slab** | Portfolio My Assets, certificate, admin All cards (per token) | `rwa_tokens.display_image_url` (+ optional `display_image_back_url`); on-chain `metadata.image` (IPFS) for provenance | `…/rwa-slabs/{chainId}/{cert}/slab` |
| **C. Collection cover** | Home / marketplace collection cards, collection detail hero | `marketplace_collections.cover_image_url` (+ Cardhedger sync) | `…/covers/{collection_key}/cover` |

Layer **B** and **C** are intentionally different images: B shows the vaulted slab (often with cert label); C shows catalog art without slab chrome.

## Mint pipeline (layer A → B)

1. **Frontend** — `frontend/lib/vault/mintImageSource.ts`  
   `resolveSelfVaultMintImageSelection`: **multipart File beats** PSA/Cardhedger for preview and upload intent.

2. **Backend** — `backend/src/rwa/rwa-mint-image.util.ts`  
   `resolveRemoteMintImageUrl`: PSA slab → user URL → Cardhedger (when no file).  
   Keep behavior aligned with the frontend module (comments cross-link both files).

3. **`POST /rwa/upload`** — `backend/src/rwa/rwa.service.ts`  
   - Pins `metadata.image` to IPFS.  
   - Sets `properties.mintImageSource`.  
   - Best-effort copies bytes to S3 (`RwaSlabS3Service.ingestMintSlabBestEffort`) → `display_image_url`.

4. **`buildMintMetadata` (frontend)** may embed `graded.cardhedger.imageUrl` for **collection cover ranking** after verified Cardhedger match. That does **not** replace the uploaded NFT `image` when a file is sent.

## Read pipeline (layer B vs C)

| Consumer | Resolver | Rule |
|----------|----------|------|
| Portfolio list / BFF | `RwaAssetResolveService.batchPortfolioMetadata` | `display_image_url` first; metadata/IPFS for title/cert heal only |
| Certificate / detail | `getResolvedRwaAsset` | Same override priority |
| Metadata JSON image ref | `pickRwaAssetDisplayImageRef` in `collection-image.util.ts` | Slab-friendly order (PSA HTTPS → pinned mint image → Cardhedger) |
| Collection UI | `pickCollectionDisplayImageUrl` (FE) / `cover_image_url` (BE) | **Rejects** `/rwa-slabs/` and PSA CloudFront cert URLs |
| Trending / components | `pickTrendingSlabImageRef` | Slab-first for bucket previews |

## Cert-scoped S3 slab key (important)

Object key: `{prefix}rwa-slabs/{chainId}/{certNumber}/slab` (see `stableRwaSlabObjectKey`).

Re-minting the **same cert** overwrites the same public URL. S3 `Cache-Control` allows day-long browser caching, so clients can show a stale slab after remint unless the URL is busted.

**Mitigation:** `withRwaSlabDisplayCacheBust` appends `?v={unix}` from `rwa_tokens.updated_at` when resolving `display_image_url` in `RwaAssetResolveService`.

## Code map (single place per concern)

| Concern | Module |
|---------|--------|
| Cardhedger URL hygiene + remote mint priority | `rwa-mint-image.util.ts` (+ FE `mintImageSource.ts`) |
| Metadata → display ref / cover scoring | `marketplace/utils/collection-image.util.ts` |
| Portfolio / admin resolve + drift heal | `blockchain/rwa-asset-resolve.service.ts` |
| S3 slab upload | `rwa/rwa-slab-s3.service.ts` |
| Backfill missing `display_image_url` | `rwa/rwa-slab-backfill.service.ts` (uses `pickRwaAssetHttpsSlabIngestUrl`) |
| Collection hero (FE) | `frontend/lib/marketplace/collectionDisplayImage.ts` |

## What we deliberately did **not** do

- **No shared `packages/`** for FE+BE mint rules — cost of a monorepo package outweighs benefit for a small team; mirror modules stay linked via this doc and tests.
- **No single mega-resolver** for portfolio + collection + mint — different SLAs (DB-only list vs IPFS detail vs catalog cover).
- **Do not** use collection cover URLs for token tiles or vice versa.

## Checklist when changing images

1. Which layer (A / B / C)?  
2. If B: does mint set `display_image_url` and `mintImageSource`?  
3. If remint same cert: expect S3 overwrite + cache bust on `updated_at`.  
4. Portfolio hot path must stay DB-first (`portfolio-list-materialization.md`).
