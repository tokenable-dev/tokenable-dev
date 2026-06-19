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

**수정 요지:** 민팅 시 `graded.psa.Variety`에 PSA Variety를 기록하고, 기존 토큰은 **cert 번호 + PSA Public API**로 Variety를 보강해 잘못된 `card_id`를 거르고 검색으로 실버 행을 잡도록 했다.

## 다른 카드 테스트 시 체크리스트

### 민팅·메타데이터

- [ ] PSA 분석 후 IPFS `properties.graded.psa`에 **`Variety`** 가 있다 (또는 `varietyHint` 미러).
- [ ] 병행/인서트 카드면 라벨의 **Variety**가 베이스 단어만이 아닌지 확인 (예: `SILVER PRIZM`, `REFRACTOR`).
- [ ] `graded.psa.certNumber`(또는 `grade.certNumber`)가 있으면, 서버가 cert로 Variety를 **보강**할 수 있다 — **`PSA_PUBLIC_API_TOKEN`** 필요.

### 백엔드 환경

- [ ] `CARDHEDGER_API_KEY` — Cardhedger 시세·검색.
- [ ] `PSA_PUBLIC_API_TOKEN` — cert로 PSACert 병합·민트 프리뷰 Variety 보강.

### 가격 이상 징후

- 같은 번호라도 **eBay/시장**과 **한 자릿수~두 자릿수 배** 차이 나면, 먼저 **다른 병행 행**을 조회 중인지 본다.
- Cardhedger `card-search` 첫 결과가 항상 맞는 것은 아니다 — **Variant** 열과 PSA **Variety**를 대조한다.

### Pokémon `SPECIAL ILLUSTRATION RARE` (SIR)

PSA는 **SIR**을 Variety에 적지만, Cardhedger는 해당 프린트를 **`variant: "Base"`** 로 두는 경우가 많고 설명에 “Special Illustration”을 반복하지 않습니다. 이 경우 문자열 청크 매칭만 하면 **모든 행이 탈락**할 수 있어, SIR 라벨일 때 **`Base` variant 행은 병행 불일치로 보지 않는다** (그 외 명·세트·번호 스코어는 기존과 동일).

### Pokémon `ILLUSTRATION RARE` (IR, SIR 아님)

PSA **Variety**가 **ILLUSTRATION RARE**일 때(일러스트 레어, SIR과 구분)도 Cardhedger가 **`variant: "Base"`** 로 두는 경우가 있어, SIR과 같은 방식으로 **`Base` 행은 병행 불일치로 보지 않는다**. (`SPECIAL ILLUSTRATION RARE`는 위 SIR 규칙이 우선한다.)

### Cardhedger 검색 (여러 줄 → `card-search`)

시세 resolver는 `components`의 PSA 거울 필드(`psaSubject`, `psaBrand`, `psaVariety`, `psaYear`)로 **여러 검색어를 순서대로 시도**한다 (풀 PSA 라인 → Variety 제외 → Subject+Brand → 긴 Brand/Subject 단독 등). 틈새·NON-SPORT·PSA/DNA처럼 카탈로그 표기가 긴 품목은 **한 번의 짧은 쿼리**보다 이 **팬아웃**이 유리할 수 있다. 그래도 Cardhedger에 품목이 없으면 `matched: false`이다.

### PSA `BLUE REFRACTOR` vs Cardhedger `Blue Wave` (Topps Chrome #150 등)

PSA **Variety**가 **`BLUE REFRACTOR`**인데 Cardhedger **`Pitching Blue Wave Refractor`** 행을 쓰면 시세가 **한 자릿수 배** 어긋날 수 있다 (예: Ohtani 2018 Topps Chrome #150 — Blue Refractor /150 vs Blue Wave).

과거에는 `blue`·`refractor` 토큰만 맞으면 **Wave**가 있는 행도 통과했다. 현재는 Cardhedger `variant`에 **PSA에 없는 병행 토큰**(예: `wave`, `raywave`)이 있으면 **불일치**로 거른다. 컬렉션 bucket hash(v2)에도 **`marketParallelKey`**(`blue_refractor` 등)가 들어가 Base·다른 병행과 풀을 나눈다.

### PSA `BASKETBALL REFRACTOR` (Topps Chrome 등)

PSA는 종종 **`{스포츠} REFRACTOR`** 한 줄만 주고, Cardhedger는 **플래그십 `Refractor`**, **RayWave Refractor**, **RWB Refractor** 등으로 **행이 나뉜다**. 토큰만 보면 여러 행이 동시에 맞아 보일 수 있다.

백엔드에서는 (1) 그런 **일반 스포츠 + REFRACTOR** 문구일 때 검색 점수가 같으면 **`variant` 문자열이 더 긴(더 구체적인 병행)** 행을 우선하고, (2) **카탈로그 PSA 10**이 **comps 타임가중** 대비 약 **2배 이상** 높으면 **comps 기반**을 써서 카탈로그 슬롯이 오래된 경우를 완화한다, (3) PSA가 **`{SPORT} REFRACTOR`만** 줄 때는 Cardhedger **`variant: "Refractor"`** (플래그심 한 장) 행을 **쓰지 않는다** — 같은 토큰으로 RayWave·RWB 등 **더 구체적인 병행** 행을 고른다.

### PSA `BASKETBALL REFRACTOR` + mint `ORANGE BASKETBALL REFRACTOR` (예: Cooper Flagg #251)

PSA Public API **Variety**는 **`BASKETBALL REFRACTOR`** 만 올 수 있지만, 슬랩/민트 JSON **`graded.card.variant`** 는 **`ORANGE BASKETBALL REFRACTOR`** 처럼 **색이 포함**된 경우가 많다. 예전에는 `psaVariety = psa.Variety || card.variant` 로 **PSA 한 줄이 mint 색상을 덮어써** Cardhedger가 Orange 행을 못 찾거나 `matched: false` 가 났다.

**수정:** `mergePsaVarietyWithMintVariant` 로 mint에만 있는 **색(orange, gold, …)** 을 보존하고, 스냅샷 refresh 시 `ensureMintParallelVarietyFromListings` 가 활성 ask 메타에서 `mintCardVariant` 를 다시 병합한다. Cardhedger 타깃 행 예: **`Orange Basketball Refractor`** (`card-search` 상위 후보).

### 관련 코드 (참고)

- `frontend/components/vault/MintForm.tsx` — 민팅 시 `graded.psa.Variety` 저장.
- `backend/src/marketplace/collections/cardhedger-market-data.service.ts` — `psaMirrorFromGradedBlock`, `enrichPsaMirrorFromCertLookup`, parallel/검색, 일반 **스포츠+REFRACTOR** 검색 동점 시 `variant` 구체성, 카탈로그 대 comps 완화.
- `backend/src/psa/psa-variety-catalog.util.ts` — 베이스 vs non-base 판별.
- `backend/src/marketplace/utils/cardhedger-psa-variety.util.ts` — PSA Variety ↔ Cardhedger `variant` (병행 토큰 충돌, 예: Wave).
- `backend/src/marketplace/utils/market-parallel-key.util.ts` — `marketParallelKey` / bucket v2 병행 facet.
