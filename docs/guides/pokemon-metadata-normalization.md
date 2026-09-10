# Pokémon metadata normalization (V1)

Additive side-car projection for Pokémon TCG slabs. Does **not** change `card.set`, `psaBrand`, Cardhedger matching, bucket keys, or marketplace set facets.

## Schema

`properties.graded.normalized.pokemon`:

| Field | Notes |
|-------|--------|
| `game` | Always `"pokemon"` when present |
| `language` | e.g. `JP` from PSA Brand |
| `series` | From curated set-code catalog only |
| `setName` | Canonical expansion name (e.g. `Pokémon Card 151`) — not raw PSA Brand |
| `setCode` | e.g. `SV2a`, `SV-P` |
| `cardName` / `cardNumber` | From PSA Subject / CardNumber |
| `variant` | Finish/parallel (e.g. Reverse Holo) |
| `rarity` | When Variety is a rarity label |
| `setKind` | `expansion` \| `promo` \| `unknown` |

Mirrored to `marketplace_collections.components.normalizedPokemon`.  
`components.language` / `components.rarity` are filled **only when empty**.

## Write path

```
PSA API / analyze
  → graded metadata construction
  → normalizePokemonMetadata()
  → graded.normalized.pokemon (IPFS)
  → components.normalizedPokemon (collection row)
```

Self-vault FormData must include `graded.normalized` when present (`useMintForm` /
`mintSellFlowCard`). `RwaService.uploadToIpfs` also re-attaches from PSA fields so
IPFS stays correct even if the client omits the block.

**Implementation:** `backend/src/marketplace/utils/pokemon-metadata-normalize.util.ts`  
**Catalog:** `backend/src/marketplace/utils/pokemon-set-code.catalog.ts` (SV2a, SV1S, SV1V, SV-P, SVP)  
**E2E validation:** `backend/src/marketplace/utils/pokemon-metadata-normalize.e2e.spec.ts`

## Explicit non-goals (V1)

- Cardhedger production matching cutover
- Historical backfill
- Sports / One Piece / universal TCG normalization
- New Postgres columns

---

## Cardhedger V2 Shadow Validation

### Why shadow mode exists

Normalized Pokémon fields (`setCode`, etc.) may improve Cardhedger search construction, but a wrong `cardhedgerCardId` attaches the wrong historical market data. Shadow mode runs a **second, observation-only** matcher beside legacy resolve so we can measure agreement **before** any cutover.

### Production behavior (unchanged)

- Flag: `CARDHEDGER_POKEMON_NORMALIZED_SHADOW=1` (default **off**)
- Legacy resolve result is always returned as production
- Shadow never writes `cardhedgerCardId`, identity, IPFS, buckets, or market data
- Cert Path 0 and first-write precedence unchanged
- Shadow errors are swallowed; production still returns

### Outcome definitions

| Outcome | Meaning |
|---------|---------|
| `same` | Both verified, same `card_id` |
| `both_fail` | Neither verified |
| `legacy_only` | Legacy verified; shadow not |
| `shadow_only` | Shadow verified; legacy not |
| `conflict` | Both verified, **different** ids |
| `skipped` | Not Pokémon / no phrase map / insufficient identity |

Unverified candidates never count as success.

### Telemetry fields

Structured log (`type: cardhedger_pokemon_normalized_shadow`):

- Card identity: `cardName`, `cardNumber`, `year`, `language`, `series`, `setName`, `setCode`, `variant`, `rarity`
- `legacy` / `shadow`: `{ cardId, query, verified, confidence }`
- `normalized`: `{ setPhrase, variantPhrase }` (Cardhedger vocabulary — not V1 display names)
- `conflict` (when outcome=`conflict`): compact row digests (`set`, `name`, `number`, `variant`, `year`) — not full payloads
- **No cert numbers** in shadow telemetry

### Aggregation counters

`CardhedgerMetricsService.recordPokemonNormalizedShadow(outcome)` increments in-window counts exposed on `getSnapshot().pokemonNormalizedShadow` and in `cardhedger_metrics_window` logs:

`same | both_fail | legacy_only | shadow_only | conflict | skipped`

### Phrase map vs V1 catalog

| Concept | Example | File |
|---------|---------|------|
| Canonical Tokenable setName | `Pokémon Card 151` | `pokemon-set-code.catalog.ts` |
| Cardhedger search phrase | `Pokemon Japanese 151` | `pokemon-cardhedger-set-phrase.util.ts` |

Do not merge these concepts.

### Cardhedger set vocabulary evidence

| Set code | Canonical set name | Observed Cardhedger `row.set` | Search phrase candidate | Evidence count | Status |
| -------- | ------------------ | ----------------------------- | ----------------------- | -------------: | ------ |
| SV2a | Pokémon Card 151 | `2023 Pokemon Japanese Scarlet & Violet 151` | `Pokemon Japanese 151` | 5+ staging + fixtures | **CONFIRMED** (shadow + production phrase map) |
| M2 | Inferno X | `2025 Pokemon Japanese Inferno X` | `Pokemon Japanese Inferno X` | V2.3 set-search + staging Mega Charizard X ex 116 | **IMPLEMENTED-SHADOW** (V2.4) |
| M2a | Mega Dream EX | `2025 Pokemon Japanese Mega Dream EX` | `Pokemon Japanese Mega Dream EX` | V2.3 set-search + staging Mega Gengar ex 240 | **IMPLEMENTED-SHADOW** (V2.4) |
| SV1S | Scarlet ex | — | — | 0 | **UNKNOWN** |
| SV1V | Violet ex | — | — | 0 | **UNKNOWN** |
| SV-P | Promo (JP) | `2023/2024 Pokemon Japanese SV-P Promos`; 2025 often `… Scarlet & Violet Promos` | `Pokemon Japanese SV-P Promos` | multi-year probes | **CANDIDATE** — not implemented |
| SVP | Promo (EN Black Star) | `2023/2024/2025 Pokemon Scarlet & Violet Black Star Promos` | `Pokemon Scarlet Violet Black Star Promos` | multi-year + staging Pikachu 190 | **CANDIDATE** — not implemented |

**Do not** treat `SV-P` and `SVP` as the same Cardhedger vocabulary.  
**Do not** search raw set code `M2` (collides with sports card numbers).

Shadow phrase map (`pokemon-cardhedger-set-phrase.util.ts`) currently implements: **SV2a, M2, M2a** only. Legacy production resolver is unchanged.

**Live JP 151 Reverse Foil probe (read-only):**

```text
query: Gengar 094 Pokemon Japanese 151 Reverse Foil
card_id: 1694044201512x180824829158223720
row.set: 2023 Pokemon Japanese Scarlet & Violet 151
variant: Reverse Foil
number: 94
```

### Known conflicts

See **V2.2 Staging Shadow Validation** below (sample window: zero conflicts).

### Criteria for production cutover (future)

Cutover is **not** justified by unit tests alone. Require:

1. Representative real-data sample (JP 151 reverse / master ball, SV1S/SV1V when mapped, promos, varied names/numbers)
2. Outcome distribution with low unexplained `legacy_only` / `conflict`
3. Manual review of every `conflict`
4. Fail-closed on insufficient metadata (`skipped` / `both_fail` — never invent ids)
5. Human-reviewed decision — never auto-cutover from shadow_only

---

## V2.2 Staging Shadow Validation

Observation window: **2026-09-10** (Dev EC2 / `develop` staging). Validation only — no production cutover.

### Environment

```text
staging (Dev EC2):
  file: /home/ubuntu/.env.production.backend
  CARDHEDGER_POKEMON_NORMALIZED_SHADOW=1
  verified in container: printenv → 1

production (main / Prod EC2):
  disabled (flag not set; this task did not touch Prod EC2)
```

Local defaults remain off. Documented in `docs/guides/local-setup.md` as:

```text
# CARDHEDGER_POKEMON_NORMALIZED_SHADOW=0
```

### Sample size

Market-snapshot / resolve traffic after enabling the flag (Nest logs `type: cardhedger_pokemon_normalized_shadow`).

```text
total shadow log events (window): 60
unique collection keys:           59
  of which not_pokemon skips:     ~29 (sports / non-Pokémon)
Pokémon-related unique keys:      30   (skipReason ≠ not_pokemon)
  evaluated (outcome ≠ skipped):  4
  skipped (Pokémon-related):      26
```

Target was ≥30 evaluated Pokémon cases; **actual evaluated = 4**. Staging inventory has only ~12 Pokémon marketplace collections (no SV1S / SV1V rows). Additional `mint_*` keys appeared from mint-preview resolves (mostly SV-P / unmapped sets → skipped).

### Global results (Pokémon-related unique keys, n=30)

Denominator for match outcomes: **evaluated = 4** (excludes `skipped`).

| Outcome | Count | % of evaluated | % of Pokémon-related |
|---------|------:|---------------:|---------------------:|
| same | 4 | 100% | 13.3% |
| both_fail | 0 | 0% | 0% |
| legacy_only | 0 | 0% | 0% |
| shadow_only | 0 | 0% | 0% |
| conflict | 0 | 0% | 0% |
| skipped | 26 | — | 86.7% |

All 26 Pokémon `skipped` used `skipReason: insufficient_set_phrase` (no Cardhedger phrase map for that `setCode`, or no extractable mapped code). That is **not** counted as `legacy_only`.

### Per-set results (Pokémon-related)

```text
SV2a:   same: 4
SV1S:   (none in staging inventory)
SV1V:   (none in staging inventory)
SV-P:   skipped: 11  (insufficient_set_phrase)
SVP:    skipped: 1
M2:     skipped: 1
M2a:    skipped: 1
unknown: skipped: 12  (set code not extracted / unmapped, e.g. Eevee Heroes, M-P, older JP)
```

### Variant results (evaluated SV2a)

```text
Reverse Holo / Reverse Foil path:  same: 1  (Gengar 094)
Master Ball Reverse Holo:          same: 1  (Gengar 094)
Special Art Rare (base finish):    same: 2  (Charizard ex 201, Mew ex 205)
```

Pikachu Master Ball (`84926b09…`) is present in staging with a stable legacy `cardhedgerCardId`, but a shadow evaluation for that key was **not** observed in this log window (site-access blocked ad-hoc HTTP probes; cron covered most of the set). Do not treat as a regression without a captured shadow row.

### SV2a confirmation

Real staging traffic produced:

```text
setCode:     SV2a
setName:     Pokémon Card 151
setPhrase:   Pokemon Japanese 151
```

Examples (legacy id = shadow id):

- Charizard ex 201 → `same` / query `CHARIZARD ex 201 Pokemon Japanese 151`
- Gengar 094 Reverse Foil → `same` / `… Reverse Foil`
- Gengar 094 Master Ball → `same` / `… Master Ball`
- Mew ex 205 → `same`

### Conflict review

No conflicts observed in the staging sample.

Zero conflicts with n_evaluated=4 is **not** proof of correctness.

### Legacy-only review

None in this window. Cases where legacy matched and shadow did not search (unmapped set) are classified **`skipped` / `insufficient_set_phrase`**, e.g. SVP Black Star Pikachu, SV-P Ditto, M2 / M2a mega cards, Eevee Heroes Umbreon — intentional fail-closed until a confirmed phrase map exists.

### Shadow-only review

None observed.

### Both-fail review

None among evaluated rows. Many unmapped / promo mint paths had legacy unverified + shadow skipped (coverage boundary, not a matcher bug).

### Cardhedger vocabulary (this window)

| setCode | Status | Notes |
|---------|--------|-------|
| SV2a | **confirmed** | Phrase `Pokemon Japanese 151`; token-coverage vs longer `row.set` |
| SV1S | **unknown** | No staging rows |
| SV1V | **unknown** | No staging rows |
| SV-P | **unknown** (candidate only from prior probes) | Staging → skipped; no map added |
| SVP | **unknown** | Staging → skipped; existing black-star aliases remain legacy-only |
| M2 / M2a | **unknown** | Staging → skipped; do not invent phrases |

### Production / persistence safety (staging checks)

- Production env not modified
- Staging `components.cardhedgerCardId` for SV2a rows unchanged vs pre-run inventory (legacy ids retained)
- Shadow telemetry logged only; no evidence of shadow id write
- No IPFS / mint / collection-key changes performed for this validation

### Skip analysis (first staging window — Pokémon-related unique keys)

All 26 Pokémon skips were `insufficient_set_phrase` (no confirmed Cardhedger phrase for the normalized `setCode`, or no extractable mapped code). Fail-closed retained.

| Bucket | Count (approx) | Notes |
|--------|---------------:|-------|
| SV2a | 0 skipped / 4 evaluated | Only mapped set |
| SV-P | 11 | Code present; phrase unmapped; mostly legacy unverified in window |
| SVP | 1 | Code present; phrase unmapped; **legacy verified** → `legacyOnlyCandidate` |
| M2 | 1 | Code present; unmapped; **legacy verified** → candidate |
| M2a | 1 | Code present; unmapped; **legacy verified** → candidate |
| unknown | 12 | No mapped setCode (Eevee Heroes, M-P, older JP, etc.); mix of legacy verified / fail |

**legacy_only_candidate** (diagnostic flag, outcome still `skipped`): SVP Pikachu 190, M2 Mega Charizard X ex, M2a Mega Gengar ex, Eevee Heroes Umbreon V/VMAX, Dark Phantasma / Fusion Strike Gengar FA lines, etc. — legacy found an id; shadow did not search because phrase map is incomplete.

No phrase mappings were added for SV1S / SV1V / SV-P / SVP / M2 / M2a in this task.

### Ops note

Shadow code ships via normal CI: push `develop` → ECR → Dev EC2 `tokenable-backend`. Do **not** hot-load `dist/` for ongoing validation.

Staging flag (Dev EC2 only): `CARDHEDGER_POKEMON_NORMALIZED_SHADOW=1` in the existing env file. Production remains disabled. Never recreate or dump that env file for this experiment.

### Skip / vocabulary limitation (inventory)

Most Pokémon-related staging traffic cannot be **evaluated** until a confirmed Cardhedger phrase exists for the normalized `setCode`. With only SV2a mapped, evaluated count stays near the SV2a inventory size (~4–5 marketplace rows), not 30+. Unmapped sets with a verified legacy id are flagged `legacyOnlyCandidate: true` while outcome remains `skipped`.

### V2.2 recommendation

```text
NOT READY — insufficient evaluated sample
```

Do **not** enable production cutover. Next: durable `develop` deploy of shadow code, keep staging flag on, grow real SV2a+ diversity and/or confirm phrases from observed `row.set` evidence before mapping other codes.

---

## V2.3 Cardhedger set vocabulary discovery

Read-only investigation **2026-09-10** (staging Cardhedger API via existing backend auth). **No phrase-map code changes.** Production matching unchanged.

### legacyOnlyCandidate cases (7)

| setCode | card | legacy card_id | Cardhedger `row.set` | `row.variant` |
| ------- | ---- | -------------- | -------------------- | ------------- |
| M2 | Mega Charizard X ex 116 | `1759154235951x249681693062288480` | `2025 Pokemon Japanese Inferno X` | Base |
| M2a | Mega Gengar ex 240 | `1765743129501x182611139206225950` | `2025 Pokemon Japanese Mega Dream EX` | Base |
| SVP | Pikachu 190 | `1763951954787x840887315467792900` | `2024 Pokemon Scarlet & Violet Black Star Promos` | Base |
| (none — Category B) | Umbreon V 085 | `1746801588115x866012808812673900` | `2021 Pokemon Japanese Sword & Shield Eevee Heroes` | Base |
| (none — Category B) | Umbreon VMAX 095 | `1746801575081x586111977839343500` | `2021 Pokemon Japanese Sword & Shield Eevee Heroes` | Base |
| (none — Category B) | FA/Gengar 074 | `1690767144318x232310659149515870` | `2022 Pokemon Japanese Dark Phantasma` | Full Art |
| (none — Category B) | FA/Gengar VMAX 157 | `1664334902745x413368462090247360` | `2021 Pokemon Fusion Strike` | Full Art |

### Findings summary

- **M2 ≠ M2a** in Cardhedger (`Inferno X` vs `Mega Dream EX`).
- Raw search `M2 Inferno X` is **REJECTED** as a strategy (sports collisions).
- **SV-P ≠ SVP** (`Japanese SV-P Promos` vs EN `Scarlet & Violet Black Star Promos`).
- Korean SV-P Ditto 173: no reliable Cardhedger hit in probes → coverage gap.
- Eevee Heroes / Dark Phantasma / Fusion Strike: Cardhedger vocabulary exists; Tokenable failed to emit a mapped `setCode` (normalization Category B), not missing Cardhedger sets.
- Phrase map file **not** updated in V2.3 — implement candidates in a separate review task.

### Mapping recommendation (do not implement yet)

| Set code | Cardhedger phrase | Recommendation | Reason |
| -------- | ----------------- | -------------- | ------ |
| SV2a | `Pokemon Japanese 151` | keep CONFIRMED | already live |
| M2 | `Pokemon Japanese Inferno X` | implement after review | consistent `row.set` + set-search |
| M2a | `Pokemon Japanese Mega Dream EX` | implement after review | distinct from M2; consistent |
| SVP | `Pokemon Scarlet Violet Black Star Promos` | implement carefully / reuse aliases | multi-year family; EN Black Star |
| SV-P | `Pokemon Japanese SV-P Promos` | defer or gated | year split + 2025 rename + KR gap |
| SV1S / SV1V | — | leave UNKNOWN | no reliable evidence |
| Eevee Heroes etc. | n/a (need setCode first) | fix normalization extract | Category B |

### V2.3 recommendation

```text
MAPPING CANDIDATES READY — separate implementation review required
```

---

## V2.4 — M2 / M2a shadow phrase implementation

Implemented in **normalized shadow only** (not production cutover):

| setCode | Canonical setName | Cardhedger search phrase |
| ------- | ----------------- | ------------------------ |
| SV2a | Pokémon Card 151 | `Pokemon Japanese 151` (unchanged) |
| M2 | Inferno X | `Pokemon Japanese Inferno X` |
| M2a | Mega Dream EX | `Pokemon Japanese Mega Dream EX` |

Still **not** implemented: SVP, SV-P, SV1S, SV1V. Category B sets (Eevee Heroes, Dark Phantasma, Fusion Strike) remain unmapped pending setCode extraction work.

Legacy Cardhedger resolver, persisted `cardhedgerCardId`, mint/IPFS/collection identity: **unchanged**.

### V2.4 staging shadow window (post-deploy `911a217`)

```text
Pokémon-related unique: 31
evaluated: 7   (SV2a=5, M2=1, M2a=1) — all same
skipped: 24
conflicts: 0
```

M2 representative: `MEGA CHARIZARD X ex 116 Pokemon Japanese Inferno X` → same id as legacy.  
M2a representative: `MEGA GENGAR ex 240 Pokemon Japanese Mega Dream EX` → same id as legacy.

**Production readiness:** insufficient sample for M2/M2a (n=1 each). Implementation success ≠ production cutover confidence.
