# P3 Final — Observability Stabilization Report

> **Scope:** Analysis + minimal logging-only cleanup (P3.1–P3.21 correctness frozen)  
> **Date:** Final stabilization pass

---

## 1. Role separation — Logs / Metrics / Health

| Signal layer | Purpose | Refresh | Operator use |
|--------------|---------|---------|----------------|
| **Structured logs** | Event trace — *what happened to key X, when* | Real-time | Root-cause, correlation by `traceId` |
| **Prometheus** | Aggregation — *how much, what rate* | 60s window gauges | Alerting, dashboards, SLO |
| **Health API** | Snapshot — *current posture* | On request | Manual triage, runbook entry |

### The 3 signals operators should watch

1. **`identitySlo.healthScore` + `mode`** (Health / Prometheus) — *should I worry?*
2. **`cardhedger_identity_cache_drift_total{kind="cache_stale"}` / drift_checks** (Prometheus) — *is cache diverging from DB?*
3. **`identity_cache_reconcile` tick_complete** OR **`identity_cache_repair`** with `traceId` (Logs) — *which keys, what action?*

Everything else is supporting detail.

---

## 2. Log event taxonomy (final)

| Category | Event | Level | When | Required? | Removable? |
|----------|-------|-------|------|-----------|------------|
| **drift** | `identity_cache_drift` | warn (stale/phantom), debug (ahead) | Drift detected, repair **not** applied | When un repaired drift | ✅ Coalesce when repair succeeds (P3 Final) |
| **repair** | `identity_cache_repair` | info (set/evict/replace), debug (cooldown) | Cache mutation executed or cooldown skip | **Yes** — primary fix trace | Keep |
| **reconcile** | `identity_cache_reconcile` | info (tick_complete), warn (failures) | 1 line per reconcile tick | **Yes** — batch summary | Keep (not duplicated per-key) |
| **write** | `identity_cache_write` | info / warn | DB write path, seed, audit | On state change only | `seed_skip` debug OK |
| **fallback** | `identity_log_fallback` | warn | Schema validation failure | Rare — must never silent | Keep |

### Non-structured (operational only)

| Source | Pattern | Keep? |
|--------|---------|-------|
| Redis provider | `[identity:cache] redis …` | **Yes** — infra failures |
| Boot | `[identity] CollectionIdentityService ENABLED` | **Yes** — once per pod |
| Boot | `[identity:reconcile/warmup] job=…` | **debug only** (P3 Final) |

---

## 3. Observability consistency matrix

| Concept | Log | Prometheus | Health API |
|---------|-----|------------|------------|
| Drift (cache_stale) | `identity_cache_drift.outcome=cache_stale` | `identity_cache_drift_total{kind="cache_stale"}` | `identityObservability.drift.cache_stale` |
| Drift rate | — (sampled) | `stale / drift_checks` (derived) | `identitySlo.reasons` (`drift_rate_*`) |
| Repair applied | `identity_cache_repair.outcome=set\|evict\|replace` | `identity_cache_repair_total{outcome}` | `identityObservability.cacheRepair.*` |
| Repair cooldown | `outcome=skipped_cooldown` (debug) | `…{outcome="skipped_cooldown"}` | `cacheRepair.skipped_cooldown` |
| Reconcile tick | `tick_complete` + hit/miss/repair/skipped | `identity_reconciliation_total{outcome}` | `reconciliation.*` + `reconciliationState` |
| SLO score | — | `identity_consistency_health_score` | `identitySlo.healthScore` |
| Degradation | — | `identity_degradation_mode` | `identitySlo.mode` |
| Invalid log schema | `identity_log_fallback` | `identity_log_invalid_total` | — |

**Naming is consistent** — same outcome vocabulary across layers.

### Gaps (document only — no code change)

| Gap | Recommendation |
|-----|----------------|
| Health `identitySlo` lacks numeric `driftRate`, `repairCooldownRate` | Add fields in future ops PR (optional) |
| Health lacks `evaluatedAt`-aligned drift window | Use Prometheus for rates; health for mode |
| Async drift logs 1% sample vs metrics 100% sample on sync | See §4 sampling |

### SLO correlation (verified)

```
healthScore = 100
  − min(40, driftRate × 400)      ← cache_stale + cache_phantom / driftChecks
  − min(25, redisFailureRate × 250)
  − min(15, repairCooldownRate × 50)
  − min(20, reconcileSkipRate × 40)

mode: protect (<60) → reconcileRepairMultiplier 0.25, warmup off
mode: throttle (<80) → multiplier 0.5, warmup off
```

**Feedback loop (by design):** protect → fewer reconcile repairs → slower convergence → score may stay low until drift source clears. Not a bug.

---

## 4. Log reduction plan (applied + recommended)

### Applied (P3 Final — logging only)

| Change | Effect |
|--------|--------|
| Drift suppressed when repair applied on same key | −~40% drift+repair pairs on read_sync |
| Repair log carries `driftKind` when coalesced | Root cause preserved in 1 line |
| Reconcile/warmup boot → `debug` | −2 info lines per pod restart |

### Keep

- Reconcile `tick_complete` (1/tick) — **not** redundant with metrics; logs give `traceId` + timestamp anchor
- Per-key `identity_cache_repair` on reconcile path — keys not visible in read traffic
- Redis L2 warn logs — only signal for failover/partition
- `skipped_cooldown` at debug — visible when log level turned up

### Sampling recommendation (config, not code)

| Setting | Default | Prod suggestion |
|---------|---------|-----------------|
| `IDENTITY_CACHE_DRIFT_SAMPLE_RATE` | 0.01 | **0.05** if async drift traces too sparse; **0.01** if log volume high |
| Dedup window | 10s | Keep |

Async path: metrics still record drift on sync sample only (`shouldRecordDriftMetric`); async fire-and-forget does **not** increment drift metrics — logs are the only async visibility. Raising sample rate to 5% improves operability without correctness impact.

---

## 5. Scenario sufficiency

| Scenario | Required logs | Required metrics | Root cause via |
|----------|---------------|------------------|----------------|
| **cache_stale burst** | `identity_cache_repair` + `driftKind`, reconcile tick | drift_total, repair_total, health_score | traceId → key; SLO reasons |
| **redis failover** | Redis `[identity:cache] redis …` warn | redis_failure_total, redisConnected | health.identityCache |
| **DB latency spike** | (none specific — by design) | resolve paths unaffected | APM / DB metrics external |
| **reconcile backlog** | tick_complete `skipped` high | reconciliation skipped, coverage_ratio | SLO `reconcile_skip_elevated` |
| **warmup cold start** | (none — warmup silent when disabled) | cache miss rate ↑ | hits/misses by layer |

**DB latency:** identity path uses single SELECT; no dedicated log — acceptable; use infra APM.

**Warmup disabled (default):** expect L2 miss spike after deploy — normal; watch `identity_cache_misses_total`.

---

## 6. L1 sweep × reconcile interaction

| Concern | Status |
|---------|--------|
| L1 sweep emits logs | **None** (silent TTL cleanup) — no conflict |
| Sweep vs repair ordering | Sweep removes **expired** keys only; repair sets fresh TTL — no race on semantics |
| Same-key log ordering | read → decision span → execution span → repair log; reconcile uses separate `traceId` per tick |
| E2E reconstruct | Filter `traceId` from repair/drift log → same cid in reconcile tick for batch context |

**Trace flow example:**

```
identity_cache_reconcile  traceId=abc  outcome=tick_complete  repair=3
identity_cache_repair       traceId=abc  key=col-x  outcome=set  driftKind=cache_stale  context=reconcile
```

Read-path repairs use decision span detail as `context`; `no-trace:key` fallback when outside ALS.

---

## 7. CI guard (unchanged)

```bash
pnpm check:identity-logs   # legacy pattern ban
pnpm test:ci               # contract + unit tests
```

---

## 8. Summary

| Area | Status |
|------|--------|
| Correctness | Frozen P3.1–P3.21 |
| Log taxonomy | 5 categories, coalesced drift+repair |
| Metrics ↔ Health ↔ Logs | Consistent naming; health SLO is SSOT with Prometheus |
| Operational complexity | Reduced — boot noise down, duplicate drift removed |
| Remaining risk | **Complexity**, not bugs — use 3-signal model above |

**One-line:** Structured logs for traces, Prometheus for alerts, Health for posture — don't read all three for the same question.
