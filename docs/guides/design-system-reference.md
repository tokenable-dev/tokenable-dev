# Design system reference

**Canonical guide for implementing or extending Tokenable UI.**  
Read this before any visual work. Phased migration (0–10) is complete — do not create new phase docs.

**AI agents:** `.cursor/rules/design-system-migration.mdc` and `.cursor/rules/design-system-reference.mdc` apply to `frontend/**` and point here first.

**Governance:** `Tokenable-with design system-2/` is the preferred HTML reference; `Tokenable-with design system/` is the earlier export. Neither is imported by Next.js — update `frontend/design-system/` intentionally when adopting prototype changes.

---

## Source of truth (designer + engineering)

| Layer | Path | Role |
|-------|------|------|
| Designer prototype | `Tokenable-with design system/` | HTML / `_ds` bundle — **reference only**, not imported by Next.js |
| Committed DS | `frontend/design-system/` | Tokens + `tk-*` CSS — **canonical styles for production** |
| React primitives | `frontend/components/ds/` | `TkButton`, `TkDialog`, … |
| App wiring | `frontend/styles/tokenable-ds-entry.css`, `globals.css` | Imports committed DS only |

**Prototype updates do not auto-apply to the app.** Production UI changes only when `frontend/design-system/` (and related React/CSS) is intentionally updated and merged.

---

## Scope (what we have today)

| Status | Meaning |
|--------|---------|
| **Built** | Figma-exported tokens, `tk-*` CSS primitives, React `Tk*` wrappers, page shell, major routes migrated |
| **Hybrid** | Some pages still use bridge aliases (`--azure`, `--ink`) or page-local CSS — acceptable; converge when touching that file |
| **Not yet** | Full semantic-token coverage on every surface; designer may hand off additional tokens (e.g. background hover/selected/active) **later** — add to `fig-tokens.css`, do not hardcode one-off hex values |

Tokenable is **dark-first**, **Bold Blue brand** (`#0033FF` / `--brand-500`), **Light Violet secondary** (`#977DFF` neutral buttons / `--brand-400`), **pixel aesthetic** (inset highlights, chamfer notches). Source: designer handoff **Tokenable Design System (Standalone).html** → `frontend/design-system/tokens/fig-tokens.css` + `components/components.css`.

---

## Read order (UI / styling tasks)

1. **This file** — tokens, components, do/don't, CSS import order
2. **[INVENTORY.md](../../frontend/design-system/INVENTORY.md)** — which React component owns which screen section
3. **[SOURCE-README.md](../../frontend/design-system/SOURCE-README.md)** — brand voice, a11y, pixel rules from designer export
4. Matching HTML prototype (reference only): `Tokenable-with design system/` — see [PROTOTYPES.md](../../frontend/design-system/PROTOTYPES.md)

**Visual QA:** `http://localhost:3000/dev/design-system` — designer **standalone HTML iframe** (source: `public/design-system-standalone.html`); compare after any DS CSS or token merge. Admin backoffice: `http://localhost:3000/dev/admin-ui`.

---

## CSS bundle (`app/globals.css` import order)

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

## File map

| Purpose | Path |
|---------|------|
| Color / spacing tokens (Figma) | `frontend/design-system/tokens/fig-tokens.css` |
| Typography, elevation, motion | `frontend/design-system/tokens/base.css` |
| `tk-btn`, `tk-dialog`, … | `frontend/design-system/components/components.css` |
| DS entry (imported by app) | `frontend/styles/tokenable-ds-entry.css` |
| Legacy → DS aliases (`--azure`, `--ink`) | `frontend/styles/tokenable-ds-bridge.css` |
| React primitives | `frontend/components/ds/*` |
| App-wide imports | `frontend/app/globals.css` |
| Per-route layout CSS | `frontend/styles/tokenable-*.css` (home, markets, portfolio, …) |
| Shared market card | `frontend/components/collectibles/CollectibleCard.tsx` + `tokenable-collectible-card.css` |
| Logos / sample imagery | `frontend/public/assets/ds/` |

---

## Tokens

### Naming (Figma semantic — not Carbon `$` names)

We use **semantic CSS variables** from Figma, e.g.:

| Role | Dark default (`:root`) | Light (`[data-theme="light"]`) |
|------|------------------------|--------------------------------|
| Page background | `--background-default-default` | `--white-1000` |
| Elevated surface | `--background-default-secondary` | `--gray-100` |
| Brand CTA fill | `--background-brand-default` → `--brand-500` | `--brand-600` |
| Neutral chip / hover | `--background-neutral-hover` | varies |

**Primitives:** `--brand-100` … `--brand-500` … `--brand-1000`, `--gray-*`, `--slate-*`, etc.

App root sets `data-theme="dark"` in `frontend/app/layout.tsx`.

### Bridge aliases (legacy — prefer semantic tokens in new code)

| Alias | Maps to | Use in new code |
|-------|---------|-----------------|
| `--azure` | `rgb(26, 111, 255)` | Prefer `--brand-500` |
| `--ink` | `#0e0e0e` | Prefer `--background-default-default` where possible |
| `--t1`, `--t2`, `--t3` | text opacity steps | Prefer `--text-default-*` from fig-tokens |

### Adding tokens from designer handoff

1. Add variable to **`fig-tokens.css`** (both dark default and `[data-theme="light"]` if applicable).
2. Optionally expose in `globals.css` `@theme inline` for Tailwind (`--color-*`).
3. Use `var(--new-token)` in `components.css` or page CSS — **no raw hex in React** unless matching an existing one-off pattern in the same file.
4. Document the role in this file (table above or new subsection).

Designer specs may use names like `$background`, `$background-hover` — **map to our semantic names** when implementing; do not introduce a second parallel naming system in code.

---

## Prototype sync (designer handoff)

When the designer updates `Tokenable-with design system/` (HTML pages, `_ds_bundle.js`, or `_ds/.../components.css`):

### Workflow

1. **Do not** paste prototype HTML/JS into React or import the prototype folder from Next.js.
2. **Diff** changed files against `frontend/design-system/` (especially `components/components.css`, `tokens/fig-tokens.css`). Use `node frontend/scripts/ds-import-standalone.mjs --extract-css` to pull typography/components from the standalone bundle for diff.
3. **Merge selectively** into `frontend/design-system/` — resolve intentional app-only deltas (e.g. `tk-btn--primary-inv` may exist only in the repo).
4. **Reimplement** layout in existing React components (`components/ds/*`, domain folders) using `Tk*` primitives — see [INVENTORY.md](../../frontend/design-system/INVENTORY.md).
5. **Verify** `http://localhost:3000/dev/design-system` after any `components.css` or token change.
6. **PR note:** one-line DS changelog when CSS/tokens change, e.g. `DS: tk-btn--primary hover #2E80FF → #3088FF`.

### What prototypes are for

- Layout and copy reference (spacing, hierarchy, section order)
- Designer iteration and stakeholder review
- **Not** a runtime dependency — the app never loads `_ds_bundle.js` or prototype `support.js` / `x-dc`

### Acknowledgment (team)

Designer and engineering agree: **prototype ≠ production** until changes are merged into `frontend/design-system/` and reflected in React/CSS on `develop`.

---

## Intentional exceptions (not pixel DS)

Some surfaces deliberately **do not** use `tk-btn` / dark pixel chrome:

| Area | Path | Style |
|------|------|--------|
| **Marketplace admin** | `frontend/app/marketplace/admin/*`, `components/marketplace/admin/adminUi.ts` | Light zinc Tailwind — see Admin UI below. **QA:** `/dev/admin-ui` |
| **Filter chips / tabs** | e.g. `MarketsFilterBar`, order book rows, chart period toolbars | Domain-specific `<button>` + page CSS — not primary CTAs |
| **Header / wallet** | `TkHeader`, `HeaderWalletMenuPanel` | GNB-specific classes (`gnb-*`, wallet menu CSS). Primary nav: Markets / Portfolio / **Sell** (`/sell` → hub `/vault`) |

### Admin UI (`adminUi.ts`)

Separate from pixel `tk-btn`. All new admin chrome should import constants from `adminUi.ts` — no ad-hoc `text-blue-600` or one-off danger button classes.

| Constant | Use |
|----------|-----|
| `ADMIN_BTN_PRIMARY` / `SECONDARY` / `GHOST` / `LOAD_MORE` | Actions |
| `ADMIN_BTN_DANGER` / `DANGER_EMPHASIS` | Burn, delete collection/user |
| `ADMIN_LINK` / `ADMIN_LINK_SM` | In-page and section header links |
| `ADMIN_INPUT` / `ADMIN_INPUT_DANGER` | Forms, destructive confirm fields |
| `ADMIN_PANEL_DANGER` / `PANEL_DANGER_DARK` | Danger zone `<details>` |
| `ADMIN_EMBEDDED_DARK` | Top 100 / movers preview inside light pages |
| `ADMIN_NAV_LINK` / `NAV_LINK_ACTIVE` | Sidebar navigation |
| `ADMIN_STAT_CARD` | Secondary stat / explainer tiles |

Brand colors use `var(--brand-500)` / `var(--brand-600)` so token updates propagate.

**Visual QA:** `http://localhost:3000/dev/admin-ui` (`AdminUiShowcase.tsx`)

New user-facing CTAs on marketplace routes should still use **`TkButton`** unless there is a documented reason.

### Button usage matrix (user-facing)

| Pattern | Use | Example |
|---------|-----|---------|
| **`TkButton`** | Primary / secondary CTAs, modals, forms | Home hero, List RWA, auth modals |
| **`TkButton decorative`** | Non-interactive label inside a parent `Link` | Watchlist card Buy/Bid |
| **Domain CTA wrapper** | `TkButton` + layout/height only | `RwaDetailGradientButton`, `PortfolioAssetCardCta` |
| **`adminUi.ts`** | Admin backoffice only | `/marketplace/admin/*` |
| **raw `<button>` + page CSS** | Chips, tabs, period toolbars, order book | `MarketsFilterBar`, `pf-period` |
| **GNB / wallet** | Header connect + wallet menu | `HeaderAuthControls` (`tk-btn--gnb` on `TkButton`) |

Never paste `tk-btn` class strings outside `components/ds/` (except documented GNB modifier on `TkButton`).

---

Import from `@/components/ds`:

| React | CSS class | When to use |
|-------|-----------|-------------|
| `TkButton` | `tk-btn--primary`, `neutral`, `subtle`, `ghost`, `primaryInv`; sizes `md` `sm` `table` | CTAs, form actions, dense table actions (`ghost`+`table`); `decorative` for labels inside links |
| `TkIconButton` | `tk-iconbtn--*` | Icon-only controls |
| `TkInput`, `TkField` | `tk-input`, `tk-field` | Forms |
| `TkDialog` | `tk-dialog` | Center modal — confirm, simple flows |
| `TkActionSheet` | `tk-sheet-*` | Portfolio list/bid/sell — drawer / bottom sheet |
| `TkTabs`, `TkTable`, `TkTag`, `TkCard`, … | matching `tk-*` | See showcase page |

**Domain cards:** `CollectibleCard` for marketplace tiles (not raw `.card` markup in pages).

**Modals:** Center (`TkDialog`) vs sheet (`TkActionSheet`) — do not mix patterns on the same flow without reason.

---

## Page CSS conventions

- **Shell width:** `tkl-wrap` + `APP_MAIN_SHELL_CLASS` from `frontend/constants/layout.ts`
- **New route:** add `frontend/styles/tokenable-{domain}.css` only for layout unique to that screen; import in `globals.css`
- **Reuse** `CollectibleCard`, `TkHeader`, `TkFooter` before inventing new chrome
- **Tailwind:** allowed alongside DS; prefer DS tokens via `var(--brand-500)` or mapped `@theme` colors for brand surfaces

---

## Checklist — new or changed UI

- [ ] Section mapped in `INVENTORY.md` (add row if new)
- [ ] Uses `Tk*` / existing domain components where possible
- [ ] Colors from `fig-tokens` or bridge aliases — no new random hex
- [ ] Modal pattern correct (Dialog vs ActionSheet)
- [ ] Focus visible / reduced-motion respected (see SOURCE-README a11y)
- [ ] `cd frontend && pnpm exec tsc --noEmit`
- [ ] Spot-check `/dev/design-system` if adding or changing a primitive
- [ ] If `frontend/design-system/**/*.css` changed: PR description includes `DS: …` one-liner (see Prototype sync)

---

## Hard rules

- **Skin swap only** — do not change API, Privy, Seaport, or auth logic in UI tasks unless explicitly requested.
- **No** `dangerouslySetInnerHTML` from prototype HTML.
- **No** `support.js` / `x-dc` from prototypes in Next.js.
- **Do not** import or commit `Tokenable-with design system/uploads/` or `screenshots/`.
- **Do not** paste prototype HTML into React components — reimplement with DS primitives.
- Match existing file patterns in the route you edit (CSS module vs `tokenable-*.css`).

---

## Related docs

| Doc | Purpose |
|-----|---------|
| [frontend/design-system/README.md](../../frontend/design-system/README.md) | Engineer quick start |
| [frontend/design-system/SOURCE-README.md](../../frontend/design-system/SOURCE-README.md) | Designer export: brand, type, pixel system, a11y |
| [frontend/design-system/INVENTORY.md](../../frontend/design-system/INVENTORY.md) | Screen → component map |
| [ARCHITECTURE_INDEX.md](../../ARCHITECTURE_INDEX.md) | Subsystem navigation |
