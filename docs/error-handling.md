# Error Handling

Patterns and conventions for error handling across backend, frontend, and smart contracts.

---

## Backend Error Conventions

### HTTP error format

All NestJS exceptions return standard JSON:

```json
{
  "statusCode": 400,
  "message": "certNumber must be a string",
  "error": "Bad Request"
}
```

ValidationPipe errors return an array of `message` strings when multiple fields fail.

### NestJS exception types

| Exception | Status | When to use |
|-----------|--------|-------------|
| `BadRequestException` | 400 | Invalid input, failed validation, business rule violation |
| `UnauthorizedException` | 401 | Missing or invalid JWT |
| `ForbiddenException` | 403 | Authenticated but not authorized (e.g., recipient not linked to user) |
| `NotFoundException` | 404 | Resource not found (token, collection, user) |
| `ConflictException` | 409 | Duplicate resource (open vault cycle, cert already active) |
| `InternalServerErrorException` | 500 | Unexpected errors; on-chain failures |

### Service vs controller errors

- **Services** throw NestJS exceptions — they own business logic and know why something failed
- **Controllers** do not catch exceptions; they propagate to the global exception filter
- Never catch and swallow exceptions silently

### Blockchain errors

RPC and contract revert errors are caught in `RwaChainWriterService` and re-thrown as appropriate NestJS exceptions:

- `VaultRefAlreadyActive` → `ConflictException` with cert number context
- `OwnerMismatch` → `ConflictException`
- RPC unavailable → `InternalServerErrorException` with error details in message

**Compensating transactions:** When an on-chain mint succeeds but DB recording fails, `VaultService` cancels the vault cycle to allow retry.

### PSA API errors

- `429 Too Many Requests` → token blocked in multi-token pool; next token used on retry
- `404` → cert not found; returned to client as business error
- Network timeout → caught and rethrown; AbortSignal.timeout(15_000) prevents hangs

---

## Frontend Error Conventions

### React Query mutation errors

Mutations use the `status` / `error` pattern:

```typescript
const { mutate, status, error } = useMutation({ mutationFn: doSomething });
// status: 'idle' | 'pending' | 'success' | 'error'
```

Error messages from API responses are extracted from `error.message` (Axios/fetch response body).

### Component-level error states

Form components expose a local `step` state union:

```typescript
type Step = 'idle' | 'uploading' | 'minting' | 'success' | 'error'
```

On error, display `step === 'error'` UI with actionable message and retry option.

### Hooks

- Hooks with `isError` and `error` follow React Query conventions
- Never swallow mutation errors silently — always surface to UI or log
- `submitLockRef` pattern prevents double-submit during async operations

### Wallet/chain errors

- Wagmi/viem contract call failures are caught and displayed as toast or inline error
- Chain ID mismatch is handled by `NetworkSwitcher` component
- Privy embedded wallet not ready: `useEnsureAccountWalletReady()` returns `isReady` flag; wait before calling

---

## Smart Contract Errors

All revert reasons use **custom errors** (EIP-838) for gas efficiency:

```solidity
error VaultRefAlreadyActive(bytes32 vaultRef, uint256 existingTokenId);
error OwnerMismatch();
error ZeroAddress();
error EmptyTokenURI();
error EmptyVaultRef();
error ArrayLengthMismatch();
error BatchTooLarge();
```

Custom errors can be decoded in the backend via ethers.js `Contract.interface.parseError()`.

---

## Logging Conventions

### Backend

Production logging: structured JSON via `@nestjs/common` `Logger`.

```typescript
private readonly logger = new Logger(MyService.name);
this.logger.log('message');
this.logger.warn('message');
this.logger.error('message', error.stack);
```

**Performance logging** (opt-in via `PERF_LOG=true`):

```json
{ "category": "psa", "label": "analyze-cert", "ms": 342, "certNumber": "83179580" }
```

### What NOT to log

- Private keys
- JWT tokens
- Privy tokens or secrets
- Full user PII beyond email/userId for correlation
- Raw PSA API responses in production (can contain personal data)

The CI pipeline runs a **legacy log ban** script (`backend-ci.yml`) to prevent disallowed log patterns.

### Frontend

- `console.error` for unexpected errors in development
- Production: errors visible to user via UI; no console spam
- `NEXT_PUBLIC_MARKETPLACE_PIPELINE_DIAG=true` enables extra marketplace diagnostic logs

---

## Error Tracking

No automated error tracking (Sentry, Datadog APM) currently configured. Errors are visible via:

- `docker logs tokenable-backend` on EC2
- GA4 for frontend events

Recommendation: add Sentry for production error monitoring.

---

## Common Error Scenarios

### "VaultRefAlreadyActive"

**Cause:** User tries to mint a cert that already has an active NFT (same vault cycle open).

**Response:** `409 Conflict` with message explaining the cert is already minted.

**Resolution:** Admin burns existing NFT first, or user waits for existing cycle to complete.

### "Recipient address not linked to user"

**Cause:** `recipientAddress` in mint DTO doesn't match any wallet in `user_wallets` for the JWT user.

**Response:** `403 Forbidden`.

**Resolution:** User must link the wallet via Privy before minting to it.

### "Token not owned by custody wallet"

**Cause:** Admin tries to deliver a token that was already delivered or transferred.

**Response:** `409 Conflict`.

**Resolution:** Check token owner on-chain; update DB if delivery already happened.

### "BURNER_ROLE not granted"

**Cause:** Backend wallet is missing `BURNER_ROLE` on the contract (e.g., after upgrade).

**Response:** `500` with `BURNER_ROLE not granted` message.

**Resolution:** Run `pnpm grant-burner:amoy` or `upgrade-tokenable-rwa.ts` (includes auto-grant).

### PSA API exhausted

**Cause:** All tokens in `PSA_PUBLIC_API_TOKENS` pool are blocked (24h each).

**Response:** Mint form PSA lookup fails; UI shows error.

**Resolution:** Add more tokens to the pool, or wait until midnight UTC when blocked tokens reset.
