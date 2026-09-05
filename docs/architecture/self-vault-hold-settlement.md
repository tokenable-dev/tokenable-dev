# Self-vault hold settlement (Option A)

Self-vault mints (`deliveryMode=direct`) persist `rwa_tokens.settlement_policy = self_vault_hold`.

## On-chain (Seaport)

- Ask consideration is a **single** USDC item to `PLATFORM_FEE_RECIPIENT` for the full price.
- Fulfill transfers NFT → buyer and USDC → company. Seller receives **$0** from Seaport.
- Bid-only fulfill (no matching ask) is rejected for these tokens.

## Off-protocol payout

1. Fulfill/match creates `self_vault_settlements` (`pending_confirm`). Unique key is **`order_hash`** (not `token_id`) — each sale of the same card gets its own row (e.g. A→B then B→C before auto-pay → **two** open payouts).
2. `seller_payout_usdc` = gross × (1 − `PLATFORM_FEE_BPS` / 10000) — same net as a standard 5% fee sale.
3. **Admin early payout** — `POST …/execute-payout` (confirm if still pending, then platform-fee-wallet USDC → seller) → `paid`.
4. **Auto payout** — cron every minute pays rows still `pending_confirm` or `confirmed` once `created_at` + delay has passed (default **300s / 5 min**). Auto path confirms then pays. Skip if `rejected` or already `paid`. Each row’s delay is independent.
5. Buyer `POST …/confirm` (or admin confirm) still works as an optional status step before early pay; not required for auto pay.

Ask create stamps `parameters._settlementPolicy`. On fulfill, ledger creation uses that stamp, `rwa_tokens.settlement_policy`, or the full-platform-take consideration shape (so resales still get a row if lookup is flaky).

**Disable / tuning:** `SELF_VAULT_AUTO_PAYOUT_CRON=0` turns the cron off; `SELF_VAULT_AUTO_PAYOUT_DELAY_SECONDS` overrides the delay (default `300`).

**Admin UI:** `/marketplace/admin/self-vault-payouts` — **Needs action** = `status=open` (`pending_confirm` | `confirmed`) on the active chain. Same token with multiple open rows shows **Sale N of M**. Pay early, reject, or wait for auto. Repair: **Backfill missing sales**. APIs: `GET/POST /api/marketplace/admin/self-vault-settlements…` (admin session).

**Platform fee wallet key:** set `PLATFORM_FEE_PRIVATE_KEY` in backend `.env` (must derive the same address as `PLATFORM_FEE_RECIPIENT`). Admin **Pay seller** and auto-payout both use this key. Never commit the key; treat it like `RWA_OWNER_PRIVATE_KEY`.

See [business-rules.md](../business-rules.md) BR-8c and [blockchain.md](blockchain.md).
