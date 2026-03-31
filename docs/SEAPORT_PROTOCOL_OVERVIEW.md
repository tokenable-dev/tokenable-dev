# Seaport 프로토콜 — 프로젝트 내 사용 범위 (요약)

대표·기획용으로, **현재 Tokenable 코드베이스에서 Seaport가 “언제·어떤 구조로·무엇에만” 쓰이는지**만 정리합니다.  
API·필드 상세는 [SEAPORT_API.md](./SEAPORT_API.md), Swagger `/api/docs` 를 참고하세요.

---

## 1. 한 줄 요약

**Seaport 1.5**는 이 프로젝트에서 **“NFT(ERC-721)와 USDC를 맞바꾸는 주문”을 표현·서명·체결하기 위한 온체인 프로토콜**으로만 사용합니다.  
**민팅**, **풀(컬렉션) 입찰 등록 자체**, **IPFS 업로드**에는 Seaport를 쓰지 않습니다.

---

## 2. Seaport를 쓰는 경우 (3가지)

| 구분 | 용도 | 누가 서명 | 이후 온체인 |
|------|------|-----------|-------------|
| **매도 리스팅 (ask)** | 특정 `tokenId` NFT를 USDC 가격에 **판매 올리기** | **판매자** (offerer) | 구매자가 `fulfillOrder`로 매입 시 NFT·USDC 이동 |
| **일반 매수 입찰 (bid)** | 특정 `tokenId`에 대해 USDC로 **사겠다는 입찰** | **구매자** (offerer) | 판매자가 `fulfillOrder`로 입찰 수락 시 체결 |
| **풀 연결 매수 입찰 (bid + bucketBidId)** | 풀(컬렉션) 단계에서 합의된 조건을 **특정 토큰에 대한 Seaport 입찰**으로 구체화 | **구매자** (풀 매수자) | 판매자가 `fulfillOrder`로 체결 (풀 입찰과 DB로 연결) |

공통점:

- 주문 내용은 **EIP-712(Seaport 도메인)** 로 서명되고,
- **백엔드 DB(`orders`)에 저장**되어 마켓 UI·매칭에 쓰이며,
- **실제 자산 이동은 사용자 지갑이 `Seaport.fulfillOrder` 트랜잭션**을 보낼 때 일어납니다.

---

## 3. Seaport를 쓰지 않는 경우 (구분용)

| 기능 | 사용하는 것 |
|------|-------------|
| **NFT 민팅** | Tokenable_RWA 컨트랙트 **`mint`** 직접 호출 (Seaport 아님) |
| **풀 입찰 “등록”** (버킷 단위, tokenId 비특정) | **별도 EIP-712 `TokenableCollectionBid`** + DB `bucket_bids` (Seaport 주문 아님) |
| **메타데이터·이미지 저장** | 백엔드 `/nft/upload` → IPFS 등 (Seaport 무관) |
| **버킷/컬렉션 키 계산** | 서버 메타 로직 (Seaport 무관) |

정리: **풀 입찰은 처음에 Seaport가 아니라 “컬렉션 단위 약속”**이고, **특정 NFT로 팔기/사기로 갈 때** 그때 **Seaport `bid`** 가 등장합니다.

---

## 4. 구조 (레이어)

```
[사용자 지갑]
    │  EIP-712 서명 (Seaport OrderComponents)
    ▼
[백엔드 API]  POST /marketplace/orders
    │  parameters + signature → PostgreSQL `orders`
    ▼
[마켓 UI]  활성 ask / bid 조회, 가격 표시
    │
    │  체결 시
    ▼
[사용자 지갑]  Seaport.fulfillOrder(...)   ← 가스는 트랜잭션을 보낸 쪽
    │
    ▼
[백엔드]  PATCH /marketplace/orders/:hash/fulfill  → DB 상태 fulfilled
```

- **Seaport 컨트랙트**: 고정 주소 **Seaport v1.5** (`0x0000…14dC`, 네트워크별 동일 패턴).  
- **우리 백엔드는 Seaport 트랜잭션을 대신 실행하지 않음** — DB 동기화·검증만.

---

## 5. 용도만의 경계 (이 프로젝트 기준)

| O (Seaport 사용) | X (Seaport 미사용) |
|------------------|---------------------|
| ERC-721 NFT ↔ ERC20(USDC) **스왑 조건**을 주문으로 걸기 | 단순 USDC 전송만 |
| **리스팅·입찰·체결** 흐름 | **민트**, **풀 등록(EIP-712 CollectionBid)** |
| `getCounter` → 서명 → `fulfillOrder` | PSA 분석, 가격 API, OAuth |

---

## 6. 관련 문서

| 문서 | 내용 |
|------|------|
| [SEAPORT_API.md](./SEAPORT_API.md) | REST 엔드포인트, DTO, 풀 `prepare-fulfill`, 프론트 함수 매핑 |
| `docs/diagrams/tokenable-all-diagrams.drawio` | **통합 Draw.io (7탭)** — **04-D-Seaport** (D1~D4), **05·06-E-E2E** (E0~E8), **01-A** (A1~A4), 등 |
| `frontend/constants/contracts.ts` | `SEAPORT_ADDRESS`, ABI 일부 |

---

*이 문서는 현재 저장소 구현을 기준으로 작성되었습니다. 프로토콜 범위를 넓히면(예: 다른 itemType, zone) 본 문서와 코드를 함께 갱신하세요.*
