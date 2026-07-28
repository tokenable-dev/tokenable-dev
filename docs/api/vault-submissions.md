# Vault submissions API

Sell-flow package tracking (draft → ship → PSA → mint link).

**Auth:** `JwtAuthGuard` (cookie session).  
**Base:** `/api/vault/submissions`

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/` | List my submissions (newest first) |
| `GET` | `/:idOrPublicId` | Detail by uuid or `SUB-…` |
| `POST` | `/draft` | Upsert draft cards (`{ publicId?, cards[] }`) |
| `PATCH` | `/:idOrPublicId/draft` | Same as draft with pinned public id |
| `POST` | `/:idOrPublicId/packing-slip` | Mark packing slip downloaded |
| `POST` | `/:idOrPublicId/tracking` | Register carrier + tracking → `in_transit` |

### Card payload

```json
{ "cert": "12345678", "name": "…", "grade": 10, "img": null, "confirmed": true }
```

### Response

Includes `scenario` (`A`–`H`) for Vault-Detail UI, plus `items[]` and shipment fields.

### Draft resume (frontend)

Sell flow persists progress so users can leave and return:

| Layer | What |
|-------|------|
| `localStorage` (`tk_sell_flow_draft`) | Card list (cert, confirm flags) |
| `localStorage` (`tk_sell_flow_progress`) | Step (`register` / `cards` / `shipping-pack` / `shipping-track`), packing checklist, tracking form |
| Account API `POST /draft` | Debounced upsert while signed in; rehydrate on return if local empty |

Vault hub lists `draft` and `awaiting_shipment` with **Continue** / **Ship**. After tracking confirm, local draft keys are cleared (shipment record kept).

Users can move freely before shipment confirm: clickable **Submit / Ship / Portfolio** indicators, Back buttons (register ↔ cards ↔ pack ↔ track), and add/remove of PSA cards on Add Cards or the shipping package list.

### Mint bridge

`RwaMintService` calls `attachCycleForCert` after `reserveCycleForDeposit`, then `markItemCompletedForCycle` after successful mint — linking sell-flow items to `vault_cycles` / live portfolio.

### Admin ops

Marketplace admin session (not JWT): `/api/marketplace/admin/vault-submissions` — counts, list, mark arrived, package/item status. UI: `/marketplace/admin/vault/submissions`. See [marketplace-admin.md](./marketplace-admin.md).
