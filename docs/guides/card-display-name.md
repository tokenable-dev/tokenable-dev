# Card display name (SSOT)

**Applies to:** every surface where a card name is rendered. This document is the single source of truth. No surface invents its own card-name format.

**Implementation:** `frontend/lib/marketplace/cardDisplayName.ts` (formatters) + `frontend/lib/marketplace/assetDetailHeadline.ts` (build parts from collection/RWA fields).

There is **no shared monorepo package**. Backend must not re-implement formatters. The contract is `backend/src/marketplace/utils/card-display-name.util.spec.ts` (imports the frontend SSOT via `@/`).

---

## 1. Canonical name schema (2 lines)

| Line | Format |
|------|--------|
| **Line 1 — identity** | `{Card name} · {Number} · {Grade}` on lists **and** Markets collection detail. **Certificate of Ownership:** `{Card name} · {Number}` (grade is below the title). |
| **Line 2 — provenance** | `{Year} · {Set} {Language} · {Variant}` |

Example (lists):

```
Charizard ex · 199/165 · PSA 10
2023 · 151 EN · Special Illustration Rare
```

Example (collection detail hero):

```
Charizard ex · 199/165 · PSA 10
2023 · 151 EN · Special Illustration Rare
```

One Piece compound catalog ids split — set code is not repeated on Line 1:

```
Monkey D. Luffy · 118 · PSA 10
2025 · OP13 Carrying On His Will JP · Red Manga Alternate Art
```

Same two-line SSOT as lists. Details KV still lists Set / Language / Variant as their own rows.

Example (portfolio Certificate of Ownership):

```
Charizard ex · 199/165
2023 · 151 EN · Special Illustration Rare
```

### Token rules

| Token | Rule |
| --- | --- |
| Card name | As-is from source (proper case). |
| Number | Collector number only. Drop `#`. Pokemon `199/165` stays. Numeric → 3-digit pad (`085`). TCG compound ids (`OP13-118`, `ST01-009`) **split**: set code belongs on Line 2 / breadcrumb, Line 1 is `118`. |
| Grade | `PSA 10`, `BGS 9.5`, etc. **Unknown / empty / legacy `Raw` grade → `Raw` on Line 1.** Certificate of Ownership and similar surfaces explicitly omit grade. |
| Year | 4-digit. Omit if unknown. |
| Set | Expansion name. TCG franchise / category prefixes (`One Piece`, `Pokemon`) and a leading language token are stripped on Line 2 and the breadcrumb — they are not part of the expansion. Sports set names stay as-is. |
| Language | Short code (`EN`, `JP`, …) **after** the set name (`151 EN`, `Svp Sv Black Star Promo EN`). If a short code leaked into the middle of the set string, move it to the end. Omit if unknown. |
| Variant | Parallel / art / rarity descriptor. Omit the `· {Variant}` segment if none. |

- **Grade is text on Line 1 — not a separate badge.**
- Separator is always ` · ` (spaced middot). Never render an empty segment or a dangling `·`.

---

## 2. Per-surface display

| Surface | Shows | Notes |
| --- | --- | --- |
| Markets / list row | Line 1 only | Variant on Line 2 / meta only (§3). |
| Card detail header | Line 1 (with grade) + Line 2 | `{Name} · {Number} · {Grade}` then `{Year} · {Set} {Language} · {Variant}`. |
| Certificate of Ownership | Line 1 (no grade) + Line 2 | `{Name} · {Number}` then provenance. Grade + cert chips below. |
| Search results | Line 1 + compact Line 2 | Global scope — keep Line 2. |
| Watchlist | Line 1 only | Variant on Line 2 / meta only (§3). |
| Portfolio / holdings | Line 1 only | Grade always present. |
| Order book / trade history | Line 1 (abbrev ok) | Tight: `{Name} · {Grade}`. |
| Checkout / Redeem / modals | Line 1 | `{Name} · {Number} · {Grade}` on every card row. Vault chip + cert are meta, not a grade badge. |
| Partner Redeem requests | Line 1 | Same Line 1 on To ship → All tabs (`partnerRedeemCardTitle`). Cert stays on the secondary line. |
| Notifications / share / email | Line 1 + Line 2 | Self-contained (no breadcrumb dedupe). |

Use `formatCardDisplayName({ parts, mode })` — never hand-join segments at call sites.

---

## 3. List surfaces (Line 1 only)

Markets / watchlist / portfolio list rows show **Line 1 only** on the main title:
`{Name} · {Number} · {Grade}`.

**Variant, set, year, and language belong on Line 2 (subtitle / meta)** — never append variant to Line 1.

When a list contains multiple rows with the same Line 1, call
`resolveCardDisplayLine1Collisions` at the list parent. It appends the smallest
available differentiator to colliding rows only: Variant → Year → Set.

---

## 4. Collection-detail breadcrumb

- Breadcrumb: `Markets / {Category} / {SetCode} {SetName} ({Language})` (navigation only — **not** card name).
- Example (JP 151): `Markets / Pokemon / SV2a 151 (JP)`.
- Example (One Piece): `Markets / One Piece / OP13 Carrying On His Will (JP)`.
- **Language source** (breadcrumb **and** Details Language share `headlineLanguageLabel`):
  1. `components.language` (incl. mirrored `normalizedPokemon.language`)
  2. else Cardhedger preview `card.market`
  3. else infer from Brand/set/title corpus (CJK script or `JAPANESE` / `KOREAN` / … in PSA-style Latin copy)
  4. then map to `JP` / `KR` / `EN` / `CN` via `formatCardDisplayLanguageShort`
  - **Never invent English.** Unknown → omit breadcrumb `(XX)` and omit the Details Language row.
- **Breadcrumb-only trail** (`formatDetailBreadcrumbTrail`):
  - Set-name segment strips category / franchise / catalog set codes / language / PSA `Card` noise.
  - Re-append catalog set code before the cleaned set name when known.
  - Re-append language only as a trailing `(JP)` / `(KR)` / `(EN)` / `(CN)` when known.
  - Do **not** put year or card number on the breadcrumb.

## 4b. Collection-detail Details KV

Order: Card name → Category → Series → Set → Set code (when known) → Card number → Variant → Year → Grade → Grader → Language.

| Row | Source |
| --- | --- |
| Card name | Character linked (`Charizard ↗`); TCG suffix (`ex`) unlinked |
| Category | Category badge, linked |
| Series | `normalizedPokemon.series`, else `Word & Word` slot from the set line. Omitted when unknown. |
| Set | cleaned expansion (`formatDetailExpansionSetName`) |
| Set code | `normalizedPokemon.setCode`, else a catalog token from the set line (`SV2a`, `OP13`). Omitted when unknown. Unlinked. |
| Card number | Card.html `#199 / 165` (or `#118`). Prefer a `printed/set` token when stored. |
| Variant | Display variant when not a set duplicate |
| Year | Linked |
| Grade | Numeric score (`10`), linked |
| Grader | `PSA`, linked |
| Language | Full name (`English` / `Japanese`). Pokémon Latin catalogs may default English. Omit when unknown. |

- Detail Line 2 (hero subtitle) is always `{Year} · {Set} {Language} · {Variant}` (language token omitted when unknown). Do not drop the set from the hero because the breadcrumb already shows it.

---

## 5. Truncation

- **Line 1 titles** (tiles, tables, heroes, search, checkout): **one line** as `{Name} · {Number} · {Grade}`. Overflow becomes `…` at the **end of the full string** (not name-only truncation).
- CSS class: `.cd-display-name--line1-clamp-2` (via `AssetDetailHeadlineTitle` or `CARD_DISPLAY_LINE1_CLAMP_CLASS`) in `tokenable-collectible-card.css`.
- Line 2: truncate from end; prefer keeping Year + Variant.

---

## Phase 0 — Surface inventory & gaps (2026-07-07)

| Surface | Primary files | Current formatter | Line rule target | Gap vs SSOT |
| --- | --- | --- | --- | --- |
| Markets grid / home cards | `CollectibleCard.tsx`, `marketsCollectionTitle.ts` | `buildMarketsCollectionTitle` | Line 1 only | — |
| Watchlist | `WatchlistCollectibleCard.tsx` | `buildMarketsCollectionTitle` | Line 1 only | — |
| GNB search typeahead | `TkHeaderSearch.tsx` | Line 1 + `buildMarketsCollectionSearchMeta` | Line 1 + compact L2 | — |
| Collection detail hero | `useCollectionDetailHeadline.ts`, `AssetDetailHeadlineTitle.tsx`, `CollectionOverviewTopBar.tsx` | `formatAssetDetailLine1` / `formatCardDisplayMeta` (adapter) → SSOT `cardDisplayName.formatCardDisplayName` | L1 name+number+grade + L2 | Grade on the title |
| Portfolio asset / certificate | `usePortfolioCertificate.ts`, `PortfolioCertificateView.tsx` | Line 1 via asset-detail adapter (`omitGrade`) + `formatCardDisplayMeta` | L1 + L2 | Grade + cert chips stay below; do not put number on a third line |
| Portfolio tx rows | `buildPortfolioTxRows.ts` | SSOT `formatCardDisplayName` / holdings helpers | Line 1 only | — |
| Portfolio holdings | gallery/table components | `resolvePortfolioHoldingsDisplayNames` | Line 1 only | — |
| Listing bid checkout | `CollectionListingBidCheckout.tsx` | listing title | L1 + L2 at decision | Uses checkout modal pattern — OK scope |
| Order book | unified order book | ask/bid labels | L1 abbrev | Price/vault only on rows — grade on collection context |
| Notifications | `notifications.service.ts` (backend copy) | free text | L1 + L2 self-contained | Backend strings not wired to SSOT |
| Admin preview | `AdminHomePreviewPanel.tsx` | `buildMarketsCollectionTitle` | Line 1 | Low priority |
| Home ticker | `HomeTicker.tsx` | `buildHomeTickerCollectionTitle` | `{Name} {Number}` — no middots, no grade | Compact marquee labels; markets tiles still use full Line 1 |

### Data sources (headline parts)

| Field | Sources (priority) |
| --- | --- |
| Card name | `psaSubject`, listing title, bucket `cardName`, Cardhedger preview |
| Number | `components.cardNumber`, preview `card.cardNumber` → `formatHeadlineCardNumber` |
| Grade | `gradeScore` + grader, `psaGradeLabel`, RWA metadata → **`Raw` if missing / empty / unknown** unless the surface explicitly passes `omitGrade` |
| Year | `components.year`, set line prefix, displayLabel |
| Set | Source text as stored (never mutated). **Details Set row / Line 2:** expansion only — pick one source (prefer Cardhedger `setName`, else set line), strip year + TCG franchise/language prefix. Do **not** re-merge Brand franchise onto the catalog expansion. |
| Language | `components.language`, `graded.normalized.language`, preview `market`, corpus inference → **short code** |
| Variant | `components.variant`, PSA variety, Cardhedger variant. **Display:** omit on Line 2 only when Variety restates the expansion (`shouldHideDuplicateVariant`). Phrase-in-set is not enough if leftover expansion identity remains (e.g. Reverse Holo must stay on 151). Stored `psaVariety` is unchanged. |

### Phase 1 scope (this change)

**Files touched (Phase 1):**

| File | Change |
| --- | --- |
| `frontend/lib/marketplace/cardDisplayName.ts` | New SSOT formatters + modes |
| `frontend/lib/marketplace/assetDetailHeadline.ts` | Delegates Line 1/2 to SSOT; re-exports helpers |
| `frontend/lib/markets/marketsCollectionTitle.ts` | Line 1 ` · ` join; grade via SSOT |
| `frontend/hooks/collection-detail/useCollectionDetailHeadline.ts` | Language short codes; unknown grade omits slot |
| `frontend/components/marketplace/marketplace-shared/AssetDetailHeadlineTitle.tsx` | Renders SSOT Line 1 as one string with end ellipsis |
| `backend/src/marketplace/utils/card-display-name.util.spec.ts` | Unit tests (imports frontend SSOT) |
| `backend/jest.config.ts` | `@/*` → frontend for cross-package tests |
| `backend/tsconfig.json` | `@/*` paths for `tsc --noEmit` |
| `ARCHITECTURE_INDEX.md` | Links to this guide |

- [x] SSOT module `cardDisplayName.ts` + unit tests
- [x] `assetDetailHeadline.ts` delegates formatting to SSOT
- [x] `marketsCollectionTitle.ts` uses SSOT Line 1/2 join rules
- [x] Language short codes in headline pipeline
- [x] Unknown grade renders `Raw` on Line 1
- [x] On-mint `rwa_tokens` sync rebuilds Line 1 from `properties.graded` (never clobber with bare IPFS `name`)
- [x] Self-vault mint writes Line 1 into both IPFS `name` and `displayName`
- [x] `AssetDetailHeadlineTitle` renders grade on Line 1 except Certificate of Ownership (`includeGrade={false}`)
- [x] Collection detail language → short codes via `formatCardDisplayLanguageShort`
- [x] Grade badge removal (Phase 2) — detail outline chip, Markets/Watchlist row, portfolio holdings, RWA header badges, Top 100
- [x] Breadcrumb §4 — `Markets / Category / {SetCode} {SetName} ({Language})`
- [x] Detail Line 2 — `{Year} · {Set} {Language} · {Variant}` with set omitted when breadcrumb already shows it
- [x] Surface-by-surface mode wiring (Phase 5) — markets/watchlist Line 1, search Line 2 meta, portfolio Line 1
- [x] Line 1 strict (Phase 6) — no variant on main title; variant on Line 2 only
- [x] Truncation CSS (Phase 7) — full Line 1 end ellipsis; hero Line 2 end-truncate
- [x] Language pipeline (Phase 8) — `formatCardDisplayLanguageShort` in markets + collection headline
- [ ] Backend notifications copy (uses stored `displayName` — no SSOT reformat yet)

---

## Phase 5–7 summary (2026-07-07)

| Surface | Mode | Implementation |
| --- | --- | --- |
| Markets / home grid | Line 1 only | `CollectibleCard` — name · number · grade only |
| Watchlist | Line 1 only | `WatchlistCollectibleCard` |
| GNB search collections | Line 1 + Line 2 meta | `buildMarketsCollectionSearchMeta` |
| Portfolio holdings | Line 1 only | `resolvePortfolioHoldingsDisplayNames` |
| Collection detail | Line 1 name+number+grade + full Line 2 | Grade on hero title |
| Portfolio certificate | Line 1 name+number + full Line 2 | Grade below title |
| Order book listing rows | No grade chip | grade on collection Line 1 context |
| Checkout / modals | Full context | existing checkout copy (unchanged logic) |

---

## QA acceptance checklist (§7)

Use when validating a release after display-name work.

| # | Check | Pass? |
| --- | --- | --- |
| 1 | Collection breadcrumb is `Markets / {Category} / {SetCode} {SetName} ({Lang})` — no year / card number | |
| 2 | Collection / Markets Line 1 is name + number + grade | |
| 3 | Certificate of Ownership Line 1 is name + number only; grade is below | |
| 4 | List Line 1 uses ` · ` between name, number, grade | |
| 5 | No dangling `·` or empty segments in formatted strings | |
| 6 | Language shows as `EN` / `JP` when known; omitted when unknown | |
| 7 | Markets list row shows Line 1 only (no set line under title) | |
| 8 | Search / notification copy is self-contained (full Line 2 when no breadcrumb) | |
| 9 | Line 1 never includes variant — variant only on Line 2 / meta | |
| 10 | One Piece OP13 sample matches §4 example after Phase 3–4 | |

### Fixture cards (manual)

1. Pokemon EN SIR — `Charizard ex · 199/165 · PSA 10` / `2023 · 151 EN · Special Illustration Rare`
2. One Piece — `Monkey D. Luffy · 118 · PSA 10` / breadcrumb `OP13 Carrying On His Will (JP)` / hero meta `2025 · OP13 Carrying On His Will JP · Red Manga Alternate Art`
3. Missing grade — Line 1 is `{Name} · {Number} · Raw`
4. Missing variant — Line 2 without third segment
5. Missing language — Line 2 without language token

---

## Related docs

- `docs/architecture/frontend.md` — Details KV / Markets filters (facet labels separate from display name)
- `frontend/design-system/INVENTORY.md` — UI components
