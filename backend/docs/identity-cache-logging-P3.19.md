# P3.19 — Identity Cache Logging Refactor

> **Status:** Implemented  
> **Scope:** Logging / observability only — no Decision / Execution / DB changes

---

## Structured log contract

Each identity cache log line is a single JSON object:

```json
{
  "event": "identity_cache_drift",
  "key": "collection-key",
  "outcome": "cache_stale",
  "context": "read_sync",
  "driftKind": "cache_stale",
  "traceId": "abc123",
  "durationMs": 42
}
```

### Events

| event | level | when |
|-------|-------|------|
| `identity_cache_drift` | warn (stale/phantom), debug (ahead) | drift detected |
| `identity_cache_repair` | info (set/evict/replace), debug (cooldown skip) | repair executed |
| `identity_cache_write` | info / warn | DB write path, seed, audit |
| `identity_cache_reconcile` | info (tick_complete), warn (failures) | reconcile job |

### Volume controls

| Rule | Implementation |
|------|----------------|
| Async drift 1% sample | `shouldSampleAsyncDriftLog` + existing `IDENTITY_CACHE_DRIFT_SAMPLE_RATE` |
| Reconcile 1 line/tick | `identity_cache_reconcile` aggregate only |
| 10s dedup | `IdentityLogDeduper` — same `key` + `event:outcome` |
| Cache hit/miss | metrics only (layered provider logs removed) |
| Metrics window | `cardhedger_metrics_window` no longer includes identity counters |

### Query examples

```bash
# Drift events for a key
grep '"event":"identity_cache_drift"' app.log | grep '"key":"my-col"'

# Reconcile ticks
grep '"event":"identity_cache_reconcile"' app.log | jq .

# Trace correlation
grep '"traceId":"abc123"' app.log
```

---

## Role separation

| Layer | Responsibility |
|-------|----------------|
| **Logs** | Event traces — drift, repair, write, reconcile |
| **Prometheus** | Aggregation — counters, gauges, SLO |
| **Health API** | Snapshot — SLO + observability surface |
