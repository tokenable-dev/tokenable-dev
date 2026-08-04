# Self-vault hold settlement (Option A)

Self-vault mints (`deliveryMode=direct`) persist `rwa_tokens.settlement_policy = self_vault_hold`.

## On-chain (Seaport)

- Ask consideration is a **single** USDC item to `PLATFORM_FEE_RECIPIENT` for the full price.
- Fulfill transfers NFT → buyer and USDC → company. Seller receives **$0** from Seaport.
- Bid-only fulfill (no matching ask) is rejected for these tokens.

## Off-protocol payout

1. Fulfill/match creates `self_vault_settlements` (`pending_confirm`).
2. `seller_payout_usdc` = gross × (1 − `PLATFORM_FEE_BPS` / 10000) — same net as a standard 5% fee sale.
3. Buyer `POST …/confirm` (or admin confirm) → `confirmed`.
4. Ops sends USDC from the company wallet and `POST …/record-payout` with the tx hash → `paid`.

See [business-rules.md](../business-rules.md) BR-8c and [blockchain.md](blockchain.md).
