# P3.21 — Logging Architecture Simplification

> **Status:** Implemented  
> **Goal:** *keep structured logs, remove enforcement complexity*

---

## Before (P3.20) → After (P3.21)

| P3.20 | P3.21 |
|-------|-------|
| CI + runtime ownership enforcement | **CI only** |
| ExecutionService repair logging wrapper | **ExecutionService pure IO** |
| Invalid log → drop (prod) | **Fallback log always emitted** |
| Caller parameter on every emit | **Simple `log*(logger, level, payload)`** |

---

## Architecture

```
CI guard (grep legacy + contract tests)
        ↓
IdentityStructuredLogger
  logDrift / logRepair / logWrite / logReconcile
  validate → fallback on failure (never silent)
        ↓
Service layer callers:
  CollectionIdentityService  → drift, write, repair (after execute)
  ReconciliationService      → reconcile, repair (after execute)
  ExecutionService           → (no logging)
```

---

## Fallback log (no silent drop)

```json
{
  "event": "identity_log_fallback",
  "originalEvent": "identity_cache_write",
  "reason": "schema_invalid",
  "traceId": "no-trace:*",
  "detail": "missing key"
}
```

Metric: `cardhedger_identity_log_invalid_total`

---

## CI (only enforcement layer)

```bash
pnpm check:identity-logs
pnpm test:ci
```

---

**One-line:** structured logs retained; runtime enforcement removed.
