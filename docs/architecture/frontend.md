# Frontend Structure

**Source:** `frontend/`  
**Framework:** Next.js 16, React 19, App Router

## Directory Map

```
frontend/
├── app/                           # Next.js App Router
│   ├── layout.tsx                 # Root layout — HTML shell, fonts, providers
│   ├── providers.tsx              # QueryClient + Wagmi + Auth + Wallet providers
│   ├── page.tsx                   # / — Landing page (Market Indexes)
│   ├── exchange/page.tsx          # /exchange — Collection hub with category filter
│   ├── markets/page.tsx           # /markets — Market indexes view (alias)
│   ├── vault/page.tsx             # /vault — Mint / RWA registration entry
│   ├── portfolio/                 # /portfolio — Owned assets
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── profile/page.tsx           # /profile — User profile & wallet settings
│   ├── login/page.tsx             # /login — Auth entry
│   ├── signup/page.tsx            # /signup — Registration
│   ├── auth/callback/page.tsx     # /auth/callback — Google OAuth callback redirect
│   └── marketplace/
│       ├── [tokenId]/             # /marketplace/[tokenId] — Token detail
│       │   ├── layout.tsx
│       │   └── page.tsx
│       ├── other-listings/        # /marketplace/other-listings — Unmatched listings
│       │   └── page.tsx
│       └── collections/
│           └── [collectionKey]/   # /marketplace/collections/[collectionKey]
│               ├── layout.tsx     #   Collection order book + chart UI
│               └── page.tsx
│
├── components/
│   ├── common/                    # GradedMetadataPanel, RwaImageZoom, …
│   ├── landing/                   # MarketIndexes
│   ├── layout/                    # AppHeader
│   ├── marketplace/               # Order book, charts, trade modals, collection panels
│   ├── vault/                     # MintForm, ImageInput, GradedCardSection
│   └── wallet/                    # WalletConnect
│
├── providers/
│   ├── AuthProvider.tsx           # Session fetch + global auth state
│   ├── MarketplaceQueryPersistence.tsx
│   └── WalletDataProvider.tsx
│
├── store/
│   ├── index.ts                   # useAppStore — wallet address, USDC balance, refresh
│   └── authStore.ts               # useAuthStore — user, login, logout
│
├── lib/
│   ├── auth/                      # fetchAuthMe, logoutAuth
│   ├── core/                      # api.ts (getApiUrl), queryKeys.ts (rq.*)
│   ├── market/                    # Price tier utils, index helpers, chart utils (13 files)
│   ├── marketplace/               # bucketKey, mediaUri, queryPersistence, …
│   ├── network/                   # chainGas, ensureSepolia, walletError
│   ├── portfolio/                 # History & reference-price utilities
│   └── seaport/
│       ├── constants.ts / merkle.ts / eip712Uint.ts
│       ├── orders/                # bidUsdc, fulfillAskListing, platformFee, submitAskListing, …
│       ├── criteria/              # criteriaMatch, collectionCriteriaRoot,
│       │                          #   matchAdvancedOrdersArgs, tryMatchCriteriaBidAgainstBook,
│       │                          #   useCollectionMerkleRootHex
│       └── fulfillment/           # runCriteriaMatch
│
├── config/wagmi.ts                # Wagmi chain & connector config
├── constants/                     # ABI JSON + contract address helpers
│   ├── abis/                      # tokenableRwa.abi.ts, usdc.abi.ts, seaport.abi.ts
│   └── contracts.ts               # RWA_CONTRACT_ADDRESS, USDC_CONTRACT_ADDRESS, …
├── hooks/                         # useMarketplaceCollectionsInfinite,
│                                  # useResolvedMediaUrl, useUserAssets
└── types/
    └── gradedCard.ts
```

## Global Providers Chain

```
RootLayout
└── Providers (providers.tsx)
    ├── WagmiProvider (config/wagmi.ts)
    ├── QueryClientProvider
    ├── AuthProvider         ← fetches /api/auth/session on mount
    ├── WalletDataProvider   ← syncs wallet address + USDC balance to Zustand
    └── MarketplaceQueryPersistence
```

## API Client Pattern

```ts
// frontend/lib/core/api.ts
getApiUrl()
// → browser: window.location.origin + "/api"  (when NEXT_PUBLIC_API_URL is unset)
// → SSR:    process.env.INTERNAL_API_URL       (docker-compose sets this)
```

All data-fetching functions accept the base URL as a parameter and use `fetch` + TanStack Query. Query keys are co-located in `frontend/lib/core/queryKeys.ts` as `rq.*` constants.
