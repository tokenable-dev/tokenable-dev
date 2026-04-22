# 개발·배포 가이드 (통합)

레포 루트 [README.md](../README.md)에서 클론·설치·실행 흐름을 보고, 여기서는 **로컬 DB·API**, **Seaport**, **규칙 기반 매칭(relational)**, **JustTCG**, **EC2 배포**, **트러블슈팅**, **다이어그램**을 정리합니다.

---

## 0. 제품 화면 · 외부 데이터 (최신)

### 프론트 주요 경로

| 경로 | 역할 |
|------|------|
| `/` | 랜딩 — Market Indexes (`GET /api/price/games` 기반 카드 등) |
| `/exchange` | 컬렉션 목록 · 카테고리 필터 · Trending · 리스트/그리드 |
| `/portfolio` | 보유 자산 · 리스팅 여부 · 참고가 대비 플랫폼 가격 |
| `/vault` | 민팅·등록 진입 |
| `/marketplace/collections/:key` | 호가북 · Tokenable+PokéTrace 듀얼 차트 · criteria 입찰/매도 · 개별 리스팅(판매자·cert·가격) |
| `/marketplace/:tokenId` | 토큰 상세 |

### 외부 가격 · 프록시

| 구분 | 엔드포인트 / 코드 | 비고 |
|------|-------------------|------|
| **JustTCG** | `GET /api/price/games`, `/sets`, `/cards`, … | `PriceService`, **`TCG_API_KEY` 필수** (`ConfigService.getOrThrow`). 로컬 mock 전용 분기는 제거됨. |
| **PokéTrace** | `GET /api/marketplace/poketrace/catalog`, `/cards`, `/cards/:cardId/prices/:tier/history`, … | `PoketraceProxyController` + `PoketraceService` — 컬렉션/토큰 차트·티어 히스토리 |
| **컬렉션 배치 스냅샷** | `POST /api/marketplace/collections/market-snapshots` | Exchange 등에서 여러 컬렉션의 풀 통계·스파크라인·외부 참조가를 한 번에 |

---

## 1. 데이터베이스 (PostgreSQL + TypeORM)

- **스키마 정의**: `backend/src/**/entities/` — 엔티티가 유일한 소스입니다.
- **로컬**: `NODE_ENV !== 'production'` 이면 TypeORM **`synchronize: true`** → 백엔드 기동 시 테이블 생성·갱신.
- **SQL 마이그레이션 폴더**: 사용하지 않습니다. 상세는 [backend/sql/README.md](../backend/sql/README.md).

### DB를 비우고 처음부터

Docker Compose를 쓰는 경우 **볼륨을 지우면** DB가 완전히 새로 만들어집니다.

```bash
docker compose down
docker volume ls   # 이름 확인 (예: tokenable-dev_postgres_data)
docker volume rm <위에서_확인한_볼륨명>
docker compose up -d postgres
cd backend && pnpm start:dev
```

로컬 Postgres를 직접 쓰면 DB를 드롭 후 재생성하거나 스키마만 비운 뒤 백엔드를 다시 띄우면 됩니다.

---

## 2. API

- **Swagger**: 백엔드 기동 후 `{API}/api/docs` (예: `http://localhost:4000/api/docs`).
- 프론트 래퍼: `frontend/lib/api.ts`, 베이스 URL은 `getApiUrl()` (브라우저에서는 보통 `{origin}/api`).
- **전체 라우트 표** (auth · rwa · blockchain · price · psa · marketplace · poketrace 프록시 · bids/trade): **[API-REFERENCE.md](./API-REFERENCE.md)** — 스키마 변경 시 Swagger와 함께 그 문서를 갱신합니다.

### 한 줄 요약

| 영역 | 역할 |
|------|------|
| `/api/auth/*` | Google OAuth, JWT 쿠키, 세션, 지갑 연결 |
| `/api/rwa/upload` | IPFS 메타 업로드 |
| `/api/blockchain/*` | USDC · TokenableRWA 읽기, 메타 배치, 미디어 resolve |
| `/api/price/*` | JustTCG (`TCG_API_KEY` 필수) |
| `/api/psa/*` | 슬랩 OCR · Cert 조회 |
| `/api/marketplace/*` | Seaport 오더북, 컬렉션·차트·스냅샷, PokéTrace 컬렉션 헬퍼, `poketrace/*` 업스트림 프록시 |
| `/api/marketplace/bids`, `/api/marketplace/trade` | 규칙 기반 relational 레이어 |

**규칙 기반 매칭** 상세: **[marketplace-trading.md](./marketplace-trading.md)**.

---

## 3. Seaport · 마켓플레이스

- 매도 **ask**, 매수는 **ERC721_WITH_CRITERIA** 컬렉션 입찰만 (`collectionKey`, Merkle root).
- 온체인: `fulfillOrder`, `matchAdvancedOrders` (recipient `address(0)` 등은 코드 `criteriaMatch.ts` 참고).
- **흐름 다이어그램**: [diagrams/marketplace-seaport-criteria-architecture.drawio](./diagrams/marketplace-seaport-criteria-architecture.drawio)
- **동일 앱의 relational 축**은 위 API 표의 `bids` / `trade/match` 참고 (UI 기본은 Seaport `orders` 경로).

### TokenableRWA 주소 (로컬 vs 배포 서버)

같은 Sepolia라도 **로컬에서 쓰는 배포본**과 **배포 서버용 배포본**이 다를 수 있습니다. 각각 아래에 맞춥니다.

| 환경 | 백엔드 | 프론트 |
|------|--------|--------|
| **로컬** | `backend/.env` → `RWA_CONTRACT_ADDRESS` | `frontend/.env` → `NEXT_PUBLIC_RWA_CONTRACT_ADDRESS` |
| **배포** | EC2 `~/.env.production.backend` → `RWA_CONTRACT_ADDRESS` | GitHub Actions 빌드 시 Secret/Variable `NEXT_PUBLIC_RWA_CONTRACT_ADDRESS` (번들에 박힘) |

`frontend/constants/contracts.ts`의 기본 폴백은 **로컬 개발용 주소**를 두며, 프로덕션에서는 반드시 env로 덮어씁니다.  
로컬·배포 컨트랙트가 다르면 **같은 tokenId라도 다른 NFT가 되므로** 환경을 섞지 않도록 합니다.

### 로컬에서 프론트·백엔드만 Docker로

`docker-compose.local.yml` 오버레이를 사용합니다 (레포 루트).

---

## 4. JustTCG 가격 API

엔드포인트·쿼리·에러 코드 전체는 별도 문서:

→ **[price-api.md](./price-api.md)**

| 변수 | 설명 |
|------|------|
| `TCG_API_KEY` | **필수** — `PriceService`가 `getOrThrow`로 읽으며, 없으면 백엔드 기동 실패. JustTCG 실호출만 사용한다. |

> 과거에 있던 **로컬 mock 전용 env / `price.mock.ts`** 분기는 제거되었다. 한도·키 관리는 JustTCG 플랜·키 로테이션으로 처리한다.

---

## 5. 배포 (develop → EC2)

`develop` 브랜치 푸시 시 GitHub Actions가 ECR에 이미지를 올리고, EC2에서 `docker-compose`로 당겨 씁니다. (워크플로: `.github/workflows/deploy.yml`)

### 5.1 사전 준비 (한 번만 확인)

#### GitHub Repository secrets / variables

배포·프론트 빌드에 필요합니다. 이름은 대소문자까지 동일해야 합니다. **`NEXT_PUBLIC_*`는 Repository secrets에 두는 것을 권장**합니다. Variables만 있으면 워크플로가 못 읽을 수 있어, `deploy.yml`은 Secrets 우선·Variables 폴백을 씁니다.

| Name | 설명 |
|------|------|
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | ECR 푸시 |
| `ECR_REGISTRY` | 예: `717728193407.dkr.ecr.ap-northeast-2.amazonaws.com` |
| `DEV_EC2_HOST`, `DEV_EC2_SSH_KEY` | **develop** 배포 시 EC2 SSH |
| `NEXT_PUBLIC_API_URL` | 예: `http://<공인IP>/api` |
| `NEXT_PUBLIC_RWA_CONTRACT_ADDRESS` | Sepolia TokenableRWA (필수; 레거시 `NEXT_PUBLIC_NFT_CONTRACT_ADDRESS` 폴백 가능) |
| `NEXT_PUBLIC_USDC_CONTRACT_ADDRESS` | Sepolia USDC |
| `NEXT_PUBLIC_ALCHEMY_RPC_URL`, `NEXT_PUBLIC_PINATA_GATEWAY` | 프론트 번들용 |
| `NEXT_PUBLIC_MARKETPLACE_ADDRESS` | Seaport 등 (워크플로 build-arg) |
| `NEXT_PUBLIC_SHOW_AUTH_LINKS` | 선택 |
| `NEXT_PUBLIC_PLATFORM_FEE_RECIPIENT`, `NEXT_PUBLIC_PLATFORM_FEE_BPS` | 선택 (Secrets 또는 Variables) |

**main → 프로덕션** 배포 단계는 워크플로에 준비되어 있으며 `PROD_EC2_HOST`, `PROD_EC2_SSH_KEY`가 필요합니다.

#### EC2

- 앱 경로: **`/home/ubuntu/app`** (레포 클론)
- 백엔드 환경: **`/home/ubuntu/.env.production.backend`** (`docker-compose.ec2.yml`에서 `env_file`로 주입)

### 5.2 로컬 — 커밋 후 푸시

```bash
cd /path/to/tokenable-dev
git checkout develop
git pull origin develop
# 변경 반영 후
git add -A
git commit -m "your message"
git push origin develop
```

### 5.3 GitHub Actions

리포지토리 **Actions** 탭에서 **Deploy** 워크플로가 **성공**할 때까지 기다립니다 (Build & Push + Deploy to Dev Server). ECR에는 `develop` 등 브랜치 태그와 커밋 SHA 태그가 함께 푸시되며, EC2 스크립트는 **`IMAGE_TAG=develop`**으로 pull합니다.

### 5.4 EC2 — 이미지 pull & 컨테이너 기동 (수동 시)

SSH 접속 후:

```bash
cd /home/ubuntu/app

export ECR_REGISTRY=717728193407.dkr.ecr.ap-northeast-2.amazonaws.com
export IMAGE_TAG=develop

git fetch origin
git checkout develop
git pull origin develop

aws ecr get-login-password --region ap-northeast-2 \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"

docker compose -f docker-compose.yml -f docker-compose.ec2.yml pull
docker compose -f docker-compose.yml -f docker-compose.ec2.yml up -d --force-recreate --remove-orphans
```

> 서버에 `docker compose`(V2)만 있으면 위 명령을 쓰고, 구식 `docker-compose`만 있으면 하이픈 형태로 바꿉니다.

### 5.5 백엔드만 다시 올릴 때 (필요 시)

`.env.production.backend`만 수정했을 때 등:

```bash
cd /home/ubuntu/app
export ECR_REGISTRY=717728193407.dkr.ecr.ap-northeast-2.amazonaws.com
export IMAGE_TAG=develop
docker compose -f docker-compose.yml -f docker-compose.ec2.yml up -d --force-recreate backend
```

### 5.6 Postgres — 빈 DB일 때 (테이블 없음)

`\dt`에 아무 관계도 없으면, 레포의 부트스트랩 SQL을 **한 번** 적용합니다.

```bash
docker exec tokenable-postgres psql -U tokenable -d tokenable -c '\dt'
```

비어 있으면:

```bash
docker exec -i tokenable-postgres psql -U tokenable -d tokenable < /home/ubuntu/app/backend/sql/bootstrap-empty-prod-db.sql
docker exec tokenable-postgres psql -U tokenable -d tokenable -c '\dt'
```

`users`, `orders`, `marketplace_collections`가 보이면 됩니다. (TypeORM `synchronize` 또는 개발 기동 후 `bids`, `asks`, `match_intents`, `trade_executions` 등이 추가될 수 있습니다.)

그다음 **`/home/ubuntu/.env.production.backend`에서 `TYPEORM_SYNC`는 제거하거나 `false`**로 두고, **5.5**로 백엔드를 재기동하세요. (운영에서는 스키마 자동 동기화를 켜 둔 채로 두지 않는 것이 안전합니다.)

### 5.7 동작 확인

- 브라우저: `http://<공인IP>` (시크릿 창 또는 강력 새로고침)
- Network: `/api/marketplace/orders`, `/api/marketplace/collections` → **200**
- 세션: `/api/auth/session` → **200** + 비로그인 시 `{ "user": null }` (해당 브랜치 배포 시)

### 5.8 자주 쓰는 점검

```bash
docker compose -f docker-compose.yml -f docker-compose.ec2.yml ps
docker logs tokenable-backend 2>&1 | tail -80
docker exec tokenable-backend env | grep -E 'TYPEORM|POSTGRES|NODE_ENV'
```

### 5.9 프론트 번들에 주소가 안 박히는 경우

`NEXT_PUBLIC_RWA_CONTRACT_ADDRESS` 등은 **Docker 빌드 시** 번들에 들어갑니다. Secrets/Variables에 값이 있고 Actions가 성공한 뒤, EC2에서 **프론트 이미지를 pull·재기동**해야 브라우저에 반영됩니다.

### 배포 관련 파일

| Path | 내용 |
|------|------|
| `.github/workflows/deploy.yml` | ECR 빌드·푸시, EC2 배포 단계 |
| `docker-compose.yml` / `docker-compose.ec2.yml` | 서비스·이미지 태그·백엔드 `env_file` |
| `frontend/Dockerfile` | `NEXT_PUBLIC_*` build-arg |
| `backend/sql/bootstrap-empty-prod-db.sql` | 빈 DB 초기 스키마 |

---

## 6. PSA 슬랩 분석 `/api/psa/analyze` — 배포 500 점검

1. 백엔드 로그에서 `PSA analyze failed:` 뒤 메시지 확인: `docker compose logs -f backend --tail=200`.
2. **sharp / tesseract.js**: Alpine musl 빌드 불일치 시 로드 실패 — Dockerfile이 Debian 기반인지 확인 후 이미지 재빌드.
3. **메모리**: 작은 인스턴스에서 OOM → 인스턴스 상향 또는 메모리 제한 완화.
4. **아웃바운드 HTTPS**: PSA·JustTCG·이미지 URL 요청이 나가야 함.
5. **업로드 크기**: Nginx `client_max_body_size` vs Multer 한도(예: 15MB).

컨테이너 안에서: `node -e "require('sharp'); console.log('ok')"` 로 네이티브 모듈 확인.

---

## 7. Draw.io / 다이어그램

| 파일 | 내용 |
|------|------|
| [marketplace-seaport-criteria-architecture.drawio](./diagrams/marketplace-seaport-criteria-architecture.drawio) | Seaport criteria + Merkle 흐름 (하단에 relational 안내) |
| [marketplace-trading-relational-layer.drawio](./diagrams/marketplace-trading-relational-layer.drawio) | 규칙 기반 매칭 레이어 (API·DB·워커) |
| [marketplace-trading.md](./marketplace-trading.md) | relational 매칭 문서 (Seaport와 병행) |
| [psa-slab-upload-ocr-api-flow.drawio](./diagrams/psa-slab-upload-ocr-api-flow.drawio) | PSA 슬랩 업로드·OCR |

과거에 쓰이던 통합 다이어그램(`tokenable-all-diagrams.drawio`)은 내용이 현재 코드와 어긋나 **제거**했습니다. 아키텍처는 위 파일과 이 문서의 API 표를 기준으로 합니다.

---

*문서를 바꿀 때는 Swagger와 실제 코드를 우선 확인하세요. HTTP 경로의 단일 요약본은 **[API-REFERENCE.md](./API-REFERENCE.md)** 를 갱신합니다.*
