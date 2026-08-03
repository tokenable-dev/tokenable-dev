# Frontend Routes Reference

**Framework:** Next.js 16, App Router  
**Source:** `frontend/app/`

All routes are file-system based. Dynamic segments use `[param]` notation.

Legacy **`/exchange`** redirects to **`/markets`** via `next.config.ts`.

---

## Route Table

| Route | Source File | Purpose |
|-------|------------|---------|
| `/` | `app/page.tsx` | Landing — Market Indexes (Card Ladder) + hero |
| `/markets` | `app/markets/page.tsx` | **Markets** — collection list, batch snapshots, category filter, trending |
| `/markets/top100` | *(section on Markets page or linked)* | Top 100 sales rank strip (feature-flagged) |
| `/markets/top100/card/[cardId]` | `app/markets/top100/card/[cardId]/page.tsx` | Top 100 card detail |
| `/vault` | `app/vault/page.tsx` | **Sell hub** — landing / empty dashboard / in-progress shipment |
| `/sell` | `app/sell/page.tsx` | Sell router → collector hub (`/vault`) |
| `/sell/flow` | `app/sell/flow/page.tsx` | Become a seller → choose vault → add cards (PSA → ship, or self → custody mint) |
| `/sell/shipping` | `app/sell/shipping/page.tsx` | Pack & tracking (PSA Shipping) |
| `/vault/submit` | `app/vault/submit/page.tsx` | Personal mint — PSA → IPFS → on-chain mint |
| `/vault/submit/mint` | `app/vault/submit/mint/page.tsx` | Mint entry alias |
| `/vault/submissions/[id]` | `app/vault/submissions/[id]/page.tsx` | Submission detail (Vault-Detail A~H; `?scenario=` / `?demo=1`) |
| `/portfolio` | `app/portfolio/page.tsx` | Owned assets — daily value chart, hide holdings, token list |
| `/watchlist` | `app/watchlist/page.tsx` | Saved collections — filter bar, HTML-style cards, JWT |
| `/profile` | `app/profile/page.tsx` | User profile — wallets, email verification, password change |
| `/login` | `app/login/page.tsx` | Sign in — Privy modal launcher (Google, email, wallet) |
| `/signup` | `app/signup/page.tsx` | Sign up — Privy modal launcher |
| `/site-access` | `app/site-access/page.tsx` | Staging site-access password gate |
| `/site-access/verify` | `app/site-access/verify/route.ts` | Route handler for gate cookie (if used) |
| `/marketplace/[tokenId]` | `app/marketplace/[tokenId]/page.tsx` | Token detail — slab panel, buy/sell, price compare |
| `/marketplace/collections/[collectionKey]` | `app/marketplace/collections/[collectionKey]/page.tsx` | Collection — order book, dual chart, AI insight, listings |
| `/marketplace/other-listings` | `app/marketplace/other-listings/page.tsx` | Listings not matched to a known collection |
| `/marketplace/admin` | `app/marketplace/admin/page.tsx` | Admin — **Overview** (platform KPIs, funnel, ops metrics) |
| `/marketplace/admin/users` | `app/marketplace/admin/users/page.tsx` | Admin — user support & lifecycle |
| `/marketplace/admin/collections` | `app/marketplace/admin/collections/page.tsx` | Admin — collection cover/delete, AI insight preview |
| `/marketplace/admin/cards` | `app/marketplace/admin/cards/page.tsx` | Admin — RWA token listings/metadata |
| `/marketplace/admin/custody-nfts` | `app/marketplace/admin/custody-nfts/page.tsx` | Admin — custody delivery queue |
| `/marketplace/admin/markets` | `app/marketplace/admin/markets/page.tsx` | Admin — home landing + Top 100 + Cardhedger movers |
| `/marketplace/admin/portfolio` | `app/marketplace/admin/portfolio/page.tsx` | Admin — portfolio snapshots & cost basis ops |
| `/marketplace/admin/top100/card/[cardId]` | `app/marketplace/admin/top100/card/[cardId]/page.tsx` | Admin — Top 100 card detail |
| `/marketplace/admin/price-webhooks` | `app/marketplace/admin/price-webhooks/page.tsx` | Admin — Cardhedger price sync (delta import) |
| `/marketplace/admin/contract-roles` | `app/marketplace/admin/contract-roles/page.tsx` | Admin — on-chain roles |
| `/marketplace/admin/vault` | `app/marketplace/admin/vault/page.tsx` | Admin — PSA / vault tooling |
| `/marketplace/admin/vault/psa-mail` | `app/marketplace/admin/vault/psa-mail/page.tsx` | Admin — PSA Items Received mail inbox |
| `/marketplace/admin/vault/submissions` | `app/marketplace/admin/vault/submissions/page.tsx` | Admin — sell-flow package ops |

Redirects: `analytics` → Overview; `top100` / `top-movers` → `markets?tab=…`.

---

## Layout Files

| File | Scope | Purpose |
|------|-------|---------|
| `app/layout.tsx` | Global | HTML shell, fonts, global providers wrapper |
| `app/providers.tsx` | Global | `PrivyAppProviders` → `PrivyProvider` → `QueryClient` → `WagmiProvider (@privy-io/wagmi)` → `WalletDataProvider` |
| `app/portfolio/layout.tsx` | `/portfolio` | Portfolio-scoped layout |
| `app/marketplace/[tokenId]/layout.tsx` | `/marketplace/[tokenId]` | Token-detail layout |
| `app/marketplace/collections/[collectionKey]/layout.tsx` | Collection detail | Collection layout |
| `app/marketplace/admin/layout.tsx` | `/marketplace/admin/*` | Admin gate + backoffice shell (`MarketplaceAdminGate`) |

---

## Key API Dependencies per Route

| Route | Primary API calls |
|-------|------------------|
| `/` | `GET /api/cardladder/indexes` |
| `/markets` | `GET /api/marketplace/collections`, `POST /api/marketplace/collections/market-snapshots` |
| `/markets/top100/*` | `GET /api/cardhedger/top100/*` |
| `/vault` | `POST /api/psa/analyze`, `POST /api/psa/analyze-by-cert`, `POST /api/rwa/upload`, `POST /api/marketplace/collections/on-mint` |
| `/portfolio` | `GET /api/blockchain/rwa/tokens/:address`, batch metadata, `POST …/portfolio-market-batch`, `GET …/portfolio/daily/:wallet`, `GET …/portfolio/hidden/:wallet`, orders |
| `/watchlist` | `GET/POST/DELETE /api/marketplace/watchlist` |
| `/login`, `/signup` | Privy SDK (client-side modal) → `POST /api/auth/privy/session` |
| `/profile` | `/api/auth/*` |
| `/site-access` | `POST /api/site-access/verify` |
| `/marketplace/[tokenId]` | `GET /api/blockchain/rwa/asset/:tokenId`, `GET /api/marketplace/orders/token/:tokenId` |
| `/marketplace/collections/[collectionKey]` | Collection detail, cardhedger, market-series, stats, ai-insight, Seaport orders |
| `/marketplace/admin/*` | `/api/marketplace/admin/auth/*`, `/api/marketplace/admin/analytics`, `/api/marketplace/admin/users/*`, `/api/marketplace/admin/rwa-tokens/*`, `/api/marketplace/collections/:key/admin/*`, `/api/admin/cardhedger/*` — see [marketplace-admin.md](../guides/marketplace-admin.md) |

---

## Collection Key

Collection keys are SHA-256 bucket hashes from normalized graded metadata.

```
collectionKey = SHA256(normalize(cardName, cardSet, cardNumber, gradingCompany, gradeScore, …))
```

**When the row is created**

| Trigger | What runs |
|---------|-----------|
| **Mint confirmed** (`POST /api/marketplace/collections/on-mint`) | `ensureCollectionForListing` → `marketplace_collections` + `rwa_tokens`, snapshot enqueue |
| **First ask** (`POST /api/marketplace/orders`, side `ask`) | Same `ensureCollectionForListing` if mint hook missed (idempotent) |
| **Platform trades read** (`GET …/platform-trades?bootstrapTokenId=`) | Ensures collection when key known but row missing |

See `backend/src/marketplace/utils/bucket-key.util.ts` and [database.md](../architecture/database.md).

---

## Header navigation

Primary nav (`HeaderNav.tsx`): **Markets** (`/markets`), **Portfolio**, **Vault**, **Watchlist** (when authenticated). Admin routes are not linked in the public header.
