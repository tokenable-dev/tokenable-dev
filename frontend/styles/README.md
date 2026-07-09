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

## Tailwind v4 + `tokenable-*.css` (required)

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
