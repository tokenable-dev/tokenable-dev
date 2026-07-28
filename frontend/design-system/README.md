# Tokenable design system (Next.js)

Committed CSS source for the Azure / pixel UI. HTML prototypes live at repo root in `Tokenable-with design system/` (reference only).

## Quick start (Phase 1+)

```css
/* frontend/app/globals.css — already wired in Phase 1 */
@import "../styles/tokenable-ds-entry.css";
@import "../styles/tokenable-ds-bridge.css";
@import "../styles/tokenable-layout.css";
```

**Visual QA:** `http://localhost:3000/dev/design-system` (live `TkButton` strip + designer standalone iframe)

**DS changelog (v2 Phase 1):** `ghost` + `table` button variants; tokens `--border-strong`, `--surface-hover`.

**IA (v2 Phase 2):** Primary nav **Sell** → `/sell` router (`SellRouterView`); collector hub at `/vault` with Selling chrome.

**Portfolio (v2 Phase 3):** Holdings **Set price** / **Edit price** ghost CTAs + Highest bid meta; `ListRwaModal` set-price copy.

**Collection (v2 Phase 4):** Set-level **Place a Bid** banner; listing rows **Buy-only**; softer vault / buyer-protection copy in listing detail + checkout.

**Sell flow (v2):** Hub **+ Sell a Card** → `/sell/flow` (`Sell-Flow.html`) → `/sell/shipping` (`PSA-Shipping.html`) → `/vault/submissions/[id]?scenario=C` (`Vault-Detail.html`). Personal mint remains at `/vault/submit` and `/vault/submit/mint`.

**Designer handoff import:**

```bash
node scripts/ds-import-standalone.mjs                    # copy HTML → public/
node scripts/ds-import-standalone.mjs --extract-css        # optional _import-*.css for diff
```

```tsx
import { TkButton, TkDialog } from "@/components/ds";
```

## Contents

| Path | Purpose |
|------|---------|
| `styles.css` | Single entry — imports tokens + components |
| `tokens/fig-tokens.css` | Figma color/spacing variables |
| `tokens/base.css` | Typography scale, elevation, pixel notches |
| `components/components.css` | `tk-btn`, `tk-dialog`, `tk-table`, … |
| `SOURCE-README.md` | Designer export notes (brand, a11y) |
| `INVENTORY.md` | Screen → route → component map |
| `PROTOTYPES.md` | HTML file index |

## Assets

Logos and sample cards: `frontend/public/assets/ds/`

## UI reference

**Canonical guide:** [`docs/guides/design-system-reference.md`](../../docs/guides/design-system-reference.md) (tokens, components, CSS import order, checklist).  
Migration phases 0–10 are done. Prototype folder is reference only — no auto-import into this directory.

## Prototype folder vs this directory

| | `Tokenable-with design system/` | `frontend/design-system/` (here) |
|---|--------------------------------|-------------------------------------|
| Role | Designer HTML / `_ds` reference | **Production** tokens + `tk-*` CSS |
| Next.js | Not imported | Imported via `tokenable-ds-entry.css` |
| Updates | Manual diff + merge into here | PR + `DS: …` changelog line + `/dev/design-system` check |
