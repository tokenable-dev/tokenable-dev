# HTML prototypes (designer handoff)

Path: `Tokenable-with design system-4/` (repo root). **Preferred HTML reference** — not imported by Next.js. Earlier folders (`Tokenable-with design system/`, `…-2/`, `…-3/`) are superseded for handoff.

## Page prototypes

| HTML file | Title | Next.js route(s) | Phase |
|-----------|-------|------------------|-------|
| `index.html` | Home | `app/page.tsx` | 3 |
| `Markets.html` | Markets browse | `app/markets/page.tsx` | 4 |
| `Card.html` | Collection / card detail | `app/marketplace/collections/[collectionKey]/page.tsx` | 5 |
| `Portfolio.html` | Portfolio | `app/portfolio/page.tsx` | 6 |
| `Watchlist.html` | Watchlist | `app/watchlist/page.tsx` | 7 |
| `Sell.html` | Sell entry router | `app/sell/page.tsx` | 2 (ds-v2) |
| `Sell-Flow.html` | KYC + vault choice + add cards (PSA ship / self mint) | `app/sell/flow/page.tsx` | ds-v2 |
| `Choose-Vault.html` | Vault choice (standalone) | `SellFlowChooseVault` in `/sell/flow` | ds-v2 |
| `PSA-Shipping.html` | Pack & tracking | `app/sell/shipping/page.tsx` | ds-v2 |
| `Vault.html` | Vault landing | `app/vault/page.tsx` | 8 |
| `Vault-Dashboard.html` / `Vault-Dashboard-Active.html` | Sell hub | `app/vault/page.tsx` | 8 / ds-v2 Phase 2+7 |
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
