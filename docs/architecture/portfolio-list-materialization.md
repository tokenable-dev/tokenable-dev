# Portfolio list materialization

**Status:** Complete — Phase 0–7 shipped.  
**Goal:** My Assets paints from PostgreSQL under multi-user load. IPFS / RPC / Cardhedger are never on the portfolio request hot path; they run only in bounded background heal / ops backfill / daily snapshot.

## List-ready row

A `rwa_tokens` row is **list-ready** when all of these are non-empty:

| Column | Role |
|--------|------|
| `cert_number` | Identity + tile subtitle |
| `display_name` | Tile title (Line 1 source) |
| `display_image_url` | Trusted HTTPS slab (platform S3 or approved CDN) |
| `owner_wallet` | Portfolio ownership |

Optional for pricing bucket (filled at mint when known, else first ask / backfill):

| Column | Role |
|--------|------|
| `collection_key` | Snapshot price join |
| `display_image_back_url` | Detail / redeem |
| `settlement_policy` | Vault label |
| `token_uri` | Detail / graded JSON (not required for list shells) |

**Stub** (transfer index): may have only `owner_wallet` + `token_id`. Not list-ready — heal asynchronously; do not block portfolio bootstrap.

## Scale rule (500+ concurrent portfolio opens)

| Path | Allowed sources |
|------|-----------------|
| `POST …/portfolio/assets-page` metadata | **PostgreSQL only** (`allowExternal: false`) |
| Background list heal queue | Shared process-wide queue (max 400, concurrency 2) — IPFS/RPC |
| Admin / cron list-ready backfill | Bounded batches (≤200) — IPFS/RPC/S3 |
| Daily portfolio snapshot cron | May use IPFS (`allowExternal: true`) + Cardhedger mint-preview |
| List mark USD | `collection_market_snapshots` join by `collection_key`; mint-preview only for tokens the snapshot cannot price |

Do **not** call upstream APIs once per user request for asset lists. That fans out with concurrency and will fail under load.

## Writers

| Action | Writer | Must set |
|--------|--------|----------|
| `POST /rwa/upload` + `POST /rwa/mint` | upload `collectionKey` → `recordMintResult` | name, images, cert, owner, settlement, collection_key when known |
| Admin / partner bulk mint | same | same |
| Seaport fulfill / match | `OrdersService` → `recordOwner` + `seedMarketplaceBuyCostBasis` | **immediate** `owner_wallet` + holdings; Transfer poll is heal only |
| Transfer index poll | `RwaTransferIndexListenerService` | `owner_wallet` heal / external transfers |
| Ask list / cancel | `orders` table | Listed badge = active ASK join (no denormalized list price on `rwa_tokens`) |
| Redeem custody confirm | `RwaRedeemService` → `recordOwner(custody)` | **immediate** drop from My Assets; Transfer poll is heal |
| Redeem pay | cancel ACTIVE `orders` for tokenIds | Listed badge clears (FE already blocks listed redeem) |
| Admin deliver / NFT return | `RwaChainWriterService.safeTransferFromCustody` → `recordOwner` | Already immediate |
| Redeem burn | vault redeem | `burned_at` + `owner_wallet` null |
| Ops backfill | `POST …/admin/rwa-slab/backfill-list-ready` + optional cron | fills gaps on legacy rows |

## Readers

| Path | Rule |
|------|------|
| `ownedIdsOnly` | DB owner index only |
| `batchPortfolioMetadata` (assets-page) | DB stubs only; enqueue `needsHeal`; stub may parse PSA grade from `display_name` |
| Listed badge | Active `orders` ASK for tokenId |
| List mark USD | Snapshot series first; mint-preview only when snapshot cannot price that token |
| Detail / certificate | May resolve full graded JSON from `token_uri` |

## Phase status

| Phase | Scope | Status |
|-------|--------|--------|
| 0 | Field contract | Done |
| 1 | Mint writes display_* ; list-ready skips IPFS | Done |
| 2 | Mint-time `collection_key` + bulk titles + metaSource | Done |
| 3 | Legacy backfill + portfolio DB-only hot path + bounded heal | Done |
| 4 | Buy/transfer immediate `owner_wallet` + FE portfolio cache clear | Done |
| 5 | Redeem / burn / re-vault polish | Done |
| 6 | List prices snapshot-first; reduce `$0`/blank flicker; mint-preview only when needed | Done |
| 7 | Guards + docs checklist | Done |

## Ops

1. Apply `backend/sql/maintenance/add_bulk_mint_display_name_collection_key.sql` if using partner bulk mint.
2. Dry-run then run list-ready backfill:

```bash
curl -X POST "$API/marketplace/admin/rwa-slab/backfill-list-ready" \
  -H "Cookie: marketplace_admin_session=…" \
  -H "x-tokenable-chain-id: 84532" \
  -H "Content-Type: application/json" \
  -d '{"limit": 100, "dryRun": true}'
```

3. Production cron (optional): `RWA_LIST_READY_BACKFILL_ENABLED=1` — every 5 minutes, batch 40.

## Success checks / smoke checklist

1. New mint → list-ready (+ collection_key when graded meta allows) before portfolio open.
2. Cold My Assets: `metaSource.ipfs` / `onChain` stay 0 on assets-page; `needsHeal` may be >0 while background catch-up runs.
3. Incomplete rows still return shells (no 500 / no request hang on IPFS).
4. Concurrent portfolio opens do not multiply IPFS calls (shared heal queue).
5. After Seaport buy/accept-offer: buyer appears in My Assets without waiting for Transfer poll; listed badge follows orders cancel/fulfill.
6. After redeem custody confirm: token leaves My Assets immediately (`owner_wallet` → custody); burn clears ownership; re-vault mint is list-ready; FE clears portfolio caches on redeem/burn.
7. Snapshot-priced tiles show USD while siblings still await mint-preview (no global blank). Hero avoids `$0` when no marks yet (`—` / skeleton).
8. Manual smoke: mint → cold portfolio → buy → redeem custody → burn (ownership + listed badge + caches).
