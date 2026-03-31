# Tokenable API 문서

백엔드(NestJS) 기준. 전역 prefix: **`/api`**.

> **더 상세한 설명·필드 표**는 [BACKEND_API.md](./BACKEND_API.md) 를 참고하고, 스키마는 **`/api/docs` Swagger**가 최신 기준입니다.

| 항목 | 예시 |
|------|------|
| 로컬 Base URL | `http://localhost:4000/api` |
| 배포 | `https://<도메인>/api` (Nginx 등에서 `/api` → 백엔드 프록시) |
| Swagger UI | `{호스트}/api/docs` (스키마·Try it out) |

로컬 **PostgreSQL 스키마·Docker·ERD** 상세는 [LOCAL_DATABASE.md](./LOCAL_DATABASE.md) 및 통합 다이어그램 `docs/diagrams/tokenable-all-diagrams.drawio` (탭 **03-C-PostgreSQL-ERD**) 를 참고하세요.

## 인증

- **쿠키**: Google OAuth 완료 후 `access_token` (httpOnly). 브라우저는 `credentials: include` 로 호출.
- **Bearer**: `Authorization: Bearer <JWT>` (일부 엔드포인트, Swagger `access-token`).

---

## 1. Auth — `/api/auth`

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| GET | `/auth/google` | Google OAuth 시작 (302) | 없음 |
| GET | `/auth/google/callback` | OAuth 콜백 → JWT 쿠키 → 프론트 리다이렉트 | 없음 |
| GET | `/auth/verify-email?token=` | 이메일 인증 링크 | 없음 |
| POST | `/auth/send-verification-email` | 인증 메일 재발송 | JWT |
| GET | `/auth/me` | 현재 사용자 | JWT |
| POST | `/auth/logout` | 로그아웃 (204, 쿠키 삭제) | 없음 |
| POST | `/auth/wallet` | 지갑 주소 연결 | JWT |
| DELETE | `/auth/wallet` | 지갑 연결 해제 | JWT |

---

## 2. NFT / 민팅 — `/api/nft`

| Method | Path | 설명 |
|--------|------|------|
| POST | `/nft/upload` | 이미지·메타데이터 IPFS 업로드, `tokenURI` 반환 (`multipart/form-data`) |

필드 예: `name`, `description`, 선택 `image`, `imageUrl`, `attributes`, `gradedMetadata` 등.

---

## 3. PSA — `/api/psa`

| Method | Path | 설명 |
|--------|------|------|
| POST | `/psa/analyze` | 슬랩 OCR + PSA Public API + JustTCG (`multipart`: `slabFront` 필수, `slabBack`, `certNumber` 선택) |

---

## 4. Blockchain — `/api/blockchain`

`NFT_CONTRACT_ADDRESS`, `USDC_CONTRACT_ADDRESS` 등은 **서버 환경 변수**로 결정.

| Method | Path | 설명 |
|--------|------|------|
| GET | `/blockchain/token/info` | USDC 이름·심볼·decimals |
| GET | `/blockchain/token/supply` | USDC 총 공급량 |
| GET | `/blockchain/token/balance/:address` | 지갑 USDC 잔액 |
| GET | `/blockchain/nft/info` | Tokenable_RWA 컨트랙트 정보 |
| GET | `/blockchain/nft/owner/:tokenId` | 소유자 주소 |
| GET | `/blockchain/nft/token-uri/:tokenId` | tokenURI |
| GET | `/blockchain/nft/balance/:address` | 보유 NFT 개수 |
| GET | `/blockchain/nft/tokens/:address` | 보유 tokenId 목록 |

---

## 5. Marketplace — `/api/marketplace`

**Seaport가 프로젝트에서 쓰이는 범위·용도·구조** 요약: [SEAPORT_PROTOCOL_OVERVIEW.md](./SEAPORT_PROTOCOL_OVERVIEW.md).  
**Seaport · 풀 입찰 · EIP-712 · 온체인 연동** API 상세는 [SEAPORT_API.md](./SEAPORT_API.md) 를 참고하세요.

### Seaport 주문 (오프체인 DB)

| Method | Path | 설명 |
|--------|------|------|
| POST | `/marketplace/orders` | Seaport 주문 등록 (JSON) |
| GET | `/marketplace/orders` | 활성 매도(ask) 목록 |
| GET | `/marketplace/orders/token/:tokenId` | 해당 토큰 주문 전체 이력 |
| GET | `/marketplace/orders/bids/token/:tokenId` | 해당 토큰 활성 매수 입찰 (가격 내림차순) |
| GET | `/marketplace/orders/:hash` | orderHash 단건 |
| PATCH | `/marketplace/orders/:hash/cancel?callerAddress=` | 매도 취소 |
| PATCH | `/marketplace/orders/:hash/fulfill` | 체결 완료 처리 |
| PATCH | `/marketplace/orders/:hash/reactivate?callerAddress=` | active 복구 |

### 컬렉션

| Method | Path | 설명 |
|--------|------|------|
| GET | `/marketplace/collections` | 컬렉션 요약 목록 |
| GET | `/marketplace/collections/:key` | 컬렉션 + listings + pool bids + seaport bids + 대표 이미지 |

### Pool (bucket) bids

| Method | Path | 설명 |
|--------|------|------|
| GET | `/marketplace/bucket-bids/by-token/:tokenId` | 버킷 키·활성 풀 입찰 |
| POST | `/marketplace/bucket-bids` | 풀 매수 호가 등록 |
| POST | `/marketplace/bucket-bids/:id/prepare-fulfill` | 특정 tokenId Seaport 입찰 초안 |
| PATCH | `/marketplace/bucket-bids/:id/cancel?callerAddress=` | 풀 입찰 취소 |
| POST | `/marketplace/bucket-bids/:id/validate-seller` | 판매자·토큰 일치 검증 |

---

## 6. Price (JustTCG) — `/api/price`

서버에 `TCG_API_KEY` 필요.

| Method | Path | 설명 |
|--------|------|------|
| GET | `/price/games` | 지원 게임 목록 |
| GET | `/price/sets` | 세트 목록 (`game` 쿼리 필수) |
| GET | `/price/cards` | 카드 단건/검색 (쿼리 파라미터 다수) |
| POST | `/price/cards/batch` | 카드 배치 조회 (JSON body) |

---

## Notion 가져오기

1. Notion 페이지에서 **Import** → **Markdown** 선택.
2. 이 파일 `docs/API_DOCUMENTATION.md` 업로드.

또는 파일 내용을 복사해 Notion에 붙여 넣으면 제목·표가 대부분 변환됩니다.

**상세 Request/Response 타입**은 Swagger **`/api/docs`** 를 링크로 두는 것을 권장합니다.
