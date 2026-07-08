# Tokenable design system (Next.js)

Committed CSS source for the Azure / pixel UI. HTML prototypes live at repo root in `Tokenable-with design system/` (reference only).

## Quick start (Phase 1+)

```css
/* frontend/app/globals.css — already wired in Phase 1 */
@import "../styles/tokenable-ds-entry.css";
@import "../styles/tokenable-ds-bridge.css";
@import "../styles/tokenable-layout.css";
```

**Visual QA:** `http://localhost:3000/dev/design-system`

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

## Migration plan

Full phases: [`docs/guides/design-system-migration.md`](../../docs/guides/design-system-migration.md)  
**Ongoing UI reference:** [`docs/guides/design-system-reference.md`](../../docs/guides/design-system-reference.md)  
**Prototype sync (no auto-import):** [`docs/guides/design-system-governance-phases.md`](../../docs/guides/design-system-governance-phases.md)

## Prototype folder vs this directory

| | `Tokenable-with design system/` | `frontend/design-system/` (here) |
|---|--------------------------------|-------------------------------------|
| Role | Designer HTML / `_ds` reference | **Production** tokens + `tk-*` CSS |
| Next.js | Not imported | Imported via `tokenable-ds-entry.css` |
| Updates | Manual diff + merge into here | PR + `DS: …` changelog line + `/dev/design-system` check |
