# Tokenable RWA (Monorepo)

- **GitHub**: 조직/회사 계정 레포
- **협업**: 카카오톡 / Notion
- **Repo**: Monorepo — `frontend` · `backend` · `contracts` (+ `seaport-demo` 등)
- **Infra**: GitHub Actions → AWS ECR → EC2 (`docker compose`), Nginx 리버스 프록시

---

## 목적 및 구조

- FE / BE / Contracts를 **한 레포**에서 관리
- **Ethereum Sepolia**에서 Tokenable_RWA(ERC-721) + **OpenSea Seaport** + Circle **USDC**로 민팅·거래
- **오프체인 주문 DB**(PostgreSQL)에 Seaport 주문·컬렉션·풀(bucket) 입찰 저장
- 확장 가능하되 MVP 범위는 단순하게 유지

---

## 런타임 & 패키지 매니저

| 항목 | 기술 | 비고 |
|------|------|------|
| Node.js | 20+ 권장 (CI/로컬에 맞출 것) | LTS |
| 패키지 매니저 | **pnpm** (워크스페이스) | 루트·패키지별 `pnpm-lock.yaml` |
| TypeScript | 5.x | FE/BE 공통 |

---

## 1. Frontend (`frontend/`)

| 항목 | 기술 | 버전(레포 기준) | 설명 |
|------|------|-----------------|------|
| 프레임워크 | Next.js (App Router) | 16.1.x | SSR/클라이언트 |
| UI | Tailwind CSS | 4.x | |
| 상태 | Zustand | 5.x | 지갑·USDC·refresh 등 |
| Web3 | wagmi + viem | 3.x / 2.x | Sepolia, MetaMask |
| 데이터 | TanStack Query | 5.x | API 캐시·폴링 |
| 배포 | Docker 이미지 (ECR) | | `NEXT_PUBLIC_*` 는 **빌드 시** 주입 |

**UI 용어**: 탭명 **My Assets** / **Exchange** (코드상 라우트·쿼리 `marketplace` 등은 호환용으로 유지될 수 있음).

---

## 2. Backend (`backend/`)

| 항목 | 기술 | 버전(레포 기준) | 설명 |
|------|------|-----------------|------|
| 프레임워크 | NestJS | 11.x | 모듈 구조 |
| DB | PostgreSQL + **TypeORM** | 16 / 11.x | `orders`, `bucket_bids`, `marketplace_collections`, users 등 |
| 블록체인 | ethers.js | 6.x | 읽기 전용 RPC + 검증 |
| IPFS | Pinata SDK | 2.x | 민팅 메타·이미지 |
| API 문서 | Swagger | `@nestjs/swagger` | `/api/docs` |

마이그레이션: `backend/sql/migrations/*.sql` (프로덕션은 `synchronize: false` 가정).

---

## 3. Smart contracts (`contracts/`)

| 항목 | 내용 |
|------|------|
| 도구 | Hardhat 2.x |
| NFT | **TokenableRWA** — OpenZeppelin ERC721Enumerable + URIStorage |
| 결제 | **USDC** (Sepolia Circle USDC 등, 주소는 env) |
| 마켓 | **OpenSea Seaport** (고정 주소, 프론트 `constants`) — 온체인 체결 |
| 배포 네트워크 | **Sepolia** (메인 개발·스테이징). Besu 등은 스크립트/레거시용으로 `hardhat.config`에 별도 네트워크 정의 가능 |

ABI: 백엔드 `abis/`, 프론트 `constants/contracts.ts` 등에서 관리.

---

## 4. Database

| 항목 | 내용 |
|------|------|
| 엔진 | PostgreSQL |
| 운영 | Docker `postgres` 서비스 + 볼륨 (로컬/EC2) |
| ORM | TypeORM (Prisma 아님) |
| 마켓 데이터 | Seaport 주문·풀 입찰·컬렉션 메타 등 |

---

## 5. Storage

| 항목 | 내용 |
|------|------|
| 이미지·메타 | Pinata (IPFS), `tokenURI` 는 IPFS/게이트웨이 URL |
| 환경 변수 | `PINATA_JWT`, `PINATA_GATEWAY` |

---

## 6. Infrastructure & DevOps

| 항목 | 구성 | 상태 |
|------|------|------|
| CI/CD | GitHub Actions | `develop`/`main` 푸시 시 ECR 빌드·푸시 |
| 실행 | AWS EC2 + Docker Compose | `docker-compose.yml` + `docker-compose.ec2.yml` |
| 리버스 프록시 | Nginx | `/` → Next, `/api` → Nest |
| 백엔드 시크릿 | `/home/ubuntu/.env.production.backend` | EC2 전용 env (레포에 커밋하지 않음) |
| 프론트 빌드 인자 | GitHub Secrets `NEXT_PUBLIC_*` | |

---

## 7. MVP에서 일부러 넣지 않은 것 (예시)

- Redis / 메시지 큐
- Kubernetes
- GraphQL (REST + Swagger로 충분)

---

## 8. 구조 개념도 (요약)

```
Next.js (Docker / ECR)
    ↓ HTTPS /api
NestJS (Docker / ECR)
    ↓
PostgreSQL (주문·풀 입찰·컬렉션)
    ↓
Ethereum Sepolia — TokenableRWA · USDC · Seaport
    ↓
Pinata (IPFS)
```

---

## 9. 구현 기능 (요약)

| 기능 | 상태 |
|------|------|
| 그레이디드 카드 민팅 (IPFS + PSA/JustTCG 보조) | ✅ |
| My Assets / Exchange / 자산 상세 | ✅ |
| Seaport 리스팅·구매·취소 (오프체인 주문 DB) | ✅ |
| 컬렉션(graded bucket)·풀 입찰·오더북 | ✅ |
| Google OAuth + 이메일 인증 + 지갑 연결 | ✅ |

---

## 10. 기술 스택 한 줄 요약

- **Next.js 16 + NestJS 11 + TypeScript** — 웹·API
- **wagmi/viem + Sepolia** — 지갑·컨트랙트
- **Seaport + USDC + TokenableRWA** — 거래·자산
- **PostgreSQL + TypeORM** — 오프체인 주문·컬렉션
- **Pinata** — IPFS
- **GitHub Actions + ECR + EC2** — 배포

*코드와 불일치 시 레포의 `package.json`·`docker-compose.yml`·`.github/workflows` 를 기준으로 본 문서를 갱신할 것.*
