# Gap Detection Report

Generated: 2026-07-03  
Scope: Full repository audit — implementation vs documentation analysis

---

## 1. Documentation Gaps (Missing Coverage)

### 1.1 No User-Facing Redeem UI

**Status:** GAP  
**Issue:** `POST /api/rwa/redeem-request` exists in the backend. No frontend page or hook calls it.  
**Impact:** Users cannot initiate physical card redemptions through the UI; must be done via API directly or admin action.  
**Recommendation:** Build `/vault/redeem` page with `useRedeemFlow` hook, or document that redemption is ops-initiated.

### 1.2 Vault Stepper Does Not Advance

**Status:** BUG / UX GAP  
**Issue:** `frontend/components/vault/mint-form/VaultPageBody.tsx` shows a stepper component with `active={1}` hardcoded. It never advances to step 2 or 3 regardless of mint state.  
**Impact:** Misleading UX during and after mint.  
**Recommendation:** Connect stepper to `useMintForm`'s `step` state.

### 1.3 Frontend ABI Mismatch

**Status:** STALE ARTIFACT  
**Issue:** `frontend/constants/contracts.ts` `TOKENABLE_RWA_MINT_ABI` uses 2-arg `mint(to, tokenURI)`. Current contract requires 3 args `mint(to, tokenURI, vaultRef)`. Also, `TOKENABLE_RWA_EVENTS_ABI` `Minted` event is missing the indexed `vaultRef` field.  
**Impact:** Low (mint is backend-only; these ABIs are not used for minting). But misleading if reused.  
**Recommendation:** Update to match current contract signature, or clearly mark as display-only.

### 1.4 Shipping Steps Not Implemented

**Status:** GAP  
**Issue:** The vault UI has a "Ship to Vault" step label, but there is no actual shipping form, address capture, or tracking number submission in the frontend.  
**Impact:** Physical shipping is entirely manual / out-of-band.  
**Recommendation:** Document that shipping is currently handled off-platform, or build a shipping submission form.

### 1.5 `card_top100_daily_snapshots` Has No Migration File

**Status:** TECH DEBT  
**Issue:** The `card_top100_daily_snapshots` entity exists in TypeORM but has no SQL schema file. Production DBs bootstrapped without TypeORM sync will not have this table.  
**Impact:** Top 100 feature breaks on fresh production bootstrap.  
**Recommendation:** Create `backend/sql/schema/085_card_top100_daily_snapshots.sql` and add to bootstrap.

### 1.6 Polygon Mainnet Not Configured in Frontend

**Status:** KNOWN GAP  
**Issue:** `NEXT_PUBLIC_CHAIN_137_*` is commented out in `frontend/.env`. Polygon mainnet is not active.  
**Impact:** Platform is testnet-only.  
**Recommendation:** Document this as intentional until mainnet readiness. Add to deployment checklist.

---

## 2. Architectural Inconsistencies

### 2.1 `TOKENABLE_RWA_MINT_ABI` vs Contract

The frontend ABI snippet uses the old 2-arg `mint` signature. The deployed contract has a 3-arg signature. Since minting is backend-only, this does not cause runtime failures — but it will mislead any AI or human reading the frontend ABI.

### 2.2 `USDC_ABI` Has Duplicate `allowance` Entry

`frontend/constants/contracts.ts` has two `allowance` entries in `USDC_ABI`. Low impact (ethers deduplicates) but should be cleaned up.

### 2.3 `passport-google-oauth20` Still a Dependency

`backend/package.json` includes `passport-google-oauth20`. The Google Strategy file has been deleted. This is dead weight.

**Recommendation:** Remove from `package.json` and `pnpm-lock.yaml`.

### 2.4 Legacy Auth Services in Production Code

`EmailVerificationService`, `PasswordResetService`, and `VerificationToken` entity remain in the codebase. Routes are removed from the controller. They exist "for admin tooling" but this path is unclear.

**Recommendation:** Audit whether admin tooling actually uses email verification. If not, remove. If yes, document clearly in `docs/api/auth.md`.

---

## 3. Duplicated Logic

### 3.1 Deprecated re-export aliases (~28 files)

`frontend/providers/` is **not** a dead folder — it is the canonical home for React context providers (`AppChainProvider`, `WalletDataProvider`, `AuthProvider`, `MarketplaceQueryPersistence`), imported across the app. However, two files in it are deprecated re-export shims: `providers/PrivyProviders.tsx` (`export * from @/lib/privy/PrivyAppProviders`) and `providers/PrivyAuthBridge.tsx`.

More broadly, ~28 files carry `@deprecated` backward-compat aliases (e.g. `PrivyProviders`, `PrivyAuthBridge`, `bootstrapRwaMintMarketData`, `adminListedRwaCards`, `SEAPORT_ORDER_DOMAIN`). These are intentional shims kept for import stability.

**Recommendation:** Once no internal imports reference a deprecated alias, delete it in a single batched cleanup. Do not remove piecemeal — verify no importers first (`grep` the symbol).

### 3.2 Multiple PSA Token References

`PSA_PUBLIC_API_TOKEN` (singular) and `PSA_PUBLIC_API_TOKENS` (plural, pool) both exist in env documentation and code. The implementation uses `PSA_PUBLIC_API_TOKENS` (pool). `PSA_PUBLIC_API_TOKEN` was the original single-token pattern.

**Recommendation:** Remove `PSA_PUBLIC_API_TOKEN` from all documentation. Document only the pool pattern.

---

## 4. Technical Debt

### 4.1 Internal Dev Email in Frontend Access Gate

```typescript
// frontend/lib/auth/accountAccess.ts
const DEV_EMAIL = 'internal@tokenable.com'  // (approximate)
```

Hardcoded email bypasses KYC check. Must be removed before mainnet production.

### 4.2 Dev Credentials in `docs/`

Default admin credentials (`skyand` / `071725`) appear in documentation. These are dev defaults — production must override via env. The documentation correctly notes to override, but the defaults should not appear in any public-facing docs.

### 4.3 `OrdersService.ensureCollectionForListing` Creates Collections on Listing

Collections are created when the **first ask is placed**, not at mint. This means minted tokens have no collection bucket until listed. The vault admin "cards" page must handle tokens with `collection_key = null`.

**Recommendation:** Consider creating a collection bucket at mint time to improve admin UX.

### 4.4 No Rate Limiting on Public Endpoints

`POST /api/rwa/upload`, `POST /api/psa/analyze`, and `POST /api/auth/privy/session` have no server-side rate limiting. In production, a malicious actor could exhaust PSA API tokens or inflate IPFS storage.

**Recommendation:** Add `@nestjs/throttler` rate limiting to upload and auth endpoints.

### 4.5 `DEFAULT_ADMIN_ROLE` Held by a Hot Wallet

The `DEFAULT_ADMIN_ROLE` (required for contract upgrades) is likely held by the same EOA as MINTER_ROLE/BURNER_ROLE. For mainnet, this should be a hardware wallet or multisig.

---

## 5. Possible Simplifications

### 5.1 Custody + Deliver Could Be Automated

The current flow: mint → custody wallet → admin manually delivers. For every successful mint, an admin action is always required. This could be automated (after ops confirms physical card receipt) using a webhook or scheduled job.

### 5.2 Vault Asset ↔ Collection Bucket Link

`vault_assets` and `marketplace_collections` are not linked in the DB. The connection is through `cert_number → psa_cert_number`. Explicit FK or join table would make vault history queries more efficient.

### 5.3 `user_wallets.wallet_address` Denormalized in `users.wallet_address`

`users.wallet_address` is a denormalized copy of the primary wallet. This creates a dual-write path. Consider making `users.wallet_address` a computed property (join to `user_wallets WHERE is_primary = true`).

---

## 6. AI-Unfriendly Areas

### 6.1 `collection_key` Algorithm

The `computeMarketBucketKey` function (v2) is complex — it incorporates cert number, grading company, grade, parallel variation, and other PSA data. An AI must read `marketplace/utils/bucket-key.util.ts` carefully before touching anything that creates or reads collections.

**Recommendation:** Add a detailed comment block to `bucket-key.util.ts` explaining the v2 algorithm, inputs, and examples.

### 6.2 `identity-cache-*.ts` Files

The identity cache system is split across 5+ files with names like `identity-cache-decision.ts`, `identity-cache-execution.ts`, `identity-cache-reconciliation.ts`. The control flow is non-obvious.

**Recommendation:** Add a `ARCHITECTURE.md` in `backend/src/marketplace/collections/` explaining the identity cache pipeline.

### 6.3 Seaport Order Construction

`lib/seaport/orders/` contains complex EIP-712 typed data construction. The relationship between offer items, consideration items, Conduit key, and criteria items is not documented inline.

**Recommendation:** Add comments or a brief explainer in `lib/seaport/README.md`.

### 6.4 `rwa-token-admin.service.ts` Is Very Long

This service handles custody listing, delivery, burn, redemption confirmation, and vault history — all in one file. It's over 400 lines and growing.

**Recommendation:** Consider splitting into `rwa-custody.service.ts`, `rwa-burn.service.ts`, and `rwa-vault-admin.service.ts`.

---

## 7. Knowledge Silos

### 7.1 PSA Rate Limit Strategy

The multi-token pool, 24h block, UTC midnight reset, and fallback-to-cache behavior are implemented in `psa-public-api.service.ts` but only partially documented. A new developer would not understand the strategy from the code comments alone.

**Status:** Now documented in `docs/business-rules.md` (BR-17, BR-18) and `docs/api/psa.md`.

### 7.2 Vault Cycle Business Rules

The state machine transitions and invariants were entirely undocumented before this audit.

**Status:** Now documented in `docs/architecture/vault-lifecycle.md`.

### 7.3 Privy Session Bridge Behavior

The sequence of: Privy auth → `getAccessToken()` → `POST /auth/privy/session` → cookie → wallet sync was only partially documented.

**Status:** Now documented in `docs/api/auth.md`.

---

## 8. Recommendations for Future Maintenance

1. **Add API rate limiting** to `/rwa/upload` and `/auth/privy/session` endpoints using `@nestjs/throttler`.

2. **Create migration file** for `card_top100_daily_snapshots` (priority: before mainnet launch).

3. **Remove `passport-google-oauth20`** from backend dependencies.

4. **Fix vault stepper** to reflect mint state progression.

5. **Add user-facing redeem flow** — at minimum, document whether this is intentionally admin-only.

6. **Upgrade `DEFAULT_ADMIN_ROLE`** to hardware wallet / Gnosis Safe before mainnet.

7. **Add `ARCHITECTURE.md`** to `backend/src/marketplace/collections/` explaining the identity cache pipeline.

8. **Consider splitting `rwa-token-admin.service.ts`** into domain-specific services.

9. **Add Sentry** (or equivalent) for production error monitoring.

10. **Document `computeMarketBucketKey` v2 algorithm** with detailed inline comments.

11. **Remove hardcoded dev email** from `accountAccess.ts` before mainnet.

12. **Create Seaport order construction explainer** (`lib/seaport/README.md`).
