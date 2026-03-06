# 🧩 NFT Marketplace MVP

- **GitHub** : 회사 계정 (이전 완료)
- **협업툴** : 카카오톡 / Notion
- **Repo** : Monorepo (FE + BE + Contracts)
- **Infra** : GitHub Actions + AWS + CI/CD (예정)

---

# 🎯 목적 및 구조

- FE / BE / Contracts를 **Monorepo**로 통합 관리
- 2달, MVP 출시 목표
- 최신 안정 버전 사용
- Audit 완료된 컨트랙트 패턴 참고 (OpenZeppelin)
- 확장성은 확보하되, 과설계는 최대한 배제해서 심플하게

---

# 🧠 런타임 & 패키지 매니저

| **항목** | **기술 및 버전** | **역할 및 이유**                   |
| -------- | ---------------- | ---------------------------------- |
| Node.js  | v24 LTS          | 최신 안정화 버전, 성능과 안정성    |
| nvm      | v0.39+           | Node 버전 관리, 다중 프로젝트 호환 |
| pnpm     | v10.x            | 빠른 설치, 효율적 의존성 관리      |

---

# 1️⃣ Frontend

| **항목**    | **기술명**     | **현재 버전** | **설명 및 선택 이유**                    |
| ----------- | -------------- | ------------- | ---------------------------------------- |
| 프레임워크  | Next.js        | 16.1.6        | App Router, SSR/SSG                      |
| UI          | Tailwind CSS   | 4.x           | 유연한 스타일링, 빠른 프로토타이핑       |
| 상태 관리   | Zustand        | 5.x           | 가벼운 전역 상태 (USDC 잔액, refresh 등) |
| Web3 통신   | wagmi + viem   | 3.x / 2.x     | 지갑 연결, 컨트랙트 호출                 |
| 지갑        | MetaMask       | @metamask/sdk | MVP 단계 MetaMask 단일 지원              |
| 데이터 패칭 | TanStack Query | 5.x           | 서버 상태 캐싱, 실시간 갱신              |
| 배포        | Vercel         | (예정)        | Next.js 최적화, 자동 CDN                 |

**미적용 (예정)**

- shadcn/ui
- WalletConnect
- styled-components

---

# 2️⃣ Backend

| **항목**      | **기술명** | **현재 버전** | **설명 및 선택 이유**            |
| ------------- | ---------- | ------------- | -------------------------------- |
| 프레임워크    | NestJS     | 11.x          | 모듈형 구조, JSP 스타일          |
| 언어          | TypeScript | 5.7           | 타입 안전성, FE와 타입 공유 가능 |
| API           | REST API   | -             | RESTful 설계                     |
| 블록체인 연동 | ethers.js  | 6.x           | 컨트랙트 읽기/쓰기               |
| IPFS          | Pinata     | 2.x           | NFT 이미지·메타데이터 업로드     |
| 문서화        | Swagger    | 11.x          | API 문서 자동 생성               |

**미적용 (예정)**

- Prisma / PostgreSQL
- 온체인 이벤트 리스너

---

# 3️⃣ Smart Contract & Wallet Integration

| **항목**      | **기술 및 선택**           | **설명 및 이유**                          |
| ------------- | -------------------------- | ----------------------------------------- | -------------------- |
| 개발 도구     | Hardhat                    | 2.x                                       | 컴파일, 테스트, 배포 |
| NFT 컨트랙트  | OpenZeppelin ERC-721       | SkyNFT (Enumerable + URIStorage)          |
| 결제 토큰     | MockUSDC (ERC-20)          | 6 decimals, 테스트용                      |
| 마켓플레이스  | SkyMarketplace (자체 구현) | listItem, cancelListing, buyItem          |
| 배포 네트워크 | Hyperledger Besu           | besu.dressdio.me (Chain ID 2741)          |
| ABI 관리      | backend/blockchain/abis    | FE는 constants/contracts.ts에서 별도 정의 |
| Wallet        | MetaMask                   | wagmi connector로 연결                    |

**미적용 (예정)**

- OpenSea Seaport Protocol
- Ethereum HoleSky
- WalletConnect

---

# 4️⃣ Database

| 항목        | 기술/서비스        | 역할 & 선택 이유                            |
| ----------- | ------------------ | ------------------------------------------- |
| DB 엔진     | PostgreSQL         | (예정)                                      |
| 운영/호스팅 | AWS RDS / Supabase | (예정)                                      |
| ORM         | Prisma             | (예정)                                      |
| 스키마      | -                  | Users, NFTs, Orders, Transactions 등 (예정) |

**현재**

- DB 미사용, API는 블록체인·IPFS 직접 조회

---

# 5️⃣ Storage

| **항목**    | **저장소 / 방법**  | **설명 / 이유**                             |
| ----------- | ------------------ | ------------------------------------------- |
| 이미지      | IPFS / Pinata      | NFT 이미지 탈중앙화 저장, CID 기반 tokenURI |
| 메타데이터  | IPFS / Pinata      | ERC-721 JSON 메타데이터, tokenURI로 참조    |
| 캐시 / 임시 | -                  | (미적용) AWS S3 등                          |
| NFT 연동    | tokenURI (ipfs://) | 민팅 시 스마트컨트랙트에 tokenURI 지정      |

---

# 6️⃣ Infrastructure & DevOps

| **항목**        | **구성 및 도구**           | **상태**          |
| --------------- | -------------------------- | ----------------- |
| 프론트엔드 배포 | Vercel                     | 예정              |
| 백엔드 서버     | AWS EC2 + Docker           | 예정              |
| DB              | AWS RDS                    | 예정              |
| Reverse Proxy   | Nginx                      | 예정 (필요 시)    |
| CI/CD           | GitHub Actions             | 예정              |
| 환경변수        | .env / AWS Secrets Manager | 로컬 .env 사용 중 |

---

# 7️⃣ MVP 단계 제외 기술

- Redis, Kafka, SQS
- Kubernetes, Microservices
- GraphQL (REST API로 충분)

---

# 8️⃣ 전체 구조 개념도

```
Next.js (Vercel 예정)
        ↓
MetaMask (wagmi)
        ↓
NestJS API (AWS EC2 예정)
        ↓
PostgreSQL (예정)
        ↓
Hyperledger Besu (besu.dressdio.me)
        ↓
SkyMarketplace + SkyNFT + MockUSDC
        ↓
IPFS / Pinata (이미지 & 메타데이터)
```

---

# 9️⃣ 현재 구현 기능

| 기능                                             | 상태 |
| ------------------------------------------------ | ---- |
| NFT 민팅 (이미지 → IPFS → mint)                  | ✅   |
| NFT 리스팅 (USDC 가격)                           | ✅   |
| NFT 구매 (USDC 결제)                             | ✅   |
| 리스팅 취소                                      | ✅   |
| My NFTs / Marketplace / 상세 페이지              | ✅   |
| Activity History (Mint, Listed, Sold, Cancelled) | ✅   |
| 이미지 호버 줌 (마그니파이어)                    | ✅   |
| USDC 파우셋 (테스트용)                           | ✅   |
| 실시간 잔액·목록 갱신 (Zustand + React Query)    | ✅   |

---

# 🔟 기술스택 요약

- **Node 24, NestJS 11, Next.js 16** : 최신 안정 버전
- **TypeScript** : FE/BE/Contracts 공통 사용
- **Hardhat + OpenZeppelin ERC-721** : NFT 발행
- **SkyMarketplace + MockUSDC** : 판매/구매/결제
- **Hyperledger Besu** : 현재 배포 네트워크
- **Pinata** : IPFS 이미지·메타데이터
- **Vercel + GitHub Actions** : 배포·CI/CD (예정)
