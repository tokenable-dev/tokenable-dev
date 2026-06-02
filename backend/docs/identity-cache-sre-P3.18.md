# P3.18 — Production Operations Finalization

> **Status:** Implemented  
> **Scope:** Health SLO surface, L1 memory sweep, Grafana alerts + runbook  
> **Non-goals:** Correctness / Decision / Execution / schema changes

---

## 1. Identity SLO Health Endpoint

**Path:** `GET /api/admin/cardhedger/health?adminWallet=…`

New field `identitySlo` on `CardhedgerHealthPayload`:

| Field | Type | Description |
|-------|------|-------------|
| `healthScore` | `number` | 0–100 composite; `-1` if not yet evaluated |
| `mode` | `normal \| throttle \| protect \| null` | Degradation mode |
| `reasons` | `string[]` | Drift / repair / reconcile derived reasons |
| `evaluatedAt` | `string \| null` | ISO-8601 UTC of last evaluation |

### Source of truth

```
IdentityCacheSloService.evaluate()
        ↓ publishToMetrics()  (60s interval + reconcile tick)
CardhedgerMetricsService.identitySloState
        ↓
  ┌─────┴─────┐
  │           │
Health API   Prometheus gauges
             cardhedger_identity_consistency_health_score
             cardhedger_identity_degradation_mode
```

Admin layer reads **only** from `CardhedgerMetricsService.getIdentitySloEvaluation()` — no duplicate SLO logic in admin.

---

## 2. L1 Cache Sweep

**Class:** `InProcessIdentityCacheProvider`

| Property | Default | Env |
|----------|---------|-----|
| Sweep interval | 5 min | `IDENTITY_L1_SWEEP_INTERVAL_MS` (60s–1h) |

- `sweepExpired()` deletes entries where `Date.now() > expiresAt`
- Does **not** change get/set/exists semantics for live keys
- `OnModuleInit` starts timer; `OnModuleDestroy` clears it

---

## 3. Alerting & Runbook

See:

- [`grafana/identity-cache-alerts.yaml`](./grafana/identity-cache-alerts.yaml)
- [`identity-cache-runbook.md`](./identity-cache-runbook.md)

---

## 4. Verification

```bash
# Unit tests
pnpm test identity-cache --testPathIgnorePatterns=integration
pnpm test cardhedger-health

# Integration (requires Docker)
pnpm test:integration

# Manual health check
curl -s "http://localhost:3000/api/admin/cardhedger/health?adminWallet=0x…" | jq .identitySlo
```
