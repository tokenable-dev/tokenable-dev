# Tokenable Design System

> Status — 25 components · 25 specimen cards · pixel aesthetic · marketplace UI kit. Browse everything in `Design System.html`. Fonts are provisional (see Caveats).

A dark-first, token-driven design system for **Tokenable** — a graded trading-card & collectibles marketplace where physical cards are vaulted, insured, tokenized, and traded with real-time pricing (PSA/BGS grades, population counts, "Vaulted" status, price + appreciation).

This project was generated from the **"Tokenable Design System.fig"** Figma file (attached to the project as a mounted virtual filesystem). Token values, components, the logo, and card imagery were extracted from that file — it is the source of truth.

---

## Sources
- **Figma:** "Tokenable Design System.fig" — pages incl. Foundations, Icons, Buttons, Inputs, Tags, Tooltip, Dialog, Navigation, Notification, Tabs, Calendar, Tokenable-Components (Market Card), LOGO-SYMBOL, Examples.
- 446 Figma Variables across 10 collections (Color, Color Primitives, Size, Typography, …) → `tokens/fig-tokens.css`.
- Icon family ≈ Feather Icons (Activity, Airplay, Anchor, Aperture…), drawn at a slightly thinner stroke — see Iconography.

---

## Brand at a glance
- **Name / wordmark:** TOKENABLE, geometric all-caps; pixel-style "T" symbol.
- **Primary color:** Azure `#1A6FFF` (`--brand-500`), applied as a **solid** fill with a hard offset shadow on primary actions (pixel system — no gradient/glow on UI chrome). The Figma variables retain a gradient ramp for reference.
- **Surface:** dark-first — near-black blue-tinted `rgb(16,16,30)` base, layered secondary/tertiary surfaces.
- **Type:** Inter (sans), Roboto Mono (mono/numeric), Noto Serif (rare serif) — *provisional defaults, not confirmed from the file; see Caveats.*
- **Mood:** premium, financial, confident — with an **on-chain pixel identity**. The chosen web3 aesthetic is **Pixel**: hard 2px edges, crisp offset shadows (no blur), notched (chamfer) corners, mono uppercase chrome, and solid azure (no gradients/glow on UI chrome). It extends the pixel "T" logo. See `explorations/web3-aesthetic.html` (Glass · Pixel · Hybrid study) and the **Pixel System** card.

---

## CONTENT FUNDAMENTALS
How Tokenable writes:
- **Voice:** direct, confident, market-literate. Short declaratives. "The graded card market." "Every card vaulted & insured."
- **Person:** addresses the user as **you / your** ("Your vault", "your tokens are live"). Product speaks plainly, never cute.
- **Casing:** Sentence case for headings and body. Tags/labels are often ALL-CAPS short tokens ("PSA 10", "POP 3", "VAULTED", "BAL"). Nav items are Title Case single words (Markets, Portfolio, Sell).
- **Numbers:** front and center. Prices `$58,000`, appreciation `+138%`, with period qualifier (`1Y`, `180d`). Monospace for prices, IDs, gas, addresses (`0xF4…9aE2`, `14 gwei`).
- **Status language:** trust + provenance vocabulary — "Vaulted", "Insured", "Verified", "Confirmed", grade + population ("POP 3").
- **Emoji:** none in product UI. A single `♡` glyph appears as the favorite affordance in source; otherwise iconography is SVG.
- **Examples:** "Trade tokenized, vault-secured collectibles. Real-time pricing, instant settlement." · "Confirm purchase" · "Make offer" · "Connect Wallet".

---

## VISUAL FOUNDATIONS
- **Color:** Dark-first. Base surface `rgb(16,16,30)`; cards on `#101016`/`--background-default-secondary`. Azure brand for primary, semantic positive (green `#00C350`), warning (amber `#EA8200`), danger (red `#E4374A`). Full light theme exists via `[data-theme="light"]`. Color is purposeful — large neutral fields, color reserved for CTAs, status tags, and gains/losses (green up / red down).
- **Type scale (Figma styles):** Title Hero 72 (-3% tracking) / Title Page 48 / Subtitle 32 / Heading 24 (-2%) / Subheading 20 / Body 16 / Body Small 14 / Body Code = Roboto Mono 500 at 16 / 14 / 12 (`.tk-bodycode`, `.tk-bodycode-sm`, `.tk-bodycode-xs`, line-height 1.6). Named classes `.tk-title-hero`, `.tk-heading`, `.tk-body`, `.tk-code`, … in `base.css` apply them directly. Inter with tight negative tracking on large headings; Roboto Mono for all numeric/ID/code.
- **Spacing:** 4px base unit (4·8·12·16·24·32·48·64·96). Generous section padding; 22px card gaps in grids.
- **Backgrounds:** flat near-black, occasionally a radial vignette behind card imagery (`radial-gradient(120% 90% at 50% 0%, #1c1c28, #0c0c12)`). Card image areas use a bottom protection gradient fading to the card surface so tags/price sit on solid color. No photographic full-bleed hero; no busy patterns.
- **Cards (pixel):** radius 0 with notched corners (`--pixel-clip`), 2px inset border, hard offset shadow (`--pixel-shadow-md`, no blur). Product tiles (e.g. market cards) use a **solid opaque** 2px frame (not a translucent hairline) so the border reads continuously over bright card art, with the image filling edge-to-edge to the frame.
- **Corner radii (pixel):** 0 everywhere; soften only via the chamfer notch on surfaces. Tags/avatars/badges/inputs are square, not pill. Specimen: the `Corner Shape` and `Elevation` cards in `guidelines/` now show the pixel treatment (square + chamfer notch; hard azure offset shadows). (The underlying Figma tokens still carry the rounded `--radius-*` scale for reference.)
- **Borders:** thin, low-opacity white hairlines on dark (`rgba(255,255,255,0.05–0.16)`); azure-tinted borders on brand surfaces.
- **Shadows / elevation:** the real Tokenable dark-mode scale — 5 levels (1 Raised → 5 Lifted), each = inset hairline (`rgba(255,255,255,.12)`) + top highlight + a **brand-blue glow** (`0 N px M px rgba(26,111,255, .12→.58)`). Tokens `--elevation-1…5` (aliased `--shadow-sm…xl`); light theme swaps to neutral `rgba(12,12,13)` shadows. Primary buttons add their own colored glow + inset top highlight.
- **Transparency & blur:** floating controls (favorite button, sticky filter bar) use `rgba(0,0,0,.55)` + `backdrop-filter: blur(8–10px)`. Dialog scrim blurs the page.
- **Animation (pixel):** fast and snappy, `120ms`. Hover nudges the element toward its shadow (`translate(-1px,-1px)`, shadow grows); press pushes into it (`translate(2px,2px)`, shadow shrinks) for a tactile button feel. Switch thumb steps (`steps(3)`). No blur transitions, no bounces, no decorative loops.
- **Underlying Figma elevation** (glass + blue glow, 5 levels) remains in `base.css` as `--elevation-1…5` for reference; the applied pixel UI uses hard offset shadows (`--pixel-shadow-*`) instead.
- **Hover states:** primary brightens its gradient and intensifies glow; neutral/subtle gain a faint fill; cards lift. **Press:** slight downward nudge.
- **Imagery vibe:** the product *is* the imagery — graded cards (Pokémon, sports) shot on transparent/dark, presented in a vignette. Cool, premium, high-contrast.

---

## ACCESSIBILITY
Built in (don't undo these):
- **Focus visible everywhere:** every interactive control shows a 2px `--brand-400` focus ring on keyboard focus — Button, IconButton, inputs, Checkbox/Radio/Switch, Slider, **Tabs, Pagination, Menu items, Accordion triggers** (added in the a11y pass at the end of `components.css`). Never set `outline:none` without a replacement.
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` neutralizes the pixel hover/press transforms and the dialog entrance animation. Keep new motion behind this guard.
- **Tooltip on focus:** `Tooltip` opens on hover **and** keyboard focus (`:focus-within`) — wrap a focusable trigger (Button/IconButton).
- **Semantics:** `IconButton` requires a `label` (aria-label); inputs link `<label for>`; `Switch` has `role="switch"`; `Dialog` is `role="dialog" aria-modal`; `Notification` is `role="status"`; `Tooltip` bubble is `role="tooltip"`; `Tabs`/`Pagination` set `aria-selected`/`aria-current`.
- **Color use:** azure `--brand-500` on white text and white-on-status fills clear AA for UI text. Status is never conveyed by color alone — tags carry a text label (and optional icon).
- **Minimum text size 12px:** no UI/component text goes below 12px (`--type-caption` / `--font-size` floor). Don't introduce 10–11px text.

Manual considerations (verify per use):
- **Touch targets:** `md` controls are 44–46px (AA). The `sm` variants (Button 38, IconButton 36, page 38) are below 44px — fine for dense desktop toolbars, but prefer `md` on touch surfaces.
- **Tertiary text** (`--text-default-tertiary`, ~38%) is for non-essential meta only (timestamps, hints) — never body copy or anything load-bearing; use `--text-default-secondary` (~60%) for readable secondary text.
- **Dialog focus trap:** `Dialog` sets the right roles but does not trap/restore focus — add focus management when wiring it into a real flow.
- **Accordion:** triggers expose `aria-expanded`; add `aria-controls` linking to the panel id if you need full APG compliance.

---

## ICONOGRAPHY
- **Chosen direction — Pixel icons.** The web3 aesthetic uses a custom **pixel-glyph** icon set: 12×12 rect grids, `shape-rendering: crispEdges`, single-color (`currentColor` / azure). Source: `assets/icons/pixel-icons.js` — `pixelIconSVG(name,{size,color})` returns SVG markup; `window.PixelIcon({name,size,color})` is a React element. Core glyphs: search, heart, check, x, plus, chevron-down/left, arrow-up-right, gem, bolt, shield, wallet, grid, filter, bell, box, coin, star, eth (expanding as needed).
- **Figma source set** was Feather Icons (outline, 2px round) — retained in `tokens`/reference for any outline need, but the applied product language is pixel.
- **No emoji.** Mono digits for numerics.

---

## INDEX / manifest

**Root**
- `styles.css` — global entry (imports only). Link this one file.
- `Design System.html` — full single-page specimen (foundations + every component, live from the bundle). Start here to browse/edit the whole system.
- `readme.md` — this guide. · `SKILL.md` — Agent Skill manifest.

**`tokens/`**
- `fig-tokens.css` — 446 Figma Variables (colors, primitives, sizes, radii, themes: default-dark + `[data-theme="light"]`, responsive modes).
- `fig-typography.css` — text/effect styles (generated).
- `fonts.css` — Inter / Roboto Mono / Noto Serif (Google Fonts).
- `base.css` — semantic type scale, radii, spacing, shadows, motion aliases.

**`components/`** (React primitives, exposed on `window.TokenableDesignSystem_8d023b`; styles in `components/components.css`)
- `forms/` — Button, IconButton, Input, Textarea, Select, Checkbox, Radio, Switch, Slider, Search
- `data/` — Tag, Badge, Avatar, Stat (key-metric chip: muted label + bright value). **Tag color rule:** gray (neutral) by default; reserve color for meaning — brand=primary id, positive=verified/up, danger=down/sold-out, warning=true warnings only (not counts). Use `Stat` for POP/Listed/Offers.
- `navigation/` — GNB (desktop top nav), SecondaryBar (solid pixel sub-nav; `mobile` prop → compact, horizontally-scrollable tabs, sticks at 58px), DetailBar (detail-page sticky buy bar — thumb + title/grade + price + Buy/Make offer; `mobile` prop → bottom-fixed full-width price + Buy now CTA), MobileNav (hamburger drawer = mobile GNB), Tabs, Pagination, Menu
- `feedback/` — Tooltip, Notification, Dialog
- `layout/` — Card, Divider, Accordion
- `commerce/` — CollectibleCard (graded-card market tile with Trend / New / Rare variants; canonical source for the marketplace card)

**`guidelines/`** — foundation specimen cards (Colors, Type, Spacing incl. Elevation, Brand) for the Design System tab.

**`explorations/`**
- `web3-aesthetic.html` — three-way **Glassmorphism · Pixel · Hybrid** direction study for the web3 graphic/icon language (canvas doc). **Hybrid is the recommended base**: glass surfaces (frosted + blue glow, matching Dialog/Elevation) with pixel detail (pixel glyphs inside glass chips, notched corners, mono labels, hard-edge status badges) — bridging the premium depth with the pixel "T" logo identity.

**`assets/`**
- `logo/` — SVG lockups & symbol (color / white / mono) + materialized JSX. (Symbol T enlarged per brand review.)
- `cards/` — graded-card imagery from the file.
- `icons/` — `pixel-icons.js`, the chosen pixel-glyph icon set.

**`templates/`**
- `marketplace-landing/` — `MarketplaceLanding.dc.html`: hero + featured graded-card grid built from DS components. Cards use the unified pixel design (notched panel, image fills, pixel offset shadow, no border line) with three featured variants — **Trend** (azure badge, % momentum), **New** (green badge, listing recency), **Rare** (amber badge, population/scarcity). Variant styling is literal per `sc-if` branch (no style holes).

**`ui_kits/marketplace/`** — interactive marketplace recreation (browse → detail → buy → portfolio). See its `README.md`.

---

## Caveats
- **Fonts — UNCONFIRMED.** The Figma export carried **no named text styles** (`fig-typography.css` is empty), so the families in use — `--font-sans: Inter`, `--font-mono: Roboto Mono`, `--font-serif: Noto Serif` — are **defaults I chose, not values read from the file**. Awaiting user confirmation of the real families (e.g. sans, and whether mono is JetBrains Mono); once confirmed, swap `tokens/fonts.css` + the `--font-*` vars in `tokens/base.css` and the whole system updates.
- **Icons** are CDN Feather, not materialized assets (the file's set is Feather).
- Component cards & the UI kit render against the compiled `_ds_bundle.js`, which builds automatically.
