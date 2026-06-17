# Frontend Routes Reference

**Framework:** Next.js 16, App Router  
**Source:** `frontend/app/`

All routes are file-system based. Dynamic segments use `[param]` notation.

---

## Route Table

| Route | Source File | Purpose |
|-------|------------|---------|
| `/` | `app/page.tsx` | Landing page — Market Indexes (Pokemon/MLB/NFL/NBA dashboard) |
| `/exchange` | `app/exchange/page.tsx` | **Markets / Card Trading List** — collections + batch snapshots |
| `/markets` | `app/markets/page.tsx` | Re-exports `/exchange` (same page) |
| `/vault` | `app/vault/page.tsx` | Mint / RWA registration — slab scan, Cardhedger/PSA lookup, IPFS upload, on-chain mint |
| `/portfolio` | `app/portfolio/page.tsx` | Owned assets — daily value chart, hide holdings, token list, reference vs platform price |
| `/profile` | `app/profile/page.tsx` | User profile — wallet link/unlink, email verification status |
| `/login` | `app/login/page.tsx` | Authentication entry (Google OAuth link) |
| `/signup` | `app/signup/page.tsx` | Registration page |
| `/auth/callback` | `app/auth/callback/page.tsx` | Google OAuth callback redirect handler (`?ok=1`) |
| `/marketplace/[tokenId]` | `app/marketplace/[tokenId]/page.tsx` | Token detail — slab panel, owner listing / buyer trade (Buy Now + Place Bid modal), price compare |
| `/marketplace/collections/[collectionKey]` | `app/marketplace/collections/[collectionKey]/page.tsx` | Collection chrome: unified order book, dual Tokenable vs Cardhedger chart, headline info tags / metrics strip, schema & identifiers, individual listings strip (seller / cert), optional Cardhedger **AI insight** (typewriter UI) |
| `/marketplace/other-listings` | `app/marketplace/other-listings/page.tsx` | Listings not matched to a known collection |

---

## Layout Files

| File | Scope | Purpose |
|------|-------|---------|
| `app/layout.tsx` | Global | HTML shell, fonts, global providers wrapper |
| `app/providers.tsx` | Global | QueryClient + Wagmi + AuthProvider + WalletDataProvider + MarketplaceQueryPersistence |
| `app/portfolio/layout.tsx` | `/portfolio` | Portfolio-scoped layout |
| `app/marketplace/[tokenId]/layout.tsx` | `/marketplace/[tokenId]` | Token-detail layout |
| `app/marketplace/collections/[collectionKey]/layout.tsx` | `/marketplace/collections/[collectionKey]` | Collection-detail layout |

---

## Key API Dependencies per Route

| Route | Primary API calls |
|-------|------------------|
| `/` | `GET /api/cardladder/indexes` |
| `/exchange` | `GET /api/marketplace/collections`, `POST /api/marketplace/collections/market-snapshots` |
| `/vault` | `POST /api/psa/analyze`, `POST /api/psa/analyze-by-cert`, `POST /api/rwa/upload`, `POST /api/marketplace/collections/on-mint` (after mint tx) |
| `/portfolio` | `GET /api/blockchain/rwa/tokens/:address`, `POST …/metadata/batch`, `POST …/token-collection-keys`, `POST …/mint-previews`, `POST …/portfolio-market-batch`, `GET …/portfolio/daily/:wallet`, `GET …/portfolio/hidden/:wallet`, `GET /api/marketplace/orders/token/:tokenId` |
| `/marketplace/[tokenId]` | `GET /api/blockchain/rwa/asset/:tokenId`, `GET /api/marketplace/orders/token/:tokenId` |
| `/marketplace/collections/[collectionKey]` | `GET /api/marketplace/collections/:key`, `GET …/cardhedger`, `GET …/market-series`, `GET …/stats`, `GET …/ai-insight`, criteria bids via Seaport + `orders` |

---

## Collection Key

Collection keys are SHA-256 bucket hashes from normalized graded metadata.

```
collectionKey = SHA256(normalize(cardName, cardSet, cardNumber, gradingCompany, gradeScore, …))
```

**When the row is created**

| Trigger | What runs |
|---------|-----------|
| **Mint confirmed** (`POST /api/marketplace/collections/on-mint`) | `ensureCollectionForListing` → `marketplace_collections` + `rwa_tokens`, Cardhedger cert lookup, snapshot enqueue, PSA spec cover retries |
| **First ask** (`POST /api/marketplace/orders`, side `ask`) | Same `ensureCollectionForListing` if the mint hook missed (idempotent) |
| **Platform trades read** (`GET …/platform-trades?bootstrapTokenId=`) | Ensures collection when key is known but row missing; lazy Cardhedger enrichment |

**Sell-flow price suggestions** (`ListRwaModal` → `useListRwaPriceSuggestions`) need a `collectionKey` plus `bootstrapTokenId` to merge Tokenable fills with Cardhedger comps. The key can come from the server (`token-collection-keys`), client metadata hash, or the mint bootstrap response prefetched into React Query.

See `backend/src/marketplace/utils/bucket-key.util.ts` and [database.md](../architecture/database.md).
