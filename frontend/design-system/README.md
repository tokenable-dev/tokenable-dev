# Design system

Committed CSS source for the Azure / pixel UI. Latest Figma export lives at repo root in `Tokenable Design System/` (reference only). Screen HTML prototypes remain in `Tokenable-with design system-*`.

## Quick start (Phase 1+)

```css
/* frontend/app/globals.css — already wired in Phase 1 */
@import "../styles/tokenable-ds-entry.css";
@import "../styles/tokenable-ds-bridge.css";
@import "../styles/tokenable-layout.css";
```

**Visual QA:** `http://localhost:3000/dev/design-system` (live `TkButton` / `TkStepper` + designer standalone iframe)

**DS changelog (v2 Phase 1):** `ghost` + `table` button variants; tokens `--border-strong`, `--surface-hover`.

**IA (v2 Phase 2):** Primary nav **Sell** → `/sell` router (`SellRouterView`); collector hub at `/vault` with Selling chrome.

**Portfolio (v2 Phase 3):** Holdings **Set price** / **Edit price** ghost CTAs + Highest bid meta; `ListRwaModal` set-price copy.

**Collection (v2 Phase 4):** Set-level **Place a Bid** banner; listing rows **Buy-only**; softer vault / buyer-protection copy in listing detail + checkout.

**Sell flow (v2):** Hub **+ Sell a Card** → `/sell/flow` (`Sell-Flow.html`) → `/sell/shipping` (`PSA-Shipping.html`) → `/vault/submissions/[id]?scenario=C` (`Vault-Detail.html`). Personal mint remains at `/vault/submit` (`/vault/submit/mint` redirects there).

**Designer handoff import:**

```bash
node scripts/ds-import-standalone.mjs                    # copy HTML → public/
node scripts/ds-import-standalone.mjs --extract-css        # optional _import-*.css for diff
```

```tsx
import { TkButton, TkDialog } from "@/components/ds";
```

## Contents of this folder

| Path | Purpose |
|------|---------|
| `styles.css` | Single entry — imports tokens + components |
| `tokens/fig-tokens.css` | Figma color/spacing variables |
| `tokens/base.css` | Typography scale, elevation, pixel notches |
| `components/components.css` | `tk-btn`, `tk-dialog`, `tk-table`, … |

This README is the **only** design-system doc under `frontend/`. Sections below: brand/a11y, prototypes, screen inventory.

## Assets

Logos and sample cards: `frontend/public/assets/ds/`

## UI reference

**Canonical guide:** [`docs/guides/design-system-reference.md`](../../docs/guides/design-system-reference.md) (tokens, components, CSS import order, checklist).  
Migration phases 0–10 are done. Prototype folder is reference only — no auto-import into this directory.

## Prototype folder vs this directory

| | `Tokenable Design System/` | `frontend/design-system/` (here) |
|---|--------------------------------|-------------------------------------|
| Role | Designer Figma/CSS + standalone | **Production** tokens + `tk-*` CSS |
| Next.js | Not imported | Imported via `tokenable-ds-entry.css` |
| Updates | Manual diff + merge into here | PR + `DS: …` changelog line + `/dev/design-system` check |

---

# Brand, voice, and accessibility

> Status — 32 components (29 project + 3 logo) · 27 specimen cards · 745 tokens · pixel aesthetic with surface-based depth · 1 template (Marketplace Landing) · marketplace UI kit. Last updated 2026-07-01.

A dark-first, token-driven design system for **Tokenable** — a graded trading-card and collectibles marketplace where physical cards are vaulted, insured, tokenized, and traded with real-time pricing (PSA/BGS grades, population counts, price + appreciation).

Extracted from **"Tokenable Design System.fig"** (mounted as a virtual filesystem). Token values, components, logo, and card imagery come from that file — it is the source of truth.

---

## Sources
- **Figma:** "Tokenable Design System.fig" — pages: Foundations, Icons, Buttons, Inputs, Tags, Tooltip, Dialog, Navigation, Notification, Tabs, Calendar, Tokenable-Components (Market Card), LOGO-SYMBOL, Examples.
- 446 Figma Variables across 10 collections (Color, Color Primitives, Size, Typography, …) → `tokens/fig-tokens.css`.
- Icon family ≈ Feather Icons (outline, ~2px stroke); pixel-glyph set built for the chosen aesthetic.

---

## Brand at a glance
- **Name / wordmark:** TOKENABLE — geometric all-caps wordmark; pixel-style "T" symbol.
- **Primary color:** Azure `#1A6FFF` (`--brand-500`), applied as solid fill with hard offset shadow on primary actions.
- **Surface:** dark-first — near-black blue-tinted `rgb(16,16,30)` base, layered secondary/tertiary surfaces.
- **Type:** Inter (sans), JetBrains Mono (mono/numeric), Noto Serif (rare serif).
- **Mood:** premium, financial, confident — with an on-chain pixel identity.

---

## CONTENT FUNDAMENTALS
- **Voice:** direct, confident, market-literate. Short declaratives. "The graded card market." "Every card vaulted and insured."
- **Person:** addresses the user as **you / your**. Product speaks plainly, never cute.
- **Casing:** sentence case for headings/body. Tags/labels often ALL-CAPS short tokens ("PSA 10", "POP 3", "VAULTED"). Nav items are Title Case single words.
- **Numbers:** prices `$58,000`, appreciation `+138%`, with period qualifier (`1Y`, `180d`). Monospace for prices, IDs, gas, addresses.
- **Status language:** trust + provenance — "Vaulted", "Insured", "Verified", "Confirmed", grade + population ("POP 3").
- **Emoji:** none in product UI.

---

## VISUAL FOUNDATIONS
- **Color:** Dark-first. Base `rgb(16,16,30)`; cards on `#101016`. Azure brand for primary, green `#00C350` positive, amber `#EA8200` warning, red `#E4374A` danger. Full light theme via `[data-theme="light"]`. Color reserved for CTAs, status tags, gains/losses.
- **Type scale:** Title Hero 72 (-3% tracking) / Title Page 48 / Subtitle 32 / Heading 24 (-2%) / Subheading 20 / Body 16 / Body Small 14 / Caption 12. Inter with tight tracking on large headings; Roboto Mono for numeric/code.
- **Spacing:** 4px base unit (4·8·12·16·24·32·48·64·96). 22px card gaps in grids.
- **Cards (collectible):** 16px rounded corners, `#1a1a1e` surface, no clip-path notch. Blue drop-shadow. Shine-on-hover effect + floating heart interaction on favorite.
- **Cards (layout):** 16px rounded corners, `#1e1e2e` surface, no visible borders.
- **Corner radii:** Cards/accordion/menu use 8–16px border-radius. Feedback components (notification/tooltip/dialog) retain pixel notch clip-path for brand identity. Buttons use notch clip-path.
- **Borders:** Minimized. No visible border lines on cards, accordion, menu, pagination (inactive). Inset shadows used only on buttons for 3D embossed depth, not as visible lines. Input fields use white background with subtle inset shadow for depth.
- **Input fields:** White background (`#fff`) with dark text (`#111`), 4px inset shadow border, pixel notch clip-path. Focus state uses blue inset shadow. Error state uses 4px red inset shadow.
- **Transparency and blur:** floating controls use `rgba(0,0,0,.55)` + `backdrop-filter: blur(8–10px)`. Dialog scrim blurs.
- **Animation (pixel):** fast 120ms. Hover nudges toward shadow; press pushes into it. Switch thumb steps. No blur transitions, bounces, or decorative loops.
- **Hover:** primary brightens gradient + intensifies glow; neutral/subtle gain faint fill; cards lift. **Press:** downward nudge.
- **Imagery:** graded cards (Pokémon, sports) on transparent/dark, presented in vignette. Cool, premium, high-contrast.

---

## ACCESSIBILITY
Built in:
- **Focus visible:** 2px `--brand-400` ring on all interactive controls.
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` neutralizes pixel transforms and dialog entrance.
- **Tooltip on focus:** opens on hover **and** `:focus-within`.
- **Semantics:** `IconButton` requires `label`; inputs link `<label for>`; `Switch` has `role="switch"`; `Dialog` is `role="dialog" aria-modal`; proper ARIA on Tabs/Pagination.
- **Minimum text 12px:** no UI text below 12px.

Manual considerations:
- `sm` controls (36–38px) below 44px touch target — prefer `md` on touch.
- `--text-default-tertiary` (~38%) for non-essential meta only.
- Dialog doesn't trap focus — add management in real flows.

---

## ICONOGRAPHY
- **Pixel icons** (`assets/icons/pixel-icons.js`): 12×12 rect grids, `shape-rendering: crispEdges`. Core glyphs: search, heart, check, x, plus, chevron-down/left, arrow-up-right, gem, bolt, shield, wallet, grid, filter, bell, box, coin, star, eth.
- `pixelIconSVG(name,{size,color})` returns SVG markup; `window.PixelIcon({name,size,color})` is a React element.
- Figma source set was Feather Icons — retained for reference.
- No emoji.

---

## Components

All 29 components exposed on `window.TokenableDesignSystem_8d023b`. Styles in `components/components.css`. 3 logo exports (FINALSYMBOLLOGO, LOGO, SYMBOL) in `assets/logo/`.

- **forms/** — Button, IconButton, Input, Textarea, Select, Checkbox, Radio, Switch, Slider, Search
- **data/** — Tag, Badge, Avatar, Stat, Table
- **navigation/** — GNB, SecondaryBar, DetailBar, MobileNav, Tabs, Pagination, Menu
- **feedback/** — Tooltip, Notification, Dialog
- **layout/** — Card, Divider, Accordion
- **commerce/** — CollectibleCard

**Table:** Surface-based data table with sortable columns, row selection, and custom cell renderers. Header on darker surface, body rows with subtle hover. 16px rounded wrap.

**Tag color rule:** gray (neutral) by default; reserve color for meaning — brand = primary id, positive = verified/up, danger = down/sold-out, warning = true warnings only.

**Stat:** key-metric chip (muted label + bright value) for POP / Listed / Offers counts.

**DetailBar:** sticky buy bar for detail pages. `mobile` prop → bottom-fixed full-width price + Buy CTA.

**SecondaryBar:** pixel sub-nav. `mobile` prop → compact scrollable tabs at 58px.

---

---

# HTML prototypes

**Tokens / standalone:** `Tokenable Design System/` (repo root) — Figma CSS, showcase HTML. Not imported by Next.js.

**Screen HTML:** `Tokenable-with design system-5/` and later numbered folders remain layout/copy references. Earlier folders (`Tokenable-with design system/` … `-4`) are superseded for handoff.

## Page prototypes

| HTML file | Title | Next.js route(s) | Phase |
|-----------|-------|------------------|-------|
| `index.html` | Home (ds-23: pay conveyor, partner PNGs, `$284M` Vaulted) | `app/page.tsx` | 3 |
| `Markets.html` | Markets browse | `app/markets/page.tsx` | 4 |
| `Card.html` | Collection / card detail | `app/marketplace/collections/[collectionKey]/page.tsx` | 5 |
| `Portfolio.html` | Portfolio | `app/portfolio/page.tsx` | 6 |
| `Redeem.html` | Portfolio redeem (pay-first) | `app/portfolio/redeem/page.tsx` | ds-5 |
| `Watchlist.html` | Watchlist | `app/watchlist/page.tsx` | 7 |
| `Sell.html` | Sell entry router | `app/sell/page.tsx` | 2 (ds-v2) |
| `Sell-Flow.html` | KYC + vault choice + add cards (PSA ship / self mint) | `app/sell/flow/page.tsx` | ds-v2 |
| `Choose-Vault.html` | Vault choice (standalone) | `SellFlowChooseVault` in `/sell/flow` | ds-v2 |
| `PSA-Shipping.html` | Pack and tracking | `app/sell/shipping/page.tsx` | ds-v2 |
| `Vault.html` | Vault landing | `app/vault/page.tsx` | 8 |
| `Vault-Dashboard.html` / `Vault-Dashboard-Active.html` | Sell hub (ds-22 active: per-card In transit / Verifying / Vaulted / Rejected) | `app/vault/page.tsx` | 8 / ds-v2 Phase 2+7 |
| `Vault-Submit.html` | Personal mint submit | `app/vault/submit` + `MintForm` | 8 |
| `Vault-Detail.html` | Submission detail A~H | `app/vault/submissions/[id]` | 8 / ds-v2 |
| `Vault-Shipping.html` | (legacy) ship card | superseded by `PSA-Shipping.html` → `/sell/shipping` | — |

## Standalone exports

Bundled single-file versions for sharing (same UI as above):

- `Tokenable Home (Standalone).html`
- `Markets (Standalone).html`
- `Card Detail (Standalone).html`
- `Portfolio (Standalone).html`

## Shared scripts (prototype behavior)

| Script | Role | Next.js equivalent |
|--------|------|-------------------|
| `ds-base.js` | Loads `_ds/.../styles.css` | `frontend/design-system/styles.css` |
| `tk-footer.js` | Injects footer | `TkFooter` (Phase 2) |
| `tk-wallet.js` | Wallet button chrome | `HeaderAuthControls` + Privy |
| `tk-notifications.js` | Notification bell | `TkNotifications` (Phase 2) |
| `portfolio-modals.js` | Sell/List/Bid drawers | `TkActionSheet` + domain modals (Phase 6) |
| `portfolio-chart-v2.js` | Portfolio chart | Existing chart + DS styles (Phase 6) |
| `portfolio-calendar.js` | Date range UI | Portfolio filters (Phase 6) |
| `hero-slab-3d.js` | Home 3D slab (Three.js) | `HomeHeroSlabCarousel` + `heroSlabCarousel.ts` |
| `support.js` | `x-dc` prototype host | **Do not port** |

## Do not commit from prototype folder

- `uploads/` — designer screenshots and scratch
- `screenshots/` — reference JPGs only

---

# Screen → component inventory

Maps designer HTML sections to existing React modules. Use when implementing Phases 3–10.

---

## Global shell (Phase 2 — done)

| Prototype pattern | CSS / JS | React target | File |
|-------------------|----------|--------------|------|
| Sticky header 64px | `header`, `.gnb-*` | `TkHeader` | `components/layout/TkHeader.tsx` |
| Nav links | `.navlink`, `.navlink.on` | `HeaderDesktopNav`, `HeaderMobileNav` | `components/layout/header/HeaderNav.tsx` |
| Search dropdown | `.gnb-search-dropdown` | `TkHeaderSearch` | `components/layout/header/TkHeaderSearch.tsx` |
| Mobile burger | `.gnb-drawer` | drawer in `TkHeader` | `components/layout/TkHeader.tsx` |
| Mobile search overlay | `.gnb-search-overlay` | `TkHeaderSearch` | `components/layout/header/TkHeaderSearch.tsx` |
| Wallet connect | `tk-wallet.js` | `HeaderWalletMenu`, `HeaderWalletMenuPanel` | `components/layout/header/wallet/` |
| Dev network switch | `NetworkSwitcher` | Account dropdown (desktop) + mobile drawer | `components/network/NetworkSwitcher.tsx` |
| Notifications | `tk-notifications.js` | bell + panel | (Phase 10) |
| Footer | `tk-footer.js` | `TkFooter` | `components/layout/TkFooter.tsx` |
| FAQ | `FAQ.html` / `faq.js` | `FaqPage` | `components/faq/FaqPage.tsx` (`/faq`) |
| Page container | `.wrap` | `tkl-wrap` | `constants/layout.ts` (`APP_MAIN_SHELL_CLASS`) |

---

## DS primitives (Phase 1 — done)

| `tk-*` class | React component | Location |
|--------------|-----------------|----------|
| `.tk-btn--primary` / `neutral` / `subtle` / `ghost` / `danger`, sizes `md` `sm` `table` | `TkButton` | `components/ds/Button.tsx` |
| `.tk-iconbtn` | `TkIconButton` | `components/ds/IconButton.tsx` |
| `.tk-input`, `.tk-field`, `.tk-select-wrap` | `TkInput`, `TkTextarea`, `TkSelect`, `TkField` | `components/ds/Input.tsx`, `Field.tsx` |
| `.tk-dialog` | `TkDialog` | `components/ds/Dialog.tsx` |
| `.tk-sheet-*` | `TkActionSheet` | `components/ds/ActionSheet.tsx` |
| `.tk-tabs` | `TkTabs`, `TkTab` | `components/ds/Tabs.tsx` |
| `.tk-tag`, `.tk-badge`, `.tk-stat` | `TkTag` (`.tk-badge` / `.tk-stat` CSS-only for now) | `components/ds/Tag.tsx` |
| `.tk-card` | `TkCard` | `components/ds/Card.tsx` |
| `.tk-table` | `TkTable` | `components/ds/Table.tsx` |
| `.tk-search` | `TkSearchInput` | `components/ds/SearchInput.tsx` |
| `.tk-note` | `TkNote` | `components/ds/Note.tsx` |
| `.tk-check`, `.tk-switch` | `TkCheckbox`, `TkSwitch` | `components/ds/Checkbox.tsx` |
| `.tk-divider` | `TkDivider` | `components/ds/Divider.tsx` |
| `.tk-stepper` (dark/light, horizontal/vertical) | `TkStepper` | `components/ds/Stepper.tsx` |

**QA page:** `app/dev/design-system/page.tsx`

### Prototype-only card (market tile)

| Class | React component | Phase |
|-------|-----------------|-------|
| `.card`, `.card__img`, `.fav`, `.fav-btn` | `CollectibleCard` | `components/collectibles/CollectibleCard.tsx` + `styles/tokenable-collectible-card.css` |

---

## Home — `index.html` (Phase 3 — hero sync from index2-standalone)

| Section | Prototype class / id | React target | File |
|---------|----------------------|--------------|------|
| Hero + CTA | `.hero-section` (index2-standalone) | `HomeHero` | `components/home/HomeHero.tsx` — photo bg `assets/home/hero-bg.jpg` + 3D slab ring; tags + “The card market, finally liquid.” Below-hero sections still from ds-5 until confirmed. |
| 3D spinning slab | `#heroSlabCanvas` / `hero-slab-3d.js` | `HomeHeroSlabCarousel` | `lib/home/heroSlabCarousel.ts` — faces from `public/assets/home/newcards/c01.jpg`…`c06.jpg` |
| Price ticker | `.ticker-row` | `HomeTicker` | `components/home/HomeTicker.tsx` — landing only |
| Top movers | `.grid4`, `.card` | `HomeTopMovers` + `CollectibleCard` | wrap grid, 10 desktop / 8 mobile (ds-23) |
| Just vaulted | `.grid4`, `.card` | `HomeJustVaulted` | wrap grid, 10 desktop / 8 mobile (ds-23) |
| Features | `.feat` | `HomeFeatures` | `components/home/HomeFeatures.tsx` — ds-5: Instant settlement; Three guarantees, every token. |
| Every payment | `.pay-sec` | `HomePaySection` | `components/home/HomePaySection.tsx` — ds-23 conveyor + checkout phone |
| Partners + CTA | partners row | `HomePartners` | `components/home/HomePartners.tsx` — PSA, Beckett, eBay, Card Ladder, GemRate, PriceCharting (grayscale) |
| Page compose | — | `HomePageContent` | `components/home/HomePageContent.tsx` |

**Data:** `hooks/home/useHomeMarketplaceGrids.ts` (collections + snapshots)

---

## Markets — `Markets.html` (Phase 4 — ds-13 slim filters)

| Section | React target | File |
|---------|--------------|------|
| Page header | eyebrow + title | `components/markets/MarketsPageHeader.tsx` |
| Filter / sort bar | Pokemon / One Piece / NBA / MLB / Others + More filters + Sort | `components/markets/MarketsFilterBar.tsx` |
| Card grid | `MarketsCollectionGrid` + `CollectibleCard` | `components/markets/MarketsCollectionGrid.tsx`, `components/collectibles/CollectibleCard.tsx` |
| Page compose | `MarketsPage` | `components/markets/MarketsPage.tsx` |

**CSS:** `frontend/styles/tokenable-markets.css` (grid 5/3/3/2 — Markets.html `.grid4`; wrap 1240px for card size)

**Facets wired (client-side):** category chips on the slim bar; set / price / grade / vault live in **More filters**. Sort menu: price, newest, population (no Top gainers; no Clear/Done/check chrome). Year deferred until backend supports them.

---

## Search — `Search.html`

| Section | React target | File |
|---------|--------------|------|
| Route `/search?q=` | Cert-match rows + Markets grid | `app/search/page.tsx` → `MarketsPage` + `SearchCertMatches` |
| Result group headings | **Cards** (under the Cert match line) and **Collections** (above the grid), DS Heading 24/600 via `.srch-sec-title` | `SearchCertMatches`, `MarketsPage`, `styles/tokenable-markets.css` |
| Hero search | 62×560 field → `/search` | `components/home/HomeHero.tsx` |
| Header search | Typeahead cards then collections; Enter / View all → `/search` | `TkHeaderSearch` + `GET /marketplace/search` |

---

## Collection detail — `Card.html` (Phase 5 — ds-13 mobile trade bar; Phase 7 ≤768)

| Section | Prototype class | React target | File |
|---------|-----------------|--------------|------|
| Page shell | `.wrap` | `collection-detail-page` | `CollectionDetailLoadedView.tsx` |
| Breadcrumb | `.breadcrumb` | `CollectionDetailBreadcrumb` | `components/marketplace/collection-detail/CollectionDetailBreadcrumb.tsx` |
| Metrics / price band | `.notch` stat tiles | `CollectionPriceMetricsStrip` | `buildCollectionDetailMarketsSlots.tsx` |
| Chart + periods | `.tk-period`, Price history | `CollectionDetailPriceChart` | `components/marketplace/collection-detail/CollectionDetailPriceChart.tsx` |
| Trade ticket | `#tk-trade` | `CollectionDetailTradePanel` | `CollectionDetailTradePanel.tsx` — Buy / Bid / Sell (direct Privy) |
| Set-level bid | Sticky hero + mobile trade bar | `CollectionDetailStatMain` / `CollectionMobileTradeBar` | `CollectionDetailStatMain.tsx` — hero synced to Card.html ds-32: 150px contain + drop-shadow, title `clamp(17–24)`, meta 15px/`--t2`, price `clamp(26–38)`/800, Last price 15px/`0.16em` |
| Mobile trade bar | `#ob-bottom-bar` | `CollectionMobileTradeBar` (Buy $price / Bid #12305e / Sell white) | `CollectionMobileTradeBar.tsx` — Card.html ds-32: 52px · 700 · Buy `#2f6bff` flex:1 · Bid `#12305e` 26% · Sell `#fff`/`#2f6bff` 26% |
| Change bid | `#tkb-bid` | `CollectionListingBidCheckout` (portfolio) | `CollectionListingBidCheckout.tsx` |
| Trades / order book | sidebar `.notch` | `CollectionUnifiedOrderBook` | `components/marketplace/unified-order-book/*` |
| Details / PSA tabs | tab row + KV | `CollectionHeroDetailsTabs` + `CollectionDetailsKvCard` | Card.html ds-32: 110×1fr, value right, row 32px, attr-link → brand-400 |
| Overview layout | `card-detail-grid` | `CollectionOverviewBoard` | `components/marketplace/collection-overview/*` |

**CSS:** `frontend/styles/tokenable-collection-detail.css`

**Fees:** change-bid checkout fine print uses `feePercent()` from `platformFee.ts` (not hardcoded 5%).

**Existing route:** `app/marketplace/collections/[collectionKey]/page.tsx`

---

## Portfolio — `Portfolio.html` (Phase 6 — done)

| Section | Prototype class | React target | File |
|---------|-----------------|--------------|------|
| Page shell | `.wrap` | `portfolio-page` | `app/portfolio/page.tsx` |
| Value hero | eyebrow + value + 24h chip | `PortfolioSummaryBar` | `components/portfolio/PortfolioSummaryBar.tsx` |
| Stat grid | `.pf-stat-grid`, `.notch` | `PortfolioStatGrid` | `components/portfolio/PortfolioStatGrid.tsx` |
| Chart | `.notch` chart panel | `PortfolioValuePanel` | `components/portfolio/PortfolioValuePanel.tsx` |
| Tabs | `.tk-tabs` | `PortfolioMainSection` | `components/portfolio/PortfolioMainSection.tsx` |
| Holdings | gallery cards | `PortfolioHoldingsSection` + `PortfolioHoldingsGalleryTile` → `/portfolio/assets/[tokenId]` | `components/portfolio/*` |
| Certificate | `PortfolioAsset.html` | `PortfolioCertificateView` | `components/portfolio/PortfolioCertificateView.tsx` |
| Redeem entry | Certificate footer action | `PortfolioCertificatePage` writes a single-card redeem draft → `/portfolio/redeem` | `components/portfolio/PortfolioCertificatePage.tsx` |
| Bids | bid rows | `PortfolioCollectionBidsSection` | `components/portfolio/PortfolioCollectionBidsSection.tsx` |
| Watchlist tab | — | `PortfolioWatchlistSection` | `components/portfolio/PortfolioWatchlistSection.tsx` |
| Transaction history | `.tk-table` | `PortfolioActivitySection` | `components/portfolio/PortfolioActivitySection.tsx` |
| Confirm modals | portfolio-modals.js | `TkDialog` | `PortfolioHideConfirmModal`, `PortfolioCancelBidConfirmModal`, `PortfolioCancelListingConfirmModal` |

**CSS:** `frontend/styles/tokenable-portfolio.css`, `frontend/styles/tokenable-portfolio-redeem.css`

**Phase 3 (ds-v2):** Row CTA is ghost **Set price** / **Edit price** only (bid meta lives in the Set price drawer, not on the row). Drawer uses `ListRwaModal` `copyVariant="set-price"`. Cancel listing via confirm dialog (not row Cancel).

**ds-5 holdings note:** Card cell = thumb + name only (no redeem chip under/beside title). **In transit** / **Redeeming — preparing** chips live only in the Action column (`PortfolioHoldingsRowActions`). Transit CTA is **Track →** (Portfolio.html). Possession is Action text only. Gallery tile badge for any in-flight redeem is **Shipping out** (not Verifying).

---

## Portfolio Redeem — `Ship-From-Vault.html` (pay-first; product name Redeem)

Canonical prototype: `Tokenable-with design system-26/Ship-From-Vault.html` → `/portfolio/redeem` (route + `pf-redeem-*` unchanged). Eyebrow copy is **Redeem**, not Ship from vault. Card titles use Line 1 `{Name} · {Number} · {Grade}` (grade is not a separate chip).

| Screen | Prototype | React | File |
|--------|-----------|-------|------|
| Entry | Certificate of Ownership footer | Single-card **Redeem** → draft in sessionStorage | `PortfolioCertificateView`, `PortfolioCertificatePage` |
| Address | `#wd-request` | Ship-to + **address search** + **Calculate cost** (idle/loading/quoted/stale) → **Continue** | `RedeemRequestPanel`, `AddressSearchField`, `shipToValidation.ts` |
| Review and pay | `#wd-pay` | Cost + ship-to + USDC pay → redeem-batch | `RedeemPayPanel` |
| Preparing | `#wd-preparing` | Shipment progress + Paid + Cancel (disabled) + Back to Portfolio | `RedeemPreparingPanel`; `?view=preparing&batch=` |
| In transit | `#wd-transit` | Shipment box (Carrier / Tracking / Est. delivery / Grades) + Cards list + **I've received my cards** | `RedeemTransitPanel`; `?view=transit&batch=` |
| Done | `#wd-done` | H1 **Delivered** + possession copy | `RedeemDonePanel`; `?view=done&batch=` |

**Hooks / API:** `useRedeemFlow`, `useMyRedemptions`, `lib/core/api/rwa-redeem.ts`, draft + saved address `lib/portfolio/redeemDraft.ts`

**Admin:** Confirm release on burned cards → `postAdminConfirmRedemptionRelease`

**HTML sync notes (ds-26, Phase 0–8):** Certificate: idle *Redeem anytime*; in-flight heading uses the surface badge + **Redemption status**. Partner shipments share collector **Carrier** / **Tracking** labels, `FedEx`/`UPS`/`DHL` display names, DHL AWB track URL, and tracking `→`. Quoted cost matches `#wd-cost-box` / `costHTML`. Review and pay matches `#wd-pay`. Preparing matches `#wd-preparing`. In transit matches `#wd-transit` (no UUID request bar; shipment rows as `costHTML` lines). Eyebrow stays **Redeem**. Deferred: cancel redeem API, claim API. The HTML `#wd-batch-head` UUID bar stays hidden — a raw batch id is support-only, not collector UI.

---

## Portfolio / watchlist modals — `portfolio-modals.js` (Phase 6–7)

| Modal function | Purpose | React modal |
|----------------|---------|-------------|
| `pfSetPriceModal` | Set / Edit list price | `ListRwaModal` (`copyVariant="set-price"`) → sheet form |
| `pfSaleResult` | Listed / price updated / sold / fill-failed | `ActionCompleteModal` via `ListRwaModalSuccessView` (sheet closes first) |
| `pfAcceptOffersModal` | Accept highest bid | `PortfolioAcceptOfferModal` (wired later) |
| `pfCancelListingModal` | Cancel ask | `PortfolioCancelListingConfirmModal` |
| `pfCancelBidModal` | Cancel bid | `PortfolioCancelBidConfirmModal` |
| `pfRaiseBidModal` | Raise bid | `RaiseBidSheet` |
| `pfTargetPriceModal` | Watchlist alert | `TargetPriceSheet` |
| `pfRemoveWatchModal` | Remove watchlist | `RemoveWatchSheet` |
| `pfBuyNowModal` | Buy at ask | `BuyNowSheet` |
| `pfBidModal` | Place bid | `BidSheet` |

**Shell:** desktop right 420px drawer; mobile bottom sheet 85vh — `ds/ActionSheet`.

**Existing:** `ListRwaModal`, `PortfolioHideConfirmModal` → migrate to `ds/Dialog` or `ds/ActionSheet`.

---

## Watchlist — `Watchlist.html` (Phase 7 — done)

| Section | Prototype class | React target | File |
|---------|-----------------|--------------|------|
| Page shell | `.wrap` | `watchlist-page` | `components/watchlist/WatchlistPage.tsx` |
| Header | eyebrow + title | `WatchlistPageHeader` | `components/watchlist/WatchlistPageHeader.tsx` |
| Filter / sort bar | `markets-filter-*` | `MarketsFilterBar` | `components/markets/MarketsFilterBar.tsx` |
| Card grid | `.grid4`, `.card` | `WatchlistCollectionGrid` + `WatchlistCollectibleCard` | set 1-line ellipsis; no INSURED |
| Portfolio tab embed | — | `WatchlistPageContent` | `components/watchlist/WatchlistPageContent.tsx` |

**Watchlist card:** `WatchlistCollectibleCard` — set line (1-line ellipsis), gray grade chip, POP, split `card__per`, in-card Buy/Bid. Markets/home still use shared `CollectibleCard`.

**CSS:** `frontend/styles/tokenable-watchlist.css`

**Route:** `app/watchlist/page.tsx`

---

## Vault / Sell — **Live (real mint + Sell IA)**

Primary chrome label is **Sell** → `/sell` (design system-2 `Sell.html` router). Collector hub remains `/vault`.

| Route | React target |
|-------|--------------|
| `/sell` | `SellRouterView` — loader then → `/vault` (partner branch Phase 8) |
| `/sell/flow` | `SellFlowView` — Sell-Flow.html (KYC + consents → choose vault → add cards via PSA cert lookup) |
| `/sell/shipping` | `SellShippingView` — PSA-Shipping.html (progress: Submit → Ship → PSA → Live; pack checklist → tracking) |
| `/vault` | `VaultHubView` — landing / empty / **vaulting cards** (`VaultActiveDashboardView`, ds-22 Vault-Dashboard-Active.html) |
| `/vault/submit` | `MintForm`, `useMintForm` (PSA → IPFS → backend mint) |
| `/vault/submit` (`/vault/submit/mint` redirects here) | `MintForm` (personal/internal mint entry) |
| `/vault/submit/shipping` | redirect → `/vault/submit` |
| `/vault/submissions/[id]` | `VaultDetailDesignView` — Vault-Detail.html A~H (scenario query + live shipment) |
| `/vault/list` | redirect → `/portfolio` |

**CSS:** `frontend/styles/tokenable-vault.css` (includes `.sell-router`); sell flow + shipping in `tokenable-sell-flow.css`

**Shared:** `VaultShell`, `VaultStepper` (`TkStepper`), `VaultBreadcrumb`, `VaultThumb`

**Gate:** Hub `/vault`, submit paths, and `/vault/submissions/[id]` are open; other `/vault/*` stay coming-soon until `VAULT_PUBLIC_ENABLED`.

**Persistence:** Sell draft/ship → `POST /api/vault/submissions/*` (`vault_submissions` + items). LocalStorage remains offline fallback. Mint attaches `vault_cycle_id` on items.

**Removed:** list/shipping/submit DesignViews, `VaultDashboardView`, `VaultDemoToggle`, `VaultBadge`, `vaultMockData` inventory/FAQ. Detail remains as `VaultDetailDesignView` (A~H; add `?demo=1` for scenario switcher).

**Lib:** `lib/sell/sellFlowDraft.ts` (draft + PSA ship address + packing checklist); `lib/vault/vaultDetailScenarios.ts`; `lib/vault/vaultHubTypes.ts`; `lib/vault/buildVaultHubRows.ts`; `lib/core/api/vault-submissions.ts`

---

## RWA token detail — (Phase 9) — **Done** (page tree removed)

`/marketplace/[tokenId]` redirects to collection detail + `?listing=`. Buy/bid/sell on collection uses the trade panel (`#tk-trade`); portfolio Set/Edit price still uses `ListRwaModal`.

**CSS:** `frontend/styles/tokenable-rwa-detail.css` (ListRwaModal `tk-price` sheet; imported from portfolio layouts)

**Kept:** `ListRwaModalHost` (under `list-rwa/`), `PsaVaultOutlineTag`, `useRwaDetailMetadata`

---

## Auth and secondary (Phase 10) — **Done**

| Surface | Notes |
|---------|--------|
| Login / signup | Header Sign up + `openSignIn` → Privy modal |
| Profile | `app/profile/page.tsx` — `TkButton`, `TkTag`, secondary panels |
| Site access | `SiteAccessClient` — `TkField` / `TkInput` / `TkButton` |
| Auth modals | `TkDialog` — delete account, KYC, wallet mismatch |
| Admin | `adminUi.ts`; light shell; brand via `--brand-500` |

**CSS:** `frontend/styles/tokenable-secondary.css`

---

## Marketplace admin (backoffice)

| Route | Component | Notes |
|-------|-----------|--------|
| `/marketplace/admin` | `MarketplaceAdminOverviewPage` | KPIs, funnel, GA4 |
| `/marketplace/admin/users` | `MarketplaceAdminUsersPage` | User search, detail rows |
| `/marketplace/admin/collections` | `MarketplaceAdminCollectionsPage` | Bucket admin, delete |
| `/marketplace/admin/cards` | `MarketplaceAdminCardsPage` | RWA registry, burn |
| `/marketplace/admin/custody-nfts` | `MarketplaceAdminCustodyNftsPage` | Deliver vaulted cards |
| `/marketplace/admin/markets` | `MarketplaceAdminMarketsPage` | Home landing preview |
| `/marketplace/admin/portfolio` | `MarketplaceAdminPortfolioPage` | Snapshots, cost basis ops |
| `/marketplace/admin/price-webhooks` | `MarketplaceAdminPriceWebhooksPage` | Cardhedger delta import |
| `/marketplace/admin/contract-roles` | `MarketplaceAdminContractRolesPage` | On-chain roles |
| `/marketplace/admin/vault` | `MarketplaceAdminVaultPage` | PSA API tooling |
| `/marketplace/admin/vault/submissions` | `MarketplaceAdminVaultSubmissionsPage` | Sell-flow package ops (pipeline, arrive, approve/reject) |

**Shared:** `adminUi.ts`, `MarketplaceAdminShell`, `MarketplaceAdminNav`, `nav/adminNavConfig.ts`, `frontend/styles/tokenable-admin.css` (sidebar chrome from `admin/` HTML)

---

## Partner vault — ds-13 Partner-* (Phase 5)

| HTML | Route | React |
|------|-------|-------|
| `Partner-Portfolio.html` | `/partner/portfolio` | `PortfolioPageView` variant=partner — Redeem requests (`tkl-view-all`) in `PortfolioValuePanel`; tabs: My Assets / Active Bids / Transaction History only + **Redeem** toolbar btn; GNB is Markets / Portfolio / Sell only; redeem queue also in account menu / mobile drawer for active partners; `/portfolio` redirects here |
| `Partner-Add-Cards.html` | `/partner/add-cards` | redirects to `/sell/flow` with `vaultChoice=self` |
| `Partner-Shipments.html` | `/partner/shipments` | `PartnerShipmentsView` — **Carrier** / **Tracking** same as collector transit (`formatCarrierLabel`, `buildCarrierTrackingUrl`); tracking via `PATCH …/redeems/batches/:id/tracking` |
| `Partner-Shipping-Origin.html` | Settings `#partner-origin` | existing Origin modal + Settings section |

**Gate:** `PartnerGate` via `GET /marketplace/partners/me`  
**API:** `GET/PATCH …/partners/me/redeems…` (writes same `vault_redemptions` tracking as admin)  
**Admin Origin:** `/marketplace/admin/users/:id` → 파트너 vault panel (`AdminPartnerOriginPanel`) uses admin GET/PUT company-address  
**CSS:** `tokenable-partner.css` (underline tabs + ≤1100 card meta; ≤640 stack CTAs + bottom-sheet modal)  
**Sell router:** partners → `/partner/add-cards` via `resolveSellRouterDestinationAsync`

---

## ds-13 Phase 6 — Partner ↔ Admin SoT (done)

- Admin user-detail Origin panel (`AdminPartnerOriginPanel`) via admin company-address GET/PUT
- Admin Redeems locked tracking shows carrier + shared-SoT note
- Terminology: Partner vault (not Self vault) in admin partner docs/UI

## ds-13 Phase 7 — Global UI polish / responsive (done)

Skin-only alignment with HTML (no new APIs):

- Card trade bar + shell clearance at ≤768 (`md:hidden` / `max-md:pb`)
- Markets “More filters” icon-only on ≤640; Portfolio tabs equal-width + table→cards at ≤768
- Sell / Choose-Vault / PSA shipping light canvas (`tokenable-sell-flow.css`)
- Partner Shipments underline tabs + dense cards ≤1100
- Login fallback atmosphere + orbit card (`secondary-page--auth`)
- Footer column ≤768; Settings snav collapse ≤860 / short labels ≤640
- Redeem ship-to + summary wrap ≤768; drawer safe-area padding

Deferred (feature, not polish): claim API, cancel redeem, Markets unsupported facets, partner application approve/reject, PSA return-address intake API.

---

## Visual token bridge (Phase 1)

| Legacy (current app) | New DS |
|----------------------|--------|
| `--mint` `#10d333` | `--brand-500` `#1A6FFF` |
| `bg-gray-950` | `--background-default-default` |
| Geist sans/mono | Inter / JetBrains Mono |
| Rounded Tailwind buttons | `tk-btn` pixel clip-path |

Remove bridge aliases after Phase 10.

