# P3.20 — Identity Logging Stability Lock (superseded by P3.21)

> **Note:** Runtime ownership enforcement removed in P3.21. See [P3.21](./identity-cache-logging-P3.21.md).

---

## Enforced contract

| Domain | Owner (sole caller) | Method |
|--------|---------------------|--------|
| drift | `CollectionIdentityService` | `identityLog.logDrift()` |
| repair | `IdentityCacheExecutionService` | `logRepairOutcome()` → `logRepair()` |
| reconcile | `IdentityCacheReconciliationService` | `identityLog.logReconcile()` |
| write | `CollectionIdentityService` | `identityLog.logWrite()` |

## Guards

- `IdentityLogEventType` enum — all events
- `validateIdentityLogEvent()` — schema (dev/test throw, prod drop + metric)
- `assertIdentityLoggingOwnership()` — domain/caller (dev/test throw, prod warn + drop)
- `traceId` — always present (`no-trace:{key}` fallback)
- Legacy pattern CI ban: `[identity:drift|repair|read|engine]`

## Metrics

- `cardhedger_identity_log_invalid_total` — validation drops (60s window)

## CI

```bash
pnpm check:identity-logs   # grep guard
pnpm test:ci               # guard + unit tests
```

GitHub Actions: `.github/workflows/backend-ci.yml`

---

**Goal:** logging is not flexible — it is enforced as a contract.
