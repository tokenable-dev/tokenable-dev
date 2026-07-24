# P2P marketplace API

Payment escrow P2P sell — see [p2p-payment-escrow.md](../architecture/p2p-payment-escrow.md).

Base path: `/api/marketplace/p2p` (user) · `/api/marketplace/admin/p2p` (admin session).

## Public / user

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/listings` | — | Active `P2P_LISTED` rows |
| GET | `/listings/:id` | — | Listing detail |
| POST | `/listings` | JWT | Mint to custody + list (KYC + authenticityAccepted) |
| POST | `/listings/:id/cancel` | JWT | Cancel + `adminBurn` |
| GET | `/listings/:id/prepare-buy` | — | Escrow params (`escrowOrderId` = hash(listingId), addresses, `alreadyFunded`) |
| POST | `/listings/:id/deposit` | JWT | After on-chain `createAndDeposit` (listing-locked) |
| GET | `/orders/:id` | JWT | Order detail — **buyer/seller only** (ship-to is PII) |
| POST | `/orders/:id/tracking` | JWT | Seller sets FedEx/DHL/UPS tracking |
| POST | `/orders/:id/settle` | JWT | After `confirmReceipt` / timeout release + burn |
| GET | `/me/listings` | JWT | Seller listings |
| GET | `/me/orders?role=buyer\|seller` | JWT | Orders |

### Create listing body

```json
{
  "certNumber": "83179580",
  "tokenURI": "ipfs://…",
  "priceUsdc": "100000000",
  "sellerWallet": "0x…",
  "authenticityAccepted": true
}
```

### Buy flow (client)

1. `GET …/prepare-buy` → `escrowOrderId` (deterministic from listing id), `escrowAddress`, `usdcAddress`, `autoReleaseAt`, `priceUsdc`, `sellerWallet`, `alreadyFunded`
2. If not `alreadyFunded`: USDC `approve` → `createAndDeposit(escrowOrderId, seller, amount, autoReleaseAt)`
3. `POST …/deposit` with ship-to + `depositTxHash` (second concurrent buyer fails on-chain `OrderExists` or DB conflict)
4. After delivery: `confirmReceipt(escrowOrderId)` then `POST …/orders/:id/settle`

Cancel while funded-but-unrecorded: seller cancel auto arbiter-refunds then burns NFT.

## Admin

| Method | Path | Description |
|--------|------|-------------|
| GET | `/marketplace/admin/p2p/orders?status=` | List orders |
| POST | `/marketplace/admin/p2p/orders/:id/refund` | Arbiter `refund` + burn NFT |

Requires marketplace admin cookie session (`assertAdminSession`).

## Env

```
CHAIN_{id}_PAYMENT_ESCROW_ADDRESS=0x…
PAYMENT_ESCROW_ARBITER_PRIVATE_KEY=   # optional; defaults to RWA_OWNER
P2P_AUTO_RELEASE_SECONDS=604800
P2P_NO_SHIP_CRON=1
P2P_AUTO_RELEASE_CRON=1
```
