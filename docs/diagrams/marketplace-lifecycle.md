# Tokenable 마켓플레이스 — 전체 파이프라인

> Seaport v1.5 · 오프체인 오더북(백엔드) · 온체인 `fulfillOrder` / `matchAdvancedOrders` 기준

> **Update (2026-06):** Relational matching removed. **Eight DB tables** including `portfolio_hidden_holdings`. [database.md](../architecture/database.md) · [materialized-market-snapshots.md](../architecture/materialized-market-snapshots.md) · [api/marketplace.md](../api/marketplace.md)
>
> **HTTP 경로 표기:** 아래 시퀀스의 `POST /api/...` 는 Nest 글로벌 프리픽스 **`api`** 를 포함한 전체 경로입니다. 전체 API 개요는 **[api/README.md](../api/README.md)**.

---

## Part 1 — 전체 흐름도

```mermaid
%%{init: {'flowchart': {'rankSpacing': 60, 'nodeSpacing': 40, 'padding': 24}}}%%
flowchart TD
    classDef mint  fill:#0c1e33,stroke:#60a5fa,color:#bfdbfe,padding:10px 18px
    classDef list  fill:#0a2215,stroke:#4ade80,color:#dcfce7,padding:10px 18px
    classDef buy   fill:#1f1a00,stroke:#fbbf24,color:#fef3c7,padding:10px 18px
    classDef bid   fill:#280a18,stroke:#f472b6,color:#fce7f3,padding:10px 18px
    classDef match fill:#1a0a2e,stroke:#c084fc,color:#f3e8ff,padding:10px 18px
    classDef gate  fill:#111827,stroke:#6b7280,color:#e5e7eb,padding:10px 18px
    classDef done  fill:#052e12,stroke:#4ade80,color:#dcfce7,padding:10px 18px

    START(["시작"])

    %% ① 발행 ──────────────────────────────────────────────────────
    subgraph G1 ["① 발행  ·  Mint"]
        M1["PSA 카드 업로드"]
        M2["PSA 등급 분석(OCR)"]
        M3["IPFS 메타데이터 저장"]
        M4["🔗 ERC-721 토큰 발행"]
        M1 --> M2 --> M3 --> M4
    end

    %% ② 판매 등록 ──────────────────────────────────────────────────
    subgraph G2 ["② 판매 등록  ·  Ask Listing"]
        L1["판매가 설정"]
        L2["🔗 Seaport NFT 위임"]
        L3["✍️ 매도 주문 서명"]
        L4["💾 판매 등록 완료"]
        L1 --> L2 --> L3 --> L4
    end

    %% 분기점 ───────────────────────────────────────────────────────
    FORK(["다음 행동 선택"])

    %% ③ 즉시 구매 ──────────────────────────────────────────────────
    subgraph G3 ["③ 즉시 구매  ·  Instant Buy"]
        F1["가격 비교"]
        F2["🔗 USDC 승인"]
        F3["🔗 온체인 주문 체결"]
        F4["💾 체결 완료"]
        F1 --> F2 --> F3 --> F4
    end

    %% ④ 구매 입찰 ──────────────────────────────────────────────────
    subgraph G4 ["④ 구매 입찰  ·  Collection Bid"]
        B1["희망 매수가 입력"]
        B2["Merkle Tree 구성"]
        B3["🔗 USDC 승인"]
        B4["✍️ 입찰 주문 서명"]
        B5["💾 입찰 등록 완료"]
        B1 --> B2 --> B3 --> B4 --> B5
    end

    %% ⑤ 입찰 수락 ──────────────────────────────────────────────────
    subgraph G5 ["⑤ 입찰 수락  ·  Instant Match"]
        I1["가격 재조정 여부 확인"]
        I2["✍️ 가격 재조정 후 재서명"]
        I3["Merkle Proof 생성"]
        I4["🔗 온체인 오더 매칭"]
        I5["💾 양방향 체결 완료"]
        I1 -->|"가격 재조정 시"| I2 --> I3
        I1 -->|"가격 일치 시"| I3
        I3 --> I4 --> I5
    end

    CANCEL(["💾 주문 철회"])
    DONE(["거래 완료"])

    %% 섹션 간 연결 ─────────────────────────────────────────────────
    START --> M1
    M4    --> L1
    L4    --> FORK

    FORK -->|"즉시 구매"| F1
    FORK -->|"구매 입찰"| B1
    FORK -->|"주문 취소"| CANCEL

    F4 --> DONE
    B5 --> I1
    I5 --> DONE

    class M1,M2,M3,M4 mint
    class L1,L2,L3,L4 list
    class F1,F2,F3,F4 buy
    class B1,B2,B3,B4,B5 bid
    class I1,I2,I3,I4,I5 match
    class FORK,CANCEL gate

    style G1 fill:#060f1c,stroke:#60a5fa,stroke-width:3px,color:#93c5fd
    style G2 fill:#030f08,stroke:#4ade80,stroke-width:3px,color:#86efac
    style G3 fill:#0f0d00,stroke:#fbbf24,stroke-width:3px,color:#fde68a
    style G4 fill:#120510,stroke:#f472b6,stroke-width:3px,color:#f9a8d4
    style G5 fill:#090514,stroke:#c084fc,stroke-width:3px,color:#d8b4fe

    %% 레이블 화살표 색상 — 목적지 섹션 테마 색 적용
    %% 링크 인덱스: 0-12 서브그래프 내부, 13·15 G5 분기, 18-20 섹션 간, 21-23 FORK 분기
    linkStyle 13 stroke:#c084fc,stroke-width:2px,color:#d8b4fe
    linkStyle 15 stroke:#c084fc,stroke-width:2px,color:#d8b4fe
    linkStyle 21 stroke:#fbbf24,stroke-width:2px,color:#fde68a
    linkStyle 22 stroke:#f472b6,stroke-width:2px,color:#f9a8d4
    linkStyle 23 stroke:#6b7280,stroke-width:2px,color:#d1d5db
```

---

## Part 2 — 기술 시퀀스 다이어그램

```mermaid
sequenceDiagram
    actor U   as 👤 사용자
    participant A   as 💻 App
    participant S   as 🖥️ Server
    participant DB  as 🗄️ Database
    participant C   as ⛓️ Blockchain

    rect rgba(147, 197, 253, 0.15)
        Note over U,C: ① 발행 · Mint
        U  ->> A  : 카드 이미지 + 정보 입력
        A  ->> S  : POST /api/psa/analyze
        S -->> A  : 등급 정보 반환
        A  ->> S  : POST /api/rwa/upload → IPFS
        S -->> A  : tokenURI (IPFS CID)
        A  ->> C  : ERC721.mint(address, tokenURI)
        C -->> U  : 🎉 tokenId 발급
        A  ->> S  : POST /api/marketplace/collections/on-mint { tokenId }
        S  ->> DB : UPSERT marketplace_collections<br/>+ UPSERT rwa_tokens<br/>+ Cardhedger cert → cardId
        S -->> A  : { collectionKey, bootstrapped }
        Note over A: React Query prefetch<br/>platform-trades · snapshots · mint preview
        Note over DB: 선택적 on-chain Minted 리스너<br/>(MINT_EVENT_LISTENER_ENABLED=1, 동일 핸들러)
    end

    rect rgba(134, 239, 172, 0.15)
        Note over U,C: ② 판매 등록 · Ask Listing
        U  ->> A  : 판매가 입력
        A  ->> C  : ERC721.isApprovedForAll(Seaport)
        alt 미승인
            A  ->> C  : ERC721.setApprovalForAll(Seaport, true)
        end
        A  ->> C  : Seaport.getCounter(seller)
        A -->> U  : 🖊️ MetaMask 서명 요청 — EIP-712 매도 주문
        U  ->> A  : 서명 승인
        A  ->> S  : POST /api/marketplace/orders [side: ask]
        S  ->> DB : INSERT orders … + UPSERT marketplace_collections<br/>+ UPSERT rwa_tokens
        Note over S,DB: mint 시 on-mint로 이미 생성된 경우 idempotent
        S -->> A  : ASK ACTIVE
    end

    rect rgba(252, 165, 165, 0.15)
        Note over U,C: ③ 구매 입찰 · Collection Bid
        U  ->> A  : 희망 매수가 입력
        Note over A: SeaportMerkleTree(activeAsks)<br/>→ identifierOrCriteria: merkleRoot
        A  ->> C  : USDC.approve(Seaport, maxUint256)
        A  ->> C  : Seaport.getCounter(buyer)
        A -->> U  : 🖊️ MetaMask 서명 요청 — EIP-712 매수 주문
        U  ->> A  : 서명 승인
        A  ->> S  : POST /api/marketplace/orders [side: bid]
        S  ->> DB : INSERT orders<br/>{order_hash, offerer, side:bid,<br/>token_id:"0"(criteria sentinel),<br/>consideration_amount(입찰가),<br/>parameters(merkleRoot 포함 jsonb),<br/>signature, status:active,<br/>collection_key}
        S -->> A  : BID ACTIVE
    end

    rect rgba(250, 204, 21, 0.12)
        Note over U,C: ④ 즉시 구매 · Instant Buy  (입력가 ≥ 최저 매도가)
        Note over A: pickLowestActiveAsk() → runInstantPurchase(ask)
        A  ->> C  : USDC.approve(Seaport, askPrice)
        A  ->> C  : Seaport.fulfillOrder(orderParams, extraData)
        C -->> U  : 💸 NFT → 구매자 / USDC → 판매자
        A  ->> S  : PATCH /api/marketplace/orders/:hash/fulfill
        S  ->> DB : UPDATE orders<br/>SET status=fulfilled<br/>WHERE order_hash=:hash
        S  ->> DB : UPDATE orders<br/>SET status=cancelled<br/>WHERE token_contract=:contract<br/>AND token_id=:id<br/>AND status=active AND id≠fulfilled_id
        S -->> A  : FULFILLED
    end

    rect rgba(192, 132, 252, 0.15)
        Note over U,C: ⑤ 입찰 수락 · Instant Match  (판매자 → 구매자 비드 수락)
        U  ->> A  : Order Book → Match 클릭
        opt 리스팅가 > 입찰가  (needsReprice = true)
            A -->> U  : 🖊️ MetaMask 서명 요청 — 재리스팅 EIP-712
            U  ->> A  : 서명 승인
            A  ->> S  : POST /api/marketplace/orders/replace-listing
            S  ->> DB : UPDATE orders SET status=cancelled<br/>WHERE order_hash=:oldHash
            S  ->> DB : INSERT orders<br/>{새 ask, status:active, 재조정된 consideration_amount}
            S -->> A  : 기존 CANCELLED · 신규 ASK ACTIVE
        end
        A  ->> S  : GET /api/marketplace/collections/:key/merkle-set
        S -->> A  : tokenIds[]
        Note over A: getCriteriaProof(tokenId)<br/>buildCriteriaMatchExecution()<br/>simulateContract 사전 검증
        A  ->> C  : Seaport.matchAdvancedOrders(orders, proof, fulfillments)
        C -->> U  : 💸 NFT → 구매자 / USDC → 판매자
        A  ->> S  : POST /api/marketplace/orders/fulfill-matched-pair
        S  ->> DB : UPDATE orders<br/>SET status=fulfilled<br/>WHERE order_hash IN [askHash, bidHash]
        S  ->> DB : UPDATE orders<br/>SET status=cancelled<br/>WHERE token_contract=:contract<br/>AND token_id=:id<br/>AND status=active (나머지 전부 취소)
        S -->> A  : ask + bid FULFILLED
    end

    rect rgba(251, 146, 60, 0.12)
        Note over U,C: ⑥ 주문 취소 · Cancel
        U  ->> A  : 취소 버튼 클릭
        A  ->> S  : PATCH /api/marketplace/orders/:hash/cancel?callerAddress=...
        S  ->> DB : UPDATE orders<br/>SET status=cancelled<br/>WHERE order_hash=:hash AND offerer=:caller
        S -->> A  : CANCELLED
    end
```

---

## Part 3 — DB 저장 구조 및 상태 전이

> 애플리케이션 DB는 **7개 테이블**입니다. PostgreSQL FK는 없고, 키는 앱에서 논리적으로 연결합니다.
> **전체 컬럼 ER 다이어그램(최신):** [architecture/database.md](../architecture/database.md#schema-overview)

### 3-1. 테이블 구조 (관계 요약)

```mermaid
erDiagram
    users {
        uuid id PK
        varchar wallet_address UK
    }
    psa_cert_snapshots {
        varchar cert_number PK
    }
    marketplace_collections {
        varchar collection_key PK
        varchar psa_cert_number
    }
    collection_market_snapshots {
        varchar collection_key PK
    }
    rwa_tokens {
        varchar token_contract PK
        varchar token_id PK
        varchar collection_key
    }
    orders {
        serial id PK
        varchar order_hash UK
        varchar offerer
        varchar collection_key
        varchar token_contract
        varchar token_id
    }
    portfolio_daily_snapshots {
        serial id PK
        varchar wallet_address
        date snapshot_date_kst UK
    }

    marketplace_collections ||--o| collection_market_snapshots : "bucket pricing"
    marketplace_collections ||--o{ orders : "collection_key"
    marketplace_collections ||--o{ rwa_tokens : "collection_key"
    marketplace_collections }o--o| psa_cert_snapshots : "psa_cert_number"
    rwa_tokens ||--o{ orders : "token"
    users |o--o{ orders : "offerer"
    users |o--o{ portfolio_daily_snapshots : "wallet optional"
```

### 3-2. 언제, 어떤 데이터가 저장되는가

```mermaid
flowchart LR
    classDef ins  fill:#0a2215,stroke:#4ade80,color:#dcfce7,padding:8px 16px
    classDef upd  fill:#1f1a00,stroke:#fbbf24,color:#fef3c7,padding:8px 16px
    classDef del  fill:#280a18,stroke:#f472b6,color:#fce7f3,padding:8px 16px
    classDef head fill:#111827,stroke:#6b7280,color:#e5e7eb,padding:8px 16px
    classDef note fill:#1e1b4b,stroke:#818cf8,color:#c7d2fe,padding:8px 16px

    subgraph OP0 ["민트 확정"]
        OP0H["온체인 Minted 이벤트 후<br/>POST /collections/on-mint"]:::head
        OP0A["📁 컬렉션 자동 생성/갱신<br/>· 컬렉션 키 + PSA cert<br/>· Cardhedger cardId (가능 시)<br/>· 스냅샷·커버 작업 큐"]:::ins
        OP0B["📇 rwa_tokens 등록<br/>· tokenId → collection_key"]:::ins
        OP0H --> OP0A
        OP0H --> OP0B
    end

    subgraph OP1 ["판매 등록"]
        OP1H["사용자가 판매가를 설정하고<br/>서명을 완료하면"]:::head
        OP1A["📝 주문 데이터 신규 저장<br/>· 주문 해시 (order_hash)<br/>· 판매자 지갑 (offerer)<br/>· 유형: ask<br/>· NFT 정보 (contract + token_id)<br/>· 판매가 (consideration_amount)<br/>· Seaport 주문 원본 (parameters)<br/>· 서명값 (signature)<br/>· 상태: active"]:::ins
        OP1B["📁 컬렉션 자동 생성/갱신<br/>· 컬렉션 키 + 이름<br/>· 카드 등급 구성 정보<br/>· 대표 이미지"]:::ins
        OP1H --> OP1A
        OP1H --> OP1B
    end

    subgraph OP2 ["입찰 등록"]
        OP2H["구매자가 희망가를 입력하고<br/>서명을 완료하면"]:::head
        OP2A["📝 입찰 데이터 신규 저장<br/>· 주문 해시 (order_hash)<br/>· 구매자 지갑 (offerer)<br/>· 유형: bid<br/>· 입찰가 (consideration_amount)<br/>· Merkle Root 포함 주문 원본<br/>· 서명값 (signature)<br/>· 상태: active"]:::ins
        OP2H --> OP2A
    end

    subgraph OP3 ["즉시 구매 체결"]
        OP3H["온체인 거래가<br/>성공적으로 완료되면"]:::head
        OP3A["✅ 해당 주문<br/>상태 → fulfilled"]:::upd
        OP3B["🚫 같은 NFT의<br/>나머지 주문 → 전부 cancelled"]:::del
        OP3H --> OP3A
        OP3H --> OP3B
    end

    subgraph OP4 ["입찰 수락 체결"]
        OP4H["양방향 매칭이<br/>성공적으로 완료되면"]:::head
        OP4A["✅ 매도 + 매수 주문<br/>양쪽 모두 → fulfilled"]:::upd
        OP4B["🚫 같은 NFT의<br/>나머지 주문 → 전부 cancelled"]:::del
        OP4H --> OP4A
        OP4H --> OP4B
    end

    subgraph OP5 ["주문 철회"]
        OP5H["사용자가 본인의<br/>주문을 취소하면"]:::head
        OP5A["🚫 해당 주문<br/>상태 → cancelled<br/>(본인 지갑 확인 후)"]:::del
        OP5H --> OP5A
    end

    subgraph OP6 ["가격 재조정"]
        OP6H["입찰 수락 전<br/>판매가를 낮추면"]:::head
        OP6A["🚫 기존 판매 주문<br/>상태 → cancelled"]:::del
        OP6B["📝 새 판매 주문 생성<br/>· 조정된 판매가<br/>· 새 서명값<br/>· 상태: active"]:::ins
        OP6H --> OP6A
        OP6H --> OP6B
    end
```

> **색상 범례** — 🟢 초록: 신규 저장 (INSERT) · 🟡 노랑: 상태 갱신 (fulfilled) · 🔴 핑크: 취소 처리 (cancelled)

### 3-3. 주문 상태 변화

```mermaid
flowchart LR
    classDef st_new     fill:#1e3a5f,stroke:#60a5fa,color:#bfdbfe,stroke-width:2px,padding:12px 20px
    classDef st_active  fill:#052e12,stroke:#4ade80,color:#dcfce7,stroke-width:3px,padding:12px 20px
    classDef st_done    fill:#1f1a00,stroke:#fbbf24,color:#fef3c7,stroke-width:2px,padding:12px 20px
    classDef st_cancel  fill:#280a18,stroke:#f472b6,color:#fce7f3,stroke-width:2px,padding:12px 20px
    classDef st_expire  fill:#111827,stroke:#6b7280,color:#e5e7eb,stroke-width:2px,padding:12px 20px

    NEW(["📝 주문 생성<br/>판매 등록 · 입찰 등록"]):::st_new

    ACTIVE(["🟢 Active<br/>오더북에 노출 중"]):::st_active

    FULFILLED(["✅ Fulfilled<br/>거래 체결 완료"]):::st_done

    CANCELLED(["🚫 Cancelled<br/>주문 취소됨"]):::st_cancel

    EXPIRED(["⏰ Expired<br/>유효 기간 만료"]):::st_expire

    NEW -->|"판매 등록 또는<br/>입찰 등록 시"| ACTIVE

    ACTIVE -->|"즉시 구매 체결<br/>입찰 수락 체결"| FULFILLED
    ACTIVE -->|"사용자 직접 취소<br/>가격 재조정 시 기존 주문 폐기<br/>동일 NFT 거래 후 잔여 주문 정리"| CANCELLED
    ACTIVE -->|"만료 시각 경과 시<br/>자동 전환"| EXPIRED

    CANCELLED -.->|"재활성화"| ACTIVE
    FULFILLED -.->|"재활성화"| ACTIVE

    style NEW fill:#0d1b2a,stroke:#60a5fa,stroke-width:2px
    style ACTIVE fill:#052e16,stroke:#4ade80,stroke-width:3px
    style FULFILLED fill:#1a1500,stroke:#fbbf24,stroke-width:2px
    style CANCELLED fill:#200510,stroke:#f472b6,stroke-width:2px
    style EXPIRED fill:#0f1115,stroke:#6b7280,stroke-width:2px
```

---

## Part 4 — 프론트엔드 아키텍처

> Next.js App Router · React 19 · Wagmi · Zustand · TanStack Query 기반

### 4-1. 라우팅 및 페이지 구조

```mermaid
%%{init: {'flowchart': {'rankSpacing': 50, 'nodeSpacing': 30, 'padding': 20}}}%%
flowchart TD
    classDef page   fill:#0c1e33,stroke:#60a5fa,color:#bfdbfe,padding:8px 14px
    classDef detail fill:#1f1a00,stroke:#fbbf24,color:#fef3c7,padding:8px 14px
    classDef auth   fill:#111827,stroke:#6b7280,color:#9ca3af,padding:8px 14px
    classDef layout fill:#0a2215,stroke:#4ade80,color:#dcfce7,padding:8px 14px

    subgraph ROOT ["RootLayout"]
        direction TB
        HEADER["AppHeader<br/>SearchBar · WalletDropdown · Nav Links"]:::layout

        subgraph NAV ["메인 라우트"]
            direction LR
            HOME["/ <br/> Landing<br/>Market Indexes · Exchange 진입"]:::page
            EXCHANGE["/exchange<br/>컬렉션 허브<br/>Stats · Filters · Listings"]:::page
            VAULT["/vault<br/>Vault Tokenization<br/>Mint · My Assets"]:::page
            PORTFOLIO["/portfolio<br/>Portfolio Dashboard<br/>Chart · Inventory · History"]:::page
        end

        subgraph MARKET ["마켓플레이스 상세"]
            direction LR
            COLLECTION["/marketplace/collections/:key<br/>컬렉션 오더북<br/>Buy · Sell · Match"]:::detail
            TOKEN["/marketplace/:tokenId<br/>토큰 상세<br/>Order Book · Match Panel"]:::detail
            OTHER["/marketplace/other-listings<br/>미분류 리스팅"]:::detail
        end

        subgraph AUTHPAGES ["인증 (OAuth 대기)"]
            direction LR
            LOGIN["/login"]:::auth
            SIGNUP["/signup"]:::auth
            CALLBACK["/auth/callback"]:::auth
            PROFILE["/profile"]:::auth
        end
    end

    HEADER --> NAV
    EXCHANGE -->|"컬렉션 클릭"| COLLECTION
    EXCHANGE -->|"기타 리스팅"| OTHER
    COLLECTION -->|"토큰 클릭"| TOKEN
    PORTFOLIO -->|"자산 클릭"| TOKEN

    style ROOT fill:#030712,stroke:#374151,stroke-width:2px,color:#e5e7eb
    style NAV fill:#060f1c,stroke:#60a5fa,stroke-width:2px,color:#93c5fd
    style MARKET fill:#0f0d00,stroke:#fbbf24,stroke-width:2px,color:#fde68a
    style AUTHPAGES fill:#0f1115,stroke:#6b7280,stroke-width:1px,color:#6b7280
```

### 4-2. 컴포넌트 · 라이브러리 구조

```mermaid
%%{init: {'flowchart': {'rankSpacing': 40, 'nodeSpacing': 24, 'padding': 16}}}%%
flowchart TB
    classDef comp fill:#0a2215,stroke:#4ade80,color:#dcfce7,padding:6px 12px
    classDef lib  fill:#1a0a2e,stroke:#c084fc,color:#f3e8ff,padding:6px 12px
    classDef store fill:#280a18,stroke:#f472b6,color:#fce7f3,padding:6px 12px
    classDef ext  fill:#1f1a00,stroke:#fbbf24,color:#fef3c7,padding:6px 12px
    classDef prov fill:#0c1e33,stroke:#60a5fa,color:#bfdbfe,padding:6px 12px

    subgraph COMPONENTS ["Components"]
        direction TB

        subgraph C_LAYOUT ["layout/"]
            APPHEADER["AppHeader<br/>SearchBar · WalletDropdown"]:::comp
        end

        subgraph C_MINT ["mint/"]
            MINTFORM["MintForm<br/>PSA 분석 · IPFS · 민팅"]:::comp
            GRADED["GradedCardSection<br/>카드 정보 입력"]:::comp
            IMGPUT["ImageInput<br/>이미지 업로드"]:::comp
            MINTFORM --> GRADED --> IMGPUT
        end

        subgraph C_MARKET ["marketplace/"]
            UNIFIED["CollectionUnifiedOrderBook<br/>통합 오더북"]:::comp
            BIDPANEL["CollectionCriteriaBidPanel<br/>구매 · 입찰"]:::comp
            LISTMODAL["ListRwaModal<br/>판매 등록"]:::comp
            OWNEDMODAL["CollectionOwnedRwaListModal<br/>보유 자산 리스팅"]:::comp
            TOKENDETAIL["RwaDetailAssetPanel<br/>토큰 상세 · Zoom"]:::comp
            ORDERBOOK["RwaOrderBook<br/>토큰별 오더북"]:::comp
            MATCHPANEL["TokenCriteriaMatchPanel<br/>입찰 수락"]:::comp
            MKTBOOK["MarketplaceOrderBook<br/>기타 리스팅"]:::comp
            COVERFRAME["CollectionCoverFrame"]:::comp
        end

        subgraph C_WALLET ["wallet/"]
            WALLETCONNECT["WalletConnect<br/>MetaMask 연결 · 네트워크"]:::comp
        end

        subgraph C_MYASSET ["my-assets/"]
            MYASSETS["MyAssets<br/>보유 RWA 목록 · 리스팅"]:::comp
        end

        subgraph C_COMMON ["common/"]
            IMGZOOM["RwaImageZoom"]:::comp
            GRADEDPANEL["GradedMetadataPanel"]:::comp
        end
    end

    subgraph LIBS ["Libraries"]
        direction TB

        subgraph L_API ["lib/"]
            API["api.ts<br/>REST API · IPFS · 마켓 조회"]:::lib
            AUTH["auth.ts<br/>Google OAuth · 세션"]:::lib
            GAS["chainGas.ts<br/>가스비 추정"]:::lib
            WERROR["walletError.ts<br/>에러 핸들링"]:::lib
        end

        subgraph L_SEAPORT ["lib/seaport/"]
            SUBMIT["submitAskListing.ts<br/>판매 등록 실행"]:::lib
            CRITERIA["criteriaMatch.ts<br/>입찰 매칭 빌드"]:::lib
            RUNCRITERIA["runCriteriaMatch.ts<br/>온체인 매칭 실행"]:::lib
            MERKLE["merkle.ts<br/>SeaportMerkleTree"]:::lib
            PLATFEE["platformFee.ts<br/>플랫폼 수수료 계산"]:::lib
            BIDUSDC["bidUsdc.ts<br/>입찰 USDC 추출"]:::lib
            FULFILL["seaportFulfillOrderArgs.ts<br/>체결 인자 빌드"]:::lib
        end
    end

    subgraph STATE ["State Management"]
        direction LR
        APPSTORE["useAppStore (Zustand)<br/>지갑 · USDC 잔고 · refresh"]:::store
        AUTHSTORE["useAuthStore (Zustand)<br/>Google 세션 · 사용자"]:::store
        RQUERY["React Query<br/>서버 데이터 캐싱 · 갱신"]:::store
    end

    subgraph PROVIDERS ["Providers"]
        direction LR
        WAGMIPROV["WagmiProvider<br/>지갑 연결 · 트랜잭션"]:::prov
        QUERYPROV["QueryClientProvider<br/>React Query"]:::prov
        AUTHPROV["AuthProvider<br/>세션 초기화"]:::prov
        WALLETPROV["WalletDataProvider<br/>Zustand ↔ Wagmi 동기화"]:::prov
    end

    subgraph EXTERNAL ["External"]
        direction LR
        BACKEND["🖥️ Backend API<br/>NestJS REST"]:::ext
        CHAIN["⛓️ Blockchain<br/>Sepolia · Seaport v1.5"]:::ext
        IPFS["📦 IPFS<br/>Pinata Gateway"]:::ext
    end

    COMPONENTS --> LIBS
    COMPONENTS --> STATE
    LIBS --> EXTERNAL
    STATE --> EXTERNAL
    PROVIDERS -.-> STATE

    style COMPONENTS fill:#030712,stroke:#4ade80,stroke-width:2px,color:#86efac
    style LIBS fill:#030712,stroke:#c084fc,stroke-width:2px,color:#d8b4fe
    style STATE fill:#030712,stroke:#f472b6,stroke-width:2px,color:#f9a8d4
    style PROVIDERS fill:#030712,stroke:#60a5fa,stroke-width:2px,color:#93c5fd
    style EXTERNAL fill:#030712,stroke:#fbbf24,stroke-width:2px,color:#fde68a

    style C_LAYOUT fill:#060f1c,stroke:#4ade80,stroke-width:1px,color:#86efac
    style C_MINT fill:#060f1c,stroke:#4ade80,stroke-width:1px,color:#86efac
    style C_MARKET fill:#060f1c,stroke:#4ade80,stroke-width:1px,color:#86efac
    style C_WALLET fill:#060f1c,stroke:#4ade80,stroke-width:1px,color:#86efac
    style C_MYASSET fill:#060f1c,stroke:#4ade80,stroke-width:1px,color:#86efac
    style C_COMMON fill:#060f1c,stroke:#4ade80,stroke-width:1px,color:#86efac

    style L_API fill:#0d0520,stroke:#c084fc,stroke-width:1px,color:#d8b4fe
    style L_SEAPORT fill:#0d0520,stroke:#c084fc,stroke-width:1px,color:#d8b4fe
```

### 4-3. 데이터 흐름

```mermaid
%%{init: {'flowchart': {'rankSpacing': 40, 'nodeSpacing': 30, 'padding': 16}}}%%
flowchart LR
    classDef user  fill:#0c1e33,stroke:#60a5fa,color:#bfdbfe,padding:8px 14px
    classDef front fill:#0a2215,stroke:#4ade80,color:#dcfce7,padding:8px 14px
    classDef state fill:#280a18,stroke:#f472b6,color:#fce7f3,padding:8px 14px
    classDef back  fill:#1f1a00,stroke:#fbbf24,color:#fef3c7,padding:8px 14px
    classDef chain fill:#1a0a2e,stroke:#c084fc,color:#f3e8ff,padding:8px 14px

    USER(["👤 사용자"]):::user

    subgraph FE ["Frontend (Next.js)"]
        direction TB
        PAGE["Page Component<br/>UI 렌더링"]:::front
        HOOK["Hooks<br/>useQuery · useMemo · useCallback"]:::front
        STORE["Zustand Store<br/>지갑 상태 · 잔고"]:::state
        LIB["Seaport Lib<br/>서명 · 매칭 · 수수료"]:::front
    end

    subgraph BE ["Backend (NestJS)"]
        direction TB
        CTRL["Controller<br/>REST 엔드포인트"]:::back
        SVC["Service<br/>검증 · 비즈니스 로직"]:::back
        DB["PostgreSQL<br/>주문 · 컬렉션"]:::back
        CTRL --> SVC --> DB
    end

    subgraph BC ["Blockchain"]
        direction TB
        SEAPORT["Seaport v1.5<br/>주문 체결"]:::chain
        ERC721["Tokenable_RWA<br/>NFT 발행 · 전송"]:::chain
        ERC20["USDC<br/>결제 · 승인"]:::chain
    end

    USER -->|"액션"| PAGE
    PAGE --> HOOK
    HOOK -->|"데이터 요청"| CTRL
    HOOK -->|"상태 읽기"| STORE
    PAGE -->|"트랜잭션 빌드"| LIB
    LIB -->|"EIP-712 서명"| USER
    LIB -->|"컨트랙트 호출"| SEAPORT
    LIB --> ERC721
    LIB --> ERC20
    STORE -.->|"Wagmi 동기화"| ERC20

    SEAPORT -->|"NFT 이전"| ERC721
    SEAPORT -->|"USDC 분배<br/>판매자 + 플랫폼 수수료"| ERC20

    style FE fill:#030712,stroke:#4ade80,stroke-width:2px,color:#86efac
    style BE fill:#030712,stroke:#fbbf24,stroke-width:2px,color:#fde68a
    style BC fill:#030712,stroke:#c084fc,stroke-width:2px,color:#d8b4fe
```

### 4-4. 파일 트리 요약

```
frontend/
├── app/
│   ├── layout.tsx              # RootLayout — Providers · AppHeader
│   ├── globals.css             # Tailwind v4 · 테마 · 스크롤바
│   ├── providers.tsx           # Wagmi · Query · Auth · WalletData
│   ├── page.tsx                # / Landing
│   ├── exchange/page.tsx       # /exchange 컬렉션 허브
│   ├── vault/page.tsx          # /vault 민팅 · 보유자산
│   ├── portfolio/page.tsx      # /portfolio 대시보드
│   └── marketplace/
│       ├── [tokenId]/page.tsx  # 토큰 상세
│       ├── collections/[collectionKey]/page.tsx  # 컬렉션 오더북
│       └── other-listings/page.tsx               # 미분류 리스팅
│
├── components/
│   ├── layout/AppHeader.tsx    # 헤더 — 검색 · 지갑 · 내비게이션
│   ├── mint/                   # MintForm · GradedCardSection · ImageInput
│   ├── marketplace/            # 오더북 · 입찰 · 리스팅 · 매칭 패널
│   ├── my-assets/MyAssets.tsx  # 보유 RWA 목록
│   ├── wallet/WalletConnect.tsx
│   └── common/                 # RwaImageZoom · GradedMetadataPanel
│
├── lib/
│   ├── api.ts                  # REST API · IPFS 헬퍼
│   ├── auth.ts                 # Google OAuth · 세션
│   ├── chainGas.ts             # 가스비 추정
│   ├── walletError.ts          # 지갑 에러 매핑
│   └── seaport/
│       ├── submitAskListing.ts # 판매 등록
│       ├── criteriaMatch.ts    # 입찰 매칭 빌드
│       ├── runCriteriaMatch.ts # 온체인 매칭
│       ├── platformFee.ts      # 플랫폼 수수료
│       ├── merkle.ts           # Merkle Tree
│       └── ...                 # bidUsdc · eip712Uint · constants
│
├── store/
│   ├── index.ts                # useAppStore (지갑 · USDC · refresh)
│   └── authStore.ts            # useAuthStore (Google 세션)
│
├── constants/
│   └── contracts.ts            # 컨트랙트 주소 · ABI · 수수료 설정
│
├── config/
│   └── wagmi.ts                # Wagmi — Sepolia · MetaMask · Alchemy
│
├── providers/
│   ├── AuthProvider.tsx        # Google 세션 초기화
│   └── WalletDataProvider.tsx  # Wagmi ↔ Zustand 동기화
│
└── types/
    └── gradedCard.ts           # 그레이딩 카드 타입 정의
```

---

## Part 5 — 백엔드 아키텍처

> NestJS · TypeORM · PostgreSQL · 글로벌 prefix `api` · Swagger `/api/docs`

### 5-1. HTTP 진입점·컨트롤러 라우트

```mermaid
%%{init: {'flowchart': {'rankSpacing': 44, 'nodeSpacing': 28, 'padding': 18}}}%%
flowchart TD
    classDef entry fill:#1f1a00,stroke:#fbbf24,color:#fef3c7,padding:8px 14px
    classDef route fill:#0c1e33,stroke:#60a5fa,color:#bfdbfe,padding:8px 14px
    classDef data  fill:#1a0a2e,stroke:#c084fc,color:#f3e8ff,padding:8px 14px
    classDef ext   fill:#0a2215,stroke:#4ade80,color:#dcfce7,padding:8px 14px

    CLIENT(["클라이언트<br/>Next.js · curl"]):::entry

    GATE["main.ts<br/>prefix api · ValidationPipe · CORS · cookie · Swagger /api/docs"]:::entry

    subgraph REST ["REST 네임스페이스"]
        direction TB
        R_AUTH["/api/auth<br/>Google OAuth · JWT 쿠키 · 지갑 연결"]:::route
        R_MKT["/api/marketplace<br/>orders · collections · market-snapshots<br/>· portfolio/daily · portfolio-market-batch · Seaport 전용"]:::route
        R_RWA["/api/rwa<br/>IPFS 메타 업로드 · 민팅 보조"]:::route
        R_BC["/api/blockchain<br/>RWA tokenURI · 메타/IPFS 해소"]:::route
        R_CH["/api/admin/cardhedger<br/>health · metrics (서버 내부 CardhedgerService)"]:::route
        R_PSA["/api/psa<br/>슬랩 OCR · PSA Public API"]:::route
    end

    subgraph PERSIST ["영속 계층"]
        PG[("PostgreSQL<br/>users · psa_cert_snapshots · marketplace_collections<br/>· rwa_tokens · collection_market_snapshots<br/>· orders · portfolio_daily_snapshots")]:::data
    end

    subgraph OUT ["외부 연동"]
        ETH["Ethereum RPC<br/>ethers.js"]:::ext
        PIN["Pinata IPFS"]:::ext
        CH["Cardhedger API"]:::ext
        PSAHTTP["PSA Public API"]:::ext
    end

    CLIENT --> GATE
    GATE --> REST
    R_MKT --> PG
    R_MKT --> CH
    R_AUTH --> PG
    R_RWA --> PIN
    R_BC --> ETH
    R_CH --> CH
    R_PSA --> PIN
    R_PSA --> CH
    R_PSA --> PSAHTTP

    style GATE fill:#0f0d00,stroke:#fbbf24,stroke-width:2px,color:#fde68a
    style REST fill:#060f1c,stroke:#60a5fa,stroke-width:2px,color:#93c5fd
    style PERSIST fill:#090514,stroke:#c084fc,stroke-width:2px,color:#d8b4fe
    style OUT fill:#030f08,stroke:#4ade80,stroke-width:2px,color:#86efac
```

### 5-2. Nest 모듈·서비스 구조

> **Note:** The diagram below still names removed controllers (`BidsController`, `PoketraceProxyController`, …). Current code: `OrdersController`, `CollectionsController`, `CertMarketTraceController`, collection/portfolio snapshot services — see [backend.md](../architecture/backend.md).

```mermaid
%%{init: {'flowchart': {'rankSpacing': 36, 'nodeSpacing': 22, 'padding': 14}}}%%
flowchart TB
    classDef mod   fill:#1f1a00,stroke:#fbbf24,color:#fef3c7,padding:6px 12px
    classDef ctrl  fill:#0c1e33,stroke:#60a5fa,color:#bfdbfe,padding:6px 12px
    classDef svc   fill:#0a2215,stroke:#4ade80,color:#dcfce7,padding:6px 12px
    classDef util  fill:#1a0a2e,stroke:#c084fc,color:#f3e8ff,padding:6px 12px
    classDef ent   fill:#280a18,stroke:#f472b6,color:#fce7f3,padding:6px 12px

    subgraph APP ["AppModule"]
        direction TB
        CFG["ConfigModule global"]:::mod
        ORM["TypeORM<br/>User · Order · MarketplaceCollection<br/>· CollectionMarketSnapshot · PsaCertSnapshot<br/>· RwaToken · PortfolioDailySnapshot"]:::ent
    end

    subgraph M_AUTH ["auth/ — AuthModule"]
        direction TB
        ACTRL["AuthController"]:::ctrl
        ASVC["AuthService"]:::svc
        GSTR["GoogleStrategy · JwtStrategy"]:::svc
        subgraph AUTH_DEP ["의존"]
            UMOD["UserModule → UserService"]:::svc
            MMOD["MailModule → MailService"]:::svc
        end
        ACTRL --> ASVC
        ASVC --> GSTR
        ASVC --> AUTH_DEP
    end

    subgraph M_MKT ["marketplace/ — MarketplaceModule"]
        direction TB
        MCTRL["MarketplaceController<br/>PoketraceProxyController<br/>BidsController · TradeController"]:::ctrl
        MSVC["MarketplaceService"]:::svc
        CSV["CollectionService"]:::svc
        CMKT["CollectionMarketService"]:::svc
        PTRSVC["PoketraceModule → PoketraceService"]:::svc
        MCTRL --> MSVC
        MCTRL --> CSV
        MCTRL --> CMKT
        MCTRL --> PTRSVC
        MBLOCK["BlockchainModule import"]:::util
        MSVC --> MBLOCK
    end

    subgraph M_NFT ["nft/ — NftModule"]
        NCTRL["NftController /rwa"]:::ctrl
        NSVC["NftService"]:::svc
        NCTRL --> NSVC
        UTL["UtilModule → PinataService"]:::util
        NSVC --> UTL
    end

    subgraph M_BC ["blockchain/ — BlockchainModule"]
        BCTRL["BlockchainController"]:::ctrl
        BSV["BlockchainService"]:::svc
        ETHF["ethers Provider · USDC · TokenableRWA factories"]:::util
        BCTRL --> BSV
        BSV --> ETHF
    end

    subgraph M_PRICE ["price/ — PriceModule"]
        PCTRL["PriceController"]:::ctrl
        CHS["CardhedgerService<br/>CARDHEDGER_API_KEY 필수"]:::svc
        PCTRL --> PSV
    end

    subgraph M_PSA ["psa/ — PsaModule"]
        PSACTRL["PsaController"]:::ctrl
        PSASVC["PsaService<br/>OCR · 이미지 · 병합"]:::svc
        PSAAPI["PsaPublicApiService"]:::svc
        PSACTRL --> PSASVC
        PSASVC --> PSAAPI
        PIMP["PriceModule import"]:::util
        PSASVC --> PIMP
    end

    subgraph M_UTIL ["util/ — UtilModule"]
        PIN["PinataService"]:::svc
    end

    APP --> M_AUTH
    APP --> M_MKT
    APP --> M_NFT
    APP --> M_BC
    APP --> M_PRICE
    APP --> M_PSA
    APP --> M_UTIL

    style APP fill:#030712,stroke:#fbbf24,stroke-width:2px,color:#fde68a
    style M_AUTH fill:#030712,stroke:#60a5fa,stroke-width:1px,color:#93c5fd
    style M_MKT fill:#030712,stroke:#4ade80,stroke-width:1px,color:#86efac
    style M_NFT fill:#030712,stroke:#4ade80,stroke-width:1px,color:#86efac
    style M_BC fill:#030712,stroke:#c084fc,stroke-width:1px,color:#d8b4fe
    style M_PRICE fill:#030712,stroke:#4ade80,stroke-width:1px,color:#86efac
    style M_PSA fill:#030712,stroke:#60a5fa,stroke-width:1px,color:#93c5fd
    style M_UTIL fill:#030712,stroke:#c084fc,stroke-width:1px,color:#d8b4fe
```

### 5-3. 요청 처리·외부 연동 흐름

```mermaid
%%{init: {'flowchart': {'rankSpacing': 38, 'nodeSpacing': 28, 'padding': 16}}}%%
flowchart LR
    classDef pipe fill:#111827,stroke:#6b7280,color:#e5e7eb,padding:8px 14px
    classDef app  fill:#1f1a00,stroke:#fbbf24,color:#fef3c7,padding:8px 14px
    classDef dom  fill:#0c1e33,stroke:#60a5fa,color:#bfdbfe,padding:8px 14px
    classDef io   fill:#0a2215,stroke:#4ade80,color:#dcfce7,padding:8px 14px

    REQ(["HTTP 요청"]):::pipe

    subgraph L1 ["Cross-cutting"]
        VP["ValidationPipe<br/>DTO whitelist · transform"]:::pipe
        CK["cookie-parser<br/>JWT 쿠키"]:::pipe
    end

    subgraph L2 ["도메인"]
        direction TB
        CT["@Controller<br/>라우팅 · Swagger 태그"]:::dom
        SV["@Injectable Service<br/>비즈니스 로직 · 트랜잭션"]:::dom
        REP["TypeORM Repository<br/>orders / collections / users"]:::dom
        CT --> SV --> REP
    end

    subgraph L3 ["외부 I/O"]
        ETH["ethers<br/>Sepolia 읽기"]:::io
        PIN["Pinata<br/>JSON·이미지 핀"]:::io
        CH["fetch → Cardhedger"]:::io
        MAIL["SMTP<br/>인증 메일"]:::io
    end

    REQ --> VP --> CK --> CT
    SV --> ETH
    SV --> PIN
    SV --> JT
    SV --> MAIL

    style L1 fill:#0f1115,stroke:#6b7280,stroke-width:2px,color:#d1d5db
    style L2 fill:#060f1c,stroke:#60a5fa,stroke-width:2px,color:#93c5fd
    style L3 fill:#030f08,stroke:#4ade80,stroke-width:2px,color:#86efac
```

### 5-4. 파일 트리 요약

```
backend/
├── src/
│   ├── main.ts                 # 부트스트랩 — prefix api · CORS · Swagger
│   ├── app.module.ts           # Config · TypeORM · Feature 모듈 조립
│   │
│   ├── auth/
│   │   ├── auth.controller.ts  # /auth — Google · JWT · 세션 · 지갑 연결
│   │   ├── auth.service.ts
│   │   ├── guards/             # JwtAuthGuard
│   │   └── strategies/         # google · jwt
│   │
│   ├── user/
│   │   ├── user.service.ts
│   │   └── entities/user.entity.ts
│   │
│   ├── mail/
│   │   └── mail.service.ts     # SMTP (Auth에서 사용)
│   │
│   ├── marketplace/
│   │   ├── marketplace.module.ts
│   │   ├── orders/             # orders.controller · orders.service · dto/
│   │   ├── collections/        # collections.controller · collection.service ·
│   │   │                       #   collection-market.service · cardhedger-market-data.service ·
│   │   │                       #   cardhedger-ai-insight.service · dto/
│   │   ├── assets/             # assets.controller · hidden-assets.service
│   │   ├── entities/           # order · marketplace-collection · hidden-asset
│   │   ├── utils/              # bucket-key · card-match · collection-image · …
│   │
│   ├── rwa/
│   │   ├── rwa.controller.ts   # /rwa — IPFS 업로드
│   │   ├── rwa.service.ts
│   │   ├── pinata/pinata.service.ts
│   │   ├── interfaces/rwa-metadata.interface.ts
│   │   └── dto/
│   │
│   ├── blockchain/
│   │   ├── blockchain.controller.ts
│   │   ├── blockchain.service.ts
│   │   ├── ipfs-gateway-resolver.service.ts
│   │   ├── abis/
│   │   └── providers/          # ethers · RWA 팩토리
│   │
│   ├── cardhedger/
│   │   └── cardhedger.service.ts       # CARDHEDGER_API_KEY 필수
│   │
│   └── psa/
│       ├── psa.controller.ts   # /psa/analyze
│       ├── psa.service.ts      # PSA/Cardhedger 결합, 이미지 폴백
│       ├── psa-public-api.service.ts
│       └── utils/              # psa-cert-images · psa-ocr
│
├── sql/
│   └── bootstrap-empty-prod-db.sql
│
└── Dockerfile
```

---

## 범례

| 아이콘 | 의미 |
|--------|------|
| 🔗 | 온체인 컨트랙트 호출 |
| ✍️ | EIP-712 지갑 서명 |
| 💾 | 백엔드 DB 저장 / 상태 갱신 |
| 💡 | 조건 분기 |
| 🌿 | Merkle 처리 |
| 🔍 | 사전 시뮬레이션 (검증) |

| 구분 | 기술 스택 |
|------|-----------|
| NFT | `Tokenable_RWA` ERC-721 |
| 결제 | Mock USDC ERC-20 (6 decimals) |
| 프로토콜 | Seaport v1.5 |
| 네트워크 | Ethereum Sepolia |
