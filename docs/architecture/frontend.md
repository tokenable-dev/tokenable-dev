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
| Trading | `collection-trading/`, `collection-detail/` (listing bid checkout) | `hooks/token-offer/`, `lib/marketplace/collection-trading/` |
| RWA detail | `rwa-detail/`, `rwa-detail-asset-panel/` | `hooks/rwa-detail/`, `lib/marketplace/rwa-detail/` |
| Listing flow | `list-rwa/` | `hooks/list-rwa/`, `lib/seaport/listing/` |
| Portfolio | `portfolio/` | `hooks/portfolio/`, `lib/portfolio/` |
| Vault / mint | `vault/` | `hooks/vault/`, `lib/vault/` |
| Marketplace admin | `marketplace/admin/` | `hooks/marketplace-admin/`, `lib/core/api/marketplace-admin-*.ts` — see [marketplace-admin.md](../guides/marketplace-admin.md) |
| Auth / profile | `auth/`, `layout/header/wallet/` | `lib/privy/PrivySessionBridge`, `lib/auth/` — header uses custom wallet menu + Privy hooks |
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
│   ├── watchlist/                 # WatchlistPage, WatchlistCollectibleCard
│   ├── vault/                     # MintForm (/vault/submit/mint); self-vault sell reuses mint APIs
│   ├── auth/
│   └── marketplace/
│       ├── collection-detail/
│       ├── collection-overview/
│       ├── collection-hero/
│       ├── collection-dual-price-chart/
│       ├── price-metrics-strip/
│       ├── unified-order-book/
│       ├── collection-trading/
│       ├── collection-trading/
│       ├── collection-detail/     # listing checkout + card offer bid
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
│   ├── chains/                    # Multi-chain registry (Sepolia / Ethereum), types, Seaport addresses
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
├── lib/privy/config.ts            # Privy + wagmi config (canonical)
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
                ├── AccountWalletAligner (activates the account wallet in wagmi — embedded unless the backend primary is external)
                └── AuthProvider
                    └── AppChainProvider  (active chain context from x-tokenable-chain-id)
                        └── WalletDataProvider
                            └── {children}
```

`PrivyAppProviders` is a no-op (returns children directly) when `NEXT_PUBLIC_PRIVY_APP_ID` is unset.

**Login modal look:** auth stays Privy SDK. Visual tokens are aligned with `Tokenable-with design system-17/Login.html` via `buildPrivyClientConfig().appearance` (`theme` `#141414`, accent `#1A6FFF`, empty header/message, GNB wordmark) and `--privy-*` CSS variables on `body` in `app/globals.css`. Unofficial CSS also enlarges the modal logo, adds Login.html’s orbiting edge highlight, and centers Privy’s default mobile bottom-sheet as a floating card (≤440px). Layout/steps remain Privy’s (not a custom Login.html clone).

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

PSA display titles follow the planner Display name rule in `lib/marketplace/assetDetailHeadline.ts` and Card.html `#hero-title` / `#hero-meta`:
**Hero title** = `Character[ · Variant] · # · Grade`; **Hero meta** = `Year · Set · …` (no `#` / grade — those stay on the title line only). Full mint strings stay for search/hover only — not as hero/tile titles. Title case (not ALL CAPS).

Collection detail layout mirrors `Tokenable-with design system-18/Card.html`: sticky `#hero-bar` with title/meta inside (`#hero-mid`), Ask/Bid + market metrics columns, Buy now + Bid; `1.35fr / 1fr` grid (Price history + **Similar items** left; Trades/Order book + Details/Pop. rail right). Trades **View all** expands the panel inline (`.tk-expanded` / Show less) — no right drawer. Left ask listings table is not rendered (asks live in Order book). Mobile (`≤1023`): Card.html hero grid — title full-width, then image | last-price (+chg), then secondary metric rows; Buy/Bid in fixed `#ob-bottom-bar`; sticky condense on scroll (title · price, no thumb). Column order: chart → rail → similar.

**Hero population metrics:** Gem rate = PSA 10 Pop ÷ Total PSA Pop. **Volume 1Y** and **Velocity 1Y** are always shown in the UI (never `Volume 6M` etc.). Internally the longest coverable window among **1M / 3M / 6M / 12M** (priority 12M→6M→3M→1M; Cardhedger comps ~100) is selected; raw period volume is annualized (×1 / ×2 / ×4 / ×12). UI Volume = normalized 1Y notional. Velocity = normalized 1Y volume ÷ market cap × 100. Market cap never scaled. No “Est.” Under 30d coverage both **—**. **30D Median** prefers comps/fills in the last 30 days; if that window is empty, the same median uses the next larger span (60d → 90d → 180d → 365d → all tape) so a single nearby sale still populates the metric.

**Markets grid titles** (`buildMarketsCollectionTitle` in `lib/markets/marketsCollectionTitle.ts`) use the catalog one-liner — `Year Set #Number CardName [Variant]` — matching Card.html `card__title` / search results. Collection detail hero keeps Display name + meta strip separately (`AssetDetailHeadlineTitle`); do not reuse the tile formatter on the detail page.

**Collection detail order book** (Price / Qty / Total policy): depth-only two-sided book — columns **Price / Qty / Total** where Total = price × qty (notional USDC; compact `$1.2k` / `$3.4m` / `$1.1b` when large); depth bar width = level Total ÷ side max Total; integer qty and whole-dollar prices; ask row click opens buy at that price (hover **Buy ›**); **LAST** + **Spread** center strip; empty states for no asks (bids live), no bids (asks live), and no market with CTAs (Place a bid, Notify me, List yours).

## Design system buttons (`TkButton`)

DS variants already own chrome: `ghost` has an inset 1px outline; `primary` / `subtle` / `neutral` use top+bottom bevel shadows + pixel-notch `clip-path`.

**Do not** add a second `border` or `box-shadow` on the same control via a feature class — it stacks as a double top edge (especially on `:hover`, where `.tk-btn--*:hover` can beat a single custom class).

Rules:
1. Prefer layout-only `className` (width / height / flex) and an unmodified DS variant.
2. For a custom outline skin, use compound selectors (`.my-btn.tk-btn`, `:hover`, `:active`) that **fully replace** `box-shadow`, `border`, `clip-path`, and `transform`.
3. Prefer `variant="ghost"` (already `clip-path: none`) when you need a quiet outline, then restyle color — don’t layer outline CSS on `subtle`.

See also the comment in `styles/tokenable-ds-bridge.css`.

## Header auth

Authenticated users see a **custom wallet chip + dropdown** styled like HTML `tk-wallet.js` (`HeaderWalletMenu`, `HeaderMobileWalletSection`). Privy still owns login/logout/session (`useLogin`, `completeSignOut` → `useLogout`); the dropdown is Tokenable product nav only.

`HeaderAuthControls` renders:

- Skeleton while Privy + Tokenable session init (`usePrivyInitGate` — if Privy never becomes `ready`, e.g. `POST auth.privy.io/api/v1/sessions` 500, falls back to Sign up after ~5s instead of an infinite skeleton)
- `TkButton` **Sign up** → `useLogin()` when logged out
- `HeaderWalletMenu` (desktop chip: address + native balance + chevron) when logged in

`PrivyUserPill` remains for dev lab (`/dev/privy`), profile fallback, and wallet-mismatch flows — not in the main GNB.

**Settings** (`/settings`, Settings.html parity): side-nav sections for Profile, Notifications, Wallet & balance, Addresses, Identity, Legal, Security. Wired today: display name (`PATCH /auth/profile`), avatar upload (`POST /auth/avatar` → S3), email notification + marketing prefs (stored; delivery TBD), shipping address book CRUD (`/user/shipping-addresses`; default prefills PSA vault return address on `/sell/shipping`, else Partner Origin), USDC + Add funds (MoonPay), linked wallet link/unlink/export, KYC → `/kyc`, sign out + delete account (delete clears Privy too). Honest “Coming soon” stubs: Telegram bot, server web-push, payment methods, multi-device sessions, 2FA, agreement document pages, consent audit log. Legacy `/profile` redirects here.

Do **not** restyle Privy modals or portal menus — only platform z-index in `globals.css` (`[data-floating-ui-portal]` → `150`) so page controls stay underneath.

Tokenable JWT sync still runs via `PrivySessionBridge`; profile page and marketplace routes use `useAuthStore` as before.

## Portfolio My Assets loading

`/portfolio` uses `useUserAssets(..., { assetPageSize: 20 })`:

1. `GET /blockchain/rwa/tokens/:address` — full owned token id list (on-chain scan; cached ~30s)
2. Metadata (+ collection keys / market pricing) loads in **pages of 20** (newest `tokenId` first) via `useInfiniteQuery`
3. **Load more** on `PortfolioHoldingsSection` fetches the next metadata page only

Summary holdings count still uses the full owned id list. Chart totals come from daily snapshots, not from summing every row. After mint, buy, or hide, React Query invalidates `portfolio-daily-snapshots` so the open Portfolio page refetches the recaptured slot.

## Multi-chain support

`lib/chains/` resolves chain definitions and contract addresses from `NEXT_PUBLIC_CHAIN_{id}_*` env vars. Active chain context is provided by `AppChainProvider`. The active chain ID is sent to the backend via the `x-tokenable-chain-id` request header.

Supported chains: **Ethereum Sepolia** (11155111, default), **Ethereum mainnet** (1). Only chains with all three env vars (`NEXT_PUBLIC_CHAIN_{id}_RPC_URL`, `_RWA`, `_USDC`) configured are offered in the UI.

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

Top 100 / Top Movers public sections can be gated via env copy helpers in `lib/markets/top100Copy.ts` (`TOP_CARDS_UI_ENABLED`, `TOP_MOVERS_UI_ENABLED`). Admin previews live under `/marketplace/admin/markets` (tabbed).

### Markets URL filters (Details → Markets)

Collection Details KV values deep-link to `/markets` using the Card.html / `markets-nav.js` query contract (`lib/markets/marketsUrlFilters.ts`):

| Param | Meaning |
|-------|---------|
| `cat` | Category path(s); pipe-joined multi = OR (e.g. `sports/baseball` and `tcg/pokemon`) |
| `character` | Card name facet (pipe-joined multi) |
| `set` | Set facet |
| `year_min` / `year_max` | Year range |
| `grade` | e.g. `PSA 10` (pipe-joined) |
| `price_min` / `price_max`, `sort` | Sort ids: `pct_change_high` (alias `gainers` = Top gainers), `recent_listed` (alias `newest` = Newest listings = **catalog `createdAt`**, same as landing Just vaulted — no price-first bump), plus price/population. Landing **Top movers → View all** → `/markets?sort=gainers`; **Just vaulted → View all** → `/markets?sort=newest`. |

Linkable Details rows: Card name, Category, Set, Year, Grade, Grader. Card number / Variant / Language stay plain text (no Markets facet yet). Series is not linked — no `series` field in collection components.

**Set facet sync:** Details **Set** values and Markets `set=` use the same canonical label (`resolveCollectionSetFacetLabel` — year prefix stripped). Markets slim bar **Set** filter searches that label against loaded collections; chosen sets and `sort` both persist in the URL so deep-links from Details and in-page filtering stay aligned.

**Collection search:** GNB search submits to `/search?q=` (`buildCollectionSearchHref`). Typeahead uses `useMarketplaceCatalogSearch` (`GET /marketplace/search`) so **minted cards (cert / name)** appear above **collections**. Digit-only `q` of any length prefix-matches `rwa_tokens.cert_number`; collection catalog still only prefix-matches collection certs at **7+** digits (short digits match card numbers / `#123`). The search page shows cert-match rows first (`SearchCertMatches`), then the collection grid. Text search does **not** match `psaBrand`. Enter on a typeahead row opens that card or collection; View all / Enter with no highlight goes to `/search`.

**Admin + local `next dev` CPU:** `/marketplace/admin/*` hides GNB/footer via `shouldHideAppChrome`, and also **disables** marketplace notification polling / partner-me queries on those routes. Otherwise the hidden header still polled `/api/marketplace/notifications` every ~15s and Turbopack kept recompiling the API proxy (fan spin with frontend alone).

**CSS + Turbopack:** `app/globals.css` only pulls DS + layout + shared card/secondary sheets. Heavy route CSS (`tokenable-vault`, `sell-flow`, `collection-detail`, …) is imported from the owning route layout so admin / home compiles do not reprocess ~25k lines of unrelated CSS. See [design-system-reference.md](../guides/design-system-reference.md) § CSS bundle.
