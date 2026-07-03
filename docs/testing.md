# Testing

Testing strategy, test file locations, and how to run tests across the monorepo.

---

## Testing Philosophy

- **Unit tests** cover pure business logic, parsers, utilities, and service methods with mocked dependencies
- **Integration tests** cover multi-service flows with real DB (test containers or in-memory)
- **Contract tests** cover smart contract behavior end-to-end with Hardhat
- **Type checking** is CI-enforced as a form of compile-time testing

No E2E browser tests currently. Manual smoke testing performed on dev/staging.

---

## Backend Tests

### Framework

- **Jest** via NestJS test scaffolding (`@nestjs/testing`)
- Config: `backend/jest.config.ts`
- Run: `cd backend && pnpm test` (watch) or `pnpm test:ci` (CI, no watch)

### Test files

| File | Type | What it covers |
|------|------|----------------|
| `auth/privy/privy-user.parser.spec.ts` | Unit | Privy user profile parsing edge cases |
| `marketplace/utils/psa-upstream-policy.util.spec.ts` | Unit | PSA upstream call policy logic |
| `psa/psa-public-api-rate-limit.util.spec.ts` | Unit | PSA token pool rotation + 429 handling |
| `rwa/pinata/pinata-filename.util.spec.ts` | Unit | IPFS filename normalization |
| `privy/privy-funding.util.spec.ts` | Unit | Privy wallet funding utility |
| `marketplace/admin/user-admin.service.spec.ts` | Unit | User admin service methods |
| `user/user-management.integration.spec.ts` | Integration | User CRUD, wallet sync, KYC flow |

### CI

`backend-ci.yml` workflow runs on PRs/pushes affecting `backend/**`:
1. Identity legacy log ban check (grep for disallowed log patterns)
2. `pnpm test:ci` — Jest with coverage

### Type checking

```bash
cd backend && pnpm exec tsc --noEmit
```

Must pass before merging.

---

## Smart Contract Tests

### Framework

- **Hardhat** + **ethers.js** (via `@nomicfoundation/hardhat-ethers`)
- **Chai** assertions

### Run

```bash
cd contracts && pnpm test
```

### Test file: `TokenableRWA.test.ts`

Full coverage including:

| Test category | Cases |
|---------------|-------|
| Initialization | roles assigned, tokenId starts at 1, royalty set |
| Mint | success, ZeroAddress revert, EmptyTokenURI, EmptyVaultRef, VaultRefAlreadyActive |
| VaultRef invariant | activeTokenIdOf, isVaultRefActive, vaultRef on burned tokens |
| MintBatch | success, max 50, ArrayLengthMismatch, BatchTooLarge |
| AdminBurn | success, OwnerMismatch, burn while paused |
| Pause | blocks mint/transfer, allows burn |
| ERC-2981 | royaltyInfo calculation |
| ContractURI | set + event |
| UUPS upgrade | upgrade succeeds, state preserved, roles intact |
| Full lifecycle | mint → transfer → burn → re-mint cycle |

---

## Frontend Tests

No Jest tests currently. TypeScript type checking is the primary static verification.

### Type checking

```bash
cd frontend && pnpm exec tsc --noEmit
```

### Conventions for future tests

When adding frontend tests:
- Use **Vitest** (compatible with Vite/Next.js ecosystem)
- Test hooks in isolation with `renderHook` from `@testing-library/react`
- Mock API calls with `msw` (Mock Service Worker)
- Place test files adjacent to the component/hook: `MyComponent.test.tsx`

---

## Running All Type Checks

```bash
# Backend
cd backend && pnpm exec tsc --noEmit

# Frontend
cd frontend && pnpm exec tsc --noEmit

# Contracts (via Hardhat compilation)
cd contracts && pnpm compile
```

---

## Linting

```bash
# Backend
cd backend && pnpm lint && pnpm format

# Frontend
cd frontend && pnpm lint
```

Backend uses ESLint with NestJS config. Frontend uses Next.js ESLint config.

---

## Testing New Features Checklist

For any new backend feature:

- [ ] Add unit test for the core service logic
- [ ] Add integration test if it touches multiple services or DB
- [ ] Run `pnpm exec tsc --noEmit` to catch type errors
- [ ] Run `pnpm test:ci` to ensure no regressions
- [ ] Test Swagger via `GET /api/docs` for any new DTOs

For contract changes:

- [ ] Add tests in `contracts/test/TokenableRWA.test.ts`
- [ ] Test the upgrade path explicitly
- [ ] Run `pnpm sync-abi` after changes and update backend

For PSA / rate-limited APIs:

- [ ] Write unit tests with mocked HTTP clients
- [ ] Cover the 429 backoff path explicitly

---

## Test Data

For integration tests requiring DB state:
- Use `backend/sql/seed-marketplace-admin.sql` for admin credentials
- Use `backend/sql/seed-dev-platform-chart-fills.sql` for marketplace chart data
- Vault data is created programmatically; no seed scripts for vault tables
