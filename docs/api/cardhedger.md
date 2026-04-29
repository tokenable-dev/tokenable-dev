# Cardhedger Proxy API

**Controllers:** `backend/src/cardhedger/controllers/*.controller.ts`  
**Base paths:** `/api/cardhedger`, `/api/cardhedger/v1/cards`, `/api/cardhedger/v1/download`  
**Swagger tag:** `cardhedger`

All routes proxy requests to the **Cardhedger upstream API**. Requires `CARDHEDGER_API_KEY` to be set in the backend environment.

The market indexes endpoint (`/indexes`) is also backed by a 24-hour scheduled refresh cache — data is fetched at server startup and refreshed daily, so the response is always fast.

---

## Catalog & Indexes

### `GET /api/cardhedger/catalog`

Returns the Cardhedger API operation list and base URL.

---

### `GET /api/cardhedger/indexes`

Returns dashboard market indexes for Pokemon, MLB, NFL, and NBA.  
Data is cached at server startup and refreshed every 24 hours.

---

## Card Search (`/api/cardhedger/v1/cards`)

### `POST /api/cardhedger/v1/cards/card-search`
Card search by name/set/number.

### `POST /api/cardhedger/v1/cards/card-match`
AI-powered card matching (used internally by collection detail and PSA analyze pipelines).

### `POST /api/cardhedger/v1/cards/set-search`
Search by set name.

### `POST /api/cardhedger/v1/cards/search-cards-wsort`
Card search with sorting options.

---

## Card Details

### `POST /api/cardhedger/v1/cards/card-details`
Returns card detail by Cardhedger card ID.

### `POST /api/cardhedger/v1/cards/card-request`
Submit a card data request (requires commercial agreement with Cardhedger).

---

## Pricing

### `POST /api/cardhedger/v1/cards/price-estimate`
Single card price estimate.

### `POST /api/cardhedger/v1/cards/batch-price-estimate`
Batch price estimate.

### `POST /api/cardhedger/v1/cards/prices-by-card`
Current prices by Cardhedger card ID.

### `POST /api/cardhedger/v1/cards/prices-by-cert`
Prices by PSA cert number.

### `POST /api/cardhedger/v1/cards/batch-prices-by-cert`
Batch prices by PSA cert numbers.

### `POST /api/cardhedger/v1/cards/details-by-certs`
Batch card details by cert numbers.

### `POST /api/cardhedger/v1/cards/all-prices-by-card`
All latest prices for a card (all grades).

### `POST /api/cardhedger/v1/cards/comps`
Comparable recent sales (COMPS) data.

---

## Market Data

### `GET /api/cardhedger/v1/cards/top-movers`

| Query | Description |
|-------|-------------|
| `count` | Number of results |
| `category` | Filter by category (e.g. `pokemon`, `nfl`) |

### `POST /api/cardhedger/v1/cards/90day-prices-by-grade`
90-day price history by grade.

### `POST /api/cardhedger/v1/cards/90day-prices-by-grade-search`
90-day price history by grade + text search.

### `POST /api/cardhedger/v1/cards/additions-summary`
Summary of recent card additions.

### `POST /api/cardhedger/v1/cards/price-updates`
Poll for price delta changes.

### `POST /api/cardhedger/v1/cards/subscribe-price-updates`
Subscribe to price update events.

### `POST /api/cardhedger/v1/cards/sales-stats-by-player`
Sales statistics by player/subject.

### `POST /api/cardhedger/v1/cards/total-sales-by-player`
Total sales count by player/subject.

---

## Image-Based

### `POST /api/cardhedger/v1/cards/image-search`
Search cards by uploading an image.

### `POST /api/cardhedger/v1/cards/details-by-cert-ocr`
Upload a graded card image → returns card details via OCR.

### `POST /api/cardhedger/v1/cards/prices-by-cert-ocr`
Upload a graded card image → returns price data via OCR.

---

## Issues

### `GET /api/cardhedger/v1/cards/issues`

| Query | Description |
|-------|-------------|
| `status` | Filter by issue status |

### `POST /api/cardhedger/v1/cards/issues`
Submit a data issue report.

### `GET /api/cardhedger/v1/cards/issues/:issue_id`
Returns a single issue by ID.

---

## Download

### `GET /api/cardhedger/v1/download/daily-price-export/:file_date`

Daily price export file.

| Param | Format | Description |
|-------|--------|-------------|
| `file_date` | `YYYY-MM-DD` | Export date |

---

## Related Environment Variables

| Variable | Purpose |
|----------|---------|
| `CARDHEDGER_API_KEY` | Required for all Cardhedger proxy routes |
