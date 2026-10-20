# PriceCharting integration

PriceCharting is integrated as a **server-side Prices proxy** so the API token never reaches the browser. Use Swagger (`/api/docs` → tag `pricecharting`) to explore responses before wiring DB ingest.

**Env**

| Variable | Required | Purpose |
|----------|----------|---------|
| `PRICECHARTING_API_TOKEN` | yes (for live calls) | 40-char token from Subscription → API/Download |
| `PRICECHARTING_CSV_URL` | for `/csv` | Full Legendary CSV download URL from the same page |
| `PRICECHARTING_BASE_URL` | no | Default `https://www.pricecharting.com` |
| `PRICECHARTING_HTTP_TIMEOUT_MS` | no | JSON timeout (default 30000) |

---

## What we proxy (and what we do not)

| Upstream | Our route | Use |
|----------|-----------|-----|
| `GET /api/product` | `GET /api/pricecharting/product` | Single product (`id` / `upc` / `q`). Same keys as one CSV row. |
| `GET /api/products` | `GET /api/pricecharting/products` | Search, max 20 (`q`). Matching / exploration. |
| Legendary CSV download | `GET /api/pricecharting/csv` | Bulk dump → intended DB source of truth. |

**Not proxied:** Marketplace APIs (`/api/offers`, `offer-publish`, `offer-ship`, `offer-refund`, …). Those automate selling on PriceCharting’s own marketplace and are unrelated to Tokenable vault / Seaport.

---

## Limits

- **JSON:** 1 call / second (upstream hard limit; enforced in-process).
- **CSV:** 1 download / 10 minutes (upstream); files regenerate ~every 24h — daily is enough.
- Nest `@Throttle` also caps per-IP abuse on the proxy.

---

## Price units

- **JSON Prices API:** integer **pennies** (`1732` = $17.32).
- **CSV:** USD with two decimal places (column names match Prices API keys).

---

## Implementation

| Piece | Path |
|-------|------|
| Module | `backend/src/pricecharting/pricecharting.module.ts` |
| Upstream client | `backend/src/pricecharting/pricecharting.service.ts` |
| HTTP + Swagger | `backend/src/pricecharting/controllers/pricecharting-proxy.controller.ts` |
| Stable error codes | `backend/src/pricecharting/pricecharting-errors.ts` |

Clients never send `t`. The service overwrites any client-supplied `t` with `PRICECHARTING_API_TOKEN`.

---

## Follow-on (not in this module yet)

- Persist CSV into our DB and serve reads from there (PriceCharting license expects caching; do not hit upstream per user request).
- Purge stored data if the subscription ends.
