# Tokenable Frontend Architecture Contract

**Audience:** New frontend developers (read this first).  
**Scope:** `frontend/` as it exists today.  
**Goal:** Predict *where* code belongs — not minimize folder count.

Related docs:

- Hook folder map: [Hooks](#hooks)
- Styles: [Styles](#styles)
- Brand assets: [Brand assets](#brand-assets)
- Design system: [`design-system/README.md`](./design-system/README.md)
- Broader product/frontend notes: [`../docs/architecture/frontend.md`](../docs/architecture/frontend.md)
- Routes: [`../docs/frontend/routes.md`](../docs/frontend/routes.md)

---

## Philosophy

1. **Fewer folders is not the goal.** Clear responsibility and predictable location is.
2. **Keep what already works.** Do not reshape the tree for fashion (FSD, Clean Architecture, etc.).
3. **Rename only when the name blocks onboarding** (e.g. `market` vs `markets` vs `marketplace`).
4. **Similar code with different business context stays separate** (e.g. two order-book UIs for two routes).
5. **RWA is a lifecycle concept**, not a mandate to put everything under `components/rwa`.

---

## Quick answers (“Where do I put …?”)

| Question | Put it here |
|----------|-------------|
| New page / URL | `app/<route>/page.tsx` |
| New UI | `components/<feature>/` |
| New hook / React Query orchestration | `hooks/<feature>/` |
| New HTTP / backend API client | `lib/core/api/` (+ key in `lib/core/queryKeys.ts`) |
| Pricing / PSA / USD math | `lib/market/` (**not** the Markets page) |
| Markets browse filters / titles / URL | `lib/markets/` |
| Marketplace PDP / trading helpers (no HTTP) | `lib/marketplace/` |
| Marketplace UI (PDP, admin, list modal) | `components/marketplace/` |
| Markets browse UI | `components/markets/` |
| Seaport / order tx helpers | `lib/seaport/` |
| Chain registry / contracts / API chain header | `lib/chains/` |
| Wallet switch / gas / wallet errors | `lib/network/` |
| Privy SDK / session / signing / Privy providers | `lib/privy/` (**intentional**; do not “fix” into hooks) |
| Global client state (auth UI, toast) | `store/` |
| App-level React providers | `providers/` (+ `app/providers.tsx`) |
| Design-system React primitive | `components/ds/` |
| CSS tokens / `tk-*` source | `design-system/` |
| Feature / app CSS entry | `styles/` |
| Shared TS ambient / small shared types | `types/` |
| RWA feature work | Match **lifecycle stage** (sell / vault / list-rwa / token-offer / portfolio / seaport / `lib/core/api/rwa-*`) — see [RWA](#rwa-architecture) |

---

## CURRENT root layout

These directories exist under `frontend/` today:

```
app/
components/
hooks/
lib/
providers/
store/
constants/
design-system/
styles/
types/
```

Also present (not part of the layer contract below, but real): `public/`, `scripts/`, config files (`next.config.ts`, `package.json`, …).

**CURRENT** = describe and follow.  
**OPTIONAL / FUTURE** = not required; do not invent folders that are not here.

---

## Root directory contract

### `app/`

**Purpose:** App Router routes and page composition.

**Allowed:**

- `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`
- Thin wiring: import a page view / hook and render
- Route-level metadata

**Forbidden:**

- Large reusable business logic
- Duplicated API clients (use `lib/core/api`)
- Design-system CSS ownership

**Example:** `app/markets/page.tsx` → `components/markets/MarketsPage`

---

### `components/`

**Purpose:** React UI, organized by feature (plus shared chrome / DS).

**Allowed:**

- Feature folders (`markets/`, `portfolio/`, `marketplace/`, `vault/`, …)
- Shared: `layout/`, `ds/`, `ui/`, `common/`
- Presentational composition; thin local `useQuery` when policy allows (see [React Query](#react-query-policy))

**Forbidden:**

- `backendFetch` / raw `fetch` to Nest APIs (use `lib/core/api` via hooks or thin query)
- Owning Seaport construction (use `lib/seaport`)
- Becoming the home for all RWA code

**Example:** `components/marketplace/collection-detail/CollectionDetailLoadedView.tsx`

---

### `hooks/`

**Purpose:** React behavior, React Query orchestration, feature wiring.

**Allowed:**

- `useQuery` / `useMutation` / invalidation orchestration
- Calling `lib/core/api` and domain `lib/*` helpers
- Feature folders listed in [Hooks](#hooks)

**Forbidden:**

- Importing `@/components/*` (hooks must not depend on UI modules)
- Defining HTTP clients (those live in `lib/core/api`)
- Exporting hooks from random `components/*.tsx` files (anti-pattern)

**Example:** `hooks/collection-detail/useCollectionDetailPage.ts`

---

### `lib/`

**Purpose:** HTTP clients, domain helpers, chain/network/seaport/privy/auth infrastructure.

**Allowed:** See subsection contracts (`core/api`, `marketplace`, `markets`, `market`, `chains`, `network`, `seaport`, `privy`, …).

**Forbidden (general):**

- Feature page components
- Using `lib` as a dumping ground without matching an existing domain folder

**Example:** `lib/core/api/orders.ts`, `lib/marketplace/bucketKey.ts`

---

### `providers/`

**Purpose:** App-wide React providers (chain, auth shell, query persistence).

**Allowed:**

- Providers that wrap large subtrees
- Wiring to `lib/chains`, `lib/network`, RQ persistence helpers

**Forbidden:**

- Feature screens
- One-off page UI

**Example:** `providers/AppChainProvider.tsx`, `providers/WalletDataProvider.tsx`

**Note:** Privy’s *canonical* provider tree lives under **`lib/privy`** (`PrivyAppProviders`), mounted from `app/providers.tsx`. That is an [intentional exception](#intentional-exceptions).

---

### `store/`

**Purpose:** Global **client** state (Zustand), not server cache.

**Allowed:**

- Auth user session mirror, auth UI flags, toasts

**Forbidden:**

- Replacing React Query for server data
- Per-page ephemeral UI that belongs in component state

**Example:** `store/authStore.ts`, `store/toastStore.ts`

---

### `constants/`

**Purpose:** Thin static constants / re-exports.

**Allowed:**

- Contract address helpers that re-export from `lib/chains` where needed

**Forbidden:**

- Growing business logic or API clients

**Example:** `constants/contracts.ts`

---

### `design-system/`

**Purpose:** **CURRENT** CSS source of truth for tokens and `tk-*` component styles (designer handoff + production CSS).

**Allowed:**

- Tokens, component CSS, inventory/docs for the DS

**Forbidden:**

- React components (those are `components/ds`)
- Feature business rules

**Example:** `design-system/` tokens + `tk-btn` CSS; wired into the app via `styles/tokenable-ds-entry.css`

---

### `styles/`

**Purpose:** Next/app CSS entries, bridges, and large feature stylesheets.

**Allowed:**

- Global entry imports, DS bridge, feature CSS (e.g. portfolio)

**Forbidden:**

- Replacing `design-system/` as the token source of truth

**Example:** `styles/tokenable-ds-entry.css`, `styles/tokenable-portfolio.css`

---

### `types/`

**Purpose:** Small shared / ambient TypeScript types.

**Allowed:**

- Ambient libs, graded-card shared shapes

**Forbidden:**

- Large domain models that belong next to their feature `lib/`

**Example:** `types/gradedCard.ts`, `types/gtag.d.ts`

---

## Default dependency direction

**Default (preferred):**

```
app  →  components  →  hooks  →  lib
```

Also normal:

- `hooks` → `lib`
- `components` → `lib` (types/helpers; prefer hooks for data loading)
- `lib/core/api` → `lib/chains` (API header), other pure libs
- `providers` → `lib` / `store`

This is a **default**, not “every import must follow this edge.”

### Intentional exceptions

| Exception | Why it exists |
|-----------|----------------|
| `app/providers.tsx` → `lib/privy` (`PrivyAppProviders`) | Privy integration boundary is intentionally under `lib/privy` |
| `lib/privy/*` → `store/*`, `hooks/auth/*` | Session bridge / wallet alignment needs auth stores and gates |
| `providers/*` → infrastructure libs | App shell wiring |
| Thin `components/*` → `useQuery` + `lib/core` | Allowed when [React Query policy](#react-query-policy) says ALLOW |
| `lib/privy` contains React providers & hooks | **Architecture exception** — do not “fix” without a new decision (see [lib/privy](#libprivy)) |

---

## lib 4-way contract

These four names are easy to confuse. Memorize them.

### `lib/core/api` — ALL HTTP

**Role:** Every Nest/backend HTTP client for the browser app.

**Allowed:**

- `backendFetch` / `getApiUrl` usage (`client.ts`)
- Request functions and API DTO / response types
- Admin, portfolio, orders, RWA, vault, Cardhedger, etc.

**Forbidden:**

- React components
- UI / presentation helpers
- Pricing math that does not talk to the network
- Marketplace PDP chrome

**Also in `lib/core/` (not under `api/`):**

- `queryKeys.ts` — canonical React Query keys (`rq.*`)
- `invalidation.ts` — cache updates after trades/mints
- Origin / proxy helpers

**New Marketplace HTTP endpoint?** → `lib/core/api/` (e.g. extend `marketplace-collections.ts` or add `marketplace-*.ts`), export from `api/index.ts`, add `rq` key.  
**Do not** put HTTP in `lib/marketplace`.

Import habit:

- Common today: `import { …, rq } from "@/lib/core"`
- Prefer for new code when practical: `@/lib/core/api/<file>` + `@/lib/core/queryKeys` (avoids hiding ownership and reduces barrel cycles)

---

### `lib/marketplace` — PDP / trading domain helpers (no HTTP)

**Allowed:** Pure TS — bucket keys, titles, order-book math, chart option builders, listing helpers, RWA metadata display helpers under `rwa-detail/`, etc.

**Forbidden:**

- `backendFetch` / API clients
- Importing React **components** (runtime)
- Depending on UI theme modules under `components/` (see Known Issues)

**Example:** `lib/marketplace/bucketKey.ts`, `lib/marketplace/unified-order-book/orderBookMath.ts`

---

### `lib/markets` — `/markets` browse helpers (no HTTP)

**Allowed:** Filters, sort, collection titles, URL query helpers, browse-facing price **facades** that call into `lib/market`.

**Forbidden:**

- HTTP
- Seaport / PDP trading orchestration

**Example:** `lib/markets/marketsFilters.ts`, `lib/markets/marketsUrlFilters.ts`

Browse **UI** lives in `components/markets/` + `hooks/markets/`. Data still loads via `lib/core/api`.

---

### `lib/market` — pricing / PSA / USD / market math

**Important:** The folder name does **not** mean “Markets page.”

**Role:** Pricing, PSA population/grade policy, USD formatting, external reference price math, chart history helpers used across Markets / PDP / portfolio.

**CURRENT decision:** Keep the name `lib/market`.  
**OPTIONAL / FUTURE:** Rename to `lib/pricing` is **not decided** (high import churn). Do not rename ad hoc.

**Example:** `lib/market/collectionMarketPricing.ts`, `lib/market/psaPopulationByGrade.ts`

---

## `lib/chains` vs `lib/network`

One-liner:

| Library | Question it answers |
|---------|---------------------|
| **`lib/chains`** | **Which chain are we on?** (identity, contracts, headers) |
| **`lib/network`** | **Can the wallet operate on that chain?** (switch, gas, errors) |

### `lib/chains`

- Chain registry / labels / explorers
- Contract addresses (RWA, USDC, Seaport, …)
- Seaport EIP-712 domain helpers
- `x-tokenable-chain-id` API header (`apiHeader.ts`)
- Active chain id for React Query (`activeChain.ts`)

### `lib/network`

- `wallet_switchEthereumChain` / `wallet_addEthereumChain` (`ensureAppChainNetwork.ts`)
- Gas estimate caps / fallbacks
- Wallet error mapping
- User tx receipt waiting

**Do not merge** these folders: metadata/config vs wallet runtime are different change rates and different consumers. Seaport code typically imports **both** (contracts from `chains`, gas from `network`).

---

## `lib/seaport`

**Purpose:** Seaport order construction, signing helpers, fulfillment / criteria matching — **blockchain transaction helpers**, not UI.

**Examples:**

- `lib/seaport/orders/submitAskListing.ts`
- `lib/seaport/orders/submitTokenBid.ts`
- `lib/seaport/orders/fulfillAskListing.ts`
- `lib/seaport/fulfillment/runCriteriaMatch.ts`
- Criteria / merkle helpers under `lib/seaport/criteria/`

Signing from the React tree usually goes through `lib/privy/useSeaportOrderSigner`.

**Forbidden:** React page components, CSS layout.

---

## `lib/privy`

### Architecture exception (read this)

`lib/privy` intentionally contains:

- Configuration / feature flags
- Session sync (Privy token → Tokenable cookie)
- Wallet helpers / signing
- React hooks (`useSeaportOrderSigner`, …)
- React providers and launchers (`PrivyAppProviders`, `PrivySessionBridge`, …)

That violates a naive “`lib` must be React-free” rule. **In this repo it is deliberate:** Privy is one integration boundary. The folder’s own `index.ts` documents the flow and calls this the canonical home.

**Do not** move Privy providers to `providers/` or hooks to `hooks/privy` unless a separate architecture decision is recorded.  
**DO NOT MOVE** for tidy-layer aesthetics.

Entry: `import { PrivyAppProviders, useSeaportOrderSigner, … } from "@/lib/privy"` or deep imports under `lib/privy/`.

---

## React Query policy

Component-level `useQuery` is **not** banned.

### ALLOW

- Single consumer
- Strongly UI-bound
- Thin query / little transform
- Uses `rq.*` from `lib/core/queryKeys`
- No existing dedicated hook already owning the same query

**Examples (CURRENT):**

- `components/partner/PartnerGate.tsx`
- `components/partner/PartnerCompanyAddressRequiredModal.tsx`
- `components/settings/SettingsPartnerVaultSection.tsx`
- `components/marketplace/admin/AdminPartnerOriginPanel.tsx`

### EXTRACT (preferred for new work / cleanup)

- Page-level orchestration
- Multiple queries composed together
- Non-trivial transformation
- Mutation + invalidation orchestration
- Likely reuse

**Examples:**

- `components/partner/PartnerShipmentsView.tsx`
- `components/portfolio/redeem/RedeemPayPanel.tsx`
- `components/portfolio/PortfolioHoldingsSection.tsx` (vault info query)

### MUST NOT / MUST EXTRACT

- **Ad-hoc query keys** (must use `rq.*`)
- **Exporting hooks from `components/*.tsx`**
- Calling Nest HTTP without going through `lib/core/api`

**MUST EXTRACT examples (CURRENT debt):**

- `components/portfolio/PortfolioPageView.tsx` (multiple page queries)
- `components/vault/hub/VaultActiveDashboardView.tsx` (exports `useVaultHubSubmissions` from a component file)
- `components/portfolio/redeem/RedeemPreparingPanel.tsx` (ad-hoc query key)

---

## RWA architecture

**RWA is an umbrella product concept** (tokenized physical card lifecycle), **not** a single folder.

### Lifecycle

```
Mint → Asset → Listing → Bid → Purchase → Settlement → Redeem
```

| Stage | Typical homes (CURRENT) |
|-------|-------------------------|
| Mint | `app/sell`, `app/vault`, `components/sell`, `components/vault`, `hooks/sell`, `hooks/vault`, `lib/sell`, `lib/vault`, `lib/core/api/rwa-mint.ts`, vault-submissions, admin mint |
| Asset | `components/portfolio`, `hooks/portfolio`, `hooks/rwa-detail`, `lib/marketplace/rwa-detail`, `lib/core/api/rwa-blockchain.ts`, portfolio BFF APIs |
| Listing | `components/marketplace/list-rwa`, `hooks/list-rwa`, `lib/seaport/orders/submitAskListing.ts`, `lib/core/api/orders.ts` |
| Bid | `hooks/token-offer`, collection trade UI, `lib/seaport/orders/submitTokenBid.ts` |
| Purchase | collection trade actions, `fulfillAskListing`, criteria match |
| Settlement | `lib/core/api/rwa-settlement.ts`, admin self-vault payouts, fee helpers in seaport |
| Redeem | `app/portfolio/redeem`, `components/portfolio/redeem`, `hooks/portfolio/useRedeemFlow.ts`, `lib/core/api/rwa-redeem.ts` |

**DO NOT** force-move all RWA UI into `components/rwa`.

**Adding a new RWA capability:** pick the lifecycle stage, then place UI/hooks/lib/API accordingly.

Naming caution: `hooks/rwa-detail` and `lib/marketplace/rwa-detail` are metadata helpers for certificate / list flows — **not** a full asset PDP route (that is `portfolio/assets/[tokenId]`). Portfolio listing entry is `list-rwa/ListRwaModalHost`.

---

## Marketplace architecture

`components/marketplace/` is large (~127 TS/TSX files). **That is not automatically an architecture failure.**

It groups real product surfaces:

| Area | Role |
|------|------|
| `admin/` | Ops console (aligned with `app/marketplace/admin/*`) |
| `collection-detail/` | Collection PDP orchestration |
| `collection-overview/` | PDP layout board |
| Cover / hero / dual-price-chart / AI insight | PDP / admin widgets |
| `unified-order-book/` | Collection PDP book + tape |
| `other-order-book/` | `/marketplace/other-listings` |
| `list-rwa/` | List-for-sale modal UI |
| `trade/`, `collection-trading/` | Trade feedback / rebid |
| `marketplace-shared/` | Cross-surface presentation bits |

**Public Markets browse** (`/markets`) is **`components/markets/`**, not under `components/marketplace/`.

### Naming improvement candidates (do not change in docs-only work)

| Name | Issue |
|------|--------|
| `collection-markets` (ex-`markets-ui`) | Renamed — PDP markets cluster, not `/markets` |
| component `rwa-detail` folder | Removed — host lives under `list-rwa/ListRwaModalHost` |

**CURRENT:** keep folders; improve names only after an explicit decision.

---

## Naming clarification

| Name | Current meaning | Do not confuse with | Current decision |
|------|-----------------|---------------------|------------------|
| **`market`** (`lib/market`) | Pricing / PSA / USD / math | Markets page, marketplace trade | **Keep name**; rename to `pricing` undecided |
| **`markets`** | Browse page `/markets` + `components/markets` + `lib/markets` + `hooks/markets` | `marketplace`, `lib/market` | Keep |
| **`marketplace`** | PDP, trading, catalog APIs, admin | `/markets` browse | Keep |
| **`collection-markets`** | PDP-only markets-cluster widgets (renamed from `markets-ui`) | `/markets` browse UI (`components/markets`) | **Keep** |
| **`list-rwa` / `ListRwaModalHost`** | List-for-sale modal + portfolio host (host moved out of `components/.../rwa-detail`) | Asset PDP (`portfolio/assets`) | **Keep** |
| **`hooks/rwa-detail` / `lib/marketplace/rwa-detail`** | Metadata helpers for cert / list flows (unchanged in Phase 4-G) | Full asset detail route | Keep; optional later rename |
| **`list-rwa`** | List-for-sale modal feature | All RWA code | Keep |
| **`common`** | Cross-feature media (e.g. lightbox) | Design-system primitives | Keep; do not dump domain UI here |
| **`ui`** | App chrome states (`AppPageState`, route error) | `ds` | Keep |
| **`ds`** | React wrappers over `tk-*` | `design-system` CSS | Keep |
| **`design-system`** | CSS tokens + `tk-*` source | `components/ds` | Keep |
| **`chains`** | Which chain / contracts / headers | Wallet switch | Keep; do not merge with network |
| **`network`** | Wallet network ops / gas / errors | Chain registry | Keep |
| **`core`** | HTTP aggregation + RQ keys + invalidation | “core domain” in DDD sense | Keep as HTTP/RQ hub |

---

## Dependency rules

### GOOD

- `components` → `hooks` → `lib`
- `hooks` → `lib` (including `lib/core`, `lib/seaport`, `lib/chains`, `lib/network`)
- `lib/core/api` → infra (`client`, `lib/chains/apiHeader`)

### WARNING (allowed with judgment)

- `components` → `lib` directly (types, formatters, thin `useQuery` + API)
- Prefer hooks when orchestration grows

### BAD

- `lib` → `components` **runtime** imports
- `hooks` → `components`
- API modules importing `@/lib/core` barrel in a way that creates a cycle

---

## Known architecture issues (Planned cleanup — do not “fix” casually here)

Documented from import-graph review. **Not fixed in the documentation-only phase.**

1. **lib → components (runtime)**  
   `lib/marketplace/unified-order-book/tradesTapeTableChrome.ts`  
   → `components/marketplace/price-metrics-strip/theme.ts`

2. **`lib/core` barrel cycle**  
   `lib/core/api/portfolio-assets-page.ts` imports `@/lib/core` while being re-exported through `lib/core`.

3. **Domain cycle**  
   `lib/marketplace/collectionDetailComponents.ts`  
   ↔ `lib/market/psaPopulationByGrade.ts` (and related grade helpers)

4. **Type / impl cycle**  
   `lib/marketplace/unified-order-book/types.ts`  
   ↔ `orderBookMath.ts`

5. **Barrel self-cycle**  
   `lib/market/index.ts`  
   ↔ `gradedCardMarketCap.ts` / `externalMarketPrice.ts`

6. **Auth type cycle**  
   `lib/auth/wallets.ts` ↔ `lib/auth/auth.ts`

7. **Analytics cycle**  
   `lib/analytics/googleAnalytics.ts` ↔ `lib/analytics/events.ts`

Track cleanup under SAFE / later phases — see below.

---

## New feature decision tree

```
New URL?
  → app/<path>/page.tsx

New visible UI?
  → components/<feature>/
     primitives → components/ds/
     app empty/error chrome → components/ui/
     shared media → components/common/
     header/shell → components/layout/

Needs React state, effects, or React Query orchestration?
  → hooks/<feature>/useX.ts
     query keys → lib/core/queryKeys (rq.*)
     HTTP fn → lib/core/api/*

Needs HTTP?
  → lib/core/api/<file>.ts
     NEVER lib/marketplace | lib/markets | lib/market

Pricing / PSA / USD math?
  → lib/market/

Markets browse filter / title / URL?
  → lib/markets/
     UI → components/markets/

Marketplace PDP / trading pure helper?
  → lib/marketplace/
     UI → components/marketplace/...

Seaport / order transaction helper?
  → lib/seaport/
     signing hook → lib/privy/useSeaportOrderSigner
     gas/errors → lib/network
     contracts → lib/chains

Chain metadata / contracts / API header?
  → lib/chains/

Wallet add/switch chain / gas?
  → lib/network/

Privy login / session / embedded wallet / Seaport sign?
  → lib/privy/

Global client state?
  → store/

App-wide provider (non-Privy)?
  → providers/

CSS token / tk-* source?
  → design-system/
     React wrapper → components/ds/
```

---

## “Where should I put this?” examples

1. **New Marketplace REST endpoint** → `lib/core/api/` (+ `rq` key).  
2. **New collection price / % change calculation** → `lib/market/`.  
3. **New `/markets` grade/price filter** → `lib/markets/` + `components/markets/` UI.  
4. **New collection PDP widget** → `components/marketplace/` (detail/overview/chart as appropriate).  
5. **New collection PDP data query** → `hooks/collection-detail/`.  
6. **New Seaport listing path** → `lib/seaport/` + `hooks/list-rwa` / trade hooks.  
7. **Wallet must switch to app chain** → `lib/network/ensureAppChainNetwork.ts`.  
8. **New chain contract address env** → `lib/chains/registry.ts` (and env docs).  
9. **New global toast** → `store/toastStore.ts`.  
10. **New Tk-style button variant** → `design-system` CSS + `components/ds`.  
11. **New portfolio holdings behavior** → `components/portfolio` + `hooks/portfolio` + portfolio APIs in `lib/core/api`.  
12. **New redeem step** → `components/portfolio/redeem` + `hooks/portfolio` + `lib/core/api/rwa-redeem.ts`.  
13. **New admin vault mint UI** → `components/marketplace/admin` + `hooks/marketplace-admin` + `lib/core/api/marketplace-admin-*.ts`.  
14. **New partner shipments column** → `components/partner` (+ extract hook if orchestration grows).  
15. **New Cardhedger search call** → `lib/core/api/cardhedger.ts` (not `lib/marketplace`).  
16. **New watchlist heart on a card** → `hooks/watchlist` + small UI in `components/watchlist` or shared collectible card.  
17. **New KYC gate copy** → `components/auth` / `hooks/auth` + `lib/auth` access helpers.

---

## SAFE vs decision required vs do not touch

### SAFE (docs / low-risk cleanup — when a code phase opens)

- This architecture documentation
- `TkBadge` unused export cleanup (CSS may remain)
- Fix `portfolio-assets-page.ts` → `@/lib/core` barrel cycle
- Normalize RedeemPreparingPanel query keys to `rq.*`
- `acceptTokenOffer.ts` cleanup **after** re-verifying zero importers

### ARCHITECTURE DECISION REQUIRED

- `lib/market` → `lib/pricing` rename
- Optional later: `hooks/rwa-detail` / `lib/marketplace/rwa-detail` naming
- `PortfolioPageView` extraction scope
- Unifying listing UX dual paths (ListRwaModal vs collection sell)
- Grouping `lib/core/api` admin files into a subfolder (keeping `@/lib/core` habit)

### DO NOT TOUCH FOR NOW

- Splitting / moving **`lib/privy`**
- Merging **`chains`** and **`network`**
- Mass consolidation of **`components/marketplace`**
- Mass merge of **`hooks/collection-*`**
- Forcing all RWA into one folder
- Moving HTTP clients into **`lib/marketplace`**
- Full Feature-Sliced Design or Clean Architecture migration

---

## Maintenance

When you change “where code lives” in a lasting way, update **this file** (including the Hooks / Styles / Brand assets sections). Prefer amending the contract over silent exceptions.

---

## Hooks

Feature-scoped React hooks. Prefer importing the owning file (`@/hooks/auth/useTradeAccessGate`) unless a folder barrel has real fan-in.

### Folders

| Folder | Role |
|--------|------|
| `analytics/` | GA page-view helpers |
| `auth/` | Session readiness, sell/trade/nav gates, linked wallet, header wallet menu |
| `chain/` | Active-chain contract addresses |
| `collection-ai-insight/` | Cardhedger AI insight panel query |
| `collection-detail/` | Collection PDP composition, listings, trade CTAs, gallery, similar items |
| `collection-dual-price-chart/` | Dual price-series chart option builder |
| `collection-grade-chart/` | Grade price series for charts |
| `collection-overview/` | Overview board layout math |
| `home/` | Home ticker / top movers / just vaulted / hero carousel |
| `layout/` | GNB / shell breakpoint helpers |
| `list-rwa/` | List-RWA modal + price suggestions |
| `marketplace/` | Catalog infinite list + GNB catalog search; admin cover under `marketplace/collection-hero/` |
| `marketplace-admin/` | Admin RQ hooks (users, vault, inventory, roles, …) |
| `markets/` | Markets page data (orders/snapshots/sort) + infinite scroll |
| `media/` | Resolve media URLs + Cardhedger catalog covers |
| `notifications/` | In-app marketplace notifications |
| `partner/` | Active partner session + redeem metadata images |
| `portfolio/` | Holdings page, bids, redeem, certificate, sort/nav/perf |
| `rwa-detail/` | Token metadata for cert / list-modal hosts |
| `sell/` | Sell flow + shipping panels |
| `token-offer/` | Criteria / token bid offer flow |
| `ui/` | Client mount, mobile viewport, modal scroll lock |
| `unified-order-book/` | Unified ask/bid book for collection trade UI |
| `vault/` | Mint form + submission display-by-cert |
| `wallet/` | Privy fiat onramp + funding status |
| `watchlist/` | Watchlist toggle + snapshot enrichment |
| `useElementSize.ts` (root) | ResizeObserver size (charts) |

### Notes

- Keep `markets/` separate from `marketplace/` (browse page vs catalog/trade APIs).
- Snapshot helpers for Markets / Watchlist / Admin stay domain-local — shared batch API, different wiring.

---

## Styles

CSS is loaded once via `app/globals.css`. Do not import page CSS from components.

### Shared (import before page files)

| File | Use |
|------|-----|
| `tokenable-ds-entry.css` | Design system tokens + `tk-*` components |
| `tokenable-ds-bridge.css` | `--font-*`, ink/azure aliases |
| `tokenable-layout.css` | Header, footer, `tkl-wrap`, app shell |
| `tokenable-wallet-menu.css` | GNB wallet chip + dropdown — imported from `TkHeader.tsx` (Turbopack dev module graph) |
| `tokenable-notifications.css` | Notifications drawer — imported from `TkHeader.tsx` |
| `tokenable-collectible-card.css` | `.card`, `.card__*`, `.fav-btn` — `CollectibleCard` |

### Page-specific

| File | Route / screen |
|------|----------------|
| `tokenable-home.css` | `/` — hero, ticker, grid4, features, partners |
| `tokenable-markets.css` | `/markets` |
| `tokenable-watchlist.css` | `/watchlist` |
| `tokenable-collection-detail.css` | Collection detail |
| `tokenable-portfolio.css` | `/portfolio` |
| `tokenable-vault.css` | Vault / Sell hub + sell router loader |
| `tokenable-rwa-detail.css` | ListRwaModal sheet (`tk-price`); leftover `.rwa-detail-page` unused |
| `tokenable-secondary.css` | Auth, profile, site gate |

When adding a new screen from `Tokenable-with design system/*.html`, add or extend the matching `tokenable-*.css` file. Reuse `CollectibleCard` and `tkl-wrap` before inventing new layout primitives.

### Tailwind v4 + `tokenable-*.css` (required)

All files imported from `app/globals.css` are processed by **Tailwind CSS v4** (`@tailwindcss/postcss`). Its parser treats `[...]` as Tailwind arbitrary-value syntax, not plain CSS.

**Do not** use attribute selectors that embed Tailwind arbitrary classes, for example:

```css
/* BREAKS the build — nested [ confuses Tailwind */
.bad [class*="lg:grid-cols-[minmax(0,1fr)_300px]"] { }
.bad [class*="text-[#a0a0a0]"] { }
```

**Do instead:**

1. Add a semantic class in the React component (`cd-overview-board__grid`, `cd-listing-card__grade`, …).
2. Target that class in `tokenable-*.css`.
3. If you must match a generated class string, use a **bracket-free substring** only (e.g. `[class*="a0a0a0"]`), never `[class*="...[...]"]`.

After editing any `tokenable-*.css` file, confirm the dev server compiles (or run `pnpm build` in `frontend/`). `tsc --noEmit` does **not** catch CSS syntax errors.

---

## Brand assets

SVG, 아이콘, 이미지 등 브랜드 에셋을 관리하는 폴더입니다.

### 디렉터리 구조

```
assets/
├── logo/       # 로고 (풀 버전, 가로형)
├── icons/      # 아이콘 (favicon, 앱 아이콘, 정사각형)
├── home/       # Home hero bg + carousel faces (`newcards/c01…c06`)
├── ds/         # Design-system marketing assets
└── images/     # 기타 이미지 (배경, 일러스트 등)
```

### 새 SVG 추가 방법

1. 해당 폴더에 파일 추가 (예: `logo/new-brand.svg`)
2. `constants/assets.ts`에 경로 등록:

```ts
export const ASSETS = {
  logo: {
    tokenable: `${ASSETS_BASE}/logo/tokenable.png`,
    newBrand: `${ASSETS_BASE}/logo/new-brand.svg`,  // 추가
  },
  // ...
};
```

3. 컴포넌트에서 `ASSETS.logo.newBrand` 또는 `<Image src={ASSETS.logo.newBrand} />` 사용

### 네이밍 규칙

- **로고**: `{브랜드명}.svg` (가로형 풀 로고)
- **아이콘**: `{브랜드명}-icon.svg` (정사각형, favicon용)
- **이미지**: `{용도}-{설명}.svg` 또는 `.png`
