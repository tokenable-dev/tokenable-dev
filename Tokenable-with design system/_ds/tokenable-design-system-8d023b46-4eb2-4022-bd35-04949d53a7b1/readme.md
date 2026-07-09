# Tokenable Design System

> Status — 32 components (29 project + 3 logo) · 27 specimen cards · 745 tokens · pixel aesthetic with surface-based depth · 1 template (Marketplace Landing) · marketplace UI kit. Last updated 2026-07-01.

A dark-first, token-driven design system for **Tokenable** — a graded trading-card & collectibles marketplace where physical cards are vaulted, insured, tokenized, and traded with real-time pricing (PSA/BGS grades, population counts, price + appreciation).

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
- **Voice:** direct, confident, market-literate. Short declaratives. "The graded card market." "Every card vaulted & insured."
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
- **Transparency & blur:** floating controls use `rgba(0,0,0,.55)` + `backdrop-filter: blur(8–10px)`. Dialog scrim blurs.
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

## INDEX / file map

**Root files**
- `styles.css` — global CSS entry (imports only). Link this one file.
- `Design System.html` — full single-page specimen.
- `readme.md` — this guide. · `SKILL.md` — Agent Skill manifest.

**`tokens/`**
- `fig-tokens.css` — 446 Figma Variables (colors, primitives, sizes, radii; themes: default-dark + `[data-theme="light"]`, responsive modes).
- `fig-typography.css` — text/effect styles.
- `fonts.css` — Inter / JetBrains Mono / Noto Serif (Google Fonts).
- `base.css` — semantic type scale, radii, spacing, shadows, motion.

**`components/`** — see Components table above. Each has `.jsx` + `.d.ts` + `.prompt.md` + a `@dsCard`-tagged `.card.html`.

**`guidelines/`** — foundation specimen cards (Colors ×4, Type ×3, Spacing ×3, Brand ×4) for the Design System tab.

**`explorations/`**
- `web3-aesthetic.html` — Glassmorphism · Pixel · Hybrid component-level study (canvas doc).
- `glass-vs-hybrid.html` — **full marketplace landing comparison**: A · Glass Morphism (frosted blur surfaces, soft round corners, gradient glow, minimal lines) vs B · Hybrid (glass surfaces + pixel detail: notched corners, offset shadows, mono CTA/grade tags). Awaiting client decision — once chosen, the entire DS will be batch-converted.

**`assets/`**
- `logo/` — SVG lockups & symbol (color / white / mono).
- `cards/` — graded-card imagery from the Figma file.
- `icons/` — `pixel-icons.js` pixel-glyph icon set.

**`templates/`**
- `marketplace-landing/` — `MarketplaceLanding.dc.html`: hero + featured card grid with search bar. Cards show Trend / New / Rare variants.

**`ui_kits/marketplace/`** — interactive marketplace recreation (browse → detail → buy → portfolio).

---

## Caveats
- **Fonts:** Inter confirmed for sans, JetBrains Mono confirmed for mono. Noto Serif is provisional for rare serif use.
- **Style direction:** Pixel aesthetic confirmed. Surface-based depth (面) with minimal visible borders/lines. Primary buttons use 3D embossed inset shadows; Secondary uses solid lighter surface; Tertiary uses translucent surface — all three share the same embossed structure. Cards use 16px rounded corners (not pixel notch). Feedback components (notifications, tooltip, dialog) retain pixel notch clip-path for brand identity.
- **Icons** loaded via CDN Feather for reference; pixel icon set is the applied language.
- Component cards render against `_ds_bundle.js` which builds automatically.
