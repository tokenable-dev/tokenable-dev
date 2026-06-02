# P3.16 — Identity Cache SRE Layer

> **Status:** Design + minimal scaffolding (P3.1–P3.15 correctness frozen)  
> **Scope:** Observability, recovery, extended failure coverage, guardrails  
> **Non-goals:** Schema changes, Decision/Execution semantic changes, write-path changes

---

## 1. Context

P3.1–P3.15 established:

| Layer | Responsibility |
|-------|----------------|
| DB writes (P3.1–P3.3) | `FOR UPDATE` + conditional UPDATE + write-through |
| DecisionEngine | Pure drift policy (single source of truth) |
| ExecutionService | Pure IO (`CacheExecutionCommand`) |
| Reconciliation (P3.6) | Hot-key proactive repair |
| Simulation (P3.11) | Deterministic model replay |
| Production parity (P3.14) | TypeORM + Redis integration |
| Chaos (P3.15) | Fault injection orchestration |

P3.16 adds the **SRE operational layer** on top — no change to repair correctness.

---

## 2. Distributed Trace / Correlation Layer

### 2.1 Goals

- End-to-end correlation: `read → decision → execution → db → repair → reconcile`
- Drift root-cause reconstruction from structured logs
- Compatible with future OpenTelemetry export (fields map 1:1)

### 2.2 Design

```
┌─────────────────────────────────────────────────────────────┐
│  IdentityTraceContext (AsyncLocalStorage)                   │
│    correlationId  — request/job scope (HTTP or generated)   │
│    txId           — DB transaction scope (write/audit)      │
│    spanStack      — nested phase spans                      │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
  [identity:trace] cid=… span=… parent=… phase=… key=… detail=…
```

**Phases:** `read` | `decision` | `execution` | `db` | `repair` | `reconcile` | `warmup`

**Implementation:** `identity-trace.context.ts`

- `runWithIdentityCorrelation(id, fn)` — HTTP middleware / job entry
- `withIdentitySpan(phase, meta, fn)` — nested spans
- `formatIdentityTraceSuffix()` — append to existing `[identity:*]` logs

### 2.3 Integration points (logging-only)

| Component | Span |
|-----------|------|
| `CollectionIdentityService.readOrResolve` | `read` |
| `evaluateAndRepair` | `decision` → `execution` |
| `IdentityCacheExecutionService.execute` | `execution` |
| `withExclusiveWrite` | `db` (txId = correlationId) |
| `IdentityCacheReconciliationService.runTick` | `reconcile` |
| `IdentityCacheWarmupService.runTick` | `warmup` |

**Constraint:** Trace hooks are **log + metrics annotations only** — no branch changes.

### 2.4 Drift root-cause reconstruction

When drift structured log fires, JSON includes `traceId` and `event=identity_cache_drift`:

```
cid=a1b2 span=decision-3 parent=read-1 key=col-xyz drift=cache_stale
```

Operator query: filter logs by `cid=` → replay ordered phases.

---

## 3. Cache Warmup / Recovery Strategy

### 3.1 Trigger scenarios

| Event | Impact | Recovery |
|-------|--------|----------|
| Cold start (new pod) | L1 empty; L2 may be warm | L2 read-through populates L1 |
| Redis FLUSHALL | L2 empty; L1 may be stale | L2 miss → DB fallback on read; reconcile repairs |
| Mass eviction (TTL expiry) | Cache miss storm | `readOrResolve` populate path + reconcile |

### 3.2 Strategy (no new write semantics)

**Primary recovery:** existing read-through + reconcile (P3.5–P3.6) — already converges.

**Optional bulk warm-up job** (`IdentityCacheWarmupService`):

- **Input:** hot-key LRU snapshot (same source as reconcile)
- **Action:** `readOrResolve(key)` only — triggers populate repair if miss
- **Schedule:** offset from reconcile interval (default: reconcile + 90s)
- **Conflict avoidance:**
  - Skip tick if reconciliation `tickInFlight`
  - Shared repair cooldown (ExecutionService) dedupes cache writes
  - Warmup never calls `execute` directly

### 3.3 Env vars (new)

| Var | Default | Purpose |
|-----|---------|---------|
| `IDENTITY_WARMUP_ENABLED` | `false` | Gate warmup job |
| `IDENTITY_WARMUP_INTERVAL_MS` | `270000` | 4.5 min (offset from 3 min reconcile) |
| `IDENTITY_WARMUP_BATCH_SIZE` | `30` | Keys per tick |
| `IDENTITY_WARMUP_MAX_READS` | `30` | Cap reads per tick |

### 3.4 Decision: proactive bulk warm-up

**Recommendation:** Enable in production **after** Redis flush incidents or L2 cold-start SLO breach. Default **off** — reconcile + read populate sufficient for steady state.

---

## 4. Production Failure Mode Coverage (Extended)

### 4.1 New simulation events

| Event | Models |
|-------|--------|
| `inject_db_commit_cache_write_fail` | DB updated; cache write-through fails |
| `inject_redis_failover` | L2 read stale / write partition mismatch |
| `inject_db_replication_lag` | Stale DB read during decision |
| `inject_repair_stall` | Delay before execute (GC / event loop proxy) |

### 4.2 Mapping: simulation → integration

| Scenario | Simulation | Integration |
|----------|------------|-------------|
| DB commit + cache fail | `inject_db_commit_cache_write_fail` | `chaos_redis_partition` + `db_set` |
| Redis failover | `inject_redis_failover` | `chaos_pod_restart` + split brain |
| Replication lag | `inject_db_replication_lag` | Phase C (read replica) |
| Event loop stall | `inject_repair_stall` | `chaos_db_lock_hold` (timing proxy) |

### 4.3 Invariants (unchanged)

- **I1:** DB authoritative for identity value
- **I5:** Cache converges after recovery path
- Partial projection (cache fail after DB commit) is **expected transient**

---

## 5. System Guardrails / SLO Layer

### 5.1 Composite health score (0–100)

```
score = 100
  - driftRatePenalty     (cache_stale + cache_phantom / drift checks)
  - redisFailurePenalty  (L2 failures / cache hits)
  - repairCooldownPenalty(skipped_cooldown / repairs)
  - reconcileSkipPenalty (skipped / scanned)
```

Exported as `cardhedger_identity_consistency_health_score`.

### 5.2 Alert thresholds (recommended)

| Signal | Warning | Critical |
|--------|---------|----------|
| Drift rate | > 1% | > 5% |
| Redis L2 failures / min | > 10 | > 50 |
| Reconcile skipped ratio | > 50% | > 80% |
| Health score | < 80 | < 60 |

### 5.3 Degradation modes (advisory)

| Mode | Trigger | Action |
|------|---------|--------|
| `normal` | score ≥ 80 | Full reconcile + warmup |
| `throttle` | 60–79 | 50% reconcile repairs; warmup off |
| `protect` | < 60 | 25% repairs; warmup off; alert |

---

## 6. Minimal Implementation Plan

### Phase A (this PR)

- `identity-trace.context.ts`
- Trace suffix in evaluateAndRepair / execute / reconcile tick
- `identity-cache-slo.service.ts`
- Prometheus health score gauge
- `identity-cache-warmup.service.ts` (gated, default off)
- Extended simulation events + `identity-cache-sre.spec.ts`

### Phase B (follow-up)

- HTTP `X-Request-Id` middleware
- Grafana dashboard + PagerDuty alerts

### Phase C (follow-up)

- Redis Sentinel testcontainer
- Postgres read-replica lag test

---

## 7. Test Plan

| Suite | Coverage |
|-------|----------|
| `identity-cache-sre.spec.ts` | SLO score, degradation, trace format, new failure events |
| `identity-cache-correctness.spec.ts` | + partial commit, lag, stall |
| `identity-cache-integration.spec.ts` | parity unchanged |
| `identity-cache-chaos.integration.spec.ts` | + DB commit + cache fail |

**Acceptance:** 34+ unit, 9+ integration pass; no Decision/Execution semantic change.
