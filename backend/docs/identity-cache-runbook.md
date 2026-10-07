# Identity Cache Runbook

Operational guide for identity cache SLO degradation modes and alert response.

**Alerts:** `backend/docs/grafana/identity-cache-alerts.yaml`

**Health endpoint:** `GET /api/admin/cardhedger/health?adminWallet=<admin>`  
**Prometheus:** `GET /api/admin/cardhedger/prometheus?adminWallet=<admin>`

Key JSON path: `identitySlo.{ healthScore, mode, reasons, evaluatedAt }`

---

## Degradation Modes

| Mode | Score trigger | Reconcile budget | Warmup |
|------|---------------|------------------|--------|
| `normal` | ≥ 80 | 100% (`IDENTITY_RECONCILIATION_MAX_REPAIRS`) | allowed |
| `throttle` | 60–79 | 50% | disabled |
| `protect` | < 60 | 25% | disabled |

SLO is **advisory** — DB remains source of truth; read-path self-healing still runs.

---

## Normal Mode

**Symptoms:** `identitySlo.mode == "normal"`, healthScore ≥ 80, no active alerts.

**Response:**

1. No action required.
2. Optional: verify drift ratio in `identityObservability.drift` is stable.
3. Confirm reconcile tick logs show expected coverage (`[identity:reconcile] scanned=…`).

---

## Throttle Mode

**Symptoms:** `identitySlo.mode == "throttle"`, healthScore 60–79, reasons may include `drift_rate_warn`, `reconcile_skip_elevated`, or `repair_cooldown_elevated`.

**Automatic behavior:**

- Reconcile max repairs per tick × 0.5
- Warmup job skips (`IDENTITY_WARMUP_ENABLED` has no effect while throttled)

**Response:**

1. Check `identitySlo.reasons` for primary driver.
2. Inspect Redis connectivity: `identityCache.redisConnected`.
3. Review recent deploys or bulk collection updates (write-through burst).
4. Filter logs: `"event":"identity_cache_drift"` and `"traceId"` for stale keys.
5. If drift is transient, wait 1–2 reconcile cycles (default 180s). Score should recover.
6. **Do not** disable `IDENTITY_SERVICE_ENABLED` unless DB integrity is suspect.

**Escalate if:** healthScore stays < 70 for > 30 minutes.

---

## Protect Mode

**Symptoms:** `identitySlo.mode == "protect"`, healthScore < 60, alert `IdentityCacheDegradationProtect` firing.

**Automatic behavior:**

- Reconcile max repairs per tick × 0.25
- Warmup disabled
- Read-path repairs still active (cooldown dedup applies)

**Response:**

1. **Triage Redis / L2:**
   - `identityCache.mode == "layered"` and `redisConnected == false` → fix Redis first.
   - Check `identityObservability.cacheWrite.l2_failed_skip_l1` spike.
2. **Triage drift:**
   - High `cache_stale` → see [Drift spike](#drift-spike).
   - High `cache_phantom` → possible premature cache populate; check write ordering.
3. **Reduce load (optional):**
   - Temporarily increase `IDENTITY_RECONCILIATION_INTERVAL_MS` (e.g. 300000) to reduce scan pressure.
   - Do **not** change Decision/Execution code paths.
4. **Verify DB truth:**
   - Spot-check affected collection keys in DB vs cache via admin tools.
   - DB value always wins; cache self-heals on read.
5. **Recovery criteria:**
   - healthScore ≥ 80 for 10+ minutes
   - `cache_stale` ratio < 1%
   - Mode returns to `normal` in health + Prometheus

**Escalate if:** protect persists > 1 hour or customer-facing resolve errors increase.

---

## Drift Spike

**Alert:** `IdentityCacheDriftStaleSpike`  
**Metric:** `cache_stale / drift_checks > 5%`

**Common causes:**

| Cause | Signal | Action |
|-------|--------|--------|
| Redis failover / partition | `redis_failure_elevated`, L2 disconnect | Restore Redis; reads self-heal |
| Bulk admin writes | `writeHint.applied` spike | Expected; wait for reconcile |
| Replication lag (read replica) | Stale reads, then converge | Verify primary reads in identity path |
| Hot-key churn | `repair_cooldown_elevated` | See [Repair cooldown spike](#repair-cooldown-spike) |

**Commands:**

```bash
# Health snapshot
curl -s "$API/api/admin/cardhedger/health?adminWallet=$ADMIN" | jq '.identitySlo, .identityObservability.drift'

# Trace a key (logs)
grep 'key=<collection-key>' backend.log | grep 'identity:'
```

---

## Repair Cooldown Spike

**Alert:** `IdentityCacheRepairCooldownSpike`  
**Metric:** `skipped_cooldown / total repairs > 30%`

**Meaning:** Many repair attempts hit the 10s per-key dedup window — indicates repeated drift on same keys before cooldown expires.

**Response:**

1. Identify hot keys from reconcile summary (`hotKeyCount`, coverage).
2. Check if reconcile + read-path repair contend on same keys (expected under load).
3. If sustained, consider lowering `IDENTITY_RECONCILIATION_CONCURRENCY` (default 3).
4. **Do not** remove cooldown — it prevents repair storms (P3.5).

---

## Environment Reference

| Variable | Default | Notes |
|----------|---------|-------|
| `IDENTITY_SERVICE_ENABLED` | off | Cache hydrate, write-through, warmup, reconcile. DB first-writes always run. |
| `IDENTITY_RECONCILIATION_ENABLED` | true | Proactive repair |
| `IDENTITY_RECONCILIATION_INTERVAL_MS` | 180000 | Reconcile period |
| `IDENTITY_RECONCILIATION_MAX_REPAIRS` | 20 | Per-tick cap (× SLO multiplier) |
| `IDENTITY_WARMUP_ENABLED` | false | Read-through populate |
| `IDENTITY_L1_SWEEP_INTERVAL_MS` | 300000 | L1 expired-key sweep |
| `IDENTITY_SLO_SCORE_THROTTLE` | 80 | Throttle threshold |
| `IDENTITY_SLO_SCORE_PROTECT` | 60 | Protect threshold |

---

## Quick Decision Tree

```
healthScore < 60?
  ├─ yes → protect mode runbook
  └─ no → healthScore < 80?
           ├─ yes → throttle mode runbook
           └─ no → normal (monitor)
```
