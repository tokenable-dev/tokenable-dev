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
| Marketplace admin | `marketplace/admin/` | `hooks/marketplace-admin/`, `lib/core/api/marketplace-admin-*.ts` — see [marketplace-admin.md](../guides/marketplace-admin.md) |
| Auth / profile | `auth/`, `privy/PrivyUserPill.tsx` | `providers/PrivyAuthBridge`, `lib/auth/` — header uses Privy `UserPill` only |
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
│       └── admin/                 # Backoffice shell, overview, users, collections, price sync
│
├── hooks/                         # Feature-scoped hooks
│
├── lib/
│   ├── core/                      # api/* split modules, queryKeys.ts (rq.*)
│   ├── auth/                      # Session helpers (syncPrivySession, signOut, refreshPrivyAuthSession)
│   ├── privy/                     # Privy config, PrivyAppProviders, PrivySessionBridge, launchers, signing
│   ├── chains/                    # Multi-chain registry (Polygon / Amoy), types, Seaport addresses
│   ├── perf/                      # Client-side perf instrumentation (index.ts, PerfObservers.tsx)
│   ├── market/                    # Pricing tiers, chart utils
│   ├── markets/                   # Top 100 / Top Movers copy, routing, sort
│   ├── marketplace/               # bucketKey, headlines, order book math, …
│   ├── seaport/                   # orders/, criteria/, fulfillment/, listing/
│   ├── portfolio/
│   └── vault/
│
├── providers/                     # AppChainProvider, PrivyAuthBridge, PrivySignInLauncher, PrivyWalletLauncher, WalletDataProvider, …
├── store/                         # authStore, useAppStore
├── config/wagmi.ts                # Legacy wagmi config (kept for reference)
├── config/wagmiPrivy.ts           # Privy wagmi config (active)
└── constants/                     # ABIs + contract addresses
```

---

## Redirects

`next.config.ts` redirects legacy **`/exchange` → `/markets`**.

---

## Global providers chain

Auth is managed by **Privy**. The provider tree is mounted via `PrivyAppProviders` (`lib/privy/PrivyAppProviders.tsx`):

```
RootLayout
└── PrivyAppProviders (lib/privy/PrivyAppProviders.tsx)
    └── PrivyProvider  (@privy-io/react-auth)
        └── QueryClientProvider
            ├── PerfObservers  (lib/perf/PerfObservers.tsx — null-render, observes query/route/page-load)
            └── WagmiProvider  (@privy-io/wagmi)
                ├── MarketplaceQueryPersistence
                ├── PrivySignInLauncher  (global openSignIn() trigger)
                ├── PrivyWalletLauncher (global openConnectWallet() trigger)
                ├── PrivySessionBridge  (syncs Privy token → Tokenable cookie on auth change)
                └── AuthProvider
                    └── AppChainProvider  (active chain context from x-tokenable-chain-id)
                        └── WalletDataProvider
                            └── {children}
```

`PrivyAppProviders` is a no-op (returns children directly) when `NEXT_PUBLIC_PRIVY_APP_ID` is unset.

---

## API client pattern

```ts
// frontend/lib/core/api.ts + lib/core/api/* (split by domain)
getApiUrl()
// → browser: window.location.origin + "/api"
// → SSR:    process.env.INTERNAL_API_URL
```

In local development, `app/api/[...path]/route.ts` proxies all `/api/*` requests to the NestJS backend (auto-detected at port 4100 or 4000). The proxy strips `content-encoding` and `content-length` from backend responses so the browser does not attempt to re-decompress already-decompressed gzip bodies.

Query keys: `frontend/lib/core/queryKeys.ts` (`rq.*`).

When **site access** is enabled on the backend, the frontend `/site-access` page sets the gate cookie before other API calls succeed.

PSA display titles (Year → Brand → # → Subject → Variety) are built client-side in `lib/marketplace/assetDetailHeadline.ts` and related helpers — not always stored verbatim in DB.

## Header auth

Authenticated users see Privy’s native **`UserPill`** (`components/privy/PrivyUserPill.tsx` → `@privy-io/react-auth/ui`). Login, wallet management, **Add funds** (MoonPay), and account settings come from Privy — no custom Tokenable account dropdown in the header.

`HeaderAuthControls` renders:

- Skeleton while Privy + Tokenable session init  
- `UserPill` with `action={{ type: "login" }}` when logged out  
- Default `UserPill` when logged in  

Do **not** restyle Privy modals or dropdowns — only platform z-index in `globals.css` (`[data-floating-ui-portal]` → `150`) so page controls (e.g. markets watchlist) stay underneath.

Tokenable JWT sync still runs via `PrivySessionBridge`; profile page and marketplace routes use `useAuthStore` as before.

## Multi-chain support

`lib/chains/` resolves chain definitions and contract addresses from `NEXT_PUBLIC_CHAIN_{id}_*` env vars. Active chain context is provided by `AppChainProvider`. The active chain ID is sent to the backend via the `x-tokenable-chain-id` request header.

Supported chains: **Polygon Amoy** (80002, default), **Polygon mainnet** (137). Only chains with all three env vars (`NEXT_PUBLIC_CHAIN_{id}_RPC_URL`, `_RWA`, `_USDC`) configured are offered in the UI.

## Performance instrumentation (`lib/perf/`)

Toggle at runtime via `localStorage` — no rebuild required:

```js
localStorage.setItem('PERF_LOG', '1');
localStorage.setItem('PERF_THRESHOLD_MS', '100'); // optional, default 200ms
location.reload();
```

`PerfObservers` (mounted once in `PrivyAppProviders`) tracks:
- **React Query fetches** — logs query label + duration on success/error
- **Route transitions** — logs `from → to` path + duration on link click
- **Initial page load** — Navigation Timing API (TTFB, DOMContentLoaded, loadEventEnd)

Output is JSON via `console.log`, parseable in DevTools or piped to a CLI.

---

## Feature flags (UI)

Top 100 / Top Movers public sections can be gated via env copy helpers in `lib/markets/top100Copy.ts` (`TOP_CARDS_UI_ENABLED`, `TOP_MOVERS_UI_ENABLED`). Admin preview routes under `/marketplace/admin/*` remain available for ops.
