# Card display name (SSOT)

**Applies to:** every surface where a card name is rendered. This document is the single source of truth. No surface invents its own card-name format.

**Implementation:** `frontend/lib/marketplace/cardDisplayName.ts` (formatters) + `frontend/lib/marketplace/assetDetailHeadline.ts` (build parts from collection/RWA fields).

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

Example (collection detail / markets):

```
Charizard ex · 199/165 · PSA 10
2023 · 151 EN · Special Illustration Rare
```

Example (portfolio Certificate of Ownership):

```
Charizard ex · 199/165
2023 · 151 EN · Special Illustration Rare
```

### Token rules

| Token | Rule |
| --- | --- |
| Card name | As-is from source (proper case). |
| Number | Drop `#` and `-`; uppercase Latin (`#OP13-118` → `OP13118`). Pokemon-style `199/165` stays. Numeric → 3-digit pad (`085`). |
| Grade | `PSA 10`, `BGS 9.5`, etc. **Ungraded → `Raw`.** Slot is **never empty**. |
| Year | 4-digit. Omit if unknown. |
| Set | Expansion name. TCG franchise / category prefixes (`One Piece`, `Pokemon`) and a leading language token are stripped on Line 2 and the breadcrumb — they are not part of the expansion. Sports set names stay as-is. |
| Language | Short code (`EN`, `JP`, …). Omit if unknown. |
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
| Notifications / share / email | Line 1 + Line 2 | Self-contained (no breadcrumb dedupe). |

Use `formatCardDisplayName({ parts, mode })` — never hand-join segments at call sites.

---

## 3. List surfaces (Line 1 only)

Markets / watchlist / portfolio list rows show **Line 1 only** on the main title:
`{Name} · {Number} · {Grade}`.

**Variant, set, year, and language belong on Line 2 (subtitle / meta)** — never append variant to Line 1.

---

## 4. Collection-detail breadcrumb

- Breadcrumb: `Markets / {Category} / {Set} ({Language})` (navigation only — **not** card name).
- Example: `Markets / One Piece / OP13 Carrying On His Will (JP)`.
- Strip category prefix from the set node. Do **not** put year on the breadcrumb.
- Language in parentheses when known; omit the `(XX)` suffix when unknown.
- Line 2 is always full: `{Year} · {Set} {Language} · {Variant}` (language token omitted when unknown). `{Set}` is the expansion only — same franchise strip as the breadcrumb node (`One Piece OP13 …` → `OP13 …`).

---

## 5. Truncation

- **Line 1 titles** (tiles, tables, heroes, search, checkout): **one line**. Overflow becomes `…` on the **card name**. Number and grade stay immediately after the name (not flush to the right).
- CSS class: `.cd-display-name--line1-clamp-2` (via `AssetDetailHeadlineTitle` or `CARD_DISPLAY_LINE1_CLAMP_CLASS`) in `tokenable-collectible-card.css`.
- Line 2: truncate from end; prefer keeping Year + Variant.

---

## Phase 0 — Surface inventory & gaps (2026-07-07)

| Surface | Primary files | Current formatter | Line rule target | Gap vs SSOT |
| --- | --- | --- | --- | --- |
| Markets grid / home cards | `CollectibleCard.tsx`, `marketsCollectionTitle.ts` | `buildMarketsCollectionTitle` | Line 1 only | — |
| Watchlist | `WatchlistCollectibleCard.tsx` | `buildMarketsCollectionTitle` | Line 1 only | — |
| GNB search typeahead | `TkHeaderSearch.tsx` | Line 1 + `buildMarketsCollectionSearchMeta` | Line 1 + compact L2 | — |
| Collection detail hero | `useCollectionDetailHeadline.ts`, `AssetDetailHeadlineTitle.tsx`, `CollectionOverviewTopBar.tsx` | `formatCardDisplayName/Meta` | L1 name+number+grade + L2 | Grade on the title |
| Portfolio asset / certificate | `usePortfolioCertificate.ts`, `PortfolioCertificateView.tsx` | `formatCardDisplayName` (`omitGrade`) + `formatCardDisplayMeta` | L1 + L2 | Grade + cert chips stay below; do not put number on a third line |
| Portfolio tx rows | `buildPortfolioTxRows.ts` | `formatCardDisplayName` | Line 1 only | — |
| Portfolio holdings | gallery/table components | `resolvePortfolioHoldingsDisplayNames` | Line 1 only | — |
| Listing bid checkout | `CollectionListingBidCheckout.tsx` | listing title | L1 + L2 at decision | Uses checkout modal pattern — OK scope |
| Order book | unified order book | ask/bid labels | L1 abbrev | Price/vault only on rows — grade on collection context |
| Notifications | `notifications.service.ts` (backend copy) | free text | L1 + L2 self-contained | Backend strings not wired to SSOT |
| Admin preview | `AdminHomePreviewPanel.tsx` | `buildMarketsCollectionTitle` | Line 1 | Low priority |
| Home ticker | `HomeTicker.tsx` | `buildMarketsCollectionTitle` | Line 1 | OK after SSOT line1 fix |

### Data sources (headline parts)

| Field | Sources (priority) |
| --- | --- |
| Card name | `psaSubject`, listing title, bucket `cardName`, Cardhedger preview |
| Number | `components.cardNumber`, preview `card.cardNumber` → `formatHeadlineCardNumber` |
| Grade | `gradeScore` + grader, `psaGradeLabel`, RWA metadata → **`Raw` if missing** |
| Year | `components.year`, set line prefix, displayLabel |
| Set | PSA `psaBrand` as stored (never mutated). **Display:** catalog expansion prefer, then omit the TCG series slot (`Word & Word` after franchise/language when an expansion follows). Not a named-series list. |
| Language | `components.language`, preview `market`, corpus inference → **short code** |
| Variant | `components.variant`, PSA variety, Cardhedger variant. **Display:** omit on Line 2 only when Variety restates the expansion (`shouldHideDuplicateVariant`). Phrase-in-set is not enough if leftover expansion identity remains (e.g. Reverse Holo must stay on 151). Stored `psaVariety` is unchanged. |

### Phase 1 scope (this change)

**Files touched (Phase 1):**

| File | Change |
| --- | --- |
| `frontend/lib/marketplace/cardDisplayName.ts` | New SSOT formatters + modes |
| `frontend/lib/marketplace/assetDetailHeadline.ts` | Delegates Line 1/2 to SSOT; re-exports helpers |
| `frontend/lib/markets/marketsCollectionTitle.ts` | Line 1 ` · ` join; grade via SSOT |
| `frontend/hooks/collection-detail/useCollectionDetailHeadline.ts` | Language short codes; grade defaults `Raw` |
| `frontend/components/marketplace/marketplace-shared/AssetDetailHeadlineTitle.tsx` | Grade always rendered on Line 1 |
| `backend/src/marketplace/utils/card-display-name.util.spec.ts` | Unit tests (imports frontend SSOT) |
| `backend/jest.config.ts` | `@/*` → frontend for cross-package tests |
| `backend/tsconfig.json` | `@/*` paths for `tsc --noEmit` |
| `ARCHITECTURE_INDEX.md` | Links to this guide |

- [x] SSOT module `cardDisplayName.ts` + unit tests
- [x] `assetDetailHeadline.ts` delegates formatting to SSOT
- [x] `marketsCollectionTitle.ts` uses SSOT Line 1/2 join rules
- [x] Language short codes in headline pipeline
- [x] Grade defaults to `Raw` in formatters
- [x] `AssetDetailHeadlineTitle` renders grade on Line 1 except Certificate of Ownership (`includeGrade={false}`)
- [x] Collection detail language → short codes via `formatCardDisplayLanguageShort`
- [x] Grade badge removal (Phase 2) — detail outline chip, Markets/Watchlist row, portfolio holdings, RWA header badges, Top 100
- [x] Breadcrumb §4 — `Markets / Category / {Set} ({Language})`
- [x] Detail Line 2 — full `{Year} · {Set} {Language} · {Variant}` (no set omit)
- [x] Surface-by-surface mode wiring (Phase 5) — markets/watchlist Line 1, search Line 2 meta, portfolio Line 1
- [x] Line 1 strict (Phase 6) — no variant on main title; variant on Line 2 only
- [x] Truncation CSS (Phase 7) — name ellipsis; number + grade stay beside the name; hero Line 2 end-truncate
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
| 1 | Collection breadcrumb is `Markets / {Category} / {Set} ({Lang})` — no year | |
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
2. One Piece — `Monkey D. Luffy · OP13118 · PSA 10` / breadcrumb `OP13 Carrying On His Will (JP)` / hero meta `2025 · OP13 Carrying On His Will JP · Red Manga Alternate Art`
3. Raw card — grade `Raw`
4. Missing variant — Line 2 without third segment
5. Missing language — Line 2 without language token

---

## Related docs

- `docs/architecture/frontend.md` — Details KV / Markets filters (facet labels separate from display name)
- `frontend/design-system/INVENTORY.md` — UI components
