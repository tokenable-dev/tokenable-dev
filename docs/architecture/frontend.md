# Frontend Structure

**Source:** `frontend/`  
**Framework:** Next.js 16, React 19, App Router

## Feature layout

Marketplace UI is organized into **feature folders** with matching `hooks/` and `lib/marketplace/` modules. Each feature exports via a barrel `index.ts`.

| Area | Components | Hooks / lib |
|------|------------|-------------|
| Collection detail | `collection-detail/`, `collection-overview/`, `collection-hero/` | `hooks/collection-detail/`, `hooks/collection-overview/` |
| Charts & metrics | `collection-dual-price-chart/`, `price-metrics-strip/` | `hooks/collection-dual-price-chart/`, `hooks/price-metrics-strip/` |
| Order book | `unified-order-book/` | `hooks/unified-order-book/`, `lib/marketplace/unified-order-book/` |
| Trading | `collection-trading/`, `collection-criteria-bid/` | `hooks/collection-criteria-bid/`, `lib/marketplace/collection-trading/` |
| RWA detail | `rwa-detail/`, `rwa-detail-asset-panel/` | `hooks/rwa-detail/`, `lib/marketplace/rwa-detail/` |
| Listing flow | `list-rwa/` | `hooks/list-rwa/`, `lib/seaport/listing/` |
| Shared chrome | `markets-ui/`, `marketplace-shared/`, `collection-cover/` | `lib/marketplace/assetDetailHeadline.ts`, `lib/markets/` |

Seaport signing / fulfillment remains in **`lib/seaport/`** (orders, criteria, fulfillment).

---

## Directory map (high level)

```
frontend/
├── app/                           # Next.js App Router (see frontend/routes.md)
│
├── components/
│   ├── layout/                    # AppHeader
│   ├── landing/                   # MarketIndexes
│   ├── portfolio/                 # Portfolio cards, chart, hide modal
│   ├── vault/                     # MintForm
│   └── marketplace/
│       ├── collection-detail/     # Loaded view, markets slot builder
│       ├── collection-overview/   # Board layout, markets cluster, book column
│       ├── collection-hero/       # Cover, details tabs, KV cards
│       ├── collection-dual-price-chart/
│       ├── price-metrics-strip/
│       ├── unified-order-book/    # Book tab, depth rows, trades tape
│       ├── collection-trading/    # Buy/sell tabs, trade tickets, my orders
│       ├── collection-criteria-bid/
│       ├── collection-listings/   # RwaCard, owned asset cards
│       ├── rwa-detail/            # Desktop/mobile layouts, buyer trade panel, modals
│       ├── rwa-detail-asset-panel/
│       ├── list-rwa/              # List modal + success modal
│       └── markets-ui/            # Category filter, order book toggle, placeholders
│
├── hooks/                         # Feature-scoped hooks (mirrors components above)
│
├── lib/
│   ├── core/                      # api/* split modules, queryKeys.ts (rq.*)
│   ├── market/                    # Pricing tiers, collection titles, chart utils
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

PSA display titles (Year → Brand → # → Subject → Variety) are built client-side in `lib/marketplace/assetDetailHeadline.ts` and related helpers — not always stored verbatim in DB.
