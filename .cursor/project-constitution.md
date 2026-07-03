# Tokenable Project Constitution

This document is written for AI agents. It describes the platform, architecture, conventions, and constraints that every AI session must understand before making any changes.

**Working order:** follow `AI_WORKFLOW.md`. **Navigation:** `ARCHITECTURE_INDEX.md`. **Philosophy + constraints:** this file. Each rule has exactly one canonical home — do not restate rules across documents.

---

## Platform Purpose

Tokenable is a **non-custodial marketplace for PSA-graded trading card RWAs (Real World Assets)** on Polygon blockchain.

Core user journey:
1. User ships a physical PSA-graded card to the vault
2. PSA cert is looked up; IPFS metadata is uploaded
3. Backend mints an ERC-721 NFT to a **platform custody wallet**
4. Admin delivers the NFT to the user's primary linked wallet
5. User trades the NFT via Seaport 1.5 with USDC settlement
6. User can redeem the NFT to retrieve the physical card (admin burns NFT + ships card)

**Only PSA 10 cards can be minted. This is a hard business rule.**

---

## Technical Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind 4, Privy, wagmi, React Query 5, Zustand 5 |
| Backend | NestJS 11, TypeORM, Ethers.js 6, PostgreSQL 16, Redis 7 |
| Blockchain | Polygon (Amoy 80002 / Mainnet 137), Seaport 1.5, USDC |
| Smart contracts | Solidity 0.8.20, UUPS upgradeable ERC-721, OpenZeppelin 4.9.6 |
| IPFS | Pinata |
| Auth | Privy (email, Google, Apple, embedded wallet, MetaMask) |
| Pricing | Cardhedger (materialized, not live) |
| PSA API | Multi-token pool (rate-limited) |

---

## Architecture Philosophy

### 1. Backend-orchestrated blockchain writes

Users never call the smart contract directly for mint or burn. Only the backend hot wallet (MINTER_ROLE, BURNER_ROLE) submits these transactions. Seaport trading is user-signed.

### 2. Materialized market data

Cardhedger pricing is never fetched on hot reads. `collection_market_snapshots` is the source of truth for the UI. Upstream calls happen in async snapshot workers.

### 3. Privy-only user auth

There is no Google OAuth, email/password, or SIWE in the user-facing auth flow. Legacy services exist in code for admin tooling only. The `auth.controller.ts` exposes only 4 endpoints.

### 4. Custody-first minting

NFTs mint to the platform custody wallet, not the user. Admin delivers via the admin UI. This enables ops verification before NFT delivery.

### 5. One physical card, one active NFT

The `vaultRef` (keccak256 of PSA cert) ensures one active NFT per physical card at any time. This is enforced both on-chain (custom error) and in the backend (vault cycle check).

---

## Engineering Standards (Simplicity First)

This project is maintained by a small team working closely with AI. Optimize for **simplicity, readability, low cognitive load** — NOT theoretical architecture or enterprise patterns.

Every folder, file, abstraction, generic, and helper has a maintenance cost. Only introduce complexity when it provides measurable long-term value.

### Hard rules (from the engineering audit)

1. **No one-function or one-class wrapper files.** If a helper is one or two lines, inline it or colocate it in the file that uses it.
2. **Do NOT split a file just because it is long.** Prefer cohesive files. Split only along a genuine domain boundary that removes real duplication or coupling.
3. **Do NOT create `shared`/`common`/`base`/`core`/`abstract` folders** without strong justification. (`common/` already exists for perf/cache/metrics — that is the exception, not a precedent.)
4. **Do NOT introduce Clean Architecture, CQRS, Factory, or Repository abstractions** beyond what already exists (NestJS default DI + TypeORM repositories).
5. **Abstractions must eliminate meaningful duplication.** Two similar functions do not justify an abstraction; five do.
6. **Business logic must stay easy to trace.** Never hide it behind indirection an engineer cannot follow in one read.
7. **When multiple solutions exist, choose the one a new engineer understands immediately.**

### TypeScript style (codebase baseline is excellent — keep it)

Current state: near-zero `any` (1 occurrence), zero `any` in frontend, minimal non-null assertions. Maintain this bar.

- **No `any`.** Use `unknown` + narrowing, or define a real type.
- **No `as` casting** except at genuine boundaries (JSON parse, external SDK). Never `as unknown as`.
- **No `@ts-ignore` / `@ts-expect-error`** except in `lib/stubs/` peer shims.
- Prefer `type` for unions/aliases, `interface` for object shapes that may be extended.
- Prefer literal unions and discriminated unions (`step: 'idle' | 'uploading' | ...`) over enums.
- Use `Pick`/`Omit`/`Partial` to derive types from a single source rather than duplicating shapes.
- Prefer readable TypeScript over clever generics. Do not add generics that a reader must decode.

### File size guidance (not a hard limit)

Large files are acceptable when cohesive. The known hotspots — `cardhedger-pricing.service.ts` (~1960 lines), `psa.service.ts` (~1710), `psa-public-api.service.ts` (~1520), `collection-market.service.ts` (~1400), `cardhedger-resolve.service.ts` (~1360) — are complexity concentrations to be aware of, but do NOT split them reactively. Split only when a change reveals a natural seam.

### Deprecated aliases

~28 files carry `@deprecated` re-export shims for import stability. Do not add new ones casually. When removing one, first `grep` the symbol to confirm zero importers, then delete in a batched cleanup — never piecemeal.

## Coding Philosophy

### "Consistency over cleverness"

Follow existing patterns exactly. When uncertain, find how the nearest equivalent feature is implemented and match it.

### "Controllers contain no business logic"

Controllers only:
- Parse and validate input (delegated to DTOs)
- Call the appropriate service method
- Return the result

All business logic belongs in services.

### "Services own domain logic"

Each service has a clear domain boundary. Do not reach across modules without using the dependency injection system.

### "DTOs validate all input"

Every controller input must have a DTO with `class-validator` decorators. `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true` is global.

### "Update docs when architecture changes"

Any time you change how a subsystem works, update the corresponding `docs/` file. Documentation is the single source of truth for AI agents starting fresh sessions.

---

## Naming Conventions

### Backend

| Thing | Convention | Example |
|-------|-----------|---------|
| Module | `PascalCase` + `Module` suffix | `VaultModule` |
| Service | `PascalCase` + `Service` suffix | `RwaMintService` |
| Controller | `PascalCase` + `Controller` suffix | `RwaTokenAdminController` |
| Entity | `PascalCase` + `Entity` suffix (file) | `vault-cycle.entity.ts` |
| DTO | `PascalCase` + `Dto` suffix | `MintRwaDto` |
| File names | `kebab-case` with domain prefix | `rwa-mint.service.ts` |
| Env vars | `UPPER_SNAKE_CASE` | `RWA_CUSTODY_PRIVATE_KEY` |

### Frontend

| Thing | Convention | Example |
|-------|-----------|---------|
| Page | `PascalCase` file + `page.tsx` | `app/vault/page.tsx` |
| Component | `PascalCase.tsx` | `MarketplaceAdminCustodyNftsPage.tsx` |
| Hook | `use` prefix, camelCase file | `useMintForm.ts` |
| API client fn | camelCase, domain prefix | `getAdminCustodyNfts()` |
| Query key | `rq.{domain}.{name}()` | `rq.adminCustodyNfts()` |
| Store | `use{Name}Store` | `useAuthStore` |

### Database

| Thing | Convention | Example |
|-------|-----------|---------|
| Table | `snake_case`, plural | `vault_cycles` |
| Column | `snake_case` | `deposited_by_user_id` |
| Migration | `NNN_{snake_case}.sql` | `082_vault_redemptions.sql` |
| Index | `idx_{table}_{columns}` | `idx_rwa_tokens_collection_key` |

---

## Folder Ownership

| Folder | Owns |
|--------|------|
| `backend/src/auth/` | JWT session, Privy verification, legacy admin email tools |
| `backend/src/privy/` | Privy API proxy |
| `backend/src/user/` | User CRUD, wallet sync, KYC |
| `backend/src/rwa/` | IPFS upload, vault mint pipeline, redeem request |
| `backend/src/vault/` | Physical card vault DB state machine |
| `backend/src/blockchain/` | All on-chain reads and writes |
| `backend/src/psa/` | PSA slab OCR, cert lookup, rate-limited API pool |
| `backend/src/cardhedger/` | Pricing data pipeline, Top 100, proxy |
| `backend/src/marketplace/` | Orders, collections, snapshots, portfolio, watchlist, admin |
| `frontend/lib/privy/` | Privy config, session bridge, signing |
| `frontend/lib/seaport/` | Order building, signing, fulfillment |
| `frontend/lib/core/` | API clients, query keys, cache invalidation |
| `frontend/store/` | Global Zustand stores |
| `contracts/` | Smart contracts, tests, deployment scripts |

---

## Dependency Graph (Key)

```
auth.controller → PrivyService → (Privy JWKS)
auth.controller → UserService → DB users/wallets/providers

rwa.controller → RwaMintService
  → VaultService         → DB vault tables
  → RwaChainWriterService → TokenableRWA contract
  → PinataService         → Pinata IPFS

rwa-token-admin.service → RwaChainWriterService
  → UserService
  → VaultService

marketplace/orders → OrdersService
  → CollectionService
  → RwaTokenRegistryService

marketplace/collections → CollectionIdentityService → Redis/DB
  → CardhedgerResolveService → Cardhedger API (cached)
```

---

## Smart Contract Assumptions

1. Token IDs start at 1 and are monotonically increasing — never 0, never reused.
2. `vaultRef = keccak256(certNumber.trim().toUpperCase())` — deterministic, permanent.
3. `activeTokenIdOf(vaultRef)` returns 0 when no active NFT for that cert.
4. `adminBurn` can be called while contract is paused; regular transfers cannot.
5. UUPS proxy address never changes on upgrade.
6. ABI must be re-synced (`pnpm sync-abi`) after any contract change.

---

## Database Assumptions

1. Marketplace core tables have **no FK constraints** — logical links enforced in app code.
2. Vault tables (`vault_cycles`, `vault_redemptions`) have **FK with RESTRICT** — cannot delete referenced rows.
3. Production environment uses `TYPEORM_SYNC=false` — schema is bootstrap SQL only.
4. Partial unique index on `rwa_tokens`: `(token_contract, cert_number) WHERE burned_at IS NULL`.
5. Migration files are numbered and immutable once deployed.

---

## API Philosophy

1. All routes are under `/api` global prefix.
2. Swagger is always up-to-date at `/api/docs`.
3. DTOs document and validate request/response shapes.
4. Never expose internal implementation details in error messages.
5. The `GET /session` endpoint never returns 401 (returns `{ user: null }`).
6. Multi-chain: `x-tokenable-chain-id` header selects chain; `DEFAULT_CHAIN_ID` is fallback.

---

## Performance Philosophy

1. Hot reads are PostgreSQL-only — no upstream API calls on every request.
2. Snapshot workers handle expensive Cardhedger calls asynchronously.
3. Performance logging opt-in via `PERF_LOG=true` with per-category thresholds.
4. PSA cache (`psa_cert_snapshots`) reduces PSA API calls; always check cache first.
5. Identity cache uses L1 (in-process) + L2 (Redis) with DB as source of truth.
6. External API calls carry `AbortSignal.timeout(15_000)` to prevent unbounded hangs.

---

## Security Philosophy

1. Private keys never enter logs or API responses.
2. `JWT_SECRET` and `MARKETPLACE_ADMIN_SESSION_SECRET` must be cryptographically random.
3. `PRIVY_APP_SECRET` is server-only — never in frontend env.
4. Admin routes use a separate session system from user routes.
5. On-chain writes require backend signer — users sign only Seaport trade orders.
6. KYC is required for vault/sell access; enforced in frontend gates.

---

## Things That Must NEVER Be Changed Without Discussion

1. **`vaultRef` derivation formula** — on-chain permanent; changing breaks all existing tokens.
2. **`_nextTokenId` starting value** — must remain 1; no tokens at ID 0.
3. **`adminBurn` burn mechanics** — clearing `activeTokenIdOf` is critical for re-mint.
4. **Seaport contract address** — standard deployed address; never override.
5. **`collection_key` computation algorithm (v2)** — changing breaks all existing orders/collections.
6. **`psa_cert_snapshots` TTL mechanics** — affects PSA rate limit compliance.
7. **JWT cookie name** (`access_token`) — changing logs out all users.
8. **Admin session cookie name** (`marketplace_admin`) — changing logs out all admins.

---

## Things Requiring Manual Approval

1. Smart contract upgrades (requires `DEFAULT_ADMIN_ROLE` — hardware wallet/multisig)
2. `BURNER_ROLE` grant (allows destroying tokens — irreversible)
3. Production database migrations
4. Changes to `bootstrap-empty-prod-db.sql` (affects all new deployments)
5. Changes to CI/CD pipeline (`.github/workflows/`)
6. Rotating `JWT_SECRET` (logs out all users)
7. Changing `PSA_PUBLIC_API_TOKENS` pool configuration

---

## Preferred Implementation Patterns

### New backend feature

1. Define DTO with `class-validator` in `dto/` subfolder
2. Implement logic in service (inject repositories via constructor)
3. Add controller method delegating to service
4. Register in module's `providers` and `exports` arrays
5. Add Swagger decorators to controller method
6. Write unit test for service logic
7. Update relevant `docs/api/` file

### New frontend feature

1. Add API client function in `frontend/lib/core/api/{domain}.ts`
2. Add query key in `frontend/lib/core/queryKeys.ts`
3. Create hook in `frontend/hooks/{domain}/use{FeatureName}.ts`
4. Create component in `frontend/components/{domain}/`
5. Add invalidation in `frontend/lib/core/invalidation.ts` if mutation
6. Wire route in `frontend/app/{path}/page.tsx`

### New SQL migration

1. Number it `NNN_{description}.sql` (next sequential number)
2. Add idempotent DDL (`IF NOT EXISTS`, `IF EXISTS`)
3. Add to `backend/sql/bootstrap-empty-prod-db.sql` with `\ir`
4. Update `docs/architecture/database.md` with the new table/column

### Smart contract change

1. Update `contracts/contracts/TokenableRWA.sol`
2. Add/update tests in `contracts/test/TokenableRWA.test.ts`
3. Run `pnpm test` — all tests must pass
4. If ABI changes: run `pnpm sync-abi` and update backend
5. Deploy via `pnpm upgrade:rwa:amoy` (preserves proxy address)
6. Update address env vars in backend + frontend `.env`
7. Update `docs/architecture/blockchain.md`
