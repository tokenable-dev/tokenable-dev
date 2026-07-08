# Design system governance — phased plan

**Goal:** Control style drift between designer HTML prototypes and the Next.js app, without over-engineering.

**Read first:** [design-system-reference.md](./design-system-reference.md)

**Source of truth (agreed rule):**

| Layer | Path | Role |
|-------|------|------|
| Designer prototype | `Tokenable-with design system/` | Reference / mockups — **not imported by Next.js** |
| Committed DS | `frontend/design-system/` | Tokens + `tk-*` CSS — **canonical styles** |
| React primitives | `frontend/components/ds/` | `TkButton`, `TkDialog`, … |
| App wiring | `frontend/styles/tokenable-ds-entry.css`, `globals.css` | Imports only |

Designer updates do **not** auto-apply. Each phase below is a discrete work order.

---

## Phase 1 — Process & documentation (no UI code changes)

**Effort:** ~1–2 hours · **Risk:** none

### Deliverables

1. **Team rule (designer + eng)** — add to [design-system-reference.md](./design-system-reference.md) § “Prototype sync”:
   - Prototype folder changes → **manual** diff into `frontend/design-system/`
   - Never paste prototype HTML/JS into React
   - Visual check: `/dev/design-system` after any `components.css` / token change

2. **Short changelog habit** — when merging DS CSS, one line in PR description, e.g.:
   - `DS: tk-btn--primary hover #2E80FF → #3088FF`

3. **Admin exception** — document in reference doc:
   - `/marketplace/admin/*` uses `adminUi.ts` (light Tailwind) **on purpose** — not pixel `tk-btn`

### Done when

- [x] Reference doc updated with sync workflow
- [ ] Designer acknowledges: prototype ≠ production until merged into `frontend/design-system/` _(team sign-off — pending)_

### Out of scope

- No lint rules, no CI, no new scripts

---

## Phase 2 — Button consistency fixes (small code diff)

**Effort:** ~2–4 hours · **Risk:** low (auth, watchlist only)

Fix the few places that bypass `TkButton` while looking like DS buttons.

| Task | File(s) | Change |
|------|---------|--------|
| Auth forms use `TkButton` | `DeleteAccountSettings`, `SiteAccessClient`, `KycRequiredModal`, … | Already on `TkButton`; removed unused `authUiStyles.ts` (`AUTH_*_BTN` dead code) |
| Watchlist card fake buttons | `WatchlistCollectibleCard.tsx` | `TkButton decorative` inside card `Link` |
| Optional tidy | `PortfolioAssetCardCta.tsx` | Unified listed/unlisted card CTAs (replaces thin SellNow/Manage wrappers) |

### Done when

- [x] No `tk-btn` class strings outside `components/ds/` and `DesignSystemShowcase` (except documented admin + header `tk-btn--gnb`)
- [x] `pnpm exec tsc --noEmit` (frontend) passes

### Out of scope

- Admin → `TkButton` migration
- Markets filter chips → `TkButton`
- Header/wallet raw `<button>` (domain-specific; OK as-is)
- Deleting thin wrappers that add real behavior (`PortfolioListingManageButton`, RWA CTA helpers)

---

## Phase 3 — Designer QA surface (showcase only)

**Effort:** ~1–2 hours · **Risk:** none

Make `/dev/design-system` the **contract** for button variants so designer can spot drift without reading CSS.

### Deliverables

1. Ensure `DesignSystemShowcase` lists **every** `TkButton` variant + size:
   - `primary`, `primaryInv`, `neutral`, `subtle`, `danger` × `md`, `sm`
   - Disabled state row

2. One-line note on that page (or reference doc): “Compare this page after any DS CSS merge.”

### Done when

- [x] All variants visible on `/dev/design-system`
- [ ] Designer sign-off on one screenshot baseline (optional PNG in design handoff, not necessarily in repo)

### Out of scope

- Percy/Chromatic, full visual regression CI

---

## Phase 4 — Prototype ↔ committed DS diff (one script)

**Effort:** ~1 hour · **Risk:** none (read-only tool)

Single shell script developers run **before/after** pulling designer prototype updates.

### Deliverables

```bash
# Example — implement as scripts/ds-diff-prototype.sh
diff -u \
  "Tokenable-with design system/_ds/.../components/components.css" \
  "frontend/design-system/components/components.css"
# Same for fig-tokens.css if needed
```

- Script prints diff exit code; **does not auto-copy**
- README blurb in `frontend/design-system/README.md`: when to run it

### Done when

- [ ] Script exists and is documented
- [ ] Team uses it once on current tree (baseline: “we know they differ today”)

### Out of scope

- CI gate blocking PRs
- Auto-sync from prototype

---

## Phase 5 — Ongoing (only if drift keeps happening)

**Do not start until Phases 1–4 are done and pain persists.**

| Option | When worth it |
|--------|----------------|
| PR checklist item: “DS CSS changed? → `/dev/design-system` checked” | Any recurring button regressions |
| Simple grep check in CI: `tk-btn` string outside `ds/` | If Phase 2 regressions repeat |
| Quarterly prototype diff review with designer | If prototype stays active |

### Out of scope (unless explicitly requested)

- Second button component library
- Replacing all raw `<button>` in marketplace/orderbook
- Migrating admin to dark pixel DS
- Carbon-style `$background` token rename project

---

## Suggested order

```
Phase 1 (docs)  →  Phase 2 (auth + watchlist)  →  Phase 3 (showcase)
                                                      ↓
                                              Phase 4 (diff script)
                                                      ↓
                                              Phase 5 (only if needed)
```

---

## Work order template (for you)

When assigning a phase to AI or eng, copy:

```
Phase N from docs/guides/design-system-governance-phases.md
Scope: [paste phase deliverables only]
Do not: [paste "Out of scope" for that phase]
Verify: tsc + manual /dev/design-system if UI touched
```
