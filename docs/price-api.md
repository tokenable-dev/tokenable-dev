# Price API — JustTCG (TCG 실시간·카탈로그 가격)

> **데이터 제공**: [JustTCG](https://justtcg.com) — The Dedicated Pricing API for Trading Card Games  
> **Base URL (로컬 예시)**: `http://localhost:4000/api/price` — Nest **글로벌 prefix `/api`** 포함  
> **Swagger**: `{호스트}/api/docs` → **price** 태그 (최종 스키마·파라미터는 코드와 동기화)  
> **백엔드**: `backend/src/price/price.controller.ts`, 서버 env **`TCG_API_KEY` 필수** (`PriceService` — mock 분기 없음)

---

## 플랫폼에서의 역할

- **민팅·컬렉션 메타**는 주로 **포켓몬·등급 카드**를 전제로 하지만, **랜딩 Market Indexes** 등은 `GET /price/games`로 노출되는 **여러 JustTCG 게임 ID**(야구·축구·농구 등)를 함께 쓸 수 있다. 호출 시 `game` 쿼리는 화면·기획에 맞게 지정한다.
- 아래 표의 숫자·통계는 **문서 작성 시점 예시**이며, 실제 값은 API 응답을 따른다.

| Game ID | 게임명 | 카드 수 | 세트 수 | 시장 총 가치 |
| --- | --- | --- | --- | --- |
| **`pokemon`** | **Pokemon (영문판)** | **28,230** | **210** | **$709,469** |
| `pokemon-japan` | Pokemon Japan (일본판) | 21,383 | 429 | $28,515 |

> JustTCG는 여러 TCG 게임을 지원한다. 포켓몬 관련 카드 검색·배치에는 보통 `pokemon` 또는 `pokemon-japan`을 쓴다.

---

## API 목록

| # | Method | Endpoint | 설명 |
| --- | --- | --- | --- |
| 1 | `GET` | `/price/games` | 지원 게임 전체 목록 + 통계 |
| 2 | `GET` | `/price/sets` | 세트 목록 조회 |
| 3 | `GET` | `/price/cards` | 카드 단건 조회 / 검색 |
| 4 | `POST` | `/price/cards/batch` | 카드 배치 조회 (최대 100개) |

---

## 1. 게임 목록 조회

### `GET /price/games`

JustTCG가 지원하는 전체 TCG 게임 목록과 게임별 통계를 반환합니다.

**Query Parameters**: 없음

**응답 필드 (게임 객체)**

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `id` | string | 게임 고유 ID |
| `name` | string | 게임명 |
| `count` | integer | 전체 카드 수 (`cards_count`와 동일) |
| `cards_count` | integer | 전체 카드 수 |
| `variants_count` | integer | 전체 variant 수 (상태×인쇄 조합) |
| `sealed_count` | integer | 봉인 제품 수 |
| `sets_count` | integer | 세트 수 |
| `last_updated` | string | 마지막 업데이트 Unix Timestamp 문자열 (초) |
| `game_value_usd` | float | 전체 카드 가치 합산 (USD) |
| `game_value_change_7d_pct` | float | 7일 가치 변동률 (%) |
| `game_value_change_30d_pct` | float | 30일 가치 변동률 (%) |
| `game_value_change_90d_pct` | float | 90일 가치 변동률 (%) |
| `cards_pos_7d_count` | integer | 7일 내 가격 상승 카드 수 |
| `cards_neg_7d_count` | integer | 7일 내 가격 하락 카드 수 |
| `cards_pos_30d_count` | integer | 30일 내 가격 상승 카드 수 |
| `cards_neg_30d_count` | integer | 30일 내 가격 하락 카드 수 |
| `cards_pos_90d_count` | integer | 90일 내 가격 상승 카드 수 |
| `cards_neg_90d_count` | integer | 90일 내 가격 하락 카드 수 |
| `sealed_cards_pos_7d_count` | integer | 7일 내 가격 상승 봉인 제품 수 |
| `sealed_cards_neg_7d_count` | integer | 7일 내 가격 하락 봉인 제품 수 |
| `sealed_cards_pos_30d_count` | integer | 30일 내 가격 상승 봉인 제품 수 |
| `sealed_cards_neg_30d_count` | integer | 30일 내 가격 하락 봉인 제품 수 |
| `sealed_cards_pos_90d_count` | integer | 90일 내 가격 상승 봉인 제품 수 |
| `sealed_cards_neg_90d_count` | integer | 90일 내 가격 하락 봉인 제품 수 |

**요청 예시**

```
GET /api/price/games
```

**실제 응답 예시**

```json
{
  "data": [
    {
      "id": "pokemon",
      "name": "Pokemon",
      "count": 28230,
      "cards_count": 28230,
      "variants_count": 208520,
      "sealed_count": 2178,
      "sets_count": 210,
      "last_updated": "1773037475",
      "game_value_usd": 709469.35,
      "game_value_change_7d_pct": 1.46,
      "game_value_change_30d_pct": 3.63,
      "game_value_change_90d_pct": 11.21,
      "cards_pos_7d_count": 19522,
      "cards_neg_7d_count": 16131,
      "sealed_cards_pos_7d_count": 795,
      "sealed_cards_neg_7d_count": 304,
      "cards_pos_30d_count": 23734,
      "cards_neg_30d_count": 19488,
      "sealed_cards_pos_30d_count": 1231,
      "sealed_cards_neg_30d_count": 351,
      "cards_pos_90d_count": 24547,
      "cards_neg_90d_count": 20989,
      "sealed_cards_pos_90d_count": 1468,
      "sealed_cards_neg_90d_count": 369
    },
    {
      "id": "magic-the-gathering",
      "name": "Magic: The Gathering",
      "count": 105732,
      "cards_count": 105732,
      "variants_count": 4677385,
      "sealed_count": 2831,
      "sets_count": 435,
      "last_updated": "1773033356",
      "game_value_usd": 705471.96,
      "game_value_change_7d_pct": 0.46,
      "game_value_change_30d_pct": 1.72,
      "game_value_change_90d_pct": 4.74,
      "cards_pos_7d_count": 58453,
      "cards_neg_7d_count": 46847,
      "sealed_cards_pos_7d_count": 961,
      "sealed_cards_neg_7d_count": 480,
      "cards_pos_30d_count": 83193,
      "cards_neg_30d_count": 65317,
      "sealed_cards_pos_30d_count": 1434,
      "sealed_cards_neg_30d_count": 685,
      "cards_pos_90d_count": 89214,
      "cards_neg_90d_count": 74219,
      "sealed_cards_pos_90d_count": 1648,
      "sealed_cards_neg_90d_count": 740
    }
  ],
  "_metadata": {
    "apiPlan": "Free Tier",
    "apiRequestLimit": 1000,
    "apiDailyLimit": 100,
    "apiRateLimit": 10,
    "apiRequestsUsed": 0,
    "apiDailyRequestsUsed": 0,
    "apiRequestsRemaining": 1000,
    "apiDailyRequestsRemaining": 100
  }
}
```

> 💡 **게임 가치 비교 (실제 데이터 기준)**
>
> | 게임 | 총 가치 (USD) | 90일 변동 |
> | --- | --- | --- |
> | Pokemon | $709,469 | **+11.21%** ↑ |
> | Magic: The Gathering | $705,471 | +4.74% ↑ |
> | One Piece Card Game | $195,980 | **+37.66%** ↑↑ |
> | YuGiOh | $65,297 | +0.59% → |
> | Dragon Ball Super: FW | $26,961 | **+117.99%** ↑↑↑ |
> | Digimon Card Game | $29,596 | -0.67% ↓ |
> | Star Wars: Unlimited | $9,062 | **-9.42%** ↓↓ |

---

## 2. 세트 목록 조회

### `GET /price/sets`

특정 게임의 세트 목록을 조회합니다. `game` 파라미터는 **필수**입니다.

**Query Parameters**

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| `game` | string | ✅ 필수 | — | **항상 `pokemon` 고정** (일본판은 `pokemon-japan`) |
| `q` | string | 선택 | — | 세트 이름 검색어 (예: `Base Set`, `Scarlet`) |
| `orderBy` | string | 선택 | `name` | 정렬 기준: `name` \| `release_date` |
| `order` | string | 선택 | `desc` | 정렬 방향: `asc` \| `desc` |

**응답 필드 (세트 객체)**

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `id` | string | 세트 고유 ID |
| `name` | string | 세트명 |
| `game_id` | string | 소속 게임 ID |
| `game` | string | 소속 게임명 |
| `count` | integer | 세트 내 카드 수 (`cards_count`와 동일) |
| `cards_count` | integer | 세트 내 카드 수 |
| `variants_count` | integer | 세트 내 variant 수 |
| `sealed_count` | integer | 봉인 제품 수 |
| `release_date` | string | 출시일 (ISO 8601, 예: `2023-03-31T00:00:00.000Z`) |
| `set_value_usd` | float | 세트 전체 카드 가치 합산 (USD) |
| `set_value_change_7d_pct` | float | 7일 가치 변동률 (%) |
| `set_value_change_30d_pct` | float | 30일 가치 변동률 (%) |
| `set_value_change_90d_pct` | float | 90일 가치 변동률 (%) |

**요청 예시**

```
# 최신 출시 순으로 포켓몬 세트 목록
GET /api/price/sets?game=pokemon&orderBy=release_date&order=desc

# 이름으로 세트 검색
GET /api/price/sets?game=pokemon&q=Base+Set
GET /api/price/sets?game=pokemon&q=Scarlet

# 일본판 세트 목록
GET /api/price/sets?game=pokemon-japan&orderBy=release_date&order=desc
```

**실제 응답 예시** (`GET /api/price/sets?game=pokemon&q=Base+Set`)

```json
{
  "data": [
    {
      "id": "base-set-pokemon",
      "name": "Base Set",
      "game_id": "pokemon",
      "game": "Pokemon",
      "count": 101,
      "cards_count": 101,
      "variants_count": 505,
      "sealed_count": 5,
      "release_date": "1999-01-09T00:00:00.000Z",
      "set_value_usd": 1930.86,
      "set_value_change_7d_pct": 0.270437,
      "set_value_change_30d_pct": 3.573149,
      "set_value_change_90d_pct": 10.808367
    },
    {
      "id": "base-set-shadowless-pokemon",
      "name": "Base Set (Shadowless)",
      "game_id": "pokemon",
      "game": "Pokemon",
      "count": 102,
      "cards_count": 102,
      "variants_count": 1016,
      "sealed_count": 3,
      "release_date": "1999-01-09T00:00:00.000Z",
      "set_value_usd": 5333.33,
      "set_value_change_7d_pct": 0,
      "set_value_change_30d_pct": -9.816898,
      "set_value_change_90d_pct": -23.260012
    },
    {
      "id": "base-set-2-pokemon",
      "name": "Base Set 2",
      "game_id": "pokemon",
      "game": "Pokemon",
      "count": 130,
      "cards_count": 130,
      "variants_count": 650,
      "sealed_count": 3,
      "release_date": "2000-02-24T00:00:00.000Z",
      "set_value_usd": 966.88,
      "set_value_change_7d_pct": 0.513818,
      "set_value_change_30d_pct": 1.689175,
      "set_value_change_90d_pct": 5.860698
    }
  ],
  "meta": {
    "total": 7,
    "limit": 7,
    "offset": 0,
    "hasMore": false
  },
  "_metadata": {
    "apiPlan": "Free Tier",
    "apiRequestLimit": 1000,
    "apiDailyLimit": 100,
    "apiRateLimit": 10,
    "apiRequestsUsed": 2,
    "apiDailyRequestsUsed": 1,
    "apiRequestsRemaining": 998,
    "apiDailyRequestsRemaining": 99
  }
}
```

---

## 3. 카드 단건 조회 / 검색

### `GET /price/cards`

카드 가격 정보를 조회합니다. **두 가지 모드**로 동작합니다.

> **직접 조회 모드**: 식별자(tcgplayerId, cardId 등) 전달 시 해당 카드를 정확히 조회
> **검색 모드**: 식별자 없이 `q` / `game` / `set` 파라미터로 카드 검색

### 식별자 우선순위

```
variantId  >  tcgplayerSkuId  >  tcgplayerId  >  mtgjsonId  >  scryfallId  >  cardId
```

---

### 파라미터 사용 분류 (포켓몬 플랫폼 기준)

**✅ 자주 쓰는 파라미터**

| 파라미터 | 기본값 | 설명 |
| --- | --- | --- |
| `game` | — | **항상 `pokemon` 고정** (일본판은 `pokemon-japan`) |
| `q` | — | 카드 이름 검색어 (예: `Charizard`, `Pikachu`) |
| `set` | — | 세트 ID (예: `base-set-pokemon`, `sv01-scarlet-violet-base-set-pokemon`) |
| `tcgplayerId` | — | TCGplayer Product ID — 카드 직접 조회 |
| `cardId` | — | JustTCG Card ID — 카드 직접 조회 |
| `condition` | `S,NM,LP,MP,HP,DMG` | 상태 필터. 약어 또는 전체명, 쉼표 구분 |
| `printing` | — | 인쇄 타입 필터 (예: `Normal`, `Holofoil`, `Reverse Holofoil`) |
| `priceHistoryDuration` | `7d` | 가격 히스토리 기간: `7d` \| `30d` \| `90d` \| `180d` |
| `include_price_history` | `true` | 가격 차트 필요 시 `true`, 목록 조회 시 `false` |
| `limit` | — | 페이지당 결과 수 |
| `offset` | `0` | 다음 페이지 이동 시 증가 |

**⚡ 상황에 따라 쓰는 파라미터**

| 파라미터 | 언제 사용하나 |
| --- | --- |
| `variantId` | 특정 카드의 특정 상태를 가장 빠르게 조회할 때 (자주 쓰는 카드 저장 후 활용) |
| `include_statistics` | 특정 통계 기간만 받고 응답 크기를 줄이고 싶을 때 (예: `7d,30d`) |

**❌ 포켓몬 플랫폼에서 무시해도 되는 파라미터**

| 파라미터 | 무시 이유 |
| --- | --- |
| `mtgjsonId` | MTG 전용 ID — 포켓몬 카드에 존재하지 않음 |
| `scryfallId` | MTG 전용 ID — 포켓몬 카드에 존재하지 않음 |
| `tcgplayerSkuId` | 외부에서 얻기 어려움 — `tcgplayerId` 또는 `cardId`로 대체 가능 |
| `include_null_prices` | 가격 없는 카드를 노출할 이유 없음 — 기본값(`false`) 유지 |
| `updated_after` | 대용량 DB 동기화 작업 시에만 필요 — 일반 조회에서는 불필요 |

---

**카드 상태(Condition) 값**

| 약어 | 전체명 | 설명 |
| --- | --- | --- |
| `NM` | Near Mint | 거의 새것 — 거래 기준 최상 상태 |
| `LP` | Lightly Played | 가볍게 사용 |
| `MP` | Moderately Played | 보통 사용 |
| `HP` | Heavily Played | 많이 사용 |
| `DMG` | Damaged | 손상됨 |
| `S` | Sealed | 봉인 (미개봉 팩/박스) |

**포켓몬 Printing(인쇄 타입) 값**

| printing 값 | 설명 |
| --- | --- |
| `Normal` | 일반 (비-홀로) |
| `Holofoil` | 홀로그램 (Holo Rare) |
| `Reverse Holofoil` | 리버스 홀로 (일반 카드에 홀로 배경) |
| `1st Edition` | 초판 (구버전 세트) |

---

### 케이스 1 — 카드 이름으로 검색 (가장 쉬운 시작)

식별자를 모를 때 이름으로 검색합니다. `game=pokemon`은 항상 고정입니다.

| 파라미터 | 값 | 비고 |
| --- | --- | --- |
| `q` | `Charizard` | 검색할 카드 이름 |
| `game` | `pokemon` | 항상 고정 |
| `condition` | `NM` | Near Mint만 필터 |
| `limit` | `5` | 결과 수 제한 |

```
GET /api/price/cards?q=Charizard&game=pokemon&condition=NM&limit=5
```

> 나머지 파라미터는 전부 비워둡니다.

**포켓몬 카드 검색 예시**

```
# 피카츄 검색
GET /api/price/cards?q=Pikachu&game=pokemon&condition=NM&limit=10

# 리자몽 NM + LP 함께 조회
GET /api/price/cards?q=Charizard&game=pokemon&condition=NM,LP&limit=10

# 일본판 카드 검색
GET /api/price/cards?q=Charizard&game=pokemon-japan&condition=NM&limit=5
```

---

### 케이스 2 — tcgplayerId로 직접 조회

TCGplayer 사이트 URL에서 숫자를 추출합니다.

```
https://www.tcgplayer.com/product/219042/...
                                 ^^^^^^
                              이 숫자 = tcgplayerId
```

| 파라미터 | 값 | 비고 |
| --- | --- | --- |
| `tcgplayerId` | `3748` | Charizard Base Set Holo |
| `condition` | `NM,LP` | 두 가지 상태 동시 조회 |
| `include_price_history` | `true` | 가격 추이 포함 |
| `priceHistoryDuration` | `30d` | 30일 히스토리 |

```
GET /api/price/cards?tcgplayerId=3748&condition=NM,LP&include_price_history=true&priceHistoryDuration=30d
```

**알려진 포켓몬 tcgplayerId 예시**

| 카드 | tcgplayerId |
| --- | --- |
| Fire Energy (#22 Charizard Stamped) | `219042` |
| Charizard (Base Set Holo) | `3748` |

> tcgplayerId는 TCGplayer 사이트 URL에서 확인하거나, `GET /price/cards?q=카드명&game=pokemon` 검색 결과의 `tcgplayerId` 필드에서 가져올 수 있습니다.

---

### 케이스 3 — 세트 전체 카드 목록 조회 (페이지네이션)

`/api/price/sets` 에서 확인한 세트 ID를 그대로 사용합니다.

| 파라미터 | 값 | 비고 |
| --- | --- | --- |
| `game` | `pokemon` | 게임 ID |
| `set` | `base-set-pokemon` | 세트 ID |
| `condition` | `NM` | Near Mint만 |
| `include_price_history` | `false` | 히스토리 제외 (응답 경량화) |
| `limit` | `20` | 페이지당 20개 |
| `offset` | `0` | 첫 페이지 |

```
# 1페이지
GET /api/price/cards?game=pokemon&set=base-set-pokemon&condition=NM&include_price_history=false&limit=20&offset=0

# 2페이지
GET /api/price/cards?game=pokemon&set=base-set-pokemon&condition=NM&include_price_history=false&limit=20&offset=20
```

**확인된 포켓몬 세트 ID 목록**

| 세트명 | set ID |
| --- | --- |
| Base Set | `base-set-pokemon` |
| Base Set (Shadowless) | `base-set-shadowless-pokemon` |
| Base Set 2 | `base-set-2-pokemon` |
| XY Base Set | `xy-base-set-pokemon` |
| Sword & Shield Base Set | `swsh01-sword-shield-base-set-pokemon` |
| Scarlet & Violet Base Set | `sv01-scarlet-violet-base-set-pokemon` |
| SM Base Set | `sm-base-set-pokemon` |

---

### 케이스 4 — Printing(인쇄 타입) 필터 조회

포켓몬에는 Normal / Holofoil / Reverse Holofoil 등 다양한 인쇄 타입이 있습니다. `printing` 파라미터로 특정 타입만 필터링합니다.

| 파라미터 | 값 | 비고 |
| --- | --- | --- |
| `tcgplayerId` | `3748` | Charizard Base Set |
| `game` | `pokemon` | 항상 고정 |
| `condition` | `NM` | Near Mint만 |
| `printing` | `Holofoil` | 홀로 카드만 |

```
# Holofoil만 조회
GET /api/price/cards?tcgplayerId=3748&game=pokemon&condition=NM&printing=Holofoil

# Reverse Holofoil만 조회
GET /api/price/cards?q=Pikachu&game=pokemon&condition=NM&printing=Reverse+Holofoil

# Normal(비홀로)만 조회
GET /api/price/cards?q=Charizard&game=pokemon&condition=NM&printing=Normal
```

> `printing` 파라미터 없이 조회하면 모든 인쇄 타입의 variant가 한꺼번에 반환됩니다.
> 카드 상세 페이지에서 Normal vs Holofoil 가격 비교 기능을 만들 때 유용합니다.

---

### 케이스 5 — variantId로 가장 빠른 단건 조회

식별자 하나만으로 가장 빠르게 특정 카드의 특정 상태를 조회합니다.

`variantId` 구조: `{cardId}_{condition-slug}`

| condition | condition-slug |
| --- | --- |
| Near Mint | `near-mint` |
| Lightly Played | `lightly-played` |
| Moderately Played | `moderately-played` |
| Heavily Played | `heavily-played` |
| Damaged | `damaged` |

| 파라미터 | 값 |
| --- | --- |
| `variantId` | `pokemon-battle-academy-fire-energy-22-charizard-stamped_near-mint` |

```
GET /api/price/cards?variantId=pokemon-battle-academy-fire-energy-22-charizard-stamped_near-mint
```

> 나머지 파라미터는 전부 비워둡니다. 응답이 가장 빠르고 API 요청 1회 소모. 자주 조회하는 카드는 variantId를 저장해두고 사용하세요.

---

### 실용 팁 — Swagger에서 테스트하는 순서

```
1단계: q + game 으로 검색 → 응답의 id(cardId) 확인
2단계: cardId 로 직접 조회 → variants 배열에서 가격/상태 확인
3단계: 자주 쓰는 카드는 variantId 로 저장 후 바로 조회 (가장 빠름)
```

> ⚠️ **Free Tier 기준 일 100회 제한.** 테스트 시 `include_price_history=false` 로 먼저 확인하고, 히스토리는 필요할 때만 `true` 로 변경하세요.

---

### 응답 구조 — Card 객체

**Card 객체 필드**

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `id` | string | JustTCG Card ID (`cardId`) |
| `name` | string | 카드명 |
| `game` | string | 게임명 (예: `Pokemon`) |
| `set` | string | 세트 ID |
| `set_name` | string | 세트명 |
| `number` | string | 세트 내 카드 번호 |
| `tcgplayerId` | string | TCGplayer Product ID |
| `mtgjsonId` | string | MTGJSON UUID (MTG 전용) |
| `scryfallId` | string | Scryfall UUID (MTG 전용) |
| `rarity` | string | 희귀도 (Common, Uncommon, Rare, Ultra Rare, Promo 등) |
| `details` | string \| null | 카드 추가 상세 정보 |
| `variants` | Variant[] | 가격 정보 배열 (상태 × 인쇄 타입 조합) |

> ⚠️ **주의**: Card 객체 자체에는 가격이 없습니다. 가격은 반드시 `variants` 배열 내 각 Variant 객체에 있습니다.

---

### 응답 구조 — Variant 객체

각 Variant는 **카드의 특정 상태(condition) × 인쇄 타입(printing)** 조합입니다.

**기본 정보**

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `id` | string | JustTCG Variant ID (`variantId`) |
| `condition` | string | 상태 (Near Mint, Lightly Played 등) |
| `printing` | string | 인쇄 타입 (Normal, Foil 등) |
| `language` | string | 언어 (English, Japanese 등) |
| `tcgplayerSkuId` | string | TCGPlayer SKU ID |
| `price` | number | 현재 가격 (USD) |
| `lastUpdated` | number | 마지막 가격 업데이트 Unix Timestamp (초) |

**단기 통계 (7일)**

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `priceChange24hr` | number \| null | 24시간 가격 변동률 (%) |
| `priceChange7d` | number \| null | 7일 가격 변동률 (%) |
| `avgPrice` | number \| null | 7일 평균 가격 |
| `minPrice7d` | number \| null | 7일 최저가 |
| `maxPrice7d` | number \| null | 7일 최고가 |
| `stddevPopPrice7d` | number \| null | 7일 가격 표준편차 (변동성 지표) |
| `covPrice7d` | number \| null | 7일 변동계수 (StdDev ÷ Mean) |
| `iqrPrice7d` | number \| null | 7일 사분위수 범위 (75th - 25th percentile) |
| `trendSlope7d` | number \| null | 7일 가격 추세 기울기 (선형 회귀) |
| `priceChangesCount7d` | number \| null | 7일 내 가격 변동 횟수 |

**중기 통계 (30일)**

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `priceChange30d` | number \| null | 30일 가격 변동률 (%) |
| `avgPrice30d` | number \| null | 30일 평균 가격 |
| `minPrice30d` | number \| null | 30일 최저가 |
| `maxPrice30d` | number \| null | 30일 최고가 |
| `stddevPopPrice30d` | number \| null | 30일 가격 표준편차 |
| `covPrice30d` | number \| null | 30일 변동계수 |
| `iqrPrice30d` | number \| null | 30일 사분위수 범위 |
| `trendSlope30d` | number \| null | 30일 가격 추세 기울기 |
| `priceChangesCount30d` | number \| null | 30일 내 가격 변동 횟수 |
| `priceRelativeTo30dRange` | number \| null | 30일 범위 내 현재 가격 위치 (0=최저, 1=최고) |

**장기 통계 (90일 / 1년 / 전체)**

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `priceChange90d` | number \| null | 90일 가격 변동률 (%) |
| `avgPrice90d` | number \| null | 90일 평균 가격 |
| `minPrice90d` | number \| null | 90일 최저가 |
| `maxPrice90d` | number \| null | 90일 최고가 |
| `stddevPopPrice90d` | number \| null | 90일 가격 표준편차 |
| `covPrice90d` | number \| null | 90일 변동계수 |
| `iqrPrice90d` | number \| null | 90일 사분위수 범위 |
| `trendSlope90d` | number \| null | 90일 가격 추세 기울기 |
| `priceChangesCount90d` | number \| null | 90일 내 가격 변동 횟수 |
| `priceRelativeTo90dRange` | number \| null | 90일 범위 내 현재 가격 위치 (0=최저, 1=최고) |
| `minPrice1y` | number \| null | 1년 최저가 |
| `maxPrice1y` | number \| null | 1년 최고가 |
| `minPriceAllTime` | number \| null | 역대 최저가 |
| `minPriceAllTimeDate` | string \| null | 역대 최저가 발생일 (ISO 8601) |
| `maxPriceAllTime` | number \| null | 역대 최고가 |
| `maxPriceAllTimeDate` | string \| null | 역대 최고가 발생일 (ISO 8601) |

**가격 히스토리**

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `priceHistory` | array \| null | 가격 히스토리 배열. 각 항목: `{ p: number, t: number }` (p=가격, t=Unix Timestamp) |

> `priceHistoryDuration` 파라미터로 기간 지정 (7d / 30d / 90d / 180d). 기본값 `7d`.

**응답 예시 (Card 객체)**

```json
{
  "data": [
    {
      "id": "pokemon-battle-academy-fire-energy-22-charizard-stamped",
      "name": "Fire Energy (#22 Charizard Stamped)",
      "game": "Pokemon",
      "set": "battle-academy-pokemon",
      "set_name": "Battle Academy",
      "number": "N/A",
      "tcgplayerId": "219042",
      "rarity": "Promo",
      "details": null,
      "variants": [
        {
          "id": "pokemon-battle-academy-fire-energy-22-charizard-stamped_near-mint",
          "condition": "Near Mint",
          "printing": "Normal",
          "language": "English",
          "price": 4.99,
          "lastUpdated": 1743100261,
          "priceChange24hr": 0.2,
          "priceChange7d": -1.5,
          "avgPrice": 5.12,
          "minPrice7d": 4.80,
          "maxPrice7d": 5.50,
          "trendSlope7d": -0.04,
          "priceHistory": [
            { "p": 5.50, "t": 1742495461 },
            { "p": 5.20, "t": 1742581861 },
            { "p": 4.99, "t": 1743100261 }
          ]
        },
        {
          "id": "pokemon-battle-academy-fire-energy-22-charizard-stamped_lightly-played",
          "condition": "Lightly Played",
          "printing": "Normal",
          "language": "English",
          "price": 3.50,
          "lastUpdated": 1743101175
        }
      ]
    }
  ],
  "meta": {
    "total": 1,
    "limit": 20,
    "offset": 0,
    "hasMore": false
  }
}
```

---

## 4. 카드 배치 조회

### `POST /price/cards/batch`

여러 카드의 가격 정보를 **단일 요청**으로 조회합니다. 각 항목마다 식별자와 필터를 개별 지정할 수 있어 다른 게임의 카드도 한 번에 조회 가능합니다.

**플랜별 최대 요청 수**

| 플랜 | 최대 항목 수 | 월간 한도 | 일간 한도 |
| --- | --- | --- | --- |
| Free Tier | 20개 | 1,000 | 100 |
| Starter / Pro | 100개 | 10,000 | 1,000 |
| Enterprise | 200개 | 500,000 | 50,000 |

---

### Request Body

**래퍼 구조**

```json
{
  "items": [ ...항목 배열... ]
}
```

**항목(item) 필드**

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `tcgplayerId` | string | 식별자 중 하나 필수 | TCGplayer Product ID |
| `cardId` | string | 식별자 중 하나 필수 | JustTCG Card ID |
| `variantId` | string | 식별자 중 하나 필수 | JustTCG Variant ID (가장 빠름) |
| `tcgplayerSkuId` | string | 식별자 중 하나 필수 | TCGPlayer SKU ID |
| `mtgjsonId` | string | 식별자 중 하나 필수 | MTGJSON UUID (MTG 전용) |
| `scryfallId` | string | 식별자 중 하나 필수 | Scryfall UUID (MTG 전용) |
| `printing` | string | 선택 | 인쇄 타입 필터 (Normal, Foil, 1st Edition, Unlimited 등) |
| `condition` | string | 선택 | 상태 필터 (NM, LP, MP, HP, DMG — 쉼표 구분) |
| `updated_after` | string | 선택 | 해당 Unix Timestamp 이후 업데이트된 항목만 반환 |

> 식별자 우선순위: `variantId > tcgplayerSkuId > tcgplayerId > mtgjsonId > scryfallId > cardId`
> 한 항목에 여러 식별자를 넣으면 우선순위가 높은 것 하나만 사용됩니다.

---

### 요청 예시

**예시 1 — tcgplayerId 기반 (기본)**

```json
{
  "items": [
    {
      "tcgplayerId": "219042",
      "condition": "NM",
      "printing": "Normal"
    },
    {
      "tcgplayerId": "25788",
      "condition": "LP"
    }
  ]
}
```

**예시 2 — 다양한 식별자 혼합 (포켓몬 + 유희왕 + MTG 동시 조회)**

```json
{
  "items": [
    {
      "tcgplayerId": "219042",
      "condition": "NM"
    },
    {
      "cardId": "yugioh-force-of-the-breaker-lich-lord-king-of-the-underworld-secret-rare",
      "condition": "LP"
    },
    {
      "variantId": "pokemon-battle-academy-fire-energy-22-charizard-stamped-promo_near-mint"
    }
  ]
}
```

**예시 3 — variantId만 사용 (가장 빠른 방식)**

```json
{
  "items": [
    { "variantId": "pokemon-battle-academy-fire-energy-22-charizard-stamped-promo_near-mint" },
    { "variantId": "yugioh-force-of-the-breaker-lich-lord-king-of-the-underworld-secret-rare_lightly-played_unlimited" }
  ]
}
```

**cURL 예시**

```bash
curl -X 'POST' \
  'http://localhost:4000/api/price/cards/batch' \
  -H 'accept: */*' \
  -H 'Content-Type: application/json' \
  -d '{
  "items": [
    { "tcgplayerId": "219042", "condition": "NM", "printing": "Normal" },
    { "tcgplayerId": "25788", "condition": "LP" }
  ]
}'
```

---

### 실제 응답 예시

> 요청: `tcgplayerId=219042 (NM, Normal)` + `tcgplayerId=25788 (LP)`

```json
{
  "data": [
    {
      "id": "pokemon-battle-academy-fire-energy-22-charizard-stamped-promo",
      "name": "Fire Energy (#22 Charizard Stamped)",
      "game": "Pokemon",
      "set": "battle-academy-pokemon",
      "set_name": "Battle Academy",
      "number": "N/A",
      "rarity": "Promo",
      "tcgplayerId": "219042",
      "mtgjsonId": null,
      "scryfallId": null,
      "details": null,
      "variants": [
        {
          "id": "pokemon-battle-academy-fire-energy-22-charizard-stamped-promo_near-mint",
          "condition": "Near Mint",
          "printing": "Normal",
          "language": "English",
          "tcgplayerSkuId": "4514055",
          "price": 0.11,
          "lastUpdated": 1773105749,
          "priceChange24hr": 0,
          "priceChange7d": -15.38,
          "avgPrice": 0.13,
          "minPrice7d": 0.11,
          "maxPrice7d": 0.13,
          "stddevPopPrice7d": 0.01,
          "covPrice7d": 0.0568,
          "iqrPrice7d": 0,
          "trendSlope7d": -0.00222,
          "priceChangesCount7d": 1,
          "priceChange30d": -8.33,
          "avgPrice30d": 0.12,
          "minPrice30d": 0.11,
          "maxPrice30d": 0.13,
          "priceRelativeTo30dRange": 0,
          "priceChange90d": -8.33,
          "avgPrice90d": 0.12,
          "minPrice90d": 0.10,
          "maxPrice90d": 0.13,
          "priceRelativeTo90dRange": 0.333,
          "minPrice1y": 0.10,
          "maxPrice1y": 0.15,
          "minPriceAllTime": 0.10,
          "minPriceAllTimeDate": "2026-01-21T12:55:01.864Z",
          "maxPriceAllTime": 0.15,
          "maxPriceAllTimeDate": "2025-10-13T23:20:01.231Z",
          "priceHistory": [
            { "p": 0.13, "t": 1772520101 },
            { "p": 0.13, "t": 1772540504 },
            { "p": 0.11, "t": 1773036602 },
            { "p": 0.11, "t": 1773105749 }
          ]
        }
      ]
    },
    {
      "id": "yugioh-force-of-the-breaker-lich-lord-king-of-the-underworld-secret-rare",
      "name": "Lich Lord, King of the Underworld",
      "game": "YuGiOh",
      "set": "force-of-the-breaker-yugioh",
      "set_name": "Force of the Breaker",
      "number": "FOTB-EN062",
      "rarity": "Secret Rare",
      "tcgplayerId": "25788",
      "mtgjsonId": null,
      "scryfallId": null,
      "details": null,
      "variants": [
        {
          "id": "yugioh-force-of-the-breaker-lich-lord-king-of-the-underworld-secret-rare_lightly-played_unlimited",
          "condition": "Lightly Played",
          "printing": "Unlimited",
          "language": "English",
          "tcgplayerSkuId": "570688",
          "price": 16.62,
          "lastUpdated": 1773099181,
          "priceChange7d": 0,
          "priceChange30d": 2.28,
          "avgPrice30d": 16.44,
          "minPrice30d": 16.25,
          "maxPrice30d": 16.62,
          "priceRelativeTo30dRange": 1,
          "priceChange90d": 2.28,
          "minPrice1y": 14.99,
          "maxPrice1y": 16.62,
          "minPriceAllTime": 14.99,
          "minPriceAllTimeDate": "2025-11-21T23:31:00.796Z",
          "maxPriceAllTime": 16.62,
          "maxPriceAllTimeDate": "2026-03-09T23:33:01.677Z"
        },
        {
          "id": "yugioh-force-of-the-breaker-lich-lord-king-of-the-underworld-secret-rare_lightly-played_1st-edition",
          "condition": "Lightly Played",
          "printing": "1st Edition",
          "language": "English",
          "tcgplayerSkuId": "537832",
          "price": 13.11,
          "lastUpdated": 1773099181,
          "priceChange7d": 0,
          "priceChange30d": 0,
          "priceChange90d": 0,
          "minPrice1y": 13.11,
          "maxPrice1y": 22.68,
          "minPriceAllTime": 13.11,
          "minPriceAllTimeDate": "2026-03-09T23:33:01.677Z",
          "maxPriceAllTime": 22.68,
          "maxPriceAllTimeDate": "2025-09-11T14:20:27.881Z"
        }
      ]
    }
  ],
  "_metadata": {
    "apiPlan": "Free Tier",
    "apiRequestLimit": 1000,
    "apiDailyLimit": 100,
    "apiRateLimit": 10,
    "apiRequestsUsed": 4,
    "apiDailyRequestsUsed": 3,
    "apiRequestsRemaining": 996,
    "apiDailyRequestsRemaining": 97
  }
}
```

---

### 응답 분석 — 실제 데이터에서 확인된 사항

**1. 배치 조회는 `meta` 필드가 없음**

단건 조회(`GET /price/cards`)와 달리 배치 조회 응답에는 `meta` (pagination) 필드가 없습니다. `_metadata` 만 포함됩니다.

**2. condition 필터 없이 조회하면 모든 printing 변형이 반환됨**

`tcgplayerId=25788, condition=LP` 로 요청했을 때 `LP_Unlimited` 와 `LP_1st Edition` 두 variant가 모두 반환됐습니다.

| variantId | printing | price |
| --- | --- | --- |
| `..._lightly-played_unlimited` | Unlimited | $16.62 |
| `..._lightly-played_1st-edition` | 1st Edition | $13.11 |

**3. variantId에 printing 정보가 포함되는 경우**

유희왕처럼 같은 상태에 printing 종류가 여러 개인 게임은 variantId 구조가 다릅니다.

```
포켓몬:  {cardId}_{condition}
유희왕:  {cardId}_{condition}_{printing}
```

예시:
```
pokemon-..._near-mint                                          ← printing 없음
yugioh-..._lightly-played_unlimited                           ← printing 포함
yugioh-..._lightly-played_1st-edition                        ← printing 포함
```

**4. `priceHistory30d` 는 deprecated 필드**

응답에 `priceHistory30d` 가 포함될 수 있으나 공식 deprecated 처리된 필드입니다. `priceHistory` + `priceHistoryDuration=30d` 파라미터 조합을 사용하세요.

**5. `priceRelativeTo30dRange` 해석**

| 값 | 의미 |
| --- | --- |
| `0` | 현재가 = 30일 최저가 (바닥) |
| `1` | 현재가 = 30일 최고가 (정상) |
| `0.5` | 30일 중간값 수준 |
| `null` | 30일 내 가격 변동 없음 (min=max) |

---

## 응답 공통 구조

```json
{
  "data": [],
  "meta": {
    "total": 100,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  },
  "_metadata": {
    "apiPlan": "Free Tier",
    "apiRequestLimit": 1000,
    "apiDailyLimit": 100,
    "apiRateLimit": 10,
    "apiRequestsUsed": 2,
    "apiDailyRequestsUsed": 1,
    "apiRequestsRemaining": 998,
    "apiDailyRequestsRemaining": 99
  }
}
```

| 필드 | 설명 |
| --- | --- |
| `data` | 요청된 카드/게임/세트 데이터 배열 |
| `meta.total` | 전체 결과 수 |
| `meta.limit` | 현재 요청의 limit 값 |
| `meta.offset` | 현재 요청의 offset 값 |
| `meta.hasMore` | 다음 페이지 존재 여부 (`true`면 offset 증가 후 재요청) |
| `_metadata.apiPlan` | 현재 API 플랜명 |
| `_metadata.apiRequestLimit` | 월간 총 요청 한도 |
| `_metadata.apiRequestsUsed` | 이번 달 사용한 요청 수 |
| `_metadata.apiRequestsRemaining` | 이번 달 남은 요청 수 |
| `_metadata.apiDailyLimit` | 일간 요청 한도 |
| `_metadata.apiDailyRequestsUsed` | 오늘 사용한 요청 수 |
| `_metadata.apiDailyRequestsRemaining` | 오늘 남은 요청 수 |
| `_metadata.apiRateLimit` | 분당 최대 요청 수 |

**플랜별 한도 (실제 확인된 Free Tier 기준)**

| 플랜 | 월간 한도 | 일간 한도 | 분당 한도 |
| --- | --- | --- | --- |
| Free Tier | 1,000 | 100 | 10 |
| Starter | 10,000 | 1,000 | 50 |
| Professional | 50,000 | 5,000 | 100 |
| Enterprise | 500,000 | 50,000 | 500 |

---

## 에러 코드

| HTTP 상태 | Error Code | 설명 |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | 필수 파라미터 누락 또는 잘못된 값 |
| 401 | `MISSING_API_KEY` | API 키 미포함 |
| 401 | `INVALID_API_KEY` | 유효하지 않은 API 키 |
| 403 | — | 권한 없음 |
| 404 | — | 카드/리소스를 찾을 수 없음 |
| 429 | `RATE_LIMIT_EXCEEDED` | 분당 요청 한도 초과 |
| 429 | `DAILY_LIMIT_EXCEEDED` | 일간 요청 한도 초과 |
| 429 | `REQUEST_LIMIT_EXCEEDED` | 월간 요청 한도 초과 |
| 500 | — | JustTCG 서버 오류 |

---

## ID 구조 참고

**Card ID 형식**: `{game}-{set}-{name}-{rarity}`

```
pokemon-battle-academy-fire-energy-22-charizard-stamped
```

**Variant ID 형식**: `{cardId}_{condition}`

```
pokemon-battle-academy-fire-energy-22-charizard-stamped_near-mint
```

---

## 포켓몬 플랫폼 활용 가이드

> 포켓몬 카드 거래 플랫폼을 개발할 때 각 API에서 꺼내 쓸 수 있는 데이터와 구현 가능한 기능을 정리한 섹션입니다.

---

### API 1 — `GET /price/games` 로 만들 수 있는 것

게임 전체 통계를 한 번에 가져오는 API입니다. 포켓몬만 필요하더라도 **시장 전체에서 포켓몬의 위치**를 보여주는 데 쓸 수 있습니다.

#### 활용 가능한 데이터

| 필드 | 플랫폼 활용 예시 |
| --- | --- |
| `game_value_usd` | 포켓몬 카드 시장 전체 규모 표시 (예: "현재 포켓몬 시장 총 가치 $709,469") |
| `game_value_change_7d_pct` | 메인 화면 마켓 요약 배너 (예: "이번 주 포켓몬 시장 +1.46% 상승") |
| `game_value_change_30d_pct` | 월간 시장 트렌드 표시 |
| `game_value_change_90d_pct` | 분기 시장 트렌드 — 투자 관점 정보 제공 |
| `cards_pos_7d_count` / `cards_neg_7d_count` | "이번 주 상승 카드 19,522개 vs 하락 16,131개" 형태의 시장 심리 지표 |
| `cards_count` | 플랫폼 내 "총 28,230개 카드 가격 실시간 추적 중" 문구 |

#### 구현 가능한 기능

```
✅ 메인 대시보드 — 포켓몬 시장 오늘의 요약 카드
   예: "시장 총 가치 $709K | 이번 주 +1.46% | 상승 카드 19,522개"

✅ 시장 흐름 배너 — 7일/30일/90일 변동률을 색상으로 표현
   (양수 = 초록, 음수 = 빨강)

✅ 타 게임 비교 위젯 — 포켓몬이 전체 TCG 시장 중 몇 위인지 보여주기
   예: "포켓몬 $709K · MTG $705K · One Piece $195K"
```

---

### API 2 — `GET /price/sets` 로 만들 수 있는 것

포켓몬에는 **210개 세트**가 있습니다. 세트별 총 가치와 가격 변동률 데이터를 활용할 수 있습니다.

#### 활용 가능한 데이터

| 필드 | 플랫폼 활용 예시 |
| --- | --- |
| `name` + `release_date` | 세트 목록 페이지 — 출시일 기준 정렬된 세트 브라우저 |
| `set_value_usd` | 각 세트의 총 가치 표시 — 고가 세트 하이라이트 |
| `set_value_change_7d_pct` | "이번 주 가장 핫한 세트" 랭킹 |
| `set_value_change_30d_pct` | 30일 트렌딩 세트 추천 |
| `set_value_change_90d_pct` | 분기 기준 가치 상승 세트 (투자 관점) |
| `cards_count` / `variants_count` | 세트 카드 수 표시 |
| `sealed_count` | 봉인 제품(팩/박스) 수 표시 |

#### 구현 가능한 기능

```
✅ 세트 브라우저 페이지
   - 210개 세트를 출시일 최신순 / 가치 높은 순으로 정렬
   - 각 세트 카드에 가치 변동률 배지 표시
     예: "Scarlet & Violet Base Set — $5,796 | +12.5% (90일)"

✅ 트렌딩 세트 위젯 (메인 화면)
   - 7일 / 30일 / 90일 기준 상승률 TOP 5 세트 목록

✅ 세트 가치 히트맵
   - 출시 연도별로 각 세트를 블록으로 표시
   - 90일 변동률에 따라 색상 변화 (상승=초록, 하락=빨강)

✅ 특정 세트 검색
   - q 파라미터로 "Base Set", "Scarlet" 등 이름 검색
```

#### 포켓몬 주요 세트 ID 참고

| 세트명 | set ID | 가치 |
| --- | --- | --- |
| Base Set (Shadowless) | `base-set-shadowless-pokemon` | $5,333 |
| SWSH01: Sword & Shield | `swsh01-sword-shield-base-set-pokemon` | $9,059 |
| SV01: Scarlet & Violet | `sv01-scarlet-violet-base-set-pokemon` | $5,796 |
| Base Set | `base-set-pokemon` | $1,930 |
| XY Base Set | `xy-base-set-pokemon` | $5,816 |

---

### API 3 — `GET /price/cards` 로 만들 수 있는 것

카드 한 장씩의 **실시간 시세 + 통계**를 조회합니다. 가장 많이 쓰게 될 API입니다.

#### 활용 가능한 데이터와 기능

**① 카드 검색 기능**

```
사용 파라미터: q + game=pokemon + condition + limit/offset

예: q=Charizard&game=pokemon&condition=NM&limit=20
```

```
✅ 통합 검색창 — 카드 이름으로 즉시 시세 확인
✅ 자동완성 검색 — 타이핑 시 실시간 카드 이름 제안
✅ 세트 내 전체 카드 목록 — set 파라미터로 특정 세트 카드 페이지 구성
```

---

**② 카드 상세 페이지 — 시세 정보**

```
사용 파라미터: tcgplayerId 또는 cardId

사용 필드: variants 배열 → condition × printing 조합별 현재 price
```

```
✅ Condition별 가격표
   예: Near Mint $4.99 | Lightly Played $3.50 | Moderately Played $2.10

✅ Normal vs Foil 가격 비교
   예: Normal NM $4.99 vs Foil NM $12.50
```

---

**③ 카드 상세 페이지 — 가격 히스토리 차트**

```
사용 파라미터: priceHistoryDuration=30d (또는 90d, 180d)

사용 필드: variants[].priceHistory → { p: 가격, t: Unix Timestamp }
```

```
✅ 가격 변동 차트 (라인 차트)
   - x축: 날짜 (t를 Date로 변환)
   - y축: 가격 (p)
   - 7일 / 30일 / 90일 / 180일 탭 전환

✅ 가격 변동률 배지
   예: "7일 -15.38% ↓" | "30일 -8.33% ↓" | "90일 -8.33% ↓"
```

---

**④ 카드 상세 페이지 — 통계 지표**

```
사용 필드: 7d/30d/90d 통계 + allTime 필드
```

| 필드 | 화면에 표시할 내용 |
| --- | --- |
| `minPrice7d` / `maxPrice7d` | "이번 주 범위 $0.11 ~ $0.13" |
| `avgPrice30d` | "30일 평균가 $0.12" |
| `trendSlope7d` | 상승/하락 추세 화살표 아이콘 (양수=↑, 음수=↓) |
| `priceRelativeTo30dRange` | "현재가는 30일 최저가 수준입니다" / "30일 최고가 근처" |
| `minPriceAllTime` + `minPriceAllTimeDate` | "역대 최저가 $0.10 (2026-01-21)" |
| `maxPriceAllTime` + `maxPriceAllTimeDate` | "역대 최고가 $0.15 (2025-10-13)" |
| `stddevPopPrice30d` | 가격 변동성 지표 — "안정적" / "변동 큼" 표시 |
| `priceChangesCount7d` | "이번 주 가격 변동 1회" |

---

**⑤ 구매 타이밍 판단 지표**

`priceRelativeTo30dRange` 하나만으로 간단한 매수 신호를 만들 수 있습니다.

```
priceRelativeTo30dRange = 0    →  "30일 최저가 수준 — 지금이 구매 적기일 수 있어요" 🟢
priceRelativeTo30dRange = 0~0.3 → "30일 저점 구간"
priceRelativeTo30dRange = 0.5  →  "30일 중간 가격대"
priceRelativeTo30dRange = 0.7~1 → "30일 고점 구간"
priceRelativeTo30dRange = 1    →  "30일 최고가 수준 — 가격이 높은 편이에요" 🔴
```

---

**⑥ 세트 페이지 — 카드 목록 + 가격**

```
사용 파라미터: game=pokemon + set={setId} + condition=NM + limit=20 + offset

예: game=pokemon&set=base-set-pokemon&condition=NM&limit=20&offset=0
```

```
✅ 세트 내 카드 전체 목록 (페이지네이션)
   - 카드 번호(number) 순 정렬
   - NM 기준 현재 시세 표시
   - 7일 변동률 배지

✅ 세트 내 고가 카드 TOP 10
   - variants[].price 내림차순 정렬 후 상위 표시
```

---

### API 4 — `POST /price/cards/batch` 로 만들 수 있는 것

여러 카드를 **한 번의 요청**으로 조회합니다. 컬렉션 관리 기능의 핵심 API입니다.

#### 활용 가능한 데이터

```
한 번에 최대 20개(Free Tier) 카드의 현재가 + 통계 조회
```

#### 구현 가능한 기능

**① 내 컬렉션 총 가치 계산기**

```
흐름:
1. 사용자가 보유 카드 목록 등록 (카드명 + 상태 + 수량)
2. 등록된 카드를 배치 조회로 현재 시세 가져오기
3. (현재가 × 보유 수량) 합산 → 총 컬렉션 가치 표시

예: "내 컬렉션 총 가치: $1,234.56"
```

**② 위시리스트 가격 한눈에 보기**

```
흐름:
1. 사용자가 원하는 카드 위시리스트 등록
2. 페이지 접속 시 배치 조회로 전체 위시리스트 현재가 갱신
3. 총 구매 예상 비용 표시

예: "위시리스트 예상 구매 금액: $89.30"
```

**③ 카드 비교 기능**

```
흐름:
1. 사용자가 여러 카드 선택 (최대 20개)
2. 배치 조회로 선택된 카드 전체 시세 가져오기
3. 가격 / 변동률 / 역대 최고-최저가 나란히 비교

예:
Charizard Holo    NM $45.00  |  7일 +3.2%  |  역대 최고 $120
Blastoise Holo    NM $22.00  |  7일 -1.1%  |  역대 최고 $60
Venusaur Holo     NM $18.00  |  7일 +0.5%  |  역대 최고 $55
```

**④ 포트폴리오 손익 계산**

```
흐름:
1. 사용자가 카드 구매 가격 + 날짜 기록
2. 배치 조회로 현재 시세 조회
3. (현재가 - 구매가) × 수량 = 손익 계산

예: "Charizard Holo — 구매가 $30 → 현재가 $45 → +$15 (+50%) 수익"
```

---

### 전체 기능 로드맵 요약

| 기능 | 사용 API | 핵심 필드 |
| --- | --- | --- |
| 메인 시장 현황 대시보드 | `GET /games` | `game_value_usd`, `game_value_change_*d_pct`, `cards_pos/neg_*d_count` |
| 트렌딩 세트 위젯 | `GET /sets` | `set_value_change_7d_pct`, `set_value_usd` |
| 세트 브라우저 | `GET /sets` | `name`, `release_date`, `set_value_usd`, `cards_count` |
| 카드 통합 검색 | `GET /cards` | `q + game + condition` |
| 세트 내 카드 목록 | `GET /cards` | `game + set + limit/offset` |
| 카드 상세 — Condition별 가격표 | `GET /cards` | `variants[].condition`, `variants[].price` |
| 카드 상세 — 가격 히스토리 차트 | `GET /cards` | `variants[].priceHistory` |
| 카드 상세 — 통계 지표 | `GET /cards` | `minPrice7d`, `avgPrice30d`, `trendSlope7d`, `priceRelativeTo30dRange` |
| 역대 최고/최저가 표시 | `GET /cards` | `minPriceAllTime`, `maxPriceAllTime`, `*AllTimeDate` |
| 구매 타이밍 신호 | `GET /cards` | `priceRelativeTo30dRange`, `trendSlope7d` |
| 컬렉션 총 가치 계산 | `POST /cards/batch` | `variants[].price` × 보유 수량 |
| 위시리스트 가격 조회 | `POST /cards/batch` | `variants[].price` |
| 카드 비교 | `POST /cards/batch` | `price`, `priceChange7d`, `minPriceAllTime` |
| 포트폴리오 손익 | `POST /cards/batch` | `variants[].price` vs 구매가 |
