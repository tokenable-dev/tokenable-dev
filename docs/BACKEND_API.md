# Tokenable Backend — REST API 레퍼런스

NestJS 기준 **실제 라우트**를 코드(`*.controller.ts`)와 맞춰 정리했습니다. 배포 시 **호스트·포트**만 바꿔 사용하면 됩니다.

| 항목 | 값 |
|------|-----|
| **글로벌 prefix** | `/api` (`main.ts`) |
| **Swagger UI** | `{BASE}/api/docs` |
| **OpenAPI JSON** | Swagger 기본 경로 (UI에서 확인) |

**예시 Base URL (로컬)**  
`http://localhost:4000` → API는 `http://localhost:4000/api/...`

---

## 1. 인증 (Auth)

### 1.1 JWT 전달 방식

보호된 엔드포인트(`JwtAuthGuard`)는 다음 **둘 중 하나**로 JWT 액세스 토큰을 받습니다.

| 방식 | 설명 |
|------|------|
| **httpOnly 쿠키** | 이름: `access_token`, `Cookie` 헤더 (브라우저 `credentials: "include"` 권장) |
| **Authorization 헤더** | `Authorization: Bearer <JWT>` |

Google OAuth 콜백 후 서버가 `access_token` 쿠키를 설정합니다 (`FRONTEND_URL`로 리다이렉트).

### 1.2 Swagger에서 인증

`Authorize` → **Bearer** 스키마 (`access-token`)에 토큰 입력.

---

## 2. 공통 동작

- **Content-Type**: JSON은 `application/json` (파일 업로드 엔드포인트는 `multipart/form-data`).
- **ValidationPipe** (`main.ts`): `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` — DTO에 없는 필드는 400.
- **CORS**: `CORS_ORIGIN` 환경변수(쉼표 구분) 또는 `*`.
- **날짜**: 엔티티 `Date`는 JSON 응답에서 보통 **ISO 8601 문자열**로 직렬화됩니다.

---

## 3. 엔드포인트 목록

> 헬스 전용 `GET /api/util`, `GET /api/nft` 는 제거되었습니다. 스모크는 `GET /api/marketplace/orders` 등 실제 라우트를 사용하세요.

### 3.1 `auth` — 인증·계정

컨트롤러 prefix: `auth` → 실제 경로 `/api/auth/...`

| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| `GET` | `/api/auth/google` | 없음 | Google OAuth 시작. **302** → Google 로그인 |
| `GET` | `/api/auth/google/callback` | 없음 | OAuth 콜백. JWT 쿠키 설정 후 `FRONTEND_URL/auth/callback?ok=1`로 **리다이렉트** |
| `GET` | `/api/auth/verify-email` | 없음 | 이메일 인증 링크. Query: `token`. 성공/실패에 따라 `FRONTEND_URL/?email_verify=...`로 **리다이렉트** |
| `POST` | `/api/auth/send-verification-email` | **JWT** | 인증 메일 재발송. 응답: `{ "ok": true }` |
| `GET` | `/api/auth/me` | **JWT** | 현재 사용자. 응답 필드: `id`, `email`, `name`, `pictureUrl`, `walletAddress`, `walletLinkedAt`, `platformEmailVerifiedAt` |
| `POST` | `/api/auth/logout` | 없음 | 로그아웃. **204**, `access_token` 쿠키 삭제 |
| `POST` | `/api/auth/wallet` | **JWT** | 지갑 연결. Body: `{ "address": "0x..." }` (`LinkWalletDto`, 체크섬 정규화). 응답: `id`, `walletAddress`, `walletLinkedAt` |
| `DELETE` | `/api/auth/wallet` | **JWT** | 지갑 연결 해제. 응답: `{ "walletAddress": ... }` |

**`POST /api/auth/wallet` Body**

```json
{
  "address": "0x0000000000000000000000000000000000000000"
}
```

---

### 3.2 `nft` — IPFS 업로드

| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| `POST` | `/api/nft/upload` | 없음 | 이미지·메타데이터를 Pinata(IPFS)에 업로드 |

**`POST /api/nft/upload`** — `multipart/form-data`

| 필드 | 필수 | 설명 |
|------|------|------|
| `name` | ✅ | 문자열 |
| `description` | ✅ | 문자열 |
| `image` | 조건부 | 바이너리. `image/jpeg`, `image/jpg`, `image/png`만. 최대 **10MB** |
| `imageUrl` | 선택 | 파일 대신 이미지 URL 사용 시 |
| `attributes` | 선택 | JSON **문자열** (예: OpenSea 스타일 trait 배열) |
| `gradedMetadata` | 선택 | JSON **문자열** — `properties.graded` 등 민팅 메타 병합용 |

**응답 (`UploadNftResult`)**

```json
{
  "tokenURI": "ipfs://... 또는 https://...",
  "metadataCID": "...",
  "imageCID": "...",
  "metadata": {
    "name": "...",
    "description": "...",
    "image": "...",
    "attributes": [],
    "properties": {},
    "external_url": "..."
  }
}
```

---

### 3.3 `blockchain` — Sepolia USDC · TokenableRWA (ERC-721)

환경변수 `NFT_CONTRACT_ADDRESS`, `USDC_CONTRACT_ADDRESS`, `SEPOLIA_RPC_URL` 등에 묶입니다.

| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| `GET` | `/api/blockchain/token/info` | 없음 | USDC 이름·심볼·decimals |
| `GET` | `/api/blockchain/token/supply` | 없음 | USDC 총 공급 (문자열) |
| `GET` | `/api/blockchain/token/balance/:address` | 없음 | 해당 주소 USDC 잔액 (문자열) |
| `GET` | `/api/blockchain/nft/info` | 없음 | NFT 컨트랙트 이름·심볼·`totalMinted` |
| `GET` | `/api/blockchain/nft/owner/:tokenId` | 없음 | `tokenId` 정수 — `ownerOf` 주소 (문자열) |
| `GET` | `/api/blockchain/nft/token-uri/:tokenId` | 없음 | `tokenURI` (문자열; JSON 래핑 여부는 컨트랙트/프록시에 따름) |
| `GET` | `/api/blockchain/nft/balance/:address` | 없음 | 해당 주소가 보유한 NFT 개수 (숫자) |
| `GET` | `/api/blockchain/nft/tokens/:address` | 없음 | 해당 주소가 보유한 **tokenId 배열** `number[]` |

**참고**: `tokenId` 경로는 `ParseIntPipe`로 파싱됩니다.

---

### 3.4 `marketplace` — Seaport 주문·컬렉션·풀 입찰 (오프체인 DB)

서명된 Seaport 주문을 **DB에 저장**하고, graded **컬렉션**·**bucket(풀) 입찰** API를 제공합니다.  
`orders` 등 테이블은 마이그레이션(`backend/sql/migrations/`)으로 생성합니다.

#### Seaport 주문

| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| `POST` | `/api/marketplace/orders` | 없음 | 주문 등록 (`side`: `ask`\|`bid`, 기본 `ask`) |
| `GET` | `/api/marketplace/orders` | 없음 | **활성 매도(ask)** 만 (만료분은 조회 시 정리) |
| `GET` | `/api/marketplace/orders/token/:tokenId` | 없음 | 해당 토큰 **전체 이력** (모든 status) |
| `GET` | `/api/marketplace/orders/bids/token/:tokenId` | 없음 | 해당 토큰 **활성 매수(bid)** , 가격 내림차순 |
| `GET` | `/api/marketplace/orders/:hash` | 없음 | `orderHash` 단건 |
| `PATCH` | `/api/marketplace/orders/:hash/cancel` | 없음 | Query: **`callerAddress`** |
| `PATCH` | `/api/marketplace/orders/:hash/fulfill` | 없음 | 체결 완료 → `fulfilled` |
| `PATCH` | `/api/marketplace/orders/:hash/reactivate` | 없음 | Query: **`callerAddress`** — `active` 복구 |

**라우트 순서**: `orders/token/...`, `orders/bids/token/...` 가 `orders/:hash` 보다 먼저 매칭됩니다.

#### 컬렉션

| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| `GET` | `/api/marketplace/collections` | 없음 | 컬렉션 요약 |
| `GET` | `/api/marketplace/collections/:key` | 없음 | 단건 + listings + pool bids + seaport bids + 대표 이미지 |

#### Pool (bucket) 입찰

| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| `GET` | `/api/marketplace/bucket-bids/by-token/:tokenId` | 없음 | 버킷·활성 풀 입찰 |
| `POST` | `/api/marketplace/bucket-bids` | 없음 | 풀 매수 호가 등록 |
| `POST` | `/api/marketplace/bucket-bids/:id/prepare-fulfill` | 없음 | Body: `tokenId` — Seaport 입찰 초안 |
| `PATCH` | `/api/marketplace/bucket-bids/:id/cancel` | 없음 | Query: **`callerAddress`** |
| `POST` | `/api/marketplace/bucket-bids/:id/validate-seller` | 없음 | Body: `tokenId`, `sellerAddress` |

**`POST /api/marketplace/orders` Body (`CreateOrderDto`)**

| 필드 | 타입 | 설명 |
|------|------|------|
| `side` | `ask` \| `bid` | 선택, 기본 `ask` |
| `parameters` | object | Seaport `OrderParameters` |
| `signature` | string | EIP-712 서명 hex |
| `tokenContract` | address | ERC-721 |
| `tokenId` | string | 숫자 문자열 |
| `considerationToken` | address | USDC 등 |
| `considerationAmount` | string | 최소 단위 문자열 |
| `bucketBidId` | number | 선택, `side=bid` + 풀 연결 시 |

**Order 응답 필드 (요약)**

| 필드 | 설명 |
|------|------|
| `id`, `orderHash`, `side`, `offerer` | |
| `tokenContract`, `tokenId` | |
| `considerationToken`, `considerationAmount` | |
| `collectionKey`, `bucketBidId` | 있을 때 |
| `parameters`, `signature`, `status` | |
| `startTime`, `endTime`, `createdAt`, `updatedAt` | |

**에러 예시**: 활성 ask 중복 **400**, 충돌 **409**, DB 미준비 **503** 등.

---

### 3.5 `price` — JustTCG (카드 가격)

**상세 파라미터·예시·에러 코드**는 별도 문서를 유지합니다.

→ **[price-api.md](./price-api.md)** (JustTCG 연동, `game` / `sets` / `cards` / `batch`)

요약:

| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| `GET` | `/api/price/games` | 서버 env `TCG_API_KEY` | 지원 게임 목록 |
| `GET` | `/api/price/sets` | 위와 동일 | Query: **`game`** 필수, 선택 `q`, `orderBy`, `order` |
| `GET` | `/api/price/cards` | 위와 동일 | 단건 ID 조회 또는 검색 (`q`, `game`, `set`, …) |
| `POST` | `/api/price/cards/batch` | 위와 동일 | Body: `{ "items": [ ... ] }` |

---

### 3.6 `psa` — 슬랩 OCR + PSA / JustTCG

| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| `POST` | `/api/psa/analyze` | 없음 | 슬랩 이미지 업로드 → OCR → (선택) PSA Public API → JustTCG 검색 |

**`POST /api/psa/analyze`** — `multipart/form-data`

| 필드 | 필수 | 제한 |
|------|------|------|
| `slabFront` | ✅ | `jpeg`/`jpg`/`png`/`webp`, 파일당 최대 **15MB** |
| `slabBack` | 선택 | 동일 |

**응답 (`PsaAnalyzeResult`) — 구조 요약**

- `ocr`: `combinedText`, `frontText?`, `backText?`
- `psa`: OCR로 파싱한 라벨 필드 + `certVerifyUrl?`, `enrichedFromOfficialApi?`
- `psaApi.lookup`: PSA Public API 조회 결과 (토큰 없으면 스킵/에러 등)
- `justtcg`: `queryUsed`, `topMatch`, `rawResponse`

`PSA_PUBLIC_API_TOKEN`이 없으면 PSA 공식 API 보강은 제한될 수 있습니다.

---

## 4. HTTP 상태 코드 (일반)

| 코드 | 의미 |
|------|------|
| 200 | 성공 (본문 있음) |
| 204 | 성공 (본문 없음 — 예: logout) |
| 302 | 리다이렉트 (OAuth, 이메일 인증) |
| 400 | 검증 실패·잘못된 요청 |
| 401 | JWT 없음/무효 |
| 404 | 리소스 없음 (예: 주문 hash) |
| 409 | 충돌 (예: 중복 주문) |
| 500 | 서버 오류 |
| 503 | 서비스 불가 (예: DB 테이블 미생성 안내) |

---

## 5. 운영 시 참고 환경변수 (요약)

로컬은 `backend/.env`, 배포는 시크릿/compose에서 주입합니다.

| 변수 | 용도 |
|------|------|
| `PORT` | HTTP 포트 (기본 4000) |
| `CORS_ORIGIN` | 허용 오리진 |
| `FRONTEND_URL` | OAuth·이메일 리다이렉트·쿠키 Secure 판단 |
| `COOKIE_SECURE` | `true`/`false` 명시 시 JWT 쿠키 `Secure` 플래그 (미설정이면 `FRONTEND_URL` 이 https 여부로 추론) |
| `JWT_SECRET` | JWT 서명 |
| `SEPOLIA_RPC_URL` | 읽기 전용 RPC |
| `NFT_CONTRACT_ADDRESS`, `USDC_CONTRACT_ADDRESS` | 컨트랙트 |
| `POSTGRES_*` | PostgreSQL |
| `PINATA_JWT`, `PINATA_GATEWAY` | IPFS |
| `TCG_API_KEY` | JustTCG |
| `PSA_PUBLIC_API_TOKEN` | PSA Public API (선택) |
| Google OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` |
| SMTP | `SMTP_*`, `MAIL_FROM` (이메일 인증) |

---

## 6. Notion에 옮길 때 팁

1. 이 파일을 Notion 페이지에 **Markdown 가져오기** 하거나 코드 블록·표를 그대로 붙여넣습니다.
2. **Price** 장은 `price-api.md`를 하위 페이지 또는 링크로 두면 중복을 줄일 수 있습니다.
3. 실제 요청/응답은 **`/api/docs` Swagger**에서 스키마를 최종 확인하는 것이 가장 정확합니다(코드와 동기화됨).

---

*문서 생성 기준: 레포 내 `backend/src/**/*controller.ts`, DTO, `main.ts`. 코드 변경 시 본 문서와 Swagger를 함께 갱신하는 것을 권장합니다.*
