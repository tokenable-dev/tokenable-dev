# Architecture Index

Navigation guide for both humans and AI agents. Read this first before working on any subsystem.

**Last updated:** 2026-07-03 | **Status:** Reflects current implementation.

> **New session?** Follow [`AI_WORKFLOW.md`](AI_WORKFLOW.md) for the step order, and read [`.cursor/project-constitution.md`](.cursor/project-constitution.md) for philosophy and invariants. This index answers "I need to modify X → which files do I read?"

---

## Platform Purpose

**Tokenable** is a **non-custodial marketplace for PSA-graded trading card RWAs** (Real World Assets) on Polygon blockchain. Users vault physical PSA 10 cards, receive ERC-721 NFTs, and trade them via Seaport 1.5 with USDC settlement.

---

## Index by Subsystem

### Authentication

| | |
|---|---|
| **Documentation** | `docs/api/auth.md` |
| **Implementation** | `backend/src/auth/`, `backend/src/privy/`, `backend/src/user/` |
| **Frontend** | `frontend/lib/privy/`, `frontend/store/authStore.ts`, `frontend/components/auth/` |
| **Database tables** | `users`, `user_wallets`, `user_auth_providers`, `user_kyc_events` |
| **Required reading before changes** | `docs/api/auth.md`, `docs/architecture/backend.md` |

Key facts:
- Auth is **Privy-only** (user-facing). No Google OAuth, no email/password in production.
- Backend issues an HttpOnly JWT cookie after verifying the Privy access token.
- `JwtAuthGuard` protects user routes; marketplace admin uses a separate session.
- Every Privy session syncs wallets to `user_wallets` and providers to `user_auth_providers`.

---

### Vault Lifecycle (NFT Mint → Deliver → Burn)

| | |
|---|---|
| **Documentation** | `docs/architecture/vault-lifecycle.md` |
| **Business rules** | `docs/business-rules.md` (BR-1 through BR-7) |
| **Backend** | `backend/src/rwa/`, `backend/src/vault/`, `backend/src/blockchain/rwa-chain-writer.service.ts` |
| **Admin API** | `docs/api/marketplace-admin.md` |
| **Frontend (vault form)** | `frontend/app/vault/`, `frontend/components/vault/`, `frontend/hooks/vault/useMintForm.ts` |
| **Frontend (admin)** | `frontend/app/marketplace/admin/custody-nfts/`, `frontend/components/marketplace/admin/MarketplaceAdminCustodyNftsPage.tsx` |
| **Database tables** | `vault_assets`, `vault_cycles`, `vault_redemptions`, `rwa_tokens` |
| **Contract** | `contracts/contracts/TokenableRWA.sol` |
| **Required reading before changes** | `docs/architecture/vault-lifecycle.md`, `docs/architecture/blockchain.md`, `docs/business-rules.md` |

Key facts:
- Mints go to **platform custody wallet**, not user. Admin delivers via `/admin/rwa-tokens/:id/deliver`.
- `vaultRef = keccak256(certNumber.toUpperCase())` — permanent on-chain identity for the physical card.
- Only **PSA 10** graded cards can mint (enforced at `/api/rwa/upload`).
- Same cert can be re-minted after burn (partial unique index in DB + contract `activeTokenIdOf` clears).

---

### Smart Contract (TokenableRWA)

| | |
|---|---|
| **Documentation** | `docs/architecture/blockchain.md` |
| **Source** | `contracts/contracts/TokenableRWA.sol` |
| **ABI (synced copy)** | `backend/src/blockchain/abis/tokenable-rwa.abi.ts` |
| **Tests** | `contracts/test/TokenableRWA.test.ts` |
| **Deploy scripts** | `contracts/scripts/` |
| **Backend writer** | `backend/src/blockchain/rwa-chain-writer.service.ts` |
| **Required reading before changes** | `docs/architecture/blockchain.md`, `docs/business-rules.md` (BR-19 through BR-21) |

Key facts:
- UUPS upgradeable ERC-721 + ERC-2981 + AccessControl + Pausable
- Roles: `MINTER_ROLE`, `BURNER_ROLE`, `PAUSER_ROLE`, `DEFAULT_ADMIN_ROLE`
- Token IDs start at 1 and never reuse
- After upgrade: always run `pnpm sync-abi` and redeploy backend

---

### Marketplace (Seaport Trading)

| | |
|---|---|
| **Documentation** | `docs/api/marketplace.md`, `docs/architecture/materialized-market-snapshots.md` |
| **Backend** | `backend/src/marketplace/orders/`, `backend/src/marketplace/collections/`, `backend/src/marketplace/snapshots/` |
| **Frontend** | `frontend/lib/seaport/`, `frontend/hooks/unified-order-book/`, `frontend/components/marketplace/` |
| **Database tables** | `orders`, `marketplace_collections`, `collection_market_snapshots` |
| **Required reading before changes** | `docs/api/marketplace.md`, `docs/architecture/materialized-market-snapshots.md` |

Key facts:
- Seaport 1.5 only; no relational bid/ask matching
- Settlement currency: USDC (6 decimals); platform fee = 5% via Seaport consideration
- Market pricing is **materialized** (DB-first, not live Cardhedger calls)
- Collection bucket (`collection_key`) is created on **first ask listing**, not at mint

---

### PSA Integration

| | |
|---|---|
| **Documentation** | `docs/api/psa.md`, `docs/guides/cardhedger-psa-variety.md` |
| **Implementation** | `backend/src/psa/` |
| **Rate limit util** | `backend/src/psa/psa-public-api.service.ts` |
| **Cache table** | `psa_cert_snapshots` |
| **Required reading before changes** | `docs/api/psa.md`, `docs/business-rules.md` (BR-17, BR-18) |

Key facts:
- PSA free tier ~1 req/day per token — mitigated by `PSA_PUBLIC_API_TOKENS` pool
- Responses cached in `psa_cert_snapshots`; TTL = `PSA_PUBLIC_SNAPSHOT_DB_TTL_SEC`
- 429 responses block a token for 24h (until next UTC midnight)

---

### Cardhedger Integration (Pricing)

| | |
|---|---|
| **Documentation** | `docs/api/cardhedger.md`, `docs/architecture/materialized-market-snapshots.md` |
| **Implementation** | `backend/src/cardhedger/` |
| **Database tables** | `collection_market_snapshots`, `cardhedger_price_*` tables |
| **Required reading before changes** | `docs/architecture/materialized-market-snapshots.md` |

Key facts:
- Never called on every market GET — snapshot workers only
- `collection_market_snapshots` is the hot read path
- Stale-while-revalidate: stale row triggers async refresh, does not block response

---

### Portfolio

| | |
|---|---|
| **Documentation** | `docs/api/marketplace.md` (portfolio section) |
| **Implementation** | `backend/src/marketplace/portfolio/` |
| **Database table** | `portfolio_daily_snapshots`, `portfolio_hidden_holdings` |

Key facts:
- Daily snapshot at 09:00 KST via cron
- Snapshots are **write-once** (never overwritten)
- Hidden holdings are off-chain UI preferences; NFT stays in wallet

---

### User Management

| | |
|---|---|
| **Documentation** | `docs/api/auth.md`, `docs/api/marketplace-admin.md` |
| **Implementation** | `backend/src/user/user.service.ts` |
| **Database tables** | `users`, `user_wallets`, `user_auth_providers`, `user_kyc_events` |
| **Required reading before changes** | `docs/api/auth.md`, `docs/architecture/database.md` |

Key facts:
- `users` is keyed by `privy_id` (primary) or `email` (legacy fallback)
- KYC status on `users.kyc_status`; events in `user_kyc_events` (append-only)
- Multiple wallets per user; one `is_primary = true`

---

### Database Schema

| | |
|---|---|
| **Documentation** | `docs/architecture/database.md` |
| **Entities** | `backend/src/**/entities/*.ts` |
| **SQL migrations** | `backend/sql/schema/` |
| **Bootstrap** | `backend/sql/bootstrap-empty-prod-db.sql` |
| **Required reading before schema changes** | `docs/architecture/database.md` |

Key facts:
- 22 TypeORM entities; 20+ tables
- No FK constraints in marketplace core (logical links only)
- Vault tables (080-084) use FKs with RESTRICT
- Never edit deployed migration files — add a new numbered file

---

### Deployment & CI/CD

| | |
|---|---|
| **Documentation** | `docs/guides/deployment.md` |
| **CI pipeline** | `.github/workflows/deploy.yml`, `.github/workflows/backend-ci.yml` |
| **Docker** | `docker-compose.yml`, `docker-compose.ec2.yml` |
| **Required reading before changes** | `docs/guides/deployment.md` |

Key facts:
- Push to `develop` → dev EC2; push to `main` → prod EC2
- `NEXT_PUBLIC_*` vars are baked into frontend Docker image at build time
- Backend secrets in `/home/ubuntu/.env.production.backend` on EC2 (not in git)

---

### Local Development

| | |
|---|---|
| **Documentation** | `docs/guides/local-setup.md` |
| **Backend** | Port 4100 (`PORT=4100` in dev), TypeORM sync enabled |
| **Frontend** | Port 3000, proxies `/api` to backend |
| **Swagger** | `http://localhost:4100/api/docs` |

---

### Admin Console

| | |
|---|---|
| **Documentation** | `docs/guides/marketplace-admin.md`, `docs/api/marketplace-admin.md` |
| **Route** | `/marketplace/admin` (separate auth from user session) |
| **Backend** | `backend/src/marketplace/admin/`, `backend/src/marketplace/collections/rwa-token-admin.controller.ts` |

---

### Security

| | |
|---|---|
| **Documentation** | `docs/security.md` |
| **Key files** | `backend/src/auth/guards/jwt-auth.guard.ts`, `backend/src/auth/strategies/jwt.strategy.ts` |
| **Required reading before any auth or secret changes** | `docs/security.md` |

---

### Testing

| | |
|---|---|
| **Documentation** | `docs/testing.md` |
| **Backend tests** | `backend/src/**/*.spec.ts` |
| **Contract tests** | `contracts/test/TokenableRWA.test.ts` |
| **CI** | `.github/workflows/backend-ci.yml` |

---

## Files to Always Read Before Modifying Each Area

| If you're changing... | Always read these first |
|-----------------------|------------------------|
| Auth / Privy session | `docs/api/auth.md`, `backend/src/auth/privy/privy-user.parser.ts` |
| Vault mint flow | `docs/architecture/vault-lifecycle.md`, `backend/src/rwa/rwa-mint.service.ts`, `backend/src/vault/vault.service.ts` |
| Smart contract | `docs/architecture/blockchain.md`, `contracts/test/TokenableRWA.test.ts` |
| Database schema | `docs/architecture/database.md`, existing schema file(s) in that domain |
| Marketplace trading | `docs/api/marketplace.md`, `docs/architecture/materialized-market-snapshots.md` |
| Admin RWA ops | `docs/api/marketplace-admin.md`, `backend/src/marketplace/collections/rwa-token-admin.service.ts` |
| PSA integration | `docs/api/psa.md`, `backend/src/psa/psa-public-api.service.ts` |
| Frontend state | `frontend/store/authStore.ts`, `frontend/lib/core/queryKeys.ts`, `frontend/lib/core/invalidation.ts` |
| Deployment | `docs/guides/deployment.md`, `.github/workflows/deploy.yml` |

---

## Business Rules Quick Reference

See `docs/business-rules.md` for the full list. Critical invariants:

- **Only PSA 10** cards can mint
- **One active NFT** per PSA cert at any time
- **Mints go to custody wallet** — admin delivers to user
- **vaultRef is permanent** — never changes, survives burn
- **Seaport only** — no relational order matching
- **No live Cardhedger on reads** — always materialized snapshots
- **JWT + Privy only** for user auth — no Google OAuth / email-password
