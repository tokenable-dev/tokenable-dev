# Frontend styles

CSS is loaded once via `app/globals.css`. Do not import page CSS from components.

## Shared (import before page files)

| File | Use |
|------|-----|
| `tokenable-ds-entry.css` | Design system tokens + `tk-*` components |
| `tokenable-ds-bridge.css` | `--font-*`, ink/azure aliases |
| `tokenable-layout.css` | Header, footer, `tkl-wrap`, app shell |
| `tokenable-wallet-menu.css` | GNB wallet chip + dropdown — imported from `TkHeader.tsx` (Turbopack dev module graph) |
| `tokenable-collectible-card.css` | `.card`, `.card__*`, `.fav-btn` — `CollectibleCard` |

## Page-specific

| File | Route / screen |
|------|----------------|
| `tokenable-home.css` | `/` — hero, ticker, grid4, features, partners |
| `tokenable-markets.css` | `/markets` |
| `tokenable-watchlist.css` | `/watchlist` |
| `tokenable-collection-detail.css` | Collection detail |
| `tokenable-portfolio.css` | `/portfolio` |
| `tokenable-vault.css` | Vault flow |
| `tokenable-rwa-detail.css` | Token detail |
| `tokenable-secondary.css` | Auth, profile, site gate |

When adding a new screen from `Tokenable-with design system/*.html`, add or extend the matching `tokenable-*.css` file. Reuse `CollectibleCard` and `tkl-wrap` before inventing new layout primitives.
