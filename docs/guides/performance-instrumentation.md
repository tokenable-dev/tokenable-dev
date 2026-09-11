# Performance Instrumentation

Tokenable has a lightweight, zero-dependency performance tracing layer on both the backend and frontend. It is **disabled by default** and adds zero overhead when not enabled.

---

## Backend (`backend/src/common/perf/perf.ts`)

### Enable

Set environment variables before starting the server:

```bash
# backend/.env
PERF_LOG=true            # required to activate
PERF_THRESHOLD_MS=200    # log ops slower than 200ms (default)
PERF_THRESHOLD_DB_MS=500 # TypeORM slow-query log threshold (default)
```

### Output format

All output is newline-delimited JSON written directly to `stdout`, bypassing NestJS formatting:

```json
{"perf":"http","method":"GET","path":"/api/marketplace/collections","status":200,"ms":312}
{"perf":"psa","label":"GetByCertNumber","ms":847.32,"cert":"12345678"}
{"perf":"ipfs","label":"fetchMetadataJson","ms":1203.10,"subpath":"QmXxx.../metadata.json"}
{"perf":"rpc","label":"getRwaTokensByOwner","ms":420.55,"owner":"0xabc..."}
{"perf":"db","label":"slow query","ms":650.0,"query":"SELECT ..."}
```

### Categories

| `perf` value | Source | Covers |
|---|---|---|
| `http` | `main.ts` request logger | Every HTTP request (above threshold) |
| `psa` | `PsaPublicApiService` | `GetByCertNumber`, `GetSpecPopulation`, `GetImages`, `OrderProgress` |
| `ipfs` | `IpfsGatewayResolverService` | `fetchMetadataJson`, `resolveImageToHttps` |
| `rpc` | `BlockchainService` | `getRwaTokensByOwner`, `batchOwnerOf`, `batchRwaMetadata` |
| `db` | TypeORM `maxQueryExecutionTime` | Any SQL query exceeding `PERF_THRESHOLD_DB_MS` |

### Utility API

```typescript
import { perfNow, perfLog, elapsedMs } from '@/common/perf/perf';

async function myMethod() {
  const _t0 = perfNow(); // bigint; returns 0n when disabled (zero cost)
  try {
    // ... work ...
  } finally {
    perfLog('myCategory', 'myLabel', elapsedMs(_t0), { extra: 'context' });
  }
}
```

`perfNow()` and `perfLog()` are complete no-ops (single branch check) when `PERF_LOG` is unset.

### Parsing logs (CLI)

Filter and format perf output while the server runs:

```bash
# Stream only perf lines
pnpm start:dev 2>&1 | grep '"perf"'

# Pretty-print with jq
pnpm start:dev 2>&1 | grep '"perf"' | jq .

# Sort by duration (collect 30s, then analyze)
pnpm start:dev 2>&1 | grep '"perf"' | jq -s 'sort_by(-.ms) | .[:20]'

# Show only ops over 500ms
pnpm start:dev 2>&1 | grep '"perf"' | jq 'select(.ms > 500)'
```

---

## Frontend (`frontend/lib/perf/`)

### Enable (no rebuild required)

Toggle via `localStorage` at runtime — works across page refreshes:

```js
// Enable with 100ms threshold
localStorage.setItem('PERF_LOG', '1');
localStorage.setItem('PERF_THRESHOLD_MS', '100'); // optional, default 200ms
location.reload();

// Disable
localStorage.removeItem('PERF_LOG');
location.reload();
```

### Output format

All output goes to `console.log` as JSON strings, parseable in DevTools:

```json
{"perf":"page","label":"initial-load","ms":1243,"ttfb":89.32,"domContentLoaded":1102.1}
{"perf":"route","label":"/marketplace/abc","ms":312,"from":"/"}
{"perf":"query","label":"collection-detail","ms":421.34,"status":"success","keyLen":3}
```

### What is measured

| `perf` | Source | What it tracks |
|---|---|---|
| `page` | `usePageLoadObserver` | Navigation Timing API — TTFB, DOMContentLoaded, full load |
| `route` | `useRoutePerfObserver` | Client-side route transitions (link click → pathname commit) |
| `query` | `useQueryPerfObserver` | TanStack Query fetches — duration from `fetch` action to `success`/`error` |

`PerfObservers` is a null-rendering React component mounted once inside `QueryClientProvider` in `PrivyAppProviders`. It registers all three observers and returns `null`.

### Parsing logs (DevTools)

In the browser console:

```js
// Intercept and collect all perf lines into an array
const perf = [];
const orig = console.log.bind(console);
console.log = (...args) => {
  try { const p = JSON.parse(args[0]); if (p.perf) perf.push(p); } catch {}
  orig(...args);
};

// After some navigation — view sorted by duration
perf.sort((a, b) => b.ms - a.ms);
console.table(perf.slice(0, 20));
```

---

## Thresholds reference

| Variable | Default | Affects |
|---|---|---|
| `PERF_THRESHOLD_MS` (backend env) | `200` | HTTP requests, PSA, IPFS, RPC |
| `PERF_THRESHOLD_DB_MS` (backend env) | `500` | TypeORM `maxQueryExecutionTime` |
| `PERF_THRESHOLD_MS` (frontend localStorage) | `200` | All frontend perf categories |

Setting a threshold of `0` logs every operation (verbose).

---

## Production notes

- Backend: `PERF_LOG` is `false` by default in production. Enable only for short profiling sessions.
- Frontend: `localStorage`-based toggle is per-browser, not deployed config. Safe to keep the instrumentation code in production bundles.
- Both sides write to their respective stdout/console — no third-party services, no network overhead.
