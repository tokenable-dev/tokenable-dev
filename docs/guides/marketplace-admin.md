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
| `/marketplace/admin/analytics` | **Analytics** | Traffic — opens **Google Analytics** console (in-app GA4 Data API reports deferred) |
| `/marketplace/admin/users` | **Users** | Registered accounts — search, filters, verify/reset/password/wallet/watchlist actions |
| `/marketplace/admin/cards` | **Listed cards** | Active marketplace listings — edit display metadata, preview images, optional on-chain burn (test) |
| `/marketplace/admin/collections` | **Collections** | Collection buckets — cover image, delete, market snapshot strip, **AI Insight** preview |
| `/marketplace/admin/top100` | **Top 100** | Admin-only preview of daily Cardhedger Top 100 (public Markets UI may stay disabled) |
| `/marketplace/admin/top-movers` | **Top Movers** | Admin-only preview of Cardhedger top movers |
| `/marketplace/admin/price-webhooks` | **Price sync** | Cardhedger delta import — cron flags, manual “Run price sync”, sync history |

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
| Login | Google OAuth, email/password | Username/password only |
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
  …

components/marketplace/admin/
  MarketplaceAdminShell.tsx       → Sidebar + top bar (backoffice layout)
  MarketplaceAdminGate.tsx        → Login gate + shell wrapper
  MarketplaceAdminNav.tsx         → Sidebar nav items
  MarketplaceAdminPageHeader.tsx  → Page title + subtitle
  MarketplaceAdmin*Page.tsx       → One page component per route
  adminUi.ts                      → Shared tokens (cards, buttons, tables)
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

| Method | Path |
|--------|------|
| `GET` | `/marketplace/admin/users/stats` |
| `GET` | `/marketplace/admin/users?q=&filter=&page=` |
| `GET` | `/marketplace/admin/users/:id` |
| `PATCH` | `/marketplace/admin/users/:id` |
| `DELETE` | `/marketplace/admin/users/:id` |
| `POST` | `/marketplace/admin/users/:id/actions` — resend verification, password reset, force verify, link/unlink wallet, watchlist remove, set password |

### Listed RWA cards

| Method | Path |
|--------|------|
| `GET` | `/marketplace/admin/rwa-tokens/listings` |
| `PATCH` | `/marketplace/admin/rwa-tokens/:tokenId` |
| `POST` | `/marketplace/admin/rwa-tokens/:tokenId/preview-metadata-image` |

### Collections (admin)

| Method | Path |
|--------|------|
| `POST` | `/marketplace/collections/:key/admin/cover` |
| `POST` | `/marketplace/collections/:key/admin/cover/from-token` |
| `POST` | `/marketplace/collections/:key/admin/delete` |

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

Period selector: **7 / 30 / 90 days** — refetches `GET /marketplace/admin/analytics`.

---

## Local development

1. Start **backend** (`pnpm start:dev` in `backend/`, port **4100**) and **frontend** (`pnpm dev`, port **3000**).
2. Open `http://localhost:3000/marketplace/admin`.
3. Sign in with dev defaults (`skyand` / `071725`) unless env overrides are set.

If login returns **502 / API proxy failed**, the Nest process is usually down or crashed — see [troubleshooting.md](troubleshooting.md).

---

## Extending the admin

1. **New page:** Add `app/marketplace/admin/<segment>/page.tsx` → page component in `components/marketplace/admin/` → hook in `hooks/marketplace-admin/` → API client in `lib/core/api/`.
2. **New nav item:** Add entry to `NAV_ITEMS` in `MarketplaceAdminNav.tsx`.
3. **New API:** Prefer `MarketplaceAdminModule` or an existing module that imports `MarketplaceAdminService`; call `assertAdminSession(req)` on each handler.
4. **UI tokens:** Reuse `adminUi.ts` (`ADMIN_ARTICLE`, `ADMIN_BTN_PRIMARY`, `ADMIN_TABLE_WRAP`, …) for consistent backoffice styling.

Avoid merging GA4 logic into `PlatformAnalyticsService` — keep PostgreSQL platform metrics and GA4 traffic as separate services/endpoints.

---

## Related docs

- [Frontend routes](../frontend/routes.md) — full route table
- [Frontend structure](../architecture/frontend.md) — feature folder map
- [Marketplace API](../api/marketplace.md) — public + admin collection/RWA endpoints
- [Analytics (GA4)](analytics.md) — measurement ID, Data API setup, admin traffic link
- [Materialized market snapshots](../architecture/materialized-market-snapshots.md) — price sync context
