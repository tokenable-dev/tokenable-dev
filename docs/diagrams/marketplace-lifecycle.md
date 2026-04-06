# Tokenable 마켓플레이스 라이프사이클 (민트 · 리스팅 · 입찰 · 체결)

> GitHub / 대부분의 Markdown 뷰어에서 Mermaid 렌더링.  
> Seaport v1.5 + 오프체인 오더북(백엔드) + 온체인 `fulfillOrder` / `matchAdvancedOrders` 기준.

---

## 전체 흐름 (한 눈에)

```mermaid
flowchart TB
  subgraph mint["① NFT 민팅"]
    M1[메타데이터 작성·PSA OCR 등] --> M2[POST /rwa/upload → IPFS tokenURI]
    M2 --> M3[지갑: ERC-721 mint to, tokenURI]
    M3 --> M4[(온체인 Tokenable_RWA)]
  end

  subgraph list["② 판매 등록 (Ask)"]
    L1[리스트 UI: 가격 USDC] --> L2{Seaport에 NFT 위임됨?}
    L2 -->|아니오| L3[지갑: setApprovalForAll Seaport, true]
    L2 -->|예| L4[EIP-712 서명: OrderComponents ask]
    L3 --> L4
    L4 --> L5[POST marketplace createOrder side=ask]
    L5 --> L6[(백엔드 orders + 서명 보관)]
  end

  subgraph bid["③ 구매 의사 (Bid)"]
    B1{종류} --> B2[토큰 상세: 풀 ERC-721 bid]
    B1 --> B3[컬렉션: ERC721_WITH_CRITERIA bid + Merkle root]
    B2 --> B4[USDC approve + 서명 + createOrder]
    B3 --> B5[Merkle leaves = 활성 리스팅 tokenIds]
    B5 --> B6[USDC approve + 서명 + createOrder]
    B4 --> B7[(백엔드 orders)]
    B6 --> B7
  end

  subgraph settle["④ 체결"]
    S1{경로} --> S2[매수: fulfillOrder 리스팅 주문]
    S2 --> S3[지갑: USDC approve → Seaport fulfillOrder]
    S3 --> S4[(NFT·USDC 이동)]
    S2 --> S5[POST fulfill 주문 상태 갱신]
    S5 --> S4

    S1 --> S6[크리테리아: matchAdvancedOrders]
    S6 --> S7[판매자 리스팅 + 입찰 주문 + merkle proof]
    S7 --> S8[지갑: matchAdvancedOrders]
    S8 --> S4
    S6 --> S9[POST fulfill-matched-pair 등]
    S9 --> S4
  end

  M4 --> L1
  L6 --> B1
  B7 --> S1
```

---

## 민팅 (상세)

```mermaid
sequenceDiagram
  participant U as 사용자
  participant FE as 프론트
  participant BE as 백엔드
  participant IPFS as IPFS
  participant CH as Sepolia

  U->>FE: Mint 폼 제출
  FE->>BE: POST /rwa/upload (메타·이미지)
  BE->>IPFS: Pin
  BE-->>FE: tokenURI
  FE->>CH: mint(to, tokenURI)
  CH-->>FE: tx / tokenId
```

---

## 판매 등록 Ask (상세)

```mermaid
sequenceDiagram
  participant U as 판매자
  participant FE as 프론트
  participant CH as Sepolia
  participant BE as 백엔드

  U->>FE: 가격 입력 · 리스트
  FE->>CH: isApprovedForAll? → setApprovalForAll Seaport true (1회)
  FE->>U: EIP-712 Seaport OrderComponents 서명
  U-->>FE: signature
  FE->>BE: POST createOrder ask + parameters + signature
  BE-->>FE: order 저장 (orderHash 등)
```

---

## 컬렉션 입찰 Bid (크리테리아 + Merkle)

```mermaid
sequenceDiagram
  participant U as 입찰자
  participant FE as 프론트
  participant BE as 백엔드
  participant CH as Sepolia

  FE->>BE: GET merkle-set (활성 리스팅 tokenIds)
  BE-->>FE: tokenIds[]
  FE->>FE: Seaport Merkle tree → root
  FE->>CH: allowance USDC? → approve max (필요 시)
  FE->>U: EIP-712 bid consideration = criteria + root
  U-->>FE: signature
  FE->>BE: POST createOrder bid + collectionKey
```

---

## 체결: 일반 매수 vs 크리테리아 매칭

```mermaid
flowchart LR
  subgraph buy["고정 리스팅 매수"]
    A1[활성 ask 주문 조회] --> A2[USDC approve]
    A2 --> A3[fulfillOrder]
    A3 --> A4[PATCH/fulfill API]
  end

  subgraph crit["컬렉션 입찰 체결"]
    C1[판매자: 리스팅 tokenId + 입찰 주문] --> C2[Merkle proof]
    C2 --> C3[matchAdvancedOrders]
    C3 --> C4[fulfill-matched-pair API]
  end
```

---

## 범례 / 구현 메모

| 단계 | 온체인 | 오프체인 (백엔드) |
|------|--------|-------------------|
| 민팅 | `mint` | IPFS 업로드 |
| Ask | `setApprovalForAll`, 서명 | 주문 저장·노출 |
| Bid | USDC `approve`, 서명 | 주문 저장·Merkle 집합 |
| 체결 | `fulfillOrder` 또는 `matchAdvancedOrders` | 상태·히스토리 |

Seaport 도메인: `name=Seaport`, `version=1.5`, `verifyingContract=Seaport 1.5 주소`.
