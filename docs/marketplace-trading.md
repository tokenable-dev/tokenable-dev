# 규칙 기반 매칭 레이어 (PostgreSQL) — Seaport와의 관계

프로덕트 UI는 여전히 **Seaport 서명 주문**(`orders` 테이블, `MarketplaceController`의 `/api/marketplace/orders/*`)을 기본으로 사용합니다.  
동일 Nest 앱에서 **조건부 입찰·리스팅·매칭 예약·정산 워커**를 위해 아래 **관계형 테이블**과 API가 **병행**으로 제공됩니다.

---

## 1. 두 축 정리

| 축 | 저장소 | 체결 방식 | 코드 진입 |
|----|--------|-----------|-----------|
| **Seaport (기존)** | `orders` (+ `marketplace_collections`) | 지갑 서명 + 온체인 `fulfillOrder` / `matchAdvancedOrders` | `MarketplaceService`, `marketplace.controller.ts`, `frontend/lib/seaport/*` |
| **Relational (추가)** | `bids`, `asks`, `match_intents`, `trade_executions`, `idempotency_keys`, `outbox_events` | API가 `pending`까지 생성 → **Settlement 워커**만 `locked` → 스텁/체인 정산 후 `executed` / `failed` | `trading/*`, `BidsController`, `TradeController` |

두 축은 **같은 PostgreSQL**을 쓰며, 운영 정책에 따라 UI는 한쪽만 쓰거나 나중에 합칠 수 있습니다.

---

## 2. HTTP API (요약)

| Method | Path | 설명 |
|--------|------|------|
| `GET` | `/api/marketplace/bids` | `collectionKey` 필수, `tokenId` 선택 시 rule 적용 가능 여부 |
| `GET` | `/api/marketplace/bids/:id` | 단건 + `rule` JSON |
| `POST` | `/api/marketplace/trade/match` | **202** — 본문 `{ bidId, askId, tokenId }`, 헤더 `Idempotency-Key` 권장 (없으면 결정적 해시) |
| `GET` | `/api/marketplace/trade/executions/:id` | 정산 상태 폴링 |

Swagger: `/api/docs` → `marketplace` 태그.

---

## 3. DB 엔티티 (TypeORM)

| 테이블 | 역할 |
|--------|------|
| `bids` | 조건부 매수 의사, `rule` JSONB, `snapshot_id`, 선택 `token_id` |
| `asks` | 토큰 단위 매도, `grade` / `traits` / `external_ref`(rule 평가용 메타) |
| `match_intents` | (bid, ask, token) 논리 매칭 + `rule_result` |
| `trade_executions` | `pending` → (**워커만**)`locked` → `executed` \| `failed`; `ask_id`/`bid_id` denormalize + in-flight partial unique |
| `idempotency_keys` | `POST /trade/match` 중복 요청 수렴 |
| `outbox_events` | Kafka 대비 트랜잭션 아웃박스; `OutboxPublisherService`가 `published` 처리 |

---

## 4. 상태 · 소유권

- **API(`TradeOrchestratorService`)**: `trade_executions.execution_state = pending` 까지, `asks.status = locked` 예약.
- **워커(`SettlementProcessorService`)**: `pending` → `locked`(CAS) → 정산 → `executed` / `failed` (실패 시 ask를 다시 `active`).

환경 변수: `SETTLEMENT_WORKER_ENABLED`, `OUTBOX_PUBLISHER_ENABLED`, `SETTLEMENT_POLL_MS`, `SETTLEMENT_STUB_FAIL` 등 — `backend/src/marketplace/trading/*.service.ts` 참고.

---

## 5. Rule 엔진

- `RuleEngineService.isBidApplicable` — 순수 함수, 스냅샷·컬렉션·만료·AST(`AND` / `OR`, `GRADE_MIN`, `TRAIT_INCLUDE_ALL`, `EXTERNAL_MATCH` 등).
- Ask 메타가 토큰 뷰의 소스 (`TokenResolutionService.buildFromAsk`).

---

## 6. 다이어그램

- [marketplace-trading-relational-layer.drawio](./diagrams/marketplace-trading-relational-layer.drawio) — 레이어 요약 (draw.io).
- Seaport 전용 세부: [marketplace-seaport-criteria-architecture.drawio](./diagrams/marketplace-seaport-criteria-architecture.drawio) (하단에 relational 안내 추가).

전체 파이프라인(민팅~Seaport) 문서: [marketplace-lifecycle.md](./diagrams/marketplace-lifecycle.md) 상단 부록 참고.
