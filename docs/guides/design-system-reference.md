# Design system reference

**Canonical guide for implementing or extending Tokenable UI.**  
Read this before any visual work. Phased migration (0–10) is complete — do not create new phase docs.

**AI agents:** `.cursor/rules/design-system-migration.mdc` and `.cursor/rules/design-system-reference.mdc` apply to `frontend/**` and point here first.

**Governance:** `Tokenable-with design system-5/` is the preferred HTML reference; earlier `Tokenable-with design system/` / `-2` / `-3` / `-4` folders are superseded for handoff. None are imported by Next.js — update `frontend/design-system/` intentionally when adopting prototype changes.

---

## Source of truth (designer + engineering)

| Layer | Path | Role |
|-------|------|------|
| Designer prototype | `Tokenable-with design system-5/` | HTML / `_ds` bundle — **reference only**, not imported by Next.js |
| Committed DS | `frontend/design-system/` | Tokens + `tk-*` CSS — **canonical styles for production** |
| React primitives | `frontend/components/ds/` | `TkButton`, `TkField`, `TkInput`, `TkSelect`, `TkDialog`, … |
| App wiring | `frontend/styles/tokenable-ds-entry.css`, `globals.css` | Imports committed DS only |

**Prototype updates do not auto-apply to the app.** Production UI changes only when `frontend/design-system/` (and related React/CSS) is intentionally updated and merged.

---

## Scope (what we have today)

| Status | Meaning |
|--------|---------|
| **Built** | Figma-exported tokens, `tk-*` CSS primitives, React `Tk*` wrappers, page shell, major routes migrated |
| **Hybrid** | Some pages still use bridge aliases (`--azure`, `--ink`) or page-local CSS — acceptable; converge when touching that file |
| **Not yet** | Full semantic-token coverage on every surface; designer may hand off additional tokens (e.g. background hover/selected/active) **later** — add to `fig-tokens.css`, do not hardcode one-off hex values |

Tokenable is **dark-first**, **Azure brand** (`#1A6FFF` / `--brand-500` / `--azure`), **eyebrow** (`#5B9AFF` / `--eyebrow`), **Light Violet secondary** (`#977DFF` Neutral buttons / `--brand-400`), **pixel aesthetic** (inset highlights, chamfer notches). HTML prototypes are layout/copy reference only — **do not copy page `:root` colors**. Production color lives in `fig-tokens.css` + `tokenable-ds-bridge.css`.

---

## Read order (UI / styling tasks)

1. **This file** — tokens, components, do/don't, CSS import order
2. **[INVENTORY.md](../../frontend/design-system/INVENTORY.md)** — which React component owns which screen section
3. **[SOURCE-README.md](../../frontend/design-system/SOURCE-README.md)** — brand voice, a11y, pixel rules from designer export
4. Matching HTML prototype (reference only): `Tokenable-with design system-5/` — see [PROTOTYPES.md](../../frontend/design-system/PROTOTYPES.md)

**Visual QA:** `http://localhost:3000/dev/design-system` — designer **standalone HTML iframe** (source: `public/design-system-standalone.html`); compare after any DS CSS or token merge. Admin backoffice: `http://localhost:3000/dev/admin-ui`.

---

## CSS bundle

### Core (`app/globals.css` — keep small for Turbopack)

| File | Scope |
|------|--------|
| `tokenable-ds-entry.css` | DS tokens + `tk-*` primitives |
| `tokenable-ds-bridge.css` | Font bridge, ink/azure aliases |
| `tokenable-layout.css` | GNB, footer, `tkl-wrap`, app shell |
| `tokenable-collectible-card.css` | `.card`, `.card__*` — **shared** across home / markets / watchlist |
| `tokenable-page-states.css` | Empty / error / gate states |
| `tokenable-secondary.css` | Auth / site-access / secondary shells |

Do **not** barrel route sheets (vault, sell, admin, portfolio, …) back into `globals.css`. That ~25k-line graph made Turbopack HMR hang on `pnpm dev`.

### Route / feature CSS (import from the owning layout or component)

| File | Import from |
|------|-------------|
| `tokenable-home.css` | `HomePageContent` + `HomeTicker` (ticker also used on Portfolio / Markets / Watchlist) |
| `tokenable-markets.css` | `app/markets/layout.tsx` |
| `tokenable-watchlist.css` | `app/watchlist/layout.tsx` |
| `tokenable-collection-detail.css` | `app/marketplace/collections/[collectionKey]/layout.tsx` |
| `tokenable-rwa-detail.css` | ListRwaModal Set/Edit price sheet — `app/portfolio/layout.tsx`, `app/partner/portfolio/layout.tsx`, collection-detail layout |
| `tokenable-portfolio.css` + `tokenable-portfolio-redeem.css` | `app/portfolio/layout.tsx` / `app/partner/portfolio/layout.tsx` |
| `tokenable-vault.css` | `app/vault/layout.tsx` |
| `tokenable-sell-flow.css` | `app/sell/layout.tsx` |
| `tokenable-admin.css` | `app/marketplace/admin/layout.tsx` (+ `app/dev/layout.tsx`) |
| `tokenable-settings.css` | `app/settings/layout.tsx` |
| `tokenable-partner.css` | `app/partner/layout.tsx` |
| `tokenable-partner-origin.css` | `PartnerCompanyAddressRequiredModal` |
| `tokenable-action-complete.css` | `ActionCompleteModal` |
| `tokenable-wallet-menu.css` / `tokenable-notifications.css` | `TkHeader` |

New pages: reuse `CollectibleCard` + `tkl-wrap`; add page CSS only for layout unique to that screen, and import it from that route’s layout — **not** from `globals.css`.

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
| Secondary text | `--text-default-secondary` `rgba(255,255,255,0.7)` | `rgba(17,17,17,0.78)` |
| Tertiary text | `--text-default-tertiary` `rgba(255,255,255,0.52)` | `rgba(17,17,17,0.62)` |

**Primitives:** `--brand-100` … `--brand-500` … `--brand-1000`, `--gray-*`, `--slate-*`, etc.

App root sets `data-theme="dark"` in `frontend/app/layout.tsx`.

**next/font weights** (same file): Inter `400 500 600 700 800` (500 = `font-medium` / `.tk-caption`; 800 = home/vault titles). JetBrains Mono `400 500 600 700`. Do not register unused weights.

### Bridge aliases (legacy — prefer semantic tokens in new code)

| Alias | Maps to | Use in new code |
|-------|---------|-----------------|
| `--azure` | `#1A6FFF` (`--accent-azure` / `--brand-500`) | Accent text, links, and primary CTA fill |
| `--eyebrow` | `#5B9AFF` | **Page eyebrows only** (mono uppercase kicker above titles). Not Neutral buttons. Hidden at `max-width: 1024px` (see `.tkl-eyebrow` in `tokenable-layout.css`). |
| `--ink` | `#0e0e0e` | Prefer `--background-default-default` where possible |
| `--t1`, `--t2`, `--t3` | `--text-default-default` / `secondary` / `tertiary` | Prefer `--text-default-*`. Dark `--t2` `rgba(255,255,255,0.7)`, `--t3` `rgba(255,255,255,0.52)`; light `--t2` `rgba(17,17,17,0.78)`, `--t3` `rgba(17,17,17,0.62)` |

### Adding tokens from designer handoff

1. Add variable to **`fig-tokens.css`** (both dark default and `[data-theme="light"]` if applicable).
2. Optionally expose in `globals.css` `@theme inline` for Tailwind (`--color-*`).
3. Use `var(--new-token)` in `components.css` or page CSS — **no raw hex in React** unless matching an existing one-off pattern in the same file.
4. Document the role in this file (table above or new subsection).

Designer specs may use names like `$background`, `$background-hover` — **map to our semantic names** when implementing; do not introduce a second parallel naming system in code.

**HTML `:root` color dumps are not source of truth.** Claude/designer HTML will drift (`--t2` 0.55 vs 0.6, `--brand-400` as `#5B9AFF` vs `#977DFF`). Map the screen to the locked palette below. Change tokens only when the designer explicitly asks to change that **role** (e.g. “make secondary text lighter”), in `fig-tokens.css` / `tokenable-ds-bridge.css` — never by copying a page-local `:root`.

### Locked platform palette

| Role | Token | Dark | Light (sell-flow canvas) |
|------|-------|------|--------------------------|
| Page background | `--ink` | `#0e0e0e` | `#F5F5F7` |
| Card / panel | `--surf` | `#141414` | `#FFFFFF` |
| Primary text | `--t1` | `rgba(255,255,255,0.95)` | `rgba(17,17,17,0.95)` |
| Secondary text | `--t2` | `rgba(255,255,255,0.7)` | `rgba(17,17,17,0.78)` |
| Tertiary text | `--t3` | `rgba(255,255,255,0.52)` | `rgba(17,17,17,0.62)` |
| Primary / links / CTA | `--azure` / `--brand-500` | `#1A6FFF` | same |
| Page eyebrow | `--eyebrow` | `#5B9AFF` | same |
| Neutral button | `--brand-400` | `#977DFF` | same |
| Up / down / warn | `--pos` / `--neg` / `--warn` | existing | same |

Do not use `#5B9AFF` for Neutral buttons. Do not use `--brand-400` / `#977DFF` for page eyebrows.

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
| `TkDialog` | `tk-dialog` | Center modal — confirm / result (Feedback-States Dialog: title, body, foot) |
| `TkNote` | `tk-note` / `tk-note--positive\|warning\|danger\|brand` | Inline banners + ephemeral toasts (`NotificationToastsHost`) |
| `TkActionSheet` | `tk-sheet-*` | Portfolio list/bid/sell — drawer / bottom sheet |
| `TkTabs`, `TkTable`, `TkTag`, `TkCard`, … | matching `tk-*` | See showcase page |

**Domain cards:** `CollectibleCard` for marketplace tiles (not raw `.card` markup in pages).

**Modals:** Center (`TkDialog`) vs sheet (`TkActionSheet`) — do not mix patterns on the same flow without reason. Result overlays (`ActionCompleteModal`) use `TkDialog`. Exception: sell partner **Add to my vault** success (`SellFlowPartnerDoneModal`) stays white-card by design.

---

## Page CSS conventions

- **Shell width:** `tkl-wrap` + `APP_MAIN_SHELL_CLASS` from `frontend/constants/layout.ts`
- **New route:** add `frontend/styles/tokenable-{domain}.css` only for layout unique to that screen; import it from that route’s `layout.tsx` / page — **never** re-add heavy sheets to `globals.css` (Turbopack HMR)
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
