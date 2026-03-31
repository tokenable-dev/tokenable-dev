# Seaport · 마켓플레이스 API 및 연동 가이드

Tokenable 마켓은 **Seaport 1.5** 스타일의 **오더 파라미터 + EIP-712 서명**을 백엔드 DB에 저장하고, **실제 자산 이동은 온체인 `Seaport.fulfillOrder`** 로 처리합니다.  
풀(컬렉션) 매수는 **별도 EIP-712(`TokenableCollectionBid`)** 로 오프체인 의사를 남긴 뒤, 특정 `tokenId`에 대해 **Seaport 매수 입찰(`side=bid`)** 으로 이어질 수 있습니다.

> **“언제 Seaport를 쓰고, 무엇에만 쓰는지”** 요약(대표·기획용): [SEAPORT_PROTOCOL_OVERVIEW.md](./SEAPORT_PROTOCOL_OVERVIEW.md)

---

## 1. Base URL · Swagger

| 항목 | 값 |
|------|-----|
| API prefix | `/api` |
| 로컬 예시 | `http://localhost:4000/api` |
| Swagger UI | `{호스트}/api/docs` (`marketplace` 태그) |

프론트엔드 래퍼: `frontend/lib/api.ts` (`getApiUrl()` 기준).

---

## 2. 개념 정리

### 2.1 오프체인 주문 레코드 (`orders` 테이블)

- **등록 시** 클라이언트가 **Seaport `OrderComponents`에 대응하는 JSON** + **EIP-712 서명**을 보냅니다.
- 백엔드는 **온체인 트랜잭션을 대신 실행하지 않습니다.** DB에만 저장합니다.
- **`orderHash`**: 이 저장소에서는 `MarketplaceService.deriveOrderHash()`로 **내부 식별자**를 만듭니다 (`side`, `offerer`, `salt`, `counter`, `startTime`, `endTime` 등을 JSON 직렬화 후 **SHA-256**). **Seaport 프로토콜이 정의하는 canonical order hash와 동일하다고 가정하면 안 됩니다.** API·UI에서는 동일 필드를 `orderHash`로 사용합니다.

### 2.2 `side`: `ask` vs `bid`

| side | 의미 | `offerer` | 대표 offer / consideration |
|------|------|-----------|----------------------------|
| **ask** (기본) | 매도 리스팅 | 판매자 | offer: ERC-721 NFT → consideration: USDC → 판매자 |
| **bid** | 매수 입찰 | 구매자(입찰 서명자) | offer: USDC → consideration: ERC-721 NFT → `offerer`(구매자) |

`side=bid` 일 때 백엔드는 `assertValidBid`로 **offer가 ERC20(USDC), consideration이 ERC721, tokenId 일치** 등을 검증합니다.

### 2.3 풀 입찰(`bucket_bids`) vs Seaport

- **풀 입찰**: 같은 카드·등급 **버킷**에 대한 **컬렉션 단위** 의사. **EIP-712 `TokenableCollectionBid`** 서명 검증 후 DB 저장.
- **체결**: 특정 `tokenId`에 대해 **Seaport 매수 입찰**을 올리고(`POST /marketplace/orders`, `side=bid`, `bucketBidId` 연결), 이후 **fulfill** 흐름으로 이어집니다.

---

## 3. 온체인 (Seaport)

| 항목 | 값 |
|------|-----|
| Seaport v1.5 주소 | `0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC` (EVM 공통, `frontend/constants/contracts.ts` 의 `SEAPORT_ADDRESS`) |
| 사용 함수 | `getCounter(address offerer)`, `fulfillOrder(...)` |
| USDC | `NEXT_PUBLIC_USDC_CONTRACT_ADDRESS` (예: Sepolia Circle USDC) |
| NFT | `NEXT_PUBLIC_NFT_CONTRACT_ADDRESS` (Tokenable_RWA ERC-721) |

**일반적 순서**

1. 서명 전: `getCounter(offerer)` 로 **counter** 를 읽어 `parameters`에 넣고 EIP-712 서명.
2. 매도 이행: 구매자가 `fulfillOrder` 로 **ask** 이행 (NFT + USDC 이동은 Seaport 규칙 따름).
3. 매수 입찰 수락: 판매자가 구매자의 **bid** 에 대해 `fulfillOrder` (역할은 주문 구조에 따름).

트랜잭션 성공 후 앱이 **`PATCH /marketplace/orders/:hash/fulfill`** 로 DB 상태를 `fulfilled`로 맞춥니다.

---

## 4. EIP-712 스키마

### 4.1 Seaport 주문 (리스팅 / 매수 입찰)

- **Domain**: Seaport 표준 — `name: "Seaport"`, `version: "1.5"`, `chainId`, `verifyingContract: SEAPORT_ADDRESS`
- **Types**: `OrderComponents` 등 Seaport 1.5 규격 (프론트: `SEAPORT_ORDER_TYPES` in `constants/contracts.ts` 등)

### 4.2 풀 입찰 — `TokenableCollectionBid`

백엔드 검증: `backend/src/marketplace/collection-bid.eip712.ts`

| 필드 | 타입 | 설명 |
|------|------|------|
| `bucketKey` | `bytes32` | 64 hex 문자 bucket key → `0x` + 32 bytes |
| `considerationAmount` | `uint256` | USDC 최소 단위 |
| `endTime` | `uint256` | 만료 Unix 초 |
| `buyer` | `address` | 매수자 |
| `nonce` | `uint256` | 매수자별 유일 |

**Domain**: `name: "TokenableCollectionBid"`, `version: "1"`, `chainId`, `verifyingContract: 0x000…000`  
프론트 상수: `frontend/lib/collectionBidTypedData.ts` (`COLLECTION_BID_DOMAIN`, `COLLECTION_BID_TYPES`).

---

## 5. REST API — Seaport 주문 (`/api/marketplace/orders`)

### 5.1 `POST /marketplace/orders`

**요약**: Seaport 서명 주문 등록 (오프체인).

**Body** (`CreateOrderDto`)

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `parameters` | object | ✓ | Seaport order parameters (`offerer`, `zone`, `zoneHash`, `startTime`, `endTime`, `orderType`, `offer[]`, `consideration[]`, `totalOriginalConsiderationItems`, `salt`, `conduitKey`, `counter`) |
| `signature` | string | ✓ | 위 parameters에 대한 EIP-712 서명 |
| `tokenContract` | address | ✓ | NFT 컨트랙트 |
| `tokenId` | string | ✓ | NFT tokenId |
| `considerationToken` | address | ✓ | 결제 토큰 (USDC) |
| `considerationAmount` | string | ✓ | 결제 금액 (wei 문자열) |
| `side` | `"ask"` \| `"bid"` | | 생략 시 `ask` |
| `bucketBidId` | number | | **`side=bid` 일 때만** 유효. 풀 입찰과 연결 시 서버가 금액·구매자·버킷 일치 검증 (`assertPoolBidMatchesSeaportBid`) |

**동작**

- `side=bid` 이면 구조 검증 (`assertValidBid`).
- `bucketBidId` 가 있으면 풀 입찰과 충돌 없는지·중복 활성 bid 없는지 확인.
- `orderHash` 생성 후 저장. `collectionKey` 는 ask 시 컬렉션 서비스로 보강될 수 있음.

**에러 예**: 검증 실패 `400`, 동일 hash 충돌 `409`.

---

### 5.2 `GET /marketplace/orders`

- **활성 매도(ask)** 만 반환 (`expire` 처리 후).
- 정렬: `createdAt` 내림차순.

---

### 5.3 `GET /marketplace/orders/token/:tokenId`

- 해당 토큰의 **전체 주문 이력** (active / fulfilled / cancelled / expired).

---

### 5.4 `GET /marketplace/orders/bids/token/:tokenId`

- **활성 매수 입찰**만, USDC 금액 기준 **내림차순**.

---

### 5.5 `GET /marketplace/orders/:hash`

- `orderHash` 단건. 프론트는 이 데이터로 **온체인 `fulfillOrder` 인자**를 구성합니다.

---

### 5.6 `PATCH /marketplace/orders/:hash/cancel?callerAddress=`

- **offerer 만** 취소 가능 (`status → cancelled`).
- ask: 판매자, bid: 입찰자.

---

### 5.7 `PATCH /marketplace/orders/:hash/fulfill`

- 온체인 `fulfillOrder` **성공 후** 호출.
- `status → fulfilled`, 연결된 **`bucketBidId` 가 있으면** 풀 입찰 `FULFILLED` + `fulfilledTokenId` 설정.
- **같은 tokenId 의 다른 활성 ask/bid** 는 정리(cancelled)되어 UI 일관성 유지.

---

### 5.8 `PATCH /marketplace/orders/:hash/reactivate?callerAddress=`

- **offerer** 만. on-chain revert 등으로 DB만 잘못됐을 때 **`fulfilled`/`cancelled` → `active`** 복구.
- **`expired` 는 복구 불가.**

---

## 6. REST API — 컬렉션 (오더북 데이터)

### 6.1 `GET /marketplace/collections`

- 메타 기준 컬렉션 요약 (활성 리스팅 수 등).

### 6.2 `GET /marketplace/collections/:key`

- `collectionKey` (64 hex) 단건.
- 응답에 **listings**(활성 ask), **poolBids**, **seaportBids**(활성 bid), **representativeImageUrl** 등 포함.

---

## 7. REST API — 풀 입찰 (`/api/marketplace/bucket-bids`)

### 7.1 `GET /marketplace/bucket-bids/by-token/:tokenId`

- IPFS 메타 `properties.graded` 등으로 **버킷 키·components** 계산 후, 해당 버킷의 **활성 풀 입찰** 목록.

---

### 7.2 `POST /marketplace/bucket-bids`

**Body** (`CreateBucketBidDto`)

| 필드 | 설명 |
|------|------|
| `tokenId` | 권장: 서버가 메타에서 버킷 계산 |
| `bucketKey` + `components` | `tokenId` 없이 보낼 때 — `bucketKey`가 components와 일치해야 함 |
| `considerationAmount` | USDC 최소 단위 (문자열) |
| `endTime` | 만료 Unix **초** |
| `buyerOfferer` | 매수자 주소 |
| `signature` | `TokenableCollectionBid` EIP-712 |
| `nonce` | 매수자별 유일 (재사용 시 `409`) |

서버: 서명 검증 후 `bucket_bids` 행 저장.

---

### 7.3 `POST /marketplace/bucket-bids/:id/prepare-fulfill`

**Body**: `{ "tokenId": "<string>" }`

**응답** (요지)

- `match`: 해당 NFT 메타 버킷이 입찰 `bucketKey` 와 같은지.
- `parametersDraft`: 구매자가 Seaport 입찰에 넣을 **초안** (`counter` 제외 — 클라이언트가 `getCounter`로 병합).
- `bucketBid`, `chainId`, `usdcAddress`, `nftContract`, `buyerMessage` 등.

구매자는 이걸로 **counter 병합 → EIP-712 Seaport 서명 → `POST /marketplace/orders`** (`side=bid`, `bucketBidId`).

---

### 7.4 `PATCH /marketplace/bucket-bids/:id/cancel?callerAddress=`

- **풀 입찰자(`buyerOfferer`)만** 취소.

---

### 7.5 `POST /marketplace/bucket-bids/:id/validate-seller`

**Body**: `{ "tokenId": "<string>", "sellerAddress": "0x..." }`

- 온체인 **소유자**가 `sellerAddress` 인지, 버킷이 입찰과 일치하는지 검사.
- 판매자 UI **Check match** 용.

---

## 8. 프론트엔드 함수 매핑 (`frontend/lib/api.ts`)

| 함수 | HTTP |
|------|------|
| `getActiveOrders` | GET `/marketplace/orders` |
| `getOrderByTokenId` | (내부적으로 GET orders 후 필터) |
| `getActiveBidsForToken` | GET `/marketplace/orders/bids/token/:tokenId` |
| `getOrderHistoryByTokenId` | GET `/marketplace/orders/token/:tokenId` |
| `getOrderByHash` | GET `/marketplace/orders/:hash` |
| `createOrder` | POST `/marketplace/orders` |
| `cancelOrder` | PATCH `/marketplace/orders/:hash/cancel` |
| `fulfillOrderApi` | PATCH `/marketplace/orders/:hash/fulfill` |
| `getMarketplaceCollections` | GET `/marketplace/collections` |
| `getMarketplaceCollectionDetail` | GET `/marketplace/collections/:key` |
| `getBucketBidsByToken` | GET `/marketplace/bucket-bids/by-token/:tokenId` |
| `createPoolBid` | POST `/marketplace/bucket-bids` |
| `cancelPoolBid` | PATCH `/marketplace/bucket-bids/:id/cancel` |
| `validatePoolBidSellerMatch` | POST `/marketplace/bucket-bids/:id/validate-seller` |
| `preparePoolBidFulfillment` | POST `/marketplace/bucket-bids/:id/prepare-fulfill` |

**참고**: `reactivateOrder` 는 현재 `api.ts` 에 래퍼 없음 — 필요 시 동일 패턴으로 추가.

---

## 9. UI 컴포넌트 참고 (Seaport 관련)

| 위치 | 역할 |
|------|------|
| `frontend/components/marketplace/ListNftModal.tsx` | 매도 ask 생성·서명 |
| `frontend/components/marketplace/PlaceBidModal.tsx` | 일반 매수 bid |
| `frontend/components/marketplace/SignPoolBidSeaport.tsx` | 풀 연결 Seaport bid (`preparePoolBidFulfillment` → `createOrder`) |
| `frontend/app/marketplace/[tokenId]/page.tsx` | `fulfillOrder` 호출, 이후 `fulfillOrderApi` |

---

## 10. 관련 문서

- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) — 전체 API 요약 표
- [BACKEND_API.md](./BACKEND_API.md) — 백엔드 상세(있는 경우)
- Swagger: **`/api/docs`** — DTO·스키마 최신 기준

---

*이 문서는 저장소의 `marketplace.controller.ts`, `marketplace.service.ts`, `bucket-bid.service.ts`, `create-order.dto.ts`, `frontend/lib/api.ts` 를 기준으로 작성되었습니다. 동작 변경 시 코드와 Swagger를 우선 확인하세요.*
