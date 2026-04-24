# HTTP API 레퍼런스 (`/api/*`)

NestJS 글로벌 프리픽스는 **`api`** 입니다. 클라이언트 최종 URL은 **`{호스트}/api/{컨트롤러경로}`**  
예: 로컬 백엔드 직결 `http://localhost:4000/api/marketplace/orders`, 프론트는 보통 `getApiUrl()`이 이미 **`…/api`** 까지 포함합니다.

자세한 스키마·쿼리는 Swagger **`/api/docs`** 와 소스 컨트롤러를 우선합니다.

---

## 태그 · 컨트롤러 매핑

| Swagger 태그 | 컨트롤러 파일 | 베이스 경로 (`/api` 다음) |
|----------------|---------------|---------------------------|
| auth | `auth/auth.controller.ts` | `/auth` |
| rwa | `nft/nft.controller.ts` | `/rwa` |
| blockchain | `blockchain/blockchain.controller.ts` | `/blockchain` |
| marketplace | `marketplace/marketplace.controller.ts` | `/marketplace` |
| marketplace | `marketplace/poketrace-proxy.controller.ts` | `/marketplace/poketrace` |
| marketplace | `marketplace/trading/bids.controller.ts` | `/marketplace/bids` |
| marketplace | `marketplace/trading/trade.controller.ts` | `/marketplace/trade` |
| price | `price/price.controller.ts` | `/price` |
| psa | `psa/psa.controller.ts` | `/psa` |

---

## `auth`

| Method | 경로 | 설명 |
|--------|------|------|
| GET | `/auth/google` | Google OAuth 시작 |
| GET | `/auth/google/callback` | 콜백 → JWT HttpOnly 쿠키 → 프론트 리다이렉트 |
| GET | `/auth/verify-email` | 이메일 인증 링크 (`token` query) |
| POST | `/auth/send-verification-email` | 인증 메일 재발송 (JWT 필요) |
| GET | `/auth/session` | 세션 (`user` 또는 `null`, 비로그인도 200) |
| GET | `/auth/me` | 현재 사용자 (JWT 필요) |
| POST | `/auth/logout` | 로그아웃 (쿠키 삭제, 204) |
| POST | `/auth/wallet` | 지갑 연결 (JWT + body `address`) |
| DELETE | `/auth/wallet` | 지갑 연결 해제 (JWT) |

---

## `rwa` (IPFS 업로드)

| Method | 경로 | 설명 |
|--------|------|------|
| POST | `/rwa/upload` | multipart — 이미지 + 메타 → Pinata → `tokenURI` 등 |

---

## `blockchain`

| Method | 경로 | 설명 |
|--------|------|------|
| GET | `/blockchain/token/info` | USDC 이름·심볼·decimals |
| GET | `/blockchain/token/supply` | USDC totalSupply |
| GET | `/blockchain/token/balance/:address` | USDC 잔액 |
| GET | `/blockchain/rwa/info` | TokenableRWA 이름·심볼·totalMinted |
| GET | `/blockchain/rwa/owner/:tokenId` | `ownerOf` |
| GET | `/blockchain/rwa/asset/:tokenId` | tokenURI → 메타 파싱 + `imageUrl` |
| GET | `/blockchain/rwa/token-uri/:tokenId` | raw tokenURI |
| GET | `/blockchain/rwa/balance/:address` | 보유 수량 |
| GET | `/blockchain/rwa/tokens/:address` | 보유 tokenId 목록 |
| POST | `/blockchain/rwa/metadata/batch` | tokenIds 배치 → 메타 + imageUrl |
| POST | `/blockchain/media/resolve` | URI → 브라우저용 https URL |

---

## `price` (JustTCG)

**환경 변수:** `TCG_API_KEY` 필수 (`PriceService.getOrThrow`). 로컬 mock 전용 파일·플래그는 제거됨.

| Method | 경로 | 설명 |
|--------|------|------|
| GET | `/price/games` | 게임 목록·통계 |
| GET | `/price/sets` | 세트 목록 (`game` 필수) |
| GET | `/price/cards` | 카드 단건·검색 |
| POST | `/price/cards/batch` | 카드 배치 (플랜별 상한) |

---

## `psa`

| Method | 경로 | 설명 |
|--------|------|------|
| POST | `/psa/analyze` | multipart 슬랩 OCR + PSA API + JustTCG (선택 `certNumber`) |
| POST | `/psa/analyze-by-cert` | JSON `{ certNumber }` 만으로 동일 파이프라인 (이미지 없음) |

---

## `marketplace` — 주문 · 컬렉션 · 시장 데이터

| Method | 경로 | 설명 |
|--------|------|------|
| POST | `/marketplace/orders` | Seaport 주문 등록 |
| POST | `/marketplace/orders/replace-listing` | 활성 ask 교체 (cancel + insert) |
| POST | `/marketplace/orders/batch-by-token` | tokenIds → 주문 이력 맵 |
| GET | `/marketplace/orders` | 활성 매도 경량 목록 |
| GET | `/marketplace/orders/token/:tokenId` | 토큰별 주문 (`activeOnly` 쿼리) |
| GET | `/marketplace/orders/:hash` | 단건 전체 (parameters·signature) |
| PATCH | `/marketplace/orders/:hash/cancel` | 취소 (`callerAddress` query) |
| PATCH | `/marketplace/orders/:hash/fulfill` | 단일 체결 DB 동기화 |
| POST | `/marketplace/orders/fulfill-matched-pair` | criteria 매칭 후 양쪽 fulfilled |
| GET | `/marketplace/collections` | 컬렉션 요약 커서 페이지 (`limit`, `cursor`) |
| POST | `/marketplace/collections/market-snapshots` | 배치 리스트 스냅샷 (스파크라인·풀 통계 등) |
| GET | `/marketplace/collections/:key` | 상세 + listings + collectionBids + 대표 이미지 |
| GET | `/marketplace/collections/:key/poketrace` | PokéTrace 프리뷰 |
| GET | `/marketplace/collections/:key/poketrace/price-history` | 티어 가격 히스토리 (`tier`, `period`, `maxDays`) |
| GET | `/marketplace/collections/:key/poketrace/nm-history` | NM 레거시 별칭 |
| GET | `/marketplace/collections/:key/market-series` | 차트 번들 (플랫폼 + 외부 시계열) |
| GET | `/marketplace/collections/:key/platform-trades` | 컬렉션 체결 내역 |
| GET | `/marketplace/collections/:key/stats` | 풀 통계 (floor 등) |
| GET | `/marketplace/collections/:key/merkle-set` | Merkle 대상 tokenIds (`bypassCache` 선택) |
| POST | `/marketplace/poketrace/mint-previews` | tokenIds(최대 32) → NM 밴드 배치 |

---

## `marketplace/poketrace` — 업스트림 프록시

PokéTrace Pro 연동 시 **`POKETRACE_PUBLIC_API_TOKEN`** 등 (미설정 시 `ServiceUnavailable`).  
Swagger 태그는 **marketplace** 와 동일.

| Method | 경로 | 설명 |
|--------|------|------|
| GET | `/marketplace/poketrace/catalog` | OpenAPI 작업 목록·베이스 URL |
| GET | `/marketplace/poketrace/cards` | 카드 검색 (쿼리 파라미터) |
| GET | `/marketplace/poketrace/cards/:cardId` | 카드 단건 |
| GET | `/marketplace/poketrace/cards/:cardId/prices/:tier/history` | 티어별 가격 히스토리 |
| GET | `/marketplace/poketrace/cards/:cardId/listings` | 리스팅 (업스트림 플랜에 따라 403 가능) |
| GET | `/marketplace/poketrace/sets` | 세트 목록 |

---

## `marketplace/bids` · `marketplace/trade` (relational 레이어)

Seaport와 병행. 상세: [marketplace-trading.md](./marketplace-trading.md)

| Method | 경로 | 설명 |
|--------|------|------|
| GET | `/marketplace/bids` | `collectionKey` 필수, `tokenId` 선택 |
| GET | `/marketplace/bids/:id` | 입찰 단건 (UUID) |
| POST | `/marketplace/trade/match` | 매칭 예약 — **202**, `Idempotency-Key` 헤더 권장 |
| GET | `/marketplace/trade/executions/:id` | 정산 상태 폴링 |

---

## 프론트엔드 라우트 (App Router)

| 경로 | 용도 |
|------|------|
| `/` | 랜딩 · Market Indexes |
| `/exchange` | 컬렉션 허브 |
| `/portfolio` | 보유 자산 |
| `/vault` | 민팅·vault |
| `/marketplace/collections/[collectionKey]` | 컬렉션 거래 UI |
| `/marketplace/[tokenId]` | 토큰 상세 |
| `/marketplace/other-listings` | 컬렉션 미매칭 리스팅 |
| `/login`, `/signup`, `/profile`, `/auth/callback` | 인증 |

---

*마지막 동기화: 레포의 `backend/src/**/*controller.ts`, `frontend/app/**/page.tsx`, `main.ts` 기준.*
