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
| Wallet connect | `tk-wallet.js` | `HeaderWalletMenu`, `HeaderWalletMenuPanel` | `components/layout/header/wallet/` |
| Dev network switch | `NetworkSwitcher` | Account dropdown (desktop) + mobile drawer | `components/network/NetworkSwitcher.tsx` |
| Notifications | `tk-notifications.js` | bell + panel | (Phase 10) |
| Footer | `tk-footer.js` | `TkFooter` | `components/layout/TkFooter.tsx` |
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

## Home — `index.html` (Phase 3 — hero sync from index2-standalone)

| Section | Prototype class / id | React target | File |
|---------|----------------------|--------------|------|
| Hero + CTA | `.hero-section` (index2-standalone) | `HomeHero` | `components/home/HomeHero.tsx` — photo bg `assets/home/hero-bg.jpg` + 3D slab ring; tags + “The card market, finally liquid.” Below-hero sections still from ds-5 until confirmed. |
| 3D spinning slab | `#heroSlabCanvas` / `hero-slab-3d.js` | `HomeHeroSlabCarousel` | `lib/home/heroSlabCarousel.ts` — faces from `public/assets/home/newcards/c01.jpg`…`c06.jpg` |
| Price ticker | `.ticker-row` | `HomeTicker` | `components/home/HomeTicker.tsx` |
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
| Ticker | `HomeTicker` | `components/home/HomeTicker.tsx` |
| Filter / sort bar | Pokemon / One Piece / NBA / MLB / Others chips + Grade / Price + More filters + Sort | `components/markets/MarketsFilterBar.tsx` |
| Card grid | `MarketsCollectionGrid` + `CollectibleCard` | `components/markets/MarketsCollectionGrid.tsx`, `components/collectibles/CollectibleCard.tsx` |
| Page compose | `MarketsPage` | `components/markets/MarketsPage.tsx` |

**CSS:** `frontend/styles/tokenable-markets.css` (grid 6/5/3/3/2 — do not regress)

**Facets wired (client-side):** category (Pokemon / One Piece / NBA / MLB / Others), price, grade (PSA 10 / 9, BGS Pristine / 10 / 9.5), sort. Year / vault / category tree deferred until backend supports them.

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
| Listings grid | `.notch` listing cards | `CollectionDetailListingsGrid` + `CollectionRwaCard` (Buy-only) | `components/marketplace/collection-detail/*` |
| Set-level bid | Sticky hero + mobile trade bar | `CollectionDetailStatMain` / `CollectionMobileTradeBar` | `CollectionDetailStatMain.tsx` |
| Mobile trade bar | `#ob-bottom-bar` | `CollectionMobileTradeBar` (Buy now / Place bid) | `CollectionMobileTradeBar.tsx` |
| Listing detail | `#tk-prov` | `CollectionListingDetailModal` | `CollectionListingDetailModal.tsx` |
| Trades / order book | sidebar `.notch` | `CollectionUnifiedOrderBook` | `components/marketplace/unified-order-book/*` |
| Details / PSA tabs | tab row | `CollectionHeroDetailsTabs` | `components/marketplace/collection-hero/*` |
| Overview layout | `card-detail-grid` | `CollectionOverviewBoard` | `components/marketplace/collection-overview/*` |

**CSS:** `frontend/styles/tokenable-collection-detail.css`

**Fees:** bid checkout fine print uses `feePercent()` from `platformFee.ts` (not hardcoded 5%).

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
| Holdings | gallery cards | `PortfolioHoldingsSection` + `PortfolioHoldingsGalleryTile` → `/portfolio/assets/[tokenId]` | `components/portfolio/*` |
| Certificate | `PortfolioAsset.html` | `PortfolioCertificateView` | `components/portfolio/PortfolioCertificateView.tsx` |
| Redeem entry | Certificate footer action | `PortfolioCertificatePage` writes a single-card redeem draft → `/portfolio/redeem` | `components/portfolio/PortfolioCertificatePage.tsx` |
| Bids | bid rows | `PortfolioCollectionBidsSection` | `components/portfolio/PortfolioCollectionBidsSection.tsx` |
| Watchlist tab | — | `PortfolioWatchlistSection` | `components/portfolio/PortfolioWatchlistSection.tsx` |
| Transaction history | `.tk-table` | `PortfolioActivitySection` | `components/portfolio/PortfolioActivitySection.tsx` |
| Confirm modals | portfolio-modals.js | `TkDialog` | `PortfolioHideConfirmModal`, `PortfolioCancelBidConfirmModal`, `PortfolioCancelListingConfirmModal` |

**CSS:** `frontend/styles/tokenable-portfolio.css`, `frontend/styles/tokenable-portfolio-redeem.css`

**Phase 3 (ds-v2):** Row CTA is ghost **Set price** / **Edit price** only (bid meta lives in the Set price drawer, not on the row). Drawer uses `ListRwaModal` `copyVariant="set-price"`. Cancel listing via confirm dialog (not row Cancel).

**ds-5 holdings note:** Card cell = thumb + name only (no redeem chip under/beside title). **In transit** / **Redeeming — preparing** chips + View status live only in the Action column (`PortfolioHoldingsRowActions`). Possession is Action text only.

---

## Portfolio Redeem — `Ship-From-Vault.html` / design system-13 (pay-first)

Product copy uses **Redeem**. Canonical prototype: `Tokenable-with design system-13/Ship-From-Vault.html` → `/portfolio/redeem` (route + `pf-redeem-*` unchanged).

| Screen | Prototype | React | File |
|--------|-----------|-------|------|
| Entry | Certificate of Ownership footer | Single-card **Redeem** → draft in sessionStorage | `PortfolioCertificateView`, `PortfolioCertificatePage` |
| Address | `#wd-request` | Ship-to + **Calculate shipping cost** (idle/loading/quoted/stale) → **Review and pay** | `RedeemRequestPanel`, `shipToValidation.ts` |
| Review & pay | `#wd-pay` | Cost + ship-to + USDC pay → redeem-batch | `RedeemPayPanel` |
| Preparing | `#wd-preparing` | Payment-received banner + progress | `RedeemPreparingPanel`; `?view=preparing` |
| In transit | `#wd-transit` | Tracking links + per-card Report (UI-only) + per-shipment received checklist | `RedeemTransitPanel`; `?view=transit` |
| Done | `#wd-done` | Possession complete | `RedeemDonePanel`; `?view=done` |

**Hooks / API:** `useRedeemFlow`, `useMyRedemptions`, `lib/core/api/rwa-redeem.ts`, draft + saved address `lib/portfolio/redeemDraft.ts`

**Admin:** Confirm release on burned cards → `postAdminConfirmRedemptionRelease`

**HTML sync notes (ds-13):** Pay-first UX — address → pay → preparing → transit → done. Deferred: cancel redeem API, real claim/report API, PSA return-address intake (UI stores locally + prefills from Settings).

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
| Page shell + ticker | `.wrap`, ticker | `watchlist-page`, `HomeTicker` | `components/watchlist/WatchlistPage.tsx` |
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
| `/vault/submit/mint` | `MintForm` (personal/internal mint entry) |
| `/vault/submit/shipping` | redirect → `/vault/submit` |
| `/vault/submissions/[id]` | `VaultDetailDesignView` — Vault-Detail.html A~H (scenario query + live shipment) |
| `/vault/list` | redirect → `/portfolio` |
| `/sell/p2p` | P2P list flow (separate) |

**CSS:** `frontend/styles/tokenable-vault.css` (includes `.sell-router`); sell flow + shipping in `tokenable-sell-flow.css`

**Shared:** `VaultShell`, `VaultStepper`, `VaultBreadcrumb`, `VaultThumb`

**Gate:** Hub `/vault`, submit paths, and `/vault/submissions/[id]` are open; other `/vault/*` stay coming-soon until `VAULT_PUBLIC_ENABLED`.

**Persistence:** Sell draft/ship → `POST /api/vault/submissions/*` (`vault_submissions` + items). LocalStorage remains offline fallback. Mint attaches `vault_cycle_id` on items.

**Removed:** list/shipping/submit DesignViews, `VaultDashboardView`, `VaultDemoToggle`, `VaultBadge`, `vaultMockData` inventory/FAQ. Detail remains as `VaultDetailDesignView` (A~H; add `?demo=1` for scenario switcher).

**Lib:** `lib/sell/sellFlowDraft.ts` (draft + PSA ship address + packing checklist); `lib/vault/vaultDetailScenarios.ts`; `lib/vault/vaultHubTypes.ts`; `lib/vault/buildVaultHubRows.ts`; `lib/vault/buildPartnerVaultHubRows.ts`; `lib/core/api/vault-submissions.ts`

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
| `/marketplace/admin/vault/submissions` | `MarketplaceAdminVaultSubmissionsPage` | Sell-flow package ops (pipeline, arrive, approve/reject) |
| `/dev/admin-ui` | `AdminUiShowcase` | Admin UI contract (not production) |

**Shared:** `adminUi.ts`, `MarketplaceAdminShell`, `MarketplaceAdminNav`, `nav/adminNavConfig.ts`, `frontend/styles/tokenable-admin.css` (sidebar chrome from `admin/` HTML)

---

## Partner vault — ds-13 Partner-* (Phase 5)

| HTML | Route | React |
|------|-------|-------|
| `Partner-Portfolio.html` | `/partner/portfolio` | `PortfolioPageView` variant=partner — Redeem requests (`tkl-view-all`) in `PortfolioValuePanel`; tabs: My Assets / Active Bids / Transaction History only + **Redeem** toolbar btn; GNB is Markets / Portfolio / Sell only; redeem queue also in account menu / mobile drawer for active partners; `/portfolio` redirects here |
| `Partner-Add-Cards.html` | `/partner/add-cards` | redirects to `/sell/flow` with `vaultChoice=self` |
| `Partner-Shipments.html` | `/partner/shipments` | `PartnerShipmentsView` — breadcrumb, summary pills, 24h urgency banner, tabs; tracking via `PATCH …/redeems/batches/:id/tracking` with `redemptionIds` (scoped by `trackingGroupKey` = batch + ship-to) → same `vault_redemptions` rows as admin redeem page |
| `Partner-Shipping-Origin.html` | Settings `#partner-origin` | existing Origin modal + Settings section |

**Gate:** `PartnerGate` via `GET /marketplace/partners/me`  
**API:** `GET/PATCH …/partners/me/redeems…` (writes same `vault_redemptions` tracking as admin)  
**Admin Origin:** `/marketplace/admin/partners` → Origin expand panel (`AdminPartnerOriginPanel`) uses admin GET/PUT company-address  
**CSS:** `tokenable-partner.css` (underline tabs + ≤1100 card meta; ≤640 stack CTAs + bottom-sheet modal)  
**Sell router:** partners → `/partner/add-cards` via `resolveSellRouterDestinationAsync`

---

## ds-13 Phase 6 — Partner ↔ Admin SoT (done)

- Admin Partners Origin panel (`AdminPartnerOriginPanel`) via admin company-address GET/PUT
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
