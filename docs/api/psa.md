# PSA API

**Controller:** `backend/src/psa/psa.controller.ts`  
**Base path:** `/api/psa`  
**Swagger tag:** `psa`

Analyzes graded card slabs using OCR and looks up the result against the **PSA Public API**. Used in the Vault (mint) flow.

---

## Routes

### `POST /api/psa/analyze`

**Content-Type:** `multipart/form-data`

Runs the full pipeline:
1. Crop slab image (front required, back optional)
2. Cardhedger OCR + slab OCR to extract cert number candidates
3. Lookup against PSA Public API → return validated metadata + Cardhedger market data

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `slabFront` | file | Yes | Slab front image (JPEG/PNG/WebP, max 15 MB) |
| `slabBack` | file | No | Slab back image |
| `certNumber` | string | No | Manual cert override (digits only or `https://www.psacard.com/cert/…`) — takes priority over OCR |

**Response:** `PsaAnalyzeResult`

```json
{
  "certNumber": "83179580",
  "cardName": "Pikachu",
  "cardSet": "Base Set",
  "cardNumber": "58",
  "gradeScore": "10",
  "gradingCompany": "psa",
  "psaSpecId": "1234567",
  "psaTotalPopulation": 500,
  "imageUrl": "https://...",
  "cardhedgerCardId": "1745765714667x...",
  "cardhedgerSearchQuery": "Pikachu 1999 Base Set"
}
```

---

### `POST /api/psa/analyze-by-cert`

**Content-Type:** `application/json`

Performs PSA lookup by cert number only, without slab images.

**Request body:**

```json
{ "certNumber": "83179580" }
```

Accepts cert number digits or full PSA cert URL (`https://www.psacard.com/cert/83179580`).

**Response:** Same `PsaAnalyzeResult` shape as `/analyze`.

---

## Related Environment Variables

| Variable | Purpose |
|----------|---------|
| `PSA_PUBLIC_API_TOKEN` | PSA Public API bearer token (optional — cert lookup degrades gracefully without it) |
| `CARDHEDGER_API_KEY` | Used for Cardhedger OCR and card-match enrichment |

## Troubleshooting

- **500 on deployed server:** Check backend logs for `PSA analyze failed:`. Common causes:
  - `sharp` native module issue (Dockerfile uses `node:22-bookworm-slim` to avoid Alpine musl incompatibility)
  - OOM on small instances
  - Outbound HTTPS blocked
  - Upload size exceeds Nginx `client_max_body_size` or Multer limit (15 MB)
- Verify `sharp` in container: `node -e "require('sharp'); console.log('ok')"`

See also: [guides/troubleshooting.md](../guides/troubleshooting.md)
