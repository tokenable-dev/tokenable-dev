# 개발·배포·DB·API (통합 가이드)

레포 루트 [README.md](../README.md)에서 클론·설치·실행 흐름을 보고, 여기서는 **DB**, **API**, **Seaport**, **배포**, **트러블슈팅**만 정리합니다.

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
- 프론트 래퍼: `frontend/lib/api.ts`, 베이스 URL은 `getApiUrl()`.

### Marketplace (요약)

| Method | Path | 설명 |
|--------|------|------|
| `POST` | `/api/marketplace/orders` | Seaport 주문 등록 |
| `POST` | `/api/marketplace/orders/replace-listing` | 활성 ask 교체 |
| `GET` | `/api/marketplace/orders` | 활성 매도 목록 |
| `GET` | `/api/marketplace/orders/token/:tokenId` | 토큰별 이력 |
| `GET` | `/api/marketplace/orders/:hash` | 단건 |
| `PATCH` | `/api/marketplace/orders/:hash/cancel` | 취소 (`callerAddress`) |
| `PATCH` | `/api/marketplace/orders/:hash/fulfill` | 단일 체결 동기화 |
| `POST` | `/api/marketplace/orders/fulfill-matched-pair` | criteria 매칭 후 동기화 |
| `GET` | `/api/marketplace/collections` / `collections/:key` | 컬렉션 |
| `GET` | `/api/marketplace/collections/:key/merkle-set` | Merkle leaf용 tokenIds |

---

## 3. Seaport · 마켓플레이스

- 매도 **ask**, 매수는 **ERC721_WITH_CRITERIA** 컬렉션 입찰만 (`collectionKey`, Merkle root).
- 온체인: `fulfillOrder`, `matchAdvancedOrders` (recipient `address(0)` 등은 코드 `criteriaMatch.ts` 참고).
- **흐름 다이어그램**: [diagrams/marketplace-seaport-criteria-architecture.drawio](./diagrams/marketplace-seaport-criteria-architecture.drawio)

### TokenableRWA 주소 (로컬 vs 배포 서버)

같은 Sepolia라도 **로컬에서 쓰는 배포본**과 **배포 서버용 배포본**이 다를 수 있습니다. 각각 아래에 맞춥니다.

| 환경 | 백엔드 | 프론트 |
|------|--------|--------|
| **로컬** | `backend/.env` → `RWA_CONTRACT_ADDRESS` | `frontend/.env.local` → `NEXT_PUBLIC_RWA_CONTRACT_ADDRESS` |
| **배포** | EC2 `~/.env.production.backend` → `RWA_CONTRACT_ADDRESS` | GitHub Actions 빌드 시 Secret `NEXT_PUBLIC_RWA_CONTRACT_ADDRESS` (번들에 박힘) |

`frontend/constants/contracts.ts`의 기본 폴백은 **로컬 개발용 주소**를 두며, 프로덕션에서는 반드시 env로 덮어씁니다.  
로컬·배포 컨트랙트가 다르면 **같은 tokenId라도 다른 NFT가 되므로** 환경을 섞지 않도록 합니다.

---

## 4. develop → 개발 서버 배포 (요약)

개발 URL 예: nginx가 `/` → Next, `/api` → Nest.

### GitHub Actions / Secrets

`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_RWA_CONTRACT_ADDRESS` (레거시: `NEXT_PUBLIC_NFT_CONTRACT_ADDRESS`), `NEXT_PUBLIC_USDC_CONTRACT_ADDRESS`, RPC, Pinata, ECR·AWS 등 — CI와 EC2 `~/app` 설정에 맞출 것.

**주의**: 백엔드가 읽는 RWA 컨트랙트 주소(`RWA_CONTRACT_ADDRESS`, 레거시 `NFT_CONTRACT_ADDRESS`)는 EC2의 **`/home/ubuntu/.env.production.backend`** 등과 프론트 빌드 인자가 **일치**해야 합니다.

### EC2에서 수동 재기동 예시

```bash
cd /home/ubuntu/app
git pull origin develop
export ECR_REGISTRY=... && export IMAGE_TAG=develop
docker compose -f docker-compose.yml -f docker-compose.ec2.yml pull
docker compose -f docker-compose.yml -f docker-compose.ec2.yml up -d --force-recreate --remove-orphans
```

로컬에서 프론트·백엔드만 Docker로: `docker-compose.local.yml` 등 레포에 있는 오버레이 파일을 사용.

---

## 5. PSA 슬랩 분석 `/api/psa/analyze` — 배포 500 점검

1. 백엔드 로그에서 `PSA analyze failed:` 뒤 메시지 확인: `docker compose logs -f backend --tail=200`.
2. **sharp / tesseract.js**: Alpine musl 빌드 불일치 시 로드 실패 — Dockerfile이 Debian 기반인지 확인 후 이미지 재빌드.
3. **메모리**: 작은 인스턴스에서 OOM → 인스턴스 상향 또는 메모리 제한 완화.
4. **아웃바운드 HTTPS**: PSA·JustTCG·이미지 URL 요청이 나가야 함.
5. **업로드 크기**: Nginx `client_max_body_size` vs Multer 한도(예: 15MB).

컨테이너 안에서: `node -e "require('sharp'); console.log('ok')"` 로 네이티브 모듈 확인.

---

## 6. JustTCG 가격 API (상세 레퍼런스)

엔드포인트·쿼리·에러 코드 전체는 별도 문서:

→ **[price-api.md](./price-api.md)**

서버에 `TCG_API_KEY` 필요.

---

## 7. Draw.io / 다이어그램

| 파일 | 내용 |
|------|------|
| [marketplace-seaport-criteria-architecture.drawio](./diagrams/marketplace-seaport-criteria-architecture.drawio) | Seaport criteria + Merkle 흐름 |
| [psa-slab-upload-ocr-api-flow.drawio](./diagrams/psa-slab-upload-ocr-api-flow.drawio) | PSA 슬랩 업로드·OCR |

과거에 쓰이던 통합 다이어그램(`tokenable-all-diagrams.drawio`)은 내용이 현재 코드와 어긋나 **제거**했습니다. 아키텍처는 위 두 파일과 이 문서의 API 표를 기준으로 합니다.

---

*문서를 바꿀 때는 Swagger와 실제 코드를 우선 확인하세요.*
