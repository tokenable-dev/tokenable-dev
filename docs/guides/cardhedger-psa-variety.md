# Cardhedger 가격과 PSA Variety (병행 구분)

같은 카드 번호·같은 선수라도 **베이스 카드**와 **실버·리프레이터 등 병행(insert)** 은 Cardhedger에서 **서로 다른 `card_id`** 와 **완전히 다른 가격대**를 가진다. 시세는 PSA slab의 **Variety/Pedigree**(`PSACert.Variety`)와 반드시 맞춰야 한다.

## 실시간 데이터 확인 방법

1. **앱/백엔드**가 쓰는 값은 Cardhedger 서버 응답이다 (`CARDHEDGER_API_KEY`).
2. 검증 시 동일 카드에 대해 upstream을 직접 호출해 볼 수 있다:
   - `POST /v1/cards/comps` — `comp_price`, `raw_prices` (PSA 10, `time_weighted: true`, `include_raw_prices: true`)
   - `POST /v1/cards/card-search` — 후보 `variant`·`card_id`·카탈로그 `prices`
3. **Silver #136 Wembanyama 예시** (실측 시점은 변동 가능):
   - Silver 행: `comp_price`는 보통 **약 2.8k–3.2k USD** 대, 마지막 raw 컴프도 같은 줄로 정렬되는 경우가 많다.
   - Base 행: 같은 번호라도 **약 수백 USD** 대 — 병행과 혼동하면 가격이 크게 어긋난다.

## 이번에 무엇이 문제였는가 (요약)

| 단계 | 문제 |
|------|------|
| 민팅 JSON | `graded.psa`에 **`Variety`(PSA 공식 병행 문구)** 가 저장되지 않음 — 분석 파이프라인의 `varietyHint`가 IPFS에 안 실림. |
| Cardhedger 매칭 | `psaVariety`가 비어 있으면 **베이스 vs 실버 구분 게이트가 동작하지 않음**. 저장된 `cardhedger.cardId`가 베이스면 번호·이름만 맞아도 **verified**로 잠김. |
| 결과 | Cardhedger **베이스 행** comps(~$400대)를 그대로 표시. 실제 슬랩은 **SILVER PRIZM**. |

**수정 요지:** 민팅 시 `graded.psa.Variety`에 PSA Variety를 **반드시** 기록한다. 마켓플레이스/스냅샷/포트폴리오 경로는 PSA Public API를 호출하지 않는다(mint-only). Variety가 비어 있으면 Cardhedger resolve가 Base에 잠기거나 `matched: false`가 될 수 있으므로, 보정은 **재민트·analyze-by-cert로 mint 메타를 고치는 쪽**에서 한다.

## 다른 카드 테스트 시 체크리스트

### 민팅·메타데이터

- [ ] PSA 분석 후 IPFS `properties.graded.psa`에 **`Variety`** 가 있다 (또는 `varietyHint` 미러).
- [ ] 병행/인서트 카드면 라벨의 **Variety**가 베이스 단어만이 아닌지 확인 (예: `SILVER PRIZM`, `REFRACTOR`).
- [ ] `graded.psa.Variety` / Subject / Brand / CardNumber / Year 가 mint JSON에 채워져 있어야 한다 — 리스팅·시세 경로에서 PSA로 보강하지 않는다.

### 백엔드 환경

- [ ] `CARDHEDGER_API_KEY` — Cardhedger 시세·검색.
- [ ] `PSA_PUBLIC_API_TOKEN` — cert로 PSACert 병합·민트 프리뷰 Variety 보강.

### 가격 이상 징후

- 같은 번호라도 **eBay/시장**과 **한 자릿수~두 자릿수 배** 차이 나면, 먼저 **다른 병행 행**을 조회 중인지 본다.
- Cardhedger `card-search` 첫 결과가 항상 맞는 것은 아니다 — **Variant** 열과 PSA **Variety**를 대조한다.

### Pokémon `SPECIAL ILLUSTRATION RARE` (SIR)

PSA는 **SIR**을 Variety에 적지만, Cardhedger는 해당 프린트를 **`variant: "Base"`** 로 두는 경우가 많고 설명에 “Special Illustration”을 반복하지 않습니다. 이 경우 문자열 청크 매칭만 하면 **모든 행이 탈락**할 수 있어, SIR 라벨일 때 **`Base` variant 행은 병행 불일치로 보지 않는다** (그 외 명·세트·번호 스코어는 기존과 동일).

### Pokémon set name in PSA `Variety` (e.g. `VSTAR UNIVERSE`)

PSA often prints the **expansion / Brand** again in Variety (slab label line), not a parallel. Example: certs of Japanese VSTAR Universe FA/Mew VMAX `#054` — one mint has `Variety: "VSTAR UNIVERSE"`, another has Variety empty; both are `s12a 054/172 RRR` GEM MT 10.

If Variety is treated as a parallel slug (`vstar_universe`), **the same PSA 10 spec splits into two collections**. Classification treats Variety as generic **base** when it equals or is a phrase inside Brand/set (same class of rule as language / SIR / ETB). Bucket hash field set is unchanged. Holofoil photography color is **not** a collection boundary.

**수정:** `psaVarietyIsBrandOrSetDuplicate` in `psa-variety-catalog.util.ts`; `marketParallelKeyFromPsaVariety(variety, brandOrSet)` feeds bucket v2. PSA vault admin mint also writes `graded.psa.Variety` (same as self-vault) so sports inserts still keep their parallel.

### Cardhedger 검색 (여러 줄 → `card-search`)

시세 resolver는 `components`의 PSA 거울 필드(`psaSubject`, `psaBrand`, `psaVariety`, `psaYear`)로 **여러 검색어를 순서대로 시도**한다 (풀 PSA 라인 → Variety 제외 → Subject+Brand → 긴 Brand/Subject 단독 등). 틈새·NON-SPORT·PSA/DNA처럼 카탈로그 표기가 긴 품목은 **한 번의 짧은 쿼리**보다 이 **팬아웃**이 유리할 수 있다. 그래도 Cardhedger에 품목이 없으면 `matched: false`이다.

### Empty PSA Variety + GemRate cert mis-map (e.g. cert `115765506` Ohtani 2018 Bowman Chrome #1)

PSA **Variety** is blank and population is thousands — the slab is the **flagship chrome base**, not a 1/1 Superfractor. GemRate / `details-by-certs` can still attach **`variant: Superfractor`** via `gemrate_id`.

**수정:** When PSA Variety is empty, reject cert/catalog rows whose `variant` or description names a parallel (Superfractor, Refractor, Silver Prizm, …). Resolve falls through to **`card-search`** and picks **`variant: Base`**. Same gate on mint analyze (`tryResolveCardhedgerMintByCert`), portfolio mint-preview, and collection Path 0.

### PSA `BLUE REFRACTOR` vs Cardhedger `Blue Wave` (Topps Chrome #150 등)

PSA **Variety**가 **`BLUE REFRACTOR`**인데 Cardhedger **`Pitching Blue Wave Refractor`** 행을 쓰면 시세가 **한 자릿수 배** 어긋날 수 있다 (예: Ohtani 2018 Topps Chrome #150 — Blue Refractor /150 vs Blue Wave).

과거에는 `blue`·`refractor` 토큰만 맞으면 **Wave**가 있는 행도 통과했다. 현재는 Cardhedger `variant`에 **PSA에 없는 병행 토큰**(예: `wave`, `raywave`)이 있으면 **불일치**로 거른다. 컬렉션 bucket hash(v2)에도 **`marketParallelKey`**(`blue_refractor` 등)가 들어가 Base·다른 병행과 풀을 나눈다.

### PSA `PANINI PRIZM ROOKIE SIGNATURES` (insert 세트, 예: Lonnie Walker IV #RSLW4)

PSA **Brand**는 **`PANINI PRIZM ROOKIE SIGNATURES`** 처럼 **인서트 제품명**을 그대로 쓰고, 슬랩 **Card #** 도 **`RSLW4`** 같은 **인서트 코드**다. Cardhedger는 부모 **`2018 Panini Prizm Basketball`** 체크리스트 행에 **`number: "18"`**, **`variant: "Base"`** 로 두고, 인서트명은 **`description`** 에 `… Prizm Rookie Signatures …` 로만 넣는다 (같은 선수의 Sensational Signatures 등은 다른 checklist #).

**증상:** cert `44457519`처럼 `prices-by-cert`가 `card: null`이면 GemRate description만 남고, 포트폴리오 mint-preview가 PSA `RSLW4` ↔ Cardhedger `#18` 불일치로 resolve를 전부 수 있었다.

**수정:** (1) mint-preview가 `cert_info.description`을 `cardhedgerSearchQuery`로 주입, (2) Rookie Signatures 검색 alias + set alias, (3) **alphanumeric insert # → numeric checklist #** 브릿지(이름·Variety·제품군 Prizm 일치 필수), (4) PSA Variety에 색이 없으면 Cardhedger `variant: Base` insert 행 우선.

### PSA `BASKETBALL REFRACTOR` (Topps Chrome 등)

PSA는 종종 **`{스포츠} REFRACTOR`** 한 줄만 주고, Cardhedger는 **플래그십 `Refractor`**, **RayWave Refractor**, **RWB Refractor** 등으로 **행이 나뉜다**. 토큰만 보면 여러 행이 동시에 맞아 보일 수 있다.

백엔드에서는 (1) 그런 **일반 스포츠 + REFRACTOR** 문구일 때 검색 점수가 같으면 **`variant` 문자열이 더 긴(더 구체적인 병행)** 행을 우선하고, (2) **카탈로그 PSA 10**이 **comps 타임가중** 대비 약 **2배 이상** 높으면 **comps 기반**을 써서 카탈로그 슬롯이 오래된 경우를 완화한다, (3) PSA가 **`{SPORT} REFRACTOR`만** 줄 때는 Cardhedger **`variant: "Refractor"`** (플래그심 한 장) 행을 **쓰지 않는다** — 같은 토큰으로 RayWave·RWB 등 **더 구체적인 병행** 행을 고른다.

### PSA `BASKETBALL REFRACTOR` + mint `ORANGE BASKETBALL REFRACTOR` (예: Cooper Flagg #251)

PSA Public API **Variety**는 **`BASKETBALL REFRACTOR`** 만 올 수 있지만, 슬랩/민트 JSON **`graded.card.variant`** 는 **`ORANGE BASKETBALL REFRACTOR`** 처럼 **색이 포함**된 경우가 많다. 예전에는 `psaVariety = psa.Variety || card.variant` 로 **PSA 한 줄이 mint 색상을 덮어써** Cardhedger가 Orange 행을 못 찾거나 `matched: false` 가 났다.

**수정:** `mergePsaVarietyWithMintVariant` 로 mint에만 있는 **색(orange, gold, …)** 을 보존하고, 스냅샷 refresh 시 `ensureMintParallelVarietyFromListings` 가 활성 ask 메타에서 `mintCardVariant` 를 다시 병합한다. Cardhedger 타깃 행 예: **`Orange Basketball Refractor`** (`card-search` 상위 후보).

### Pokémon `SPECIAL ART RARE` (SAR)

PSA **Variety** is often **`SPECIAL ART RARE`** (Japanese secret-rare slot, e.g. Mega Dream EX Mega Gengar EX `#240`, cert `165544810`) while Cardhedger catalogs that print as **`variant: "Base"`** with the unique card number. GemRate / `details-by-certs` usually attach the correct `card_id`.

Tokenable used to treat SAR like a named parallel (Master Ball / Silver Prizm). The Variety gate then **rejected the Base catalog row**, so mint preview, collection attach, and comps all stayed unmatched even though Cardhedger had a hit.

**수정:** `psaVarietyIsSpecialArtRareLabel` — SAR is a Pokémon rarity label (same class as SIR / Art Rare). `marketParallelKey` stays `base`. Do not require “special art” on the Cardhedger row.

### Pokémon rarity vs Cardhedger `Base` (compound PSA Variety)

Cardhedger usually stores Pokémon **rarity slots** (Full Art, SAR, MUR, SIR, …) as **`variant: "Base"`** plus a unique card number. PSA Variety is often **only the rarity**, but just as often **`RARITY/SUBJECT`** on one line.

Example: cert `171849969` — GemRate `2021 … Full Art/Umbreon Vmax-Hyper 095`. Cardhedger Base `#95` already has comps (`prices-by-cert`). Tokenable used to match rarity labels with **whole-string equality** (`/^full art$/`), so `FULL ART/UMBREON VMAX-HYPER` was treated like a named parallel (Master Ball / Silver Prizm). The Variety gate **rejected Base**, resolve stayed unmatched, and trades-tape / mint-preview comps never ran.

**수정:** split Variety on `/`, treat each phrase as a rarity-slot candidate (`psaVarietyLabelPhrases` + `psaVarietyIsPokemonRarityLabel`). Master Ball / Reverse Holo / Poké Ball prints stay non-base. Do not add a new one-off string per cert.

Same class of miss as SAR and Mega Ultra Rare; those exact labels still match, including after a slash suffix.

### Pokémon `MASTER BALL` vs `REVERSE HOLO` (Japanese 151, etc.)

PSA **Variety** is often **`MASTER BALL REVERSE HOLO`** while Cardhedger catalogs that print as **`variant: "Master Ball"`** (no reverse/holo in the variant string). A sibling **`Reverse Foil`** row exists for **`REVERSE HOLO`** and is a **different `card_id` and price band** (Master Ball PSA 10 is typically several times Reverse Foil).

Cardhedger **`details-by-certs` / `prices-by-cert` can attach the Master Ball cert to Reverse Foil** (`card_match` fallback). Tokenable does **not** trust that `card_id` when it fails the PSA Variety gate. Resolution then uses **`card-search`** and picks the catalog `variant` whose **named identity** is contained in PSA Variety (Master Ball ⊂ Master Ball Reverse Holo). Finish tokens (`reverse` / `holo` / `foil`) are not required on the named-variant row.

If search has no Master Ball row, Tokenable **does not** fall back to Reverse Foil prices — the collection stays unmatched until a compatible catalog row exists.

The same Variety gate applies to **mint preview**, **catalog attach** (`details-by-certs` → `components.cardhedgerCardId`), and **collection comps / trades tape**. Those paths used to take the cert `card_id` / `prices-by-cert` price even when resolve had already rejected it — so portfolio and comps could stay on Reverse Foil (~$337) while the collection hero showed Master Ball (~$1,025). Snapshot audit now **clears** a stored cert ID that fails Variety so the next refresh can persist the search match.

### Comps resolve vs card display titles

Trades-tape comps use `resolveCardForCollection` / mint-preview, **not** the UI Line 1/Line 2 formatter (`card-display-name.md`). After display-name SSOT, `metadata.name` / `listingDisplayTitle` look like `Sylveon VMAX · 093 · PSA 10`. Those strings are **not** Cardhedger catalog queries.

**What broke:** (1) stored `cardhedgerCardId` skipped PSA `details-by-certs`, so a stale mint ID blocked GemRate; (2) `card-search` candidates included listing/display titles; (3) Pokémon rarity Variety like `FULL ART/SYLVEON VMAX-HYPER` (cert `73064683`) rejected Cardhedger `variant: Base` even though `prices-by-cert` already had sales.

**수정:** Path 0 always tries cert lookup first when a cert exists (collection created or not). Search uses PSA/catalog fields only — never middot UI titles. Rarity-slot Variety still maps to Base (slash phrases). Master Ball vs Reverse Foil is unchanged.

**PSA `FULL ART/…` Subject vs Cardhedger short names (cert `171849969` Umbreon VMAX #095):** Cardhedger has the cert and comps (`Umbreon VMAX` / Eevee Heroes / `variant: Base`). Tokenable used to require the **whole** PSA Subject/Brand string to be a substring of the catalog name/set (`FULL ART/UMBREON VMAX-HYPER` ⊄ `Umbreon VMAX`). After display-name work this showed up as unmatched comps. Identity needles split `RARITY/SUBJECT` and strip `-HYPER`; set aliases drop `pokemon japanese` / map Eevee Heroes. Search also tries `Umbreon VMAX #95` + set alias **before** the long PSA-forward query (still inside the search-candidate cap).

Stored `components.cardhedgerCardId` is re-checked the same way (no DB migration). Wrong Reverse Foil IDs are ignored at resolve time; the next successful search is used for pricing.

**Admin `Missing cardhedgerCardId`:** the checklist reads `marketplace_collections.components.cardhedgerCardId`, not whether the snapshot priced. Snapshot search used to persist that ID with `void` (race) and the next refresh **audited it away** when leftover Variety (`EEVEE HEROES-HYPER`) or `FA/UMBREON VMAX` failed the catalog gate. Refresh now: listing mint IDs → cert → search (await persist). Audit treats Hyper leftover / FA names as Base. Admin falls back to snapshot preview `card.id` if components are still empty.

**수정:** `cardhedgerRowMatchesPsaVariety` leftover-identity matching; `CardhedgerResolveService` Path 0/1 and `card-match` variety gates; `tryResolveCardIdByCert` refuses a conflicting cert `card_id`; mint preview / attach / comps / cert-ID audit use `cardhedgerCertRowUsableForPsaVariety`.

### PSA One Piece `Championship 2024-Top Prize` (cert `161565251` Nefeltari Vivi #086)

PSA Brand is **`ONE PIECE JAPANESE PROMOS`**, Variety **`Championship 2024-Top Prize`**, Card # **`086`**. Cardhedger `details-by-certs` often returns **`card: null`**. The catalog slot for this stamp is the **parent expansion** row **`OP05-086` / `variant: "Championship 2024"`** (`2023 One Piece Japanese Awakening of the New Era`). There is no Vivi `Top Prize` row; `Top Prize` on Cardhedger is a **different character** (e.g. Ace OP07-119).

**수정:** (1) leftover PSA `top`/`prize` maps to Cardhedger `Championship {year}` only (not Base, Finalist, or a yearless `Top Prize`), (2) numeric PSA # ↔ `OP05-086` suffix, (3) set alias `one piece japanese`, (4) search `Name Championship 2024` (no Top Prize token, so Ace does not steal the hit).

### PSA One Piece `RED MANGA ALTERNATE ART` (cert `139887849` Monkey D. Luffy OP13-118)

Official pipeline is still **cert → `details-by-certs` → Variety gate → `/v1/cards/comps`**. For this cert Cardhedger already returns the right catalog row (`OP13-118` / `variant: "Red Manga"`) and PSA 10 comps exist. Tokenable used to **reject that row** because PSA Variety is **`RED MANGA ALTERNATE ART`** while the catalog string is only **`Red Manga`**. Sibling rows **`Alternate Art`**, **`Manga`**, and **`Base`** are different `card_id`s and must not steal comps.

**수정:** leftover PSA `alternate`/`art` maps to Cardhedger **`Red Manga` only** (requires both `red` and `manga` on `variant`). Do not treat this label as a Pokémon rarity Base slot (unlike SAR).

**Comps are empty after a correct match.** Tokenable already calls `POST /v1/cards/comps` with that Championship `card_id` + `grade: "PSA 10"`. Cardhedger returns **404** `No sales data found for this card and grade`. `prices-by-card` / `all-prices-by-card` are also `[]`. Cert `prices-by-cert` still has `card: null` because GemRate `universal_gemrate_id` is empty — sales never land on this overlay row.

Sibling rows **do** have comps and must not be used for this slab:

| Cardhedger row | PSA 10 comps (order of magnitude) |
|---|---|
| JP `Championship 2024` OP05-086 (correct stamp) | none |
| JP `Base` OP05-086 | ~$30–40 (pack single) |
| EN `Base` OP05-086 | mixed, including thousand-dollar outliers (not this Japanese promo) |

Preview reason `cardhedger_no_sales_for_grade` is this 404, not a Tokenable wiring miss. Do not fall back to Base comps or `segment_fallback` FMV (~$58 on the 2023 One Piece bucket). Last price stays empty until Cardhedger attributes sales to the Championship `card_id`.

### 관련 코드 (참고)

- `frontend/components/vault/MintForm.tsx` / `frontend/lib/vault/buildMintMetadata.ts` — 민팅 시 `graded.psa.Variety` 저장.
- `backend/src/rwa/admin/vault-admin-mint-metadata.util.ts` — PSA 볼트 어드민 민트도 동일하게 `Variety` 기록.
- `backend/src/marketplace/collections/cardhedger-market-data.service.ts` — `psaMirrorFromGradedBlock`, `enrichPsaMirrorFromCertLookup`, parallel/검색, 일반 **스포츠+REFRACTOR** 검색 동점 시 `variant` 구체성, 카탈로그 대 comps 완화.
- `backend/src/psa/psa-variety-catalog.util.ts` — 베이스 vs non-base 판별.
- `backend/src/marketplace/utils/cardhedger-psa-variety.util.ts` — PSA Variety ↔ Cardhedger `variant` (named identity vs print finish, leftover tokens, Wave/flavor conflict).
- `backend/src/marketplace/utils/market-parallel-key.util.ts` — `marketParallelKey` / bucket v2 병행 facet.
