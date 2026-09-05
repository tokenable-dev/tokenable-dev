# Marketplace Admin Console

The **marketplace admin** is an internal backoffice for operating Tokenable: platform KPIs, user support, collection/RWA maintenance, Cardhedger price sync, and market-data previews. It is **separate from end-user JWT auth** — operators sign in with a dedicated admin username/password and an HTTP-only session cookie.

**URL (local):** `http://localhost:3000/marketplace/admin`  
**Swagger:** routes tagged `marketplace-admin` and `admin` under `http://localhost:4100/api/docs`

---

## Responsibilities by page

Admin routes are split by **operational role**, not duplicated dashboards.

| Route | Nav label | Purpose |
|-------|-----------|---------|
| `/marketplace/admin` | **Overview** | Platform health from PostgreSQL — KPIs, funnel, users, orders, activity charts, AI pricing coverage, recent sales, Cardhedger infra snippet, **GA4 external link** |
| `/marketplace/admin/data-inventory` | **데이터 인벤토리** | Schema map (PK/UK/FK + logical joins) at the top, then all `public` tables — row counts, how each table is written, paginated raw row browser |
| `/marketplace/admin/users` | **유저** | Korean table: KYC/상태/역할 filters · row → `/users/:uuid` detail · partner approve modal · strike/restrict/suspend UI stub |
| `/marketplace/admin/users/[id]` | **유저 상세** | Profile actions, partner approve/revoke, legacy KYC/wallet tools below |
| `/marketplace/admin/collections` | **Collections** | Collection review queue — Pending / Active / Rejected filters; cover (URL or S3), prices, sparkline, Cardhedger check, Approve/Reject |
| `/marketplace/admin/cards` | **All cards** | RWA token registry — edit display metadata, register missing slab front/back to S3, burn (test) |
| `/marketplace/admin/custody-nfts` | **Custody NFTs** | Deliver vaulted NFTs to user wallets |
| `/marketplace/admin/self-vault-payouts` | **Self-vault payouts** | One row per sale (`order_hash`); resales before auto-pay show as Sale N of M. Pay early (~95% USDC) or wait ~5 min; reject to skip |
| `/marketplace/admin/partners` | **Partners** | Company display name + wallet for Self vault; optional encrypted PK for consignment mint & list |
| `/marketplace/admin/bulk-mint` | **Partner bulk mint** | Excel cert+price → PSA prepare → mint to company wallet + Seaport list (Listed/Sold). Any admin session for now |
| `/marketplace/admin/markets` | **Markets preview** | Tabbed: **Home landing** (90d top movers + just vaulted), **Top 100**, **Cardhedger movers** |
| `/marketplace/admin/portfolio` | **Portfolio ops** | Daily snapshots, `portfolio_holdings` cost basis stats, operator checklist |
| `/marketplace/admin/price-webhooks` | **Price sync** | Cardhedger delta import — cron flags, manual “Run price sync”, sync history |
| `/marketplace/admin/contract-roles` | **Contract roles** | TokenableRWA AccessControl grant/revoke |
| `/marketplace/admin/vault/psa-mail` | **PSA mail** | Items Received Gmail queue — confirm → At PSA |
| `/marketplace/admin/vault/mint-queue` | **Mint queue** | At PSA cards — mint & deliver NFT to depositor (Live) |
| `/marketplace/admin/vault/submissions` | **Submissions** | Sell-flow packages (ready-to-ship → PSA → mint) — mark arrived, approve/reject; legacy draft tile only if any remain |
| `/marketplace/admin/vault` | **Vault / PSA** | Mint-only PSA tools (`analyze-by-cert`, slab OCR). Raw Public API proxies disabled |

Legacy redirects: `/marketplace/admin/analytics` → Overview; `/top100` and `/top-movers` → `/markets?tab=…`.

Nested admin route: `/marketplace/admin/top100/card/[cardId]` — Top 100 card detail (admin routing).

---

## Authentication

### Flow

1. Browser loads any `/marketplace/admin/*` route.
2. `MarketplaceAdminGate` calls `GET /api/marketplace/admin/auth/session`.
3. If unauthenticated → `MarketplaceAdminLoginForm`.
4. On submit → `POST /api/marketplace/admin/auth/login` → sets cookie `marketplace_admin` (HTTP-only, `SameSite=Lax`).
5. Subsequent API calls send the cookie via `backendFetch` (same-origin `/api` proxy).

Sign out: `POST /api/marketplace/admin/auth/logout`.

### Backend guard

Protected handlers call `MarketplaceAdminService.assertAdminSession(req)`. There is **no shared Nest `AdminGuard`** yet — the assert pattern is used consistently across admin controllers.

### Environment (backend)

| Variable | Default (dev) | Description |
|----------|---------------|-------------|
| `MARKETPLACE_ADMIN_USERNAME` | `skyand` | Admin login ID |
| `MARKETPLACE_ADMIN_PASSWORD` | `071725` | Admin login password |
| `MARKETPLACE_ADMIN_SESSION_SECRET` | falls back to `SITE_ACCESS_SECRET` | HMAC secret for session token |
| `MARKETPLACE_ADMIN_SESSION_SECONDS` | `28800` (8h) | Cookie max-age |

**Production:** set strong username, password, and a dedicated `MARKETPLACE_ADMIN_SESSION_SECRET`. Credentials are also bootstrapped into the `marketplace_admins` table on first login if missing (`MarketplaceAdminBootstrapService`).

### Distinction from user auth

| | End users | Admin |
|---|-----------|-------|
| Cookie | JWT session (`auth` module) | `marketplace_admin` |
| Login | Privy (`POST /api/auth/privy/session`) | Username/password only |
| API prefix | `/api/auth/*`, `/api/marketplace/watchlist`, … | `/api/marketplace/admin/*`, `/api/admin/cardhedger/*`, selected `collections` admin POSTs |

---

## Frontend architecture

Pattern: **Page → Component → Hook → API** (same as the rest of the frontend).

```
app/marketplace/admin/
  layout.tsx              → MarketplaceAdminGate (session + shell)
  page.tsx                → MarketplaceAdminOverviewPage
  analytics/page.tsx      → MarketplaceAdminAnalyticsPage
  users/page.tsx          → MarketplaceAdminUsersPage
  users/[id]/page.tsx     → MarketplaceAdminUserDetailPage
  …

components/marketplace/admin/
  MarketplaceAdminShell.tsx       → 240px paper sidebar + main (from `admin/` HTML)
  MarketplaceAdminGate.tsx        → Login gate + shell wrapper
  MarketplaceAdminNav.tsx         → Sidebar nav items (icons + active tint)
  MarketplaceAdminPageHeader.tsx  → Page title + subtitle (flush to main header)
  MarketplaceAdmin*Page.tsx       → One page component per route
  adminUi.ts                      → Shared tokens (cards, buttons, tables)
  styles/tokenable-admin.css      → Admin chrome only — not marketplace tk-*
  AdminAnalyticsWidgets.tsx       → KPI tiles, mini charts, funnel bars
  …

hooks/marketplace-admin/
  useMarketplaceAdminSession.ts
  useMarketplaceAdminAnalytics.ts
  useMarketplaceAdminUsers.ts
  useMarketplaceAdminCollections.ts
  useMarketplaceAdminCards.ts
  useCardhedgerPriceInfraAdmin.ts
  …

lib/core/api/
  marketplace-admin-auth.ts
  marketplace-admin-analytics.ts
  marketplace-admin-users.ts
  marketplace-admin-rwa.ts
  marketplace-admin-cardhedger.ts
```

### Layout shell

`MarketplaceAdminShell` provides a **light backoffice** UI:

- **Desktop:** fixed left sidebar (256px), white top bar, gray page background (`zinc-100`), white content cards.
- **Mobile:** hamburger opens slide-over sidebar; tables scroll horizontally; toolbars stack vertically.
- **Network switcher (top bar):** Sepolia / Ethereum / Polygon. Admin RWA routes (`/cards`, `/custody-nfts`, `/contract-roles`, analytics) send `x-tokenable-chain-id` and scope lists to that chain's registry + custody wallet. Switching networks does not require the public "internal dev" email allowlist.

Pages render only their **content** inside the shell — they do not mount their own nav.

### React Query keys

Admin analytics uses `rq.adminAnalytics(days)` and `rq.adminGa4Analytics(days)` in `frontend/lib/core/queryKeys.ts`. Other admin hooks use scoped keys under `["admin", …]`.

---

## Backend architecture

**Nest module:** `backend/src/marketplace/admin/marketplace-admin.module.ts`

| Provider / controller | Role |
|----------------------|------|
| `MarketplaceAdminAuthController` | Session, login, logout |
| `MarketplaceAdminService` | Credential verify, `assertAdminSession`, session username |
| `UserAdminController` + `UserAdminService` | Platform user CRUD & support actions |
| `PlatformAnalyticsController` + `PlatformAnalyticsService` | PostgreSQL KPI dashboard |
| `Ga4AnalyticsService` | GA4 Data API (optional; not used by UI today) |

**Related controllers** (same admin cookie, different modules):

| Controller | Base path |
|------------|-----------|
| `RwaTokenAdminController` | `GET/PATCH/POST /api/marketplace/admin/rwa-tokens/*` |
| `CollectionsController` (admin actions) | `POST /api/marketplace/collections/:key/admin/*` |
| `CardhedgerPriceSubscriptionAdminController` | `/api/admin/cardhedger/price-subscriptions/*` |
| `CardhedgerAdminController` | `/api/admin/cardhedger/health`, `circuit`, `metrics`, `prometheus` |

`MarketplaceAdminService` is **exported** from `MarketplaceAdminModule` so Cardhedger and collections modules can reuse session checks without duplicating auth logic.

---

## API reference (admin UI)

All paths are prefixed with `/api` when called from the browser.

### Auth

| Method | Path |
|--------|------|
| `GET` | `/marketplace/admin/auth/session` |
| `POST` | `/marketplace/admin/auth/login` |
| `POST` | `/marketplace/admin/auth/logout` |

### Platform analytics (Overview)

| Method | Path | Query |
|--------|------|-------|
| `GET` | `/marketplace/admin/analytics` | `days=7\|30\|90` |

Returns: `overview` (users, orders, mints, collections, funnel, watchlist, portfolio), `timeseries`, `ordersBreakdown`, `topCollections`, `recentTrades`, `generatedAt`.

Implemented in `PlatformAnalyticsService` (PostgreSQL aggregates). Independent of GA4.

### GA4 analytics (backend ready, UI deferred)

| Method | Path | Query |
|--------|------|-------|
| `GET` | `/marketplace/admin/analytics/ga4` | `days=7\|30\|90` |

Requires `GA4_PROPERTY_ID` + service account JSON. `Ga4AnalyticsService` supports overview, top pages/events/countries/devices, timeseries, realtime (with in-memory report cache). **The admin UI currently links to GA4 console instead** — see [Analytics (GA4)](analytics.md).

### Users

Korean list UI (`전체 유저` / `플래그·제한` stub). Filters: KYC, account status (restricted/suspended empty until schema exists), role (partner vs individual via wallet ∩ `marketplace_partners`). Row navigates to `/marketplace/admin/users/:id` (UUID). Detail: **파트너 승인** modal (`displayName` + wallet → `POST /partners`) or **파트너 해제** (`PATCH isActive: false`); strike / 계정 제한 / 판매 정지 buttons alert “준비 중”. Legacy KYC/wallet/delete tools remain on the detail page footer. Display short id `U-` + first 5 hex of UUID is cosmetic only.

| Method | Path |
|--------|------|
| `GET` | `/marketplace/admin/users/stats` |
| `GET` | `/marketplace/admin/users?q=&filter=&role=&accountStatus=&page=` |
| `GET` | `/marketplace/admin/users/:id` |
| `PATCH` | `/marketplace/admin/users/:id` |
| `DELETE` | `/marketplace/admin/users/:id` |
| `POST` | `/marketplace/admin/users/:id/force-verify-email` |
| `POST` | `/marketplace/admin/users/:id/wallets` |
| `DELETE` | `/marketplace/admin/users/:id/wallets/:address` |
| `DELETE` | `/marketplace/admin/users/:id/watchlist/:collectionKey` |

List/detail enrichment: `role`, `partner`, `custodyCardCount` (minted vault cycles), `accountStatus`/`strikeCount` placeholders.

### RWA cards

| Method | Path |
|--------|------|
| `GET` | `/marketplace/admin/rwa-tokens/cards` |
| `PATCH` | `/marketplace/admin/rwa-tokens/:tokenId` |
| `POST` | `/marketplace/admin/rwa-tokens/:tokenId/preview-metadata-image` |

### Collections (admin)

| Method | Path |
|--------|------|
| `GET` | `/marketplace/collections?reviewStatus=pending_review\|active\|rejected\|all` (admin cookie) |
| `GET` | `/marketplace/collections/admin/review-counts` |
| `POST` | `/marketplace/collections/admin/create-from-cert` body `{ certNumber }` — catalog create without mint |
| `POST` | `/marketplace/collections/:key/admin/review` body `{ reviewStatus }` |
| `POST` | `/marketplace/collections/:key/admin/cover` |
| `POST` | `/marketplace/collections/:key/admin/cover/upload` |
| `POST` | `/marketplace/collections/:key/admin/cover/from-token` |
| `POST` | `/marketplace/collections/:key/admin/delete` | Removes the marketplace bucket, snapshots, and orders. **Does not delete `rwa_tokens`** — those rows are the NFT registry + portfolio owner index. `collection_key` is set to null. |

Public `GET /marketplace/collections` always returns **`active`** only.  
Cover upload **overwrites** the collection’s stable S3 object and writes that public URL to `coverImageUrl`. New collections ingest Cardhedger images to S3 on create. See [catalog-cover-s3.md](catalog-cover-s3.md).  
Review flow: [business-rules.md](../business-rules.md) BR-11b.

### Price sync (Cardhedger)

| Method | Path |
|--------|------|
| `GET` | `/admin/cardhedger/price-subscriptions/status` |
| `POST` | `/admin/cardhedger/price-subscriptions/run-delta-import` |
| `GET` | `/admin/cardhedger/price-subscriptions` |
| `POST` | `/admin/cardhedger/price-subscriptions/sync` |
| `POST` | `/admin/cardhedger/price-subscriptions/:collectionKey/subscribe` |
| `DELETE` | `/admin/cardhedger/price-subscriptions/:collectionKey` |

See also [materialized-market-snapshots.md](../architecture/materialized-market-snapshots.md) for how delta runs refresh `collection_market_snapshots`.

---

## Overview page sections

| Section | Data source |
|---------|-------------|
| North star | Total sales, GMV, listings, mints, collections, users |
| Traffic summary | External link → [GA4 console](https://analytics.google.com/) (property `540208626`) |
| Conversion funnel | Signup→wallet, mint→list, list→sale |
| Users / Engagement & vault | User breakdown, watchlist, portfolio snapshots |
| AI pricing coverage | Collections with Cardhedger data |
| Supply / Orders | Mint and order liquidity stats |
| Activity charts | Daily signups, mints, listings, sales, GMV |
| Orders breakdown | Side × status counts |
| Top collections | By listings, sales, GMV, watchlist |
| Recent platform sales | Latest fulfilled trades |
| Price sync snippet | Cardhedger mode, subscriptions, cron (from price infra API) |

Period selector: **7 / 30 / 90 days** — refetches `GET /marketplace/admin/analytics`. Client caches ~5 minutes (no background poll); Refresh button forces a refetch. Backend keeps a 60s in-memory TTL per `chainId`+`days`.

---

## Local development

1. Start **backend** (`pnpm start:dev` in `backend/`, port **4100**) and **frontend** (`pnpm dev`, port **3000**).
2. Open `http://localhost:3000/marketplace/admin`.
3. Sign in with dev defaults (`skyand` / `071725`) unless env overrides are set.

If login returns **502 / API proxy failed**, the Nest process is usually down or crashed — see [troubleshooting.md](troubleshooting.md).

---

## Extending the admin

1. **New page:** Add `app/marketplace/admin/<segment>/page.tsx` → page component in `components/marketplace/admin/` → hook in `hooks/marketplace-admin/` → API client in `lib/core/api/`.
2. **New nav item:** Add entry (including `icon`) to `ADMIN_NAV_SECTIONS` in `components/marketplace/admin/nav/adminNavConfig.ts`.
3. **New API:** Prefer `MarketplaceAdminModule` or an existing module that imports `MarketplaceAdminService`; call `assertAdminSession(req)` on each handler.
4. **UI tokens:** Reuse `adminUi.ts` for cards/buttons/tables. Shell/sidebar chrome lives in `frontend/styles/tokenable-admin.css` (from `admin/` HTML) — not marketplace `tk-*`.

Avoid merging GA4 logic into `PlatformAnalyticsService` — keep PostgreSQL platform metrics and GA4 traffic as separate services/endpoints.

---

## Related docs

- [Frontend routes](../frontend/routes.md) — full route table
- [Frontend structure](../architecture/frontend.md) — feature folder map
- [Marketplace API](../api/marketplace.md) — public + admin collection/RWA endpoints
- [Analytics (GA4)](analytics.md) — measurement ID, Data API setup, admin traffic link
- [Materialized market snapshots](../architecture/materialized-market-snapshots.md) — price sync context
