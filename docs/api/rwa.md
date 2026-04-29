# RWA — IPFS Upload

**Controller:** `backend/src/rwa/rwa.controller.ts`  
**Base path:** `/api/rwa`  
**Swagger tag:** `rwa`

Uploads card image and metadata to **Pinata (IPFS)** and returns a `tokenURI` that can be passed to the `TokenableRWA.mint()` on-chain call.

---

## Routes

### `POST /api/rwa/upload`

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Token name |
| `description` | string | Yes | Token description |
| `image` | file | No* | JPEG/PNG image file (max 10 MB) |
| `imageUrl` | string | No* | External image URL (alternative to `image` file) |
| `attributes` | string | No | JSON string — `[{"trait_type": "...", "value": "..."}]` |
| `gradedMetadata` | string | No | JSON string — `{ graded, attributes?, external_url? }` — merged PSA/Cardhedger data |

\* Either `image` file or `imageUrl` must be provided.

**Response:**

```json
{
  "tokenURI": "ipfs://Qm.../metadata.json",
  "metadataCid": "Qm...",
  "imageCid": "Qm...",
  "imageUrl": "https://gateway.pinata.cloud/ipfs/Qm..."
}
```

---

## Related Environment Variables

| Variable | Purpose |
|----------|---------|
| `PINATA_JWT` | Pinata API JWT for uploads |
| `PINATA_GATEWAY` | Custom Pinata gateway domain (e.g. `mygateway.mypinata.cloud`) |
