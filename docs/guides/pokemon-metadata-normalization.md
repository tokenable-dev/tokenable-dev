# Pokémon metadata normalization & Cardhedger matching

Additive side-car for Pokémon TCG slabs. Does **not** change `card.set`, marketplace set facets, or production Cardhedger cutover by itself.

## Two concepts (do not merge)

| Concept | Example | Source of truth |
| ------- | ------- | --------------- |
| **Canonical metadata** | `SV2a` → `Pokémon Card 151` | `pokemon-set-code.catalog.ts` |
| **Cardhedger vocabulary** | `SV2a` → `Pokemon Japanese 151` | `pokemon-cardhedger-set-phrase.util.ts` |

Canonical `setName` is for normalized display / identity. It must **never** be used as a Cardhedger set-match phrase (deferred `SV1S` → `Scarlet ex` falsely matches other EX sets).

## Language resolution

`language` is a short code (`JP` / `EN` / …). PSA has **no Language field** — codes are inferred from Brand / Category / Variety / Cardhedger set (`japanese` → `JP`, …).

- **Every TCG** writes `graded.normalized.language` and `components.language` when a word match exists. Do not invent English.
- **Pokémon only** also writes `graded.normalized.pokemon` (set code, series, …) and mirrors `pokemon.language` onto `components.language`.

Resolution order (first hit wins):

1. Explicit language / Cardhedger `market`
2. Word match on Brand / setHint / category / **Variety** / **Cardhedger set phrase** (`japanese` → `JP`, …)
3. Pokémon curated catalog `market` for the resolved set code (e.g. `SV2a` → `JP`) when Brand omitted “Japanese”

Mint (`PsaService` analyze) also passes the Cardhedger primary set phrase (when mapped) into Pokémon normalize so JP phrases like `Pokemon Japanese 151` fill language even when PSA Brand is language-silent. Non-Pokémon slabs still get `normalized.language` from Brand (e.g. `ONE PIECE JAPANESE OP05-…` → `JP`).

Collection create / duplicate-key merge re-applies inference from graded raw fields so a partial mint projection without `language` still gets backfilled.

Collection detail read also calls `ensureNormalizedPokemonLanguageIfMissing` so already-vaulted rows without language are repaired from stored PSA Brand / set code / Cardhedger phrase.

## Normalization pipeline

```text
PSA Brand / Subject / CardNumber / Variety / Category
  → normalizePokemonMetadata()
  → graded.normalized.pokemon
  → components.normalizedPokemon
```

Fields (when known): `game`, `language`, `series`, `setName`, `setCode`, `cardName`, `cardNumber`, `variant`, `rarity`, `setKind`.

Missing source data → omit fields; do not invent series/setName for unknown codes.

**Implementation:** `pokemon-metadata-normalize.util.ts`  
**Catalog:** `pokemon-set-code.catalog.ts`

## Cardhedger phrase map (supported)

| setCode | Canonical setName | Cardhedger phrase | Status |
| ------- | ----------------- | ----------------- | ------ |
| SV2a | Pokémon Card 151 | `Pokemon Japanese 151` | Mapped (+ alias `Scarlet Violet 151`) |
| M2 | Inferno X | `Pokemon Japanese Inferno X` | Mapped |
| M2a | Mega Dream EX | `Pokemon Japanese Mega Dream EX` | Mapped |
| SVP | Scarlet & Violet Black Star Promos | `Pokemon Scarlet Violet Black Star Promos` | Mapped |
| SV1V | Violet ex | `Pokemon Japanese Scarlet & Violet Violet EX` | Mapped |
| SV1S | Scarlet ex | — | **Deferred** (no phrase) |
| SV-P | *(promo; no invented setName)* | — | **Deferred** (no phrase) |

Helpers:

- `pokemonCardhedgerPrimarySetPhrase(setCode)` → primary phrase or `null`
- `pokemonCardhedgerMintSetMatchPhrases({ setCode, cardSetHint })` → PSA hint + phrase/aliases only
- `setMatchedAgainstPhrase(phrase, row.set)` → substring / token coverage

## Matching rules

### Mint (`PsaService.tryResolveCardhedgerMint`)

Detect Pokémon via `normalizePokemonMetadata` on PSA hints (mint runs **before** `result.normalized` is attached).

| | Verified rule |
| - | ------------- |
| **Pokémon** | `number AND set AND name` (+ variety util + year hard-reject when both years present) |
| **Non-Pokémon** | `number AND (set OR name)` (unchanged soft set) |

Pokémon wrong-set rows score `0` (also blocks `allowApproximate` fail-open). Deferred codes without a phrase fail closed — no name-only fallback.

### Collection (`CardhedgerResolveService.scoreCard`)

`number AND set AND name` (+ parallel/variety utilities, year hard-reject). Unchanged by Pokémon mint work.

### Normalized shadow (observation-only)

Flag: `CARDHEDGER_POKEMON_NORMALIZED_SHADOW` (default off).

```text
setCode → phrase map → search queries → score (number∧setPhrase∧name∧variety)
→ compare legacy vs shadow IDs → telemetry (same|both_fail|legacy_only|shadow_only|conflict|skipped)
```

Never writes `cardhedgerCardId`. Production pick remains legacy. Keep flag + metrics for staging validation.

## Variant / rarity notes

- PSA `REVERSE HOLO` ↔ Cardhedger `Reverse Foil`
- PSA `MASTER BALL REVERSE HOLO` ↔ Cardhedger `Master Ball`
- Pokémon rarity labels (e.g. Special Art Rare) may match Cardhedger `Base` via existing variety utilities — do not treat rarity string equality as a hard gate

## Fail-closed expectations

- Pokémon mint: name+number without set coverage → no verified (or approximate) pick
- Collection / shadow: wrong-set candidates do not verify
- SV1S / SV-P: no invented Cardhedger phrases

## Key files

| File | Responsibility |
| ---- | -------------- |
| `pokemon-set-code.catalog.ts` | Canonical setCode → series/setName/setKind |
| `pokemon-metadata-normalize.util.ts` | PSA → normalized Pokémon projection |
| `pokemon-cardhedger-set-phrase.util.ts` | Cardhedger phrases + set match helpers |
| `pokemon-cardhedger-normalized-shadow.util.ts` | Shadow query/score/telemetry (pure) |
| `psa.service.ts` | Mint Cardhedger resolve (Pokémon-hardened) |
| `cardhedger-resolve.service.ts` | Collection resolve + optional shadow compare |
| `cardhedger-feature-flags.util.ts` | Includes `pokemonNormalizedShadow` |

## Tests

| Suite | Focus |
| ----- | ----- |
| `pokemon-metadata-normalize*.spec.ts` | Catalog + normalize + e2e mint metadata |
| `pokemon-cardhedger-normalized-shadow.util.spec.ts` | Phrase map + shadow scoring/telemetry |
| `pokemon-cardhedger-ambiguity.matrix.spec.ts` | Shadow + collection ambiguity |
| `pokemon-cardhedger-mint.e2e.spec.ts` | Mint harden / deferred / non-Pokémon |
| `cardhedger-resolve.service.spec.ts` | Collection resolve + variety |
| `cardhedger-feature-flags.util.spec.ts` | Shadow flag parsing |
