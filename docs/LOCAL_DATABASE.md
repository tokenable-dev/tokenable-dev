# 로컬 PostgreSQL · DB 스키마 (대표/기획용 상세)

로컬 개발 기준으로 **코드(TypeORM 엔티티) + Docker + 마이그레이션 SQL** 을 맞춘 설명입니다.  
프로덕션 DB는 **마이그레이션을 수동 적용**하는 경우가 있어 로컬과 컬럼 순서·이력이 다를 수 있습니다.

---

## 1. 한눈에 요약

| 항목 | 내용 |
|------|------|
| **DBMS** | PostgreSQL **16** (Alpine 이미지) |
| **실행 방식** | Docker Compose 서비스 `postgres`, 데이터는 **이름 붙은 볼륨** `postgres_data` |
| **기본 DB/유저** | 환경변수 미설정 시 `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` = `tokenable` (`docker-compose.yml` 기본값) |
| **포트** | 호스트 `5432` → 컨테이너 `5432` (`localhost:5432`) |
| **앱 연결** | NestJS **TypeORM** — `backend/.env` 의 `POSTGRES_HOST`(로컬은 보통 `localhost`), `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` |
| **스키마 반영** | **`NODE_ENV !== 'production'`** 이면 **`synchronize: true`** → 엔티티 기준으로 테이블이 자동 생성·변경됨 (로컬 개발 편의). **프로덕션에서는 `synchronize: false`** 권장. |
| **초기 SQL** | `docker/postgres/init/*.sql` — **Postgres 데이터 디렉터리가 처음 만들어질 때만** 실행 (이미 볼륨이 있으면 스킵). |

---

## 2. Docker 구성 (로컬)

`docker-compose.yml` 요지:

- **이미지**: `postgres:16-alpine`
- **컨테이너 이름**: `tokenable-postgres` (기본)
- **볼륨**: `postgres_data:/var/lib/postgresql/data`
- **init 스크립트 마운트**: `./docker/postgres/init` → `/docker-entrypoint-initdb.d` (읽기 전용)

`backend` 를 Docker 밖에서 띄우면 `POSTGRES_HOST=localhost` 로 접속합니다.  
`backend` 가 같은 compose 네트워크 안에 있으면 `POSTGRES_HOST=postgres` 로 붙는 식으로 바뀝니다.

---

## 3. ERD 관계 (논리)

```
users                    (단독 — OAuth·지갑 연동)

marketplace_collections  (collection_key PK)
        ↑
        │  orders.collection_key (문자열 참조, 컬렉션 메타·그리드용)
        │
orders                   (id PK, order_hash UNIQUE)
        │
        │  orders.bucket_bid_id → bucket_bids.id (FK, ON DELETE SET NULL)
        ↓
bucket_bids              (id PK)
```

- **`orders` ↔ `bucket_bids`**: 마이그레이션 `006` 에서 `bucket_bid_id` 가 `bucket_bids(id)` 를 **참조(FK)** 합니다. 풀 매수와 연결된 Seaport **bid** 주문 한 건에 대응.
- **`orders` ↔ `marketplace_collections`**: **`collection_key` 문자열**으로 연결. DB FK 제약은 마이그레이션에 없을 수 있으나, 앱 로직상 같은 키(64 hex 버킷)를 사용합니다.

---

## 4. 테이블 상세

### 4.1 `users`

웹2(Google) 계정 + 선택적 지갑 연동.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID PK | |
| `email` | varchar(320) UNIQUE | |
| `google_id` | varchar(64) UNIQUE NULL | Google `sub` |
| `name` | varchar(200) NULL | |
| `picture_url` | text NULL | |
| `email_verified` | boolean | |
| `platform_email_verified_at` | timestamptz NULL | 플랫폼 이메일 인증 시각 |
| `email_verification_token_hash` | varchar(64) NULL | |
| `email_verification_expires_at` | timestamptz NULL | |
| `verification_email_last_sent_at` | timestamptz NULL | |
| `wallet_address` | varchar(42) UNIQUE NULL | 체크섬 정규화 `0x…` |
| `wallet_linked_at` | timestamptz NULL | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

엔티티: `backend/src/user/entities/user.entity.ts`

---

### 4.2 `orders`

Seaport **오프체인 주문** 저장 (매도 ask / 매수 bid).

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | SERIAL PK | |
| `order_hash` | varchar UNIQUE | 앱 내부 식별용 해시 (서버 `deriveOrderHash` — Seaport canonical hash와 동일하다고 가정하면 안 됨) |
| `offerer` | varchar(INDEX) | ask: 판매자 / bid: 구매자(입찰 서명자) |
| `side` | `orders_side_enum` | `'ask'` \| `'bid'` (기본 ask) |
| `token_contract` | varchar | ERC-721 컨트랙트 |
| `token_id` | varchar(INDEX) | NFT tokenId |
| `bucket_bid_id` | int NULL FK → `bucket_bids(id)` | 풀 연결 bid 만 |
| `collection_key` | varchar(64) NULL(INDEX) | graded 메타 기준 컬렉션 (주로 ask) |
| `consideration_token` | varchar | USDC 등 |
| `consideration_amount` | varchar | 최소 단위 문자열 |
| `parameters` | jsonb | Seaport order parameters 전체 |
| `signature` | text | EIP-712 서명 |
| `status` | `orders_status_enum` | `active`, `fulfilled`, `cancelled`, `expired` |
| `start_time` | timestamptz | |
| `end_time` | timestamptz(INDEX) | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

엔티티: `backend/src/marketplace/entities/order.entity.ts`  
마이그레이션: `003`, `004`, `006`, `007` 등

---

### 4.3 `bucket_bids`

풀(컬렉션) 매수 — **같은 카드·등급 버킷**, EIP-712(`TokenableCollectionBid`) 오프체인 약속.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | SERIAL PK | |
| `bucket_key` | varchar(64) INDEX | 논리 풀 ID (sha256 hex) |
| `token_contract` | varchar | NFT 컨트랙트 |
| `buyer_offerer` | varchar(INDEX) | 매수자 지갑 |
| `consideration_amount` | varchar | USDC 최소 단위 |
| `components` | jsonb | 카드·등급 메타 (UI·감사) |
| `signature` | text NULL | EIP-712 |
| `nonce` | varchar(80) NULL | buyer별 유일 (부분 unique 인덱스) |
| `status` | `bucket_bid_status_enum` | `active`, `fulfilled`, `cancelled`, `expired` |
| `start_time` | timestamptz | |
| `end_time` | timestamptz(INDEX) | |
| `fulfilled_token_id` | varchar(64) NULL | 체결된 tokenId |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

엔티티: `backend/src/marketplace/entities/bucket-bid.entity.ts`  
마이그레이션: `005`, `006`

---

### 4.4 `marketplace_collections`

graded 메타 기준 **논리 컬렉션** (첫 매도 ask 등록 시 행 생성).

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `collection_key` | varchar(64) PK | `computeMarketBucketKey` 와 동일 문자열 |
| `display_label` | text | |
| `query_used` | text NULL | JustTCG 등 |
| `components` | jsonb | |
| `cover_image_url` | text NULL | 카탈로그 카드 아트 URL |
| `created_at` | timestamptz | |

엔티티: `backend/src/marketplace/entities/marketplace-collection.entity.ts`  
마이그레이션: `007`, `008`

---

## 5. PostgreSQL ENUM (요약)

| 이름 | 값 |
|------|-----|
| `orders_status_enum` | `active`, `fulfilled`, `cancelled`, `expired` |
| `orders_side_enum` | `ask`, `bid` |
| `bucket_bid_status_enum` | `active`, `fulfilled`, `cancelled`, `expired` |

---

## 6. Draw.io ERD

시각적 다이어그램: 통합 파일 **`docs/diagrams/tokenable-all-diagrams.drawio`** 에서 탭 **「03-C-PostgreSQL-ERD」**  
diagrams.net에서 **파일 → 열기**로 import 하면 됩니다.

---

## 7. 로컬에서 직접 확인하는 방법 (대표 시연)

1. Postgres가 떠 있는지 확인 (`docker ps` — `tokenable-postgres`).
2. **DBeaver / TablePlus / pgAdmin** 등으로 `localhost:5432`, DB `tokenable`, 유저/비밀번호는 `.env` 또는 compose 기본값.
3. SQL: `\dt` 로 테이블 목록, `SELECT * FROM orders LIMIT 5;` 등.

---

## 8. 관련 파일

| 경로 | 역할 |
|------|------|
| `docker-compose.yml` | Postgres 서비스·볼륨·포트 |
| `docker/postgres/init/*.sql` | 첫 초기화 시 실행 |
| `backend/sql/migrations/*.sql` | 배포/수동 적용용 마이그레이션 |
| `backend/src/app.module.ts` | TypeORM 설정 |
| `backend/src/**/entities/*.ts` | 엔티티 = 스키마의 소스 오브 트루스(로컬 sync 시) |

---

*문서 기준일: 저장소 코드 기준. 스키마 변경 시 엔티티·마이그레이션·이 문서를 함께 갱신하는 것을 권장합니다.*
