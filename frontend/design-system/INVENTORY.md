# Design system — screen & component inventory

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
| Wallet connect | `tk-wallet.js` | `HeaderWalletMenu`, `HeaderMobileWalletSection` | `components/layout/header/wallet/` |
| Notifications | `tk-notifications.js` | bell + panel | (Phase 10) |
| Footer | `tk-footer.js` | `TkFooter` | `components/layout/TkFooter.tsx` |
| Page container | `.wrap` | `tkl-wrap` | `constants/layout.ts` (`APP_MAIN_SHELL_CLASS`) |

---

## DS primitives (Phase 1 — done)

| `tk-*` class | React component | Location |
|--------------|-----------------|----------|
| `.tk-btn--primary` etc. | `TkButton` | `components/ds/Button.tsx` |
| `.tk-iconbtn` | `TkIconButton` | `components/ds/IconButton.tsx` |
| `.tk-input`, `.tk-field` | `TkInput`, `TkField` | `components/ds/Input.tsx`, `Field.tsx` |
| `.tk-dialog` | `TkDialog` | `components/ds/Dialog.tsx` |
| `.tk-sheet-*` | `TkActionSheet` | `components/ds/ActionSheet.tsx` |
| `.tk-tabs` | `TkTabs`, `TkTab` | `components/ds/Tabs.tsx` |
| `.tk-tag`, `.tk-badge`, `.tk-stat` | `TkTag`, `TkBadge`, `TkStat` | `components/ds/Tag.tsx` |
| `.tk-card` | `TkCard` | `components/ds/Card.tsx` |
| `.tk-table` | `TkTable` | `components/ds/Table.tsx` |
| `.tk-search` | `TkSearchInput` | `components/ds/SearchInput.tsx` |
| `.tk-note` | `TkNote` | `components/ds/Note.tsx` |
| `.tk-check`, `.tk-switch` | `TkCheckbox`, `TkSwitch` | `components/ds/Checkbox.tsx` |
| `.tk-divider` | `TkDivider` | `components/ds/Divider.tsx` |

**QA page:** `app/dev/design-system/page.tsx`

### Prototype-only card (market tile)

| Class | React component | Phase |
|-------|-----------------|-------|
| `.card`, `.card__img`, `.fav`, `.fav-btn` | `CollectibleCard` | `components/collectibles/CollectibleCard.tsx` + `styles/tokenable-collectible-card.css` |

---

## Home — `index.html` (Phase 3 — done)

| Section | Prototype class / id | React target | File |
|---------|----------------------|--------------|------|
| Hero + CTA | hero block, `.btn--primary` | `HomeHero` | `components/home/HomeHero.tsx` |
| 3D spinning slab | `hero-slab-3d.js` | `HomeHeroSlabCarousel` | `lib/home/heroSlabCarousel.ts`, `components/home/HomeHeroSlabCarousel.tsx` — tiers: `docs/guides/hero-carousel-performance.md` |
| Price ticker | `.ticker-row` | `HomeTicker` | `components/home/HomeTicker.tsx` |
| Top movers | `.grid4`, `.card` | `HomeTopMovers` + `CollectibleCard` | `components/home/HomeTopMovers.tsx` |
| Just vaulted | `.grid4`, `.card` | `HomeJustVaulted` | `components/home/HomeJustVaulted.tsx` |
| Features | `.feat` | `HomeFeatures` | `components/home/HomeFeatures.tsx` |
| Partners + CTA | partners row | `HomePartners` | `components/home/HomePartners.tsx` |
| Page compose | — | `HomePageContent` | `components/home/HomePageContent.tsx` |

**Data:** `hooks/home/useHomeMarketplaceGrids.ts` (collections + snapshots)

---

## Markets — `Markets.html` (Phase 4 — done)

| Section | React target | File |
|---------|--------------|------|
| Page header | eyebrow + title | `components/markets/MarketsPageHeader.tsx` |
| Ticker | `HomeTicker` | `components/home/HomeTicker.tsx` |
| Filter / sort bar | `MarketsFilterBar` | `components/markets/MarketsFilterBar.tsx` |
| Card grid | `MarketsCollectionGrid` + `CollectibleCard` | `components/markets/MarketsCollectionGrid.tsx`, `components/collectibles/CollectibleCard.tsx` |
| Page compose | `MarketsPage` | `components/markets/MarketsPage.tsx` |

**CSS:** `frontend/styles/tokenable-markets.css`

---

## Collection detail — `Card.html` (Phase 5 — done)

| Section | Prototype class | React target | File |
|---------|-----------------|--------------|------|
| Page shell | `.wrap` | `collection-detail-page` | `CollectionDetailLoadedView.tsx` |
| Breadcrumb | `.breadcrumb` | `CollectionDetailBreadcrumb` | `components/marketplace/collection-detail/CollectionDetailBreadcrumb.tsx` |
| Metrics / price band | `.notch` stat tiles | `CollectionPriceMetricsStrip` | `buildCollectionDetailMarketsSlots.tsx` |
| Chart + periods | `.tk-period`, Price history | `CollectionDetailPriceChart` | `components/marketplace/collection-detail/CollectionDetailPriceChart.tsx` |
| Listings grid | `.notch` listing cards | `CollectionDetailListingsGrid` + `CollectionRwaCard` | `components/marketplace/collection-detail/*` |
| Trades / order book | sidebar `.notch` | `CollectionUnifiedOrderBook` | `components/marketplace/unified-order-book/*` |
| Details / PSA tabs | tab row | `CollectionHeroDetailsTabs` | `components/marketplace/collection-hero/*` |
| Overview layout | `card-detail-grid` | `CollectionOverviewBoard` | `components/marketplace/collection-overview/*` |

**CSS:** `frontend/styles/tokenable-collection-detail.css`

**Existing route:** `app/marketplace/collections/[collectionKey]/page.tsx`

---

## Portfolio — `Portfolio.html` (Phase 6 — done)

| Section | Prototype class | React target | File |
|---------|-----------------|--------------|------|
| Page shell + ticker | `.wrap`, ticker | `portfolio-page`, `HomeTicker` | `app/portfolio/page.tsx` |
| Value hero | eyebrow + value + 24h chip | `PortfolioSummaryBar` | `components/portfolio/PortfolioSummaryBar.tsx` |
| Stat grid | `.pf-stat-grid`, `.notch` | `PortfolioStatGrid` | `components/portfolio/PortfolioStatGrid.tsx` |
| Chart | `.notch` chart panel | `PortfolioValuePanel` | `components/portfolio/PortfolioValuePanel.tsx` |
| Tabs | `.tk-tabs` | `PortfolioMainSection` | `components/portfolio/PortfolioMainSection.tsx` |
| Holdings | card grid | `PortfolioHoldingsSection` + `PortfolioAssetCard` + `PortfolioAssetCardCta` | `components/portfolio/*` |
| Bids | bid rows | `PortfolioCollectionBidsSection` | `components/portfolio/PortfolioCollectionBidsSection.tsx` |
| Watchlist tab | — | `PortfolioWatchlistSection` | `components/portfolio/PortfolioWatchlistSection.tsx` |
| Transaction history | `.tk-table` | `PortfolioActivitySection` | `components/portfolio/PortfolioActivitySection.tsx` |
| Confirm modals | portfolio-modals.js | `TkDialog` | `PortfolioHideConfirmModal`, `PortfolioCancelBidConfirmModal` |

**CSS:** `frontend/styles/tokenable-portfolio.css`

---

## Portfolio / watchlist modals — `portfolio-modals.js` (Phase 6–7)

| Modal function | Purpose | React modal |
|----------------|---------|-------------|
| `pfSellModal` | Accept highest bid | `PortfolioSellSheet` |
| `pfListModal` | Create listing + OB preview | extend `ListRwaModal` → ActionSheet |
| `pfCancelListingModal` | Cancel ask | `CancelListingSheet` |
| `pfCancelBidModal` | Cancel bid | `CancelBidSheet` |
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
| Page shell + ticker | `.wrap`, ticker | `watchlist-page`, `HomeTicker` | `components/watchlist/WatchlistPage.tsx` |
| Header | eyebrow + title | `WatchlistPageHeader` | `components/watchlist/WatchlistPageHeader.tsx` |
| Filter / sort bar | `markets-filter-*` | `MarketsFilterBar` | `components/markets/MarketsFilterBar.tsx` |
| Card grid | `.grid4`, `.card` | `WatchlistCollectionGrid` + `WatchlistCollectibleCard` | `components/watchlist/*` |
| Portfolio tab embed | — | `WatchlistPageContent` | `components/watchlist/WatchlistPageContent.tsx` |

**Watchlist card:** `WatchlistCollectibleCard` — set line, gray grade chip, POP + INSURED, split `card__per`, in-card Buy/Bid (HTML parity). Markets/home still use shared `CollectibleCard`.

**CSS:** `frontend/styles/tokenable-watchlist.css`

**Route:** `app/watchlist/page.tsx`

---

## Vault — **Live (real mint)**

| Route | React target |
|-------|--------------|
| `/vault` | `VaultHubView` (landing / empty dashboard) |
| `/vault/submit` | `MintForm`, `useMintForm` (PSA → IPFS → backend mint) |
| `/vault/submit/mint` | redirect → `/vault/submit` |
| `/vault/submit/shipping` | redirect → `/vault/submit` |
| `/vault/submissions/[id]` | redirect → `/vault` |
| `/vault/list` | redirect → `/portfolio` |

**CSS:** `frontend/styles/tokenable-vault.css`

**Shared:** `VaultShell`, `VaultStepper`, `VaultBreadcrumb`, `VaultBadge`

**Removed:** design-mock views (`Vault*DesignView`, `VaultDashboardView`, `VaultDemoToggle`), vault/home/markets/portfolio mock data modules

---

## RWA token detail — (Phase 9) — **Done**

Overlap with Card.html sidebar: list/buy/trade panel.

**CSS:** `frontend/styles/tokenable-rwa-detail.css`

**Components:** `RwaDetailPageShell`, `RwaDetailBreadcrumb`, `RwaDetailLoadedView`, trade panels, `RwaDetailListModalHost` (sheet), `RwaDetailPlaceBidModal` (sheet)

**Existing (logic preserved):** `app/marketplace/[tokenId]/page.tsx`, `hooks/rwa-detail/*`, `RwaDetailAssetPanel`

---

## Auth & secondary (Phase 10) — **Done**

| Surface | Notes |
|---------|--------|
| Login / signup | `PrivyAuthEntryPage` + DS auth card |
| Profile | `app/profile/page.tsx` — `TkButton`, `TkTag`, secondary panels |
| Site access | `SiteAccessClient` — `TkField` / `TkInput` / `TkButton` |
| Auth modals | `TkDialog` — delete account, KYC, wallet mismatch |
| Admin | `adminUi.ts` + `/dev/admin-ui` showcase; light shell; brand via `--brand-500` |

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
| `/marketplace/admin/markets` | `MarketplaceAdminMarketsPage` | Home / Top 100 / movers preview |
| `/marketplace/admin/portfolio` | `MarketplaceAdminPortfolioPage` | Snapshots, cost basis ops |
| `/marketplace/admin/price-webhooks` | `MarketplaceAdminPriceWebhooksPage` | Cardhedger delta import |
| `/marketplace/admin/contract-roles` | `MarketplaceAdminContractRolesPage` | On-chain roles |
| `/marketplace/admin/vault` | `MarketplaceAdminVaultPage` | PSA API tooling |
| `/dev/admin-ui` | `AdminUiShowcase` | Admin UI contract (not production) |

**Shared:** `adminUi.ts`, `MarketplaceAdminShell`, `MarketplaceAdminNav`, `nav/adminNavConfig.ts`

---

## Visual token bridge (Phase 1)

| Legacy (current app) | New DS |
|----------------------|--------|
| `--mint` `#10d333` | `--brand-500` `#0033FF` |
| `bg-gray-950` | `--background-default-default` |
| Geist sans/mono | Inter / JetBrains Mono |
| Rounded Tailwind buttons | `tk-btn` pixel clip-path |

Remove bridge aliases after Phase 10.
