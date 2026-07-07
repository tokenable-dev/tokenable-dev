# Design system migration (HTML prototypes → Next.js)

Canonical plan for replacing the current mint-green / Tailwind-heavy UI with the **Tokenable Design System** (Azure `#1A6FFF`, chunky pixel aesthetic, Inter + JetBrains Mono).

**Before any design/UI task:** read this file and `frontend/design-system/INVENTORY.md`.  
**Phase status:** update the checklist below in the same PR that completes a phase.

---

## Source locations

| What | Path | Notes |
|------|------|--------|
| **Canonical DS (committed)** | `frontend/design-system/` | Tokens + `tk-*` component CSS — use in Next.js |
| **Designer HTML prototypes** | `Tokenable-with design system/` (repo root) | Static mocks; **do not** paste into React |
| **Prototype reference doc** | `frontend/design-system/PROTOTYPES.md` | HTML file → route mapping |
| **Screen inventory** | `frontend/design-system/INVENTORY.md` | Sections → React components |
| **Public DS assets** | `frontend/public/assets/ds/` | Logos, sample card images |
| **Figma DS readme** | `frontend/design-system/SOURCE-README.md` | Brand/a11y notes from designer export |

Do **not** commit `Tokenable-with design system/uploads/` or `screenshots/` (designer scratch). They stay local or in design handoff storage.

---

## Principles

1. **Logic unchanged, skin swapped** — hooks, API calls, Seaport/Privy flows stay; JSX and styles change.
2. **DS primitives first** — build `components/ds/*` before page rewrites.
3. **Two modal shells** — center `TkDialog` (confirm/simple) vs `TkActionSheet` (portfolio list/bid/sell drawer + mobile bottom sheet). See `portfolio-modals.js` in prototypes.
4. **No `dangerouslySetInnerHTML`** from prototype HTML.
5. **No `support.js` / `x-dc`** in Next.js — prototype runtime only.
6. **Tailwind coexistence** — map DS tokens into `@theme` in Phase 1; retire mint tokens gradually.
7. **Page-local `<style>` from HTML** → consolidate into `frontend/styles/tokenable-*.css` by domain (see **CSS bundle** below), never copy per page.

### CSS bundle (`app/globals.css` import order)

| File | Scope |
|------|--------|
| `tokenable-ds-entry.css` | DS tokens + `tk-*` primitives |
| `tokenable-ds-bridge.css` | Font bridge, ink/azure aliases |
| `tokenable-layout.css` | GNB, footer, `tkl-wrap`, app shell |
| `tokenable-collectible-card.css` | `.card`, `.card__*`, `.fav-btn` — **shared** across home / markets / watchlist |
| `tokenable-home.css` | `.home-*`, `.grid4` carousel (home only) |
| `tokenable-markets.css` | `.markets-*`, `.markets-grid` card overrides |
| `tokenable-watchlist.css` | `.watchlist-*`, `.watchlist-grid` card overrides |
| Other `tokenable-*.css` | One file per route domain (portfolio, vault, …) |

New pages: reuse `CollectibleCard` + `tkl-wrap`; add page CSS only for layout unique to that screen.

---

## Phase checklist

| Phase | Goal | Status |
|-------|------|--------|
| **0** | Canonical paths, docs, DS CSS copy, inventory, cursor rule | **Done** |
| **1** | Foundation: tokens in `globals.css`, fonts, `components/ds/*` primitives, layout CSS | **Done** |
| **2** | App shell: `TkHeader`, `TkFooter`, `tkl-wrap` page shell | **Done** |
| **3** | Home (`index.html`) | **Done** |
| **4** | Markets (`Markets.html`) + shared `CollectibleCard` | **Done** |
| **5** | Collection detail (`Card.html`) | Done |
| **6** | Portfolio (`Portfolio.html`) + `TkActionSheet` modals | Done |
| **7** | Watchlist (`Watchlist.html`) | Done |
| **8** | Vault flow (`Vault*.html`) | Done |
| **9** | RWA token detail (`marketplace/[tokenId]`) — reuse collection sections | Done |
| **10** | Auth, profile, admin — extend DS to secondary surfaces | Done |

---

## Phase 0 — Setup (complete)

**Deliverables**

- [x] `frontend/design-system/` — `styles.css`, `tokens/*`, `components/components.css`
- [x] `frontend/public/assets/ds/` — logos and sample imagery
- [x] `frontend/design-system/INVENTORY.md` — screen + modal mapping
- [x] `frontend/design-system/PROTOTYPES.md` — HTML prototype index
- [x] `frontend/design-system/README.md` — quick start for engineers
- [x] This migration guide + `.cursor/rules/design-system-migration.mdc`
- [x] `ARCHITECTURE_INDEX.md` — Frontend design system row

**Not in scope for Phase 0**

- Changing `app/layout.tsx` or any visible UI
- Importing DS CSS into production bundle (Phase 1)

---

## Phase 1 — Foundation (complete)

**Goal:** Wire tokens and primitives without swapping pages yet.

### Delivered

- [x] `frontend/styles/tokenable-ds-entry.css` — DS tokens + components (no Google Fonts duplicate)
- [x] `frontend/styles/tokenable-ds-bridge.css` — Inter/JetBrains via `next/font`, prototype ink aliases, `.tk-ds-surface`
- [x] `frontend/styles/tokenable-layout.css` — `tkl-*` layout + `tk-sheet-*` action sheet shell
- [x] `frontend/app/globals.css` — imports above + Tailwind `@theme` brand aliases
- [x] `frontend/app/layout.tsx` — `data-theme="dark"`, Inter + JetBrains Mono font variables
- [x] `frontend/components/ds/*` — Button, Dialog, ActionSheet, Input, Table, Tabs, Tag, …
- [x] `frontend/app/dev/design-system/page.tsx` — visual QA showcase

### Verify

Open `http://localhost:3000/dev/design-system` while `pnpm dev` is running.

### Exit criteria

- [x] Primitives render in isolation on dev page
- [x] `pnpm exec tsc --noEmit` passes
- [x] `pnpm exec tsc --noEmit` passes

---

## Phase 2 — App shell (complete)

**Goal:** Global chrome matches prototypes.

### Delivered

- [x] `TkHeader` — sticky GNB: DS logos, nav (Markets, Portfolio, Vault, Watchlist), desktop search dropdown, mobile overlay + burger drawer
- [x] `TkHeaderSearch` — collection search logic ported from pre-DS header
- [x] `TkFooter` — prototype footer markup
- [x] `APP_MAIN_SHELL_CLASS` → `tkl-wrap` (1240px) in `constants/layout.ts`

### Exit criteria

- [x] All routes use new header/footer (hidden on `/site-access`, `/marketplace/admin`)
- [x] Mobile burger + search overlay work
- [x] Active nav state matches pathname
- [x] `pnpm exec tsc --noEmit` passes

---

## Phase 3 — Home (complete)

**Reference:** `Tokenable-with design system/index.html`

### Delivered

- [x] `frontend/styles/tokenable-home.css` — hero, ticker, grid4, feat, partners (home-only)
- [x] `frontend/styles/tokenable-collectible-card.css` — shared `.card` / `.fav-btn` (home, markets, watchlist)
- [x] `components/home/HomeHero.tsx` — headline, chips, CTAs, stats, Three.js slab carousel
- [x] `lib/home/heroSlabCarousel.ts` + `HomeHeroSlabCarousel.tsx` — port of `hero-slab-3d.js`
- [x] `components/home/HomeTicker.tsx` — marquee (live data + index fallback)
- [x] `components/home/HomeTopMovers.tsx` / `HomeJustVaulted.tsx` — horizontal card grids
- [x] `components/collectibles/CollectibleCard.tsx` + `HomeCardGrid.tsx` — DS `.card` with real catalog data
- [x] `components/home/HomeFeatures.tsx` — three guarantees
- [x] `components/home/HomePartners.tsx` — partner logos + vault CTA
- [x] `hooks/home/useHomeMarketplaceGrids.ts` — Top movers (all collections, 90d gain, max 20) / Just vaulted (newest mint, max 20) / ticker
- [x] `app/page.tsx` — composes new home shell (legacy landing sections removed)

### Exit criteria

- [x] Home matches prototype section order and DS styling
- [x] Trending grids use live marketplace data + snapshots
- [x] `pnpm exec tsc --noEmit` passes

---

## Phase 4 — Markets (complete)

**Reference:** `Tokenable-with design system/Markets.html`

### Delivered

- [x] `frontend/styles/tokenable-markets.css` — sticky filter bar, pchip, dd dropdown, mobile drawer, results grid
- [x] `components/collectibles/CollectibleCard.tsx` — shared DS `.card` (home + markets)
- [x] `MarketsPageHeader` — eyebrow + page title
- [x] `MarketsFilterBar` — category pchips + sort dropdown + mobile filter drawer
- [x] `MarketsCollectionGrid` — 4-column responsive grid with live data
- [x] `MarketsPage.tsx` — DS shell, ticker, filter/grid; logic preserved (sort, category, pagination, browse context)
- [x] Shared `.card` styles in `tokenable-collectible-card.css`; page grids override in `tokenable-markets.css` / `tokenable-watchlist.css`

### Exit criteria

- [x] `/markets` matches prototype filter bar + card grid aesthetic
- [x] `CollectibleCard` reused on home trending sections
- [x] `pnpm exec tsc --noEmit` passes

---

## Phase 5 — Collection detail

**Reference:** `Card.html`

- Breadcrumb, hero image, price band, chart area, tabs (listings, sales, population)
- Desktop vs mobile layouts (prototype has responsive table/card rules)

### Maps to

- `app/marketplace/collections/[collectionKey]/page.tsx`
- `components/marketplace/collection-detail/*`

**CSS:** `frontend/styles/tokenable-collection-detail.css`

### Checklist

- [x] `collection-detail-page` shell + breadcrumb (`CollectionDetailBreadcrumb`)
- [x] Metrics strip notch tiles (`.cd-metrics-strip`)
- [x] Chart panel + Azure period toolbar (`CollectionDetailPriceChart`, `CollectionDetailChartPeriodToolbar`)
- [x] Listings section header + grid cards (`.cd-listing-grid`, `.cd-listing-card`)
- [x] Sidebar order book + details notch panels (`.cd-sidebar-orderbook`, `.cd-sidebar-details`)
- [x] `pnpm exec tsc --noEmit` passes

---

## Phase 6 — Portfolio

**Reference:** `Portfolio.html`, `portfolio-modals.js`, `portfolio-chart-v2.js`

- Stats grid, chart, holdings table (`.tk-table` + mobile card rows)
- **`TkActionSheet`** for: Sell, List, Cancel listing, Cancel bid, Raise bid

### Maps to

- `app/portfolio/page.tsx`
- Replace styling on `ListRwaModal` / add sheet variant

**CSS:** `frontend/styles/tokenable-portfolio.css`

### Checklist

- [x] `portfolio-page` shell + `HomeTicker`
- [x] Value hero + `pf-stat-grid` (`PortfolioSummaryBar`, `PortfolioStatGrid`)
- [x] Chart notch panel (`PortfolioValuePanel`)
- [x] `TkTabs` main sections (`PortfolioMainSection`)
- [x] Holdings cards + `TkButton` CTAs (`PortfolioAssetCard`, sell/list actions)
- [x] Hero value + 24h change from `portfolio_daily_snapshots` only; per-row P/L from `portfolio_holdings` cost basis
- [x] Activity `TkTable` (`PortfolioActivitySection`)
- [x] Confirm modals → `TkDialog` (`PortfolioHideConfirmModal`, `PortfolioCancelBidConfirmModal`)
- [x] `pnpm exec tsc --noEmit` passes

---

## Phase 7 — Watchlist (complete)

**Reference:** `Watchlist.html`

- Shares filter patterns with Markets; card layout matches prototype (set line, POP, INSURED, split change/period, in-card Buy/Bid)

### Maps to

- `app/watchlist/page.tsx`

**CSS:** `frontend/styles/tokenable-watchlist.css`

### Checklist

- [x] Standalone `/watchlist` route (replaces redirect to portfolio tab)
- [x] Page layout like Markets: `WatchlistPageHeader` (`tkl-wrap`) → full-width `MarketsFilterBar` → results + grid (`tkl-wrap`)
- [x] `MarketsFilterBar` category / price / grade / sort (880px mobile drawer)
- [x] `WatchlistCollectibleCard` — HTML card body (not shared `CollectibleCard`); `WatchlistCollectionGrid`
- [x] Shared `WatchlistPageContent` for portfolio tab embed
- [x] `pnpm exec tsc --noEmit` passes

---

## Phase 8 — Vault

**References:** `Vault.html`, `Vault-Dashboard.html`, `Vault-Submit.html`, `Vault-Detail.html`, `Vault-Shipping.html`

Treat as one **step flow** with routes or tabs:

| Prototype | App target |
|-----------|------------|
| Vault.html | `app/vault/page.tsx` landing |
| Vault-Submit.html | Mint / submit (`components/vault/`, `useMintForm`) |
| Vault-Dashboard.html | User submissions list |
| Vault-Detail.html | Cycle status |
| Vault-Shipping.html | Redemption shipping |

### Delivered

- [x] `frontend/styles/tokenable-vault.css` — `.vault-page`, stepper, form panel, gate/landing, features, success panel
- [x] `app/vault/page.tsx` — `vault-page` shell (legacy `?tab=my-rwa` redirect preserved)
- [x] `VaultStepper`, `VaultSubmitHeader`, `VaultGateState`, `VaultFeatures`, `VaultPortfolioBanner`
- [x] `VaultPageBody` — gate vs submit flow; `MintForm` / `useMintForm` logic unchanged
- [x] `MintFormMintActions` / `MintFormSuccessView` — `TkButton` + DS panels
- [x] `pnpm exec tsc --noEmit` passes

### Deferred

- Vault-Dashboard / Detail / Shipping screens (no user-facing submission-tracking API yet) — `VaultPortfolioBanner` links to Portfolio for minted holdings
- Full `GradedCardSection` component rewrite — form inputs styled via `.vault-form-panel` CSS overrides

---

## Phase 9 — RWA token detail

**Reference:** Overlap with `Card.html` (single listing focus)

- `app/marketplace/[tokenId]/page.tsx`
- Reuse collection chart/price components where possible
- `RwaDetailListModalHost` → `TkActionSheet`

### Delivered

- [x] `frontend/styles/tokenable-rwa-detail.css` — `.rwa-detail-page`, breadcrumb, sidebar/trades, mint→azure overrides, list/bid sheets
- [x] `RwaDetailPageShell` — DS page shell (`var(--ink)` background)
- [x] `RwaDetailBreadcrumb` — Markets / collection / token trail (desktop)
- [x] Buy / list / sticky CTAs — `TkButton` replaces `GradientOutlineFrame` mint rim
- [x] `RwaDetailListModalHost` — `ListRwaModal` with `shell="sheet"` (`TkActionSheet`)
- [x] `RwaDetailPlaceBidModal` — `TkActionSheet`
- [x] Loading / invalid / not-found states — DS empty state + `TkButton`
- [x] `pnpm exec tsc --noEmit` passes

### Deferred

- `CollectionOwnedRwaListModal` still uses centered `ListRwaModal` (`shell="modal"`) — migrate in a follow-up if desired
- Header badge outline tags (`PsaVaultOutlineTag`) — functional; full `TkTag` swap optional

---

## Phase 10 — Secondary surfaces

- Login / signup / profile — DS forms + `TkDialog`
- Marketplace admin — functional parity first; DS chrome lower priority
- Site access gate — minimal DS tokens

### Delivered

- [x] `frontend/styles/tokenable-secondary.css` — auth entry, profile panels, site gate, dialog wallet blocks
- [x] `PrivyAuthEntryPage` — DS auth card (`login` / `signup` modes); Privy modal flow unchanged
- [x] `app/profile/page.tsx` — secondary shell, `TkButton`, `TkTag`
- [x] `DeleteAccountSettings`, `KycRequiredModal`, `PrivyWalletMismatchModal` → `TkDialog`
- [x] `SiteAccessClient` — `TkField` + `TkInput` + `TkButton`
- [x] Admin — Azure primary button, input focus ring, `admin-console` shell class (light UI preserved)
- [x] `authUiStyles.ts` — mint aliases → DS tokens
- [x] `pnpm exec tsc --noEmit` passes

### Deferred

- Full admin backoffice dark-theme reskin (intentionally light)
- Privy Dashboard modal theming (controlled by Privy, not app CSS)

---

## Target frontend structure (end state)

```
frontend/
  design-system/          # CSS tokens + SOURCE-README (this migration)
  styles/
    tokenable-layout.css
    tokenable-collectible-card.css  # shared marketplace card tile
    tokenable-home.css              # home-only sections
    tokenable-markets.css           # markets page + grid overrides
    tokenable-watchlist.css
    …
  components/
    ds/                   # primitives (no business logic)
    layout/               # TkHeader, TkFooter
    collectibles/         # CollectibleCard (shared tile)
    home/
    markets/
    …
  hooks/
    home/                 # useHomeMarketplaceGrids, useMarketplaceSnapshots
```

---

## AI agent workflow (design tasks)

1. Read **this file** → confirm current phase from checklist.
2. Read **`INVENTORY.md`** for the target screen.
3. Open matching **HTML prototype** for layout/spacing only.
4. Implement only the **active phase** scope; do not skip ahead.
5. Update phase checklist when phase completes.
6. Run `cd frontend && pnpm exec tsc --noEmit`.
