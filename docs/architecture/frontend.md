# Frontend Structure

**Source:** `frontend/`  
**Framework:** Next.js 16, React 19, App Router

## Feature layout

Marketplace UI is organized into **feature folders** with matching `hooks/` and `lib/marketplace/` modules. Each feature exports via a barrel `index.ts`.

| Area | Components | Hooks / lib |
|------|------------|-------------|
| Markets / exchange | `markets/`, `markets-ui/` | `hooks/markets/`, `lib/markets/` |
| Collection detail | `collection-detail/`, `collection-overview/`, `collection-hero/` | `hooks/collection-detail/`, `hooks/collection-overview/` |
| Charts & metrics | `collection-dual-price-chart/`, `price-metrics-strip/` | `hooks/collection-dual-price-chart/`, `hooks/price-metrics-strip/` |
| Order book | `unified-order-book/` | `hooks/unified-order-book/`, `lib/marketplace/unified-order-book/` |
| Trading | `collection-trading/`, `collection-criteria-bid/` | `hooks/collection-criteria-bid/`, `lib/marketplace/collection-trading/` |
| RWA detail | `rwa-detail/`, `rwa-detail-asset-panel/` | `hooks/rwa-detail/`, `lib/marketplace/rwa-detail/` |
| Listing flow | `list-rwa/` | `hooks/list-rwa/`, `lib/seaport/listing/` |
| Portfolio | `portfolio/` | `hooks/portfolio/`, `lib/portfolio/` |
| Vault / mint | `vault/` | `hooks/vault/`, `lib/vault/` |
| Marketplace admin | `marketplace/admin/` | `hooks/marketplace-admin/`, `lib/core/api/marketplace-admin-auth.ts` |
| Auth / profile | `auth/` | `providers/AuthProvider.tsx`, `lib/auth/` |
| Shared chrome | `layout/`, `marketplace-shared/`, `collection-cover/` | `lib/marketplace/assetDetailHeadline.ts` |

Seaport signing / fulfillment remains in **`lib/seaport/`** (orders, criteria, fulfillment).

---

## Directory map (high level)

```
frontend/
├── app/                           # Next.js App Router (see frontend/routes.md)
│   ├── page.tsx                   # Landing + Market Indexes
│   ├── markets/                   # Collection list (+ top100 sub-routes)
│   ├── marketplace/               # Token detail, collections, admin
│   ├── portfolio/
│   ├── vault/
│   ├── watchlist/
│   ├── profile/, login/, signup/
│   ├── auth/                      # OAuth callback, reset-password
│   └── site-access/               # Staging gate UI
│
├── components/
│   ├── layout/                    # AppHeader, HeaderNav
│   ├── landing/                   # MarketIndexes
│   ├── markets/                   # MarketsPage, Top100, TopMovers sections
│   ├── portfolio/
│   ├── vault/                     # MintForm (inbound mint UX — Vault system TBD)
│   ├── auth/
│   └── marketplace/
│       ├── collection-detail/
│       ├── collection-overview/
│       ├── collection-hero/
│       ├── collection-dual-price-chart/
│       ├── price-metrics-strip/
│       ├── unified-order-book/
│       ├── collection-trading/
│       ├── collection-criteria-bid/
│       ├── collection-listings/
│       ├── rwa-detail/
│       ├── rwa-detail-asset-panel/
│       ├── list-rwa/
│       ├── markets-ui/
│       └── admin/                 # Collections, cards, top100, top-movers, webhooks
│
├── hooks/                         # Feature-scoped hooks
│
├── lib/
│   ├── core/                      # api/* split modules, queryKeys.ts (rq.*)
│   ├── auth/                      # emailAuth, session helpers
│   ├── market/                    # Pricing tiers, chart utils
│   ├── markets/                   # Top 100 / Top Movers copy, routing, sort
│   ├── marketplace/               # bucketKey, headlines, order book math, …
│   ├── seaport/                   # orders/, criteria/, fulfillment/, listing/
│   ├── portfolio/
│   └── vault/
│
├── providers/                     # AuthProvider, WalletDataProvider, …
├── store/                         # authStore, useAppStore
├── config/wagmi.ts
└── constants/                     # ABIs + contract addresses
```

---

## Redirects

`next.config.ts` redirects legacy **`/exchange` → `/markets`**.

---

## Global providers chain

```
RootLayout
└── Providers (providers.tsx)
    ├── WagmiProvider
    ├── QueryClientProvider
    ├── AuthProvider
    ├── WalletDataProvider
    └── MarketplaceQueryPersistence
```

---

## API client pattern

```ts
// frontend/lib/core/api.ts + lib/core/api/* (split by domain)
getApiUrl()
// → browser: window.location.origin + "/api"
// → SSR:    process.env.INTERNAL_API_URL
```

Query keys: `frontend/lib/core/queryKeys.ts` (`rq.*`).

When **site access** is enabled on the backend, the frontend `/site-access` page sets the gate cookie before other API calls succeed.

PSA display titles (Year → Brand → # → Subject → Variety) are built client-side in `lib/marketplace/assetDetailHeadline.ts` and related helpers — not always stored verbatim in DB.

---

## Feature flags (UI)

Top 100 / Top Movers public sections can be gated via env copy helpers in `lib/markets/top100Copy.ts` (`TOP_CARDS_UI_ENABLED`, `TOP_MOVERS_UI_ENABLED`). Admin preview routes under `/marketplace/admin/*` remain available for ops.
