# Privy auth migration

> **Status (Jun 2026):** Phases 0–3 are complete. Privy is the active authentication and wallet
> management system in development. Legacy Google OAuth and email/password code remains in the
> codebase until Phase 6 cleanup.

Replace Tokenable's custom auth (Google OAuth, email/password, MetaMask link) with **Privy** for login, wallets, and (later) KYC — while keeping Seaport trading logic unchanged.

## Target architecture

```
User → Privy (email / social / passkey / embedded wallet / MetaMask external)
         ↓ access token
Frontend → POST /api/auth/privy/session (Bearer)
         ↓ verify via Privy JWKS + upsert users row + auto-link wallets
Backend  → issue Tokenable access_token cookie (transitional; removed in Phase 6)
         ↓
Seaport  → wagmi + viem (Privy wagmi connector; MetaMask via Privy external wallets)
```

**MetaMask:** Privy supports external wallets (including MetaMask browser extension and WalletConnect). Users connect MetaMask through Privy's wallet management UI; wagmi reads the active Privy-connected wallet.

## Phases

| Phase | Goal | Status |
|-------|------|--------|
| **0** | Privy Dashboard setup (domains, login methods, embedded wallet, KYC provider) | ✅ Done |
| **1** | Foundation: packages, DB columns, `/auth/privy/session`, PrivyProvider + wagmi bridge | ✅ Done |
| **2** | Login UX: replace SignInModal / login pages with Privy `login()`; legacy auth behind flag | ✅ Done |
| **3** | Wallet: remove manual link challenge; auto-sync embedded + external wallets via Privy | ✅ Done |
| **4** | Trading QA: EIP-712 list/bid/buy/mint on all supported chains with embedded + MetaMask | 🔲 Pending |
| **5** | KYC: Sumsub WebSDK → `users.kyc_status`; wire `isKycComplete()` | 🚧 In progress — see [sumsub-kyc.md](./sumsub-kyc.md) |
| **6** | Cleanup: remove Google OAuth, email/password, wallet-link challenge, legacy JWT cookie | 🔲 Pending |
| **7** | User migration: existing Google/email users re-link via Privy (email match) | 🔲 Pending |

## What changed (Phases 1–3 summary)

### Backend

| File | Change |
|------|--------|
| `backend/sql/schema/069_users_privy_kyc.sql` | Added `privy_id`, `kyc_status`, `kyc_verified_at` to `users` |
| `backend/src/auth/privy/` | New `PrivyService`, `parsePrivyUserProfile`, JWT verification, user parser |
| `backend/src/auth/auth.service.ts` | `authenticatePrivyAccessToken()` — verify token, upsert user + wallets |
| `backend/src/auth/auth.controller.ts` | `POST /api/auth/privy/session` endpoint |
| `backend/src/privy/` | Privy catalog controller, Privy API proxy (users, funding) |
| `backend/src/user/user.service.ts` | `findOrCreateFromPrivy()` — upsert by `privy_id` or email |
| `backend/src/user/entities/user.entity.ts` | New columns: `privyId`, `kycStatus`, `kycVerifiedAt` |
| Removed | `backend/src/auth/strategies/google.strategy.ts` |
| Removed | `backend/src/auth/wallet-link.util.ts`, `wallet-link.util.spec.ts`, `dto/link-wallet.dto.ts` |

### Frontend

| File | Change |
|------|--------|
| `frontend/lib/privy/` | Privy config, session bridge, sign-in/wallet launchers, wagmi config, signing utilities |
| `frontend/lib/privy/PrivyAppProviders.tsx` | Root Privy + wagmi + QueryClient provider tree |
| `frontend/lib/privy/PrivySessionBridge.tsx` | Syncs Privy auth state → Tokenable `access_token` cookie |
| `frontend/providers/PrivyAuthBridge.tsx` | Re-sync on wallet list changes; returnTo redirect |
| `frontend/providers/PrivySignInLauncher.tsx` | Global `openSignIn()` → Privy `login()` |
| `frontend/providers/PrivyWalletLauncher.tsx` | Global `openConnectWallet()` → Privy `linkWallet()` |
| `frontend/components/auth/PrivyAuthEntryPage.tsx` | `/login`, `/signup` entry UI (replaces `EmailAuthForm`) |
| `frontend/components/auth/PrivyWalletMismatchModal.tsx` | Switch / unlink wallet via Privy (replaces `WalletMismatchModal`) |
| `frontend/hooks/auth/usePrivyWalletUnlink.ts` | Privy `unlinkWallet` + session refresh |
| `frontend/lib/auth/refreshPrivyAuthSession.ts` | Shared session re-sync helper |
| `frontend/lib/auth/signOut.ts` | `completeSignOut()` — clears both Tokenable cookie and Privy session |
| Removed | `SignInModal`, `EmailAuthForm`, `AuthProviderButtons`, `ConnectWalletModal`, `WalletMismatchModal` |
| Removed | `useWalletLink`, `linkWalletFlow`, `connectMetaMaskWallet`, auth callback page |

## Phase 0 checklist (Privy Dashboard)

- [x] **Domains:** `localhost:3000`, staging, production
- [x] **Login methods:** Google, email
- [x] **Embedded wallets:** create on login
- [x] **External wallets:** MetaMask / WalletConnect enabled
- [ ] **Production upgrade** before >150 test users
- [x] **App secret** stored in backend env only
- [ ] **KYC:** enable Privy identity verification (Phase 5)

## Environment variables

### Frontend (`frontend/.env`)

| Variable | Required | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Phase 1+ | From Privy Dashboard |
| `NEXT_PUBLIC_PRIVY_GOOGLE_LOGIN` | Optional | `true` to show Google button in Privy modal |

`NEXT_PUBLIC_PRIVY_ENABLED` has been removed — Privy is always enabled when `NEXT_PUBLIC_PRIVY_APP_ID` is set.

### Backend (`backend/.env`)

| Variable | Required | Notes |
|----------|----------|-------|
| `PRIVY_APP_ID` | Phase 1+ | Same as frontend App ID |
| `PRIVY_APP_SECRET` | Phase 1+ | Server-only; never expose to client |
| `PRIVY_JWT_VERIFICATION_KEY` | Optional | PEM public key from Privy Dashboard; avoids JWKS fetch on every verify |
| `PRIVY_ENABLED` | Optional | Gate `/auth/privy/*` and `/privy/*` routes |

Legacy auth env vars remain until Phase 6 (`GOOGLE_*`, `JWT_SECRET`, SMTP, etc.).

## Database changes

### `069_users_privy_kyc.sql` (Phase 1)

```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS privy_id VARCHAR(128) NULL,
  ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(16) NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMPTZ NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_privy_id_unique
  ON users (privy_id)
  WHERE privy_id IS NOT NULL;
```

- `kyc_status` enum: `none` | `pending` | `approved` | `rejected`

## API

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/auth/privy/session` | Verify Privy access token → upsert user → set `access_token` cookie |
| `GET` | `/api/auth/session` | Unchanged — reads Tokenable JWT cookie |
| `GET` | `/api/privy/catalog` | List all Privy features and integration status |

See [api/auth.md](../api/auth.md#privy-session-endpoint) for full request/response details.

## How session sync works

```
1. User completes Privy login (email / Google / passkey / wallet)
2. Privy issues an access token (short-lived JWT)
3. PrivySessionBridge calls POST /api/auth/privy/session with Bearer token
4. Backend: verifyAccessToken (JWKS / PEM) → fetchUser (Privy API) → findOrCreateFromPrivy
5. Backend: issues Tokenable access_token HttpOnly cookie (7-day)
6. All subsequent API calls use the Tokenable cookie (unchanged backend auth flow)
7. On Privy wallet list change → PrivyAuthBridge re-syncs session
8. On logout → completeSignOut() clears both Privy session and Tokenable cookie
```

## Risk register

| Risk | Mitigation |
|------|------------|
| Existing users get a new embedded wallet address | Phase 7 email-based account merge; communicate re-link flow |
| wagmi / @privy-io/wagmi peer dep conflicts | Pin viem 2.52; validate `signTypedData` early in Phase 4 QA |
| KYC stub blocks sell flow | Keep dev bypass (`kycStatus === 'none'` treated as allowed) until Phase 5 |
| Privy dev plan 150-user cap | Upgrade Privy plan before public beta |
| Deploy frontend missing `NEXT_PUBLIC_PRIVY_APP_ID` | CI bakes it at Docker build — see [deployment.md](./deployment.md#privy-on-deploy-login--wallet--not-fiat-pay) |
| Backend missing `PRIVY_APP_SECRET` on EC2 | Set in `/home/ubuntu/.env.production.backend` and recreate backend container |

## Fiat on-ramp (Apple Pay / Google Pay — later)

Privy **does** support fiat funding via:

| SDK hook | What it opens |
|----------|----------------|
| `useFundWallet()` | Privy modal — card, Apple Pay, Google Pay (via MoonPay and other providers configured in Dashboard) |
| `useFiatOnramp()` | Direct on-ramp flow with destination chain/asset |
| `useFundWalletWithBankDeposit()` | ACH / wire / SEPA (mainnet, provider-dependent) |

**Current repo status:** Header uses **custom wallet menu** (`HeaderWalletMenu` / `HeaderMobileWalletSection`) — HTML `tk-wallet.js` parity. Privy `UserPill` kept in dev lab (`/dev/privy`, `PrivyFeaturesLab.tsx`) and profile/mismatch flows. Add funds / export key: use `/profile` or dev lab until a product entry is added to the custom menu.

### Header wallet menu

HTML prototypes (`tk-wallet.js`) show a **Tokenable product dropdown** (Portfolio, Watchlist, KYC, Sign out) — not Privy’s account menu.

| Approach | Feasible? | Notes |
|----------|-----------|--------|
| Restyle / extend `UserPill` dropdown | **No** | Menu items are Privy-owned (Add funds, linked accounts, export key, logout). No API to inject app nav links. |
| Custom chip + dropdown + Privy hooks | **Yes** | **Implemented** — `components/layout/header/wallet/*`, styles in `tokenable-wallet-menu.css`. |
| CSS-only overrides on Privy portal | Fragile | SDK updates break styling; does not add Portfolio/Watchlist items. |

Do not patch Privy menu DOM in the header; use hooks + our dropdown for app navigation.

**Why it does not work on Amoy for real deposits:**

- On-ramp providers settle **mainnet** assets only — testnet cannot receive card/Apple Pay deposits.
- Privy Dashboard must enable **Funding** / MoonPay (or other) providers for your app.
- Destination chain USDC contract must match the chain the user selected.

**When enabling pay (future):**

1. Privy Dashboard → **Funding** → enable MoonPay (and/or other providers)
2. Configure supported mainnet chains (e.g. Polygon `137`)
3. Set `NEXT_PUBLIC_CHAIN_137_*` contract addresses in GitHub Secrets + rebuild frontend
4. Test with `NEXT_PUBLIC_PRIVY_FUNDING_ENVIRONMENT=sandbox` and Dashboard MoonPay sandbox keys
5. Confirm **UserPill → Add funds** opens MoonPay before production

See `frontend/lib/privy/features.ts` → `PRIVY_CLIENT_FEATURE_MATRIX` for feature flags.

## Testing checklist (current state)

1. Set `NEXT_PUBLIC_PRIVY_APP_ID` (frontend) and `PRIVY_APP_ID` + `PRIVY_APP_SECRET` (backend)
2. Run DB migration `069_users_privy_kyc.sql`
3. Sign in via Privy login modal — should redirect back and set session cookie
4. `GET /api/auth/session` returns user with `privyId` populated
5. Connected wallet address appears in Profile page
6. Wallet unlink / switch via Profile → wallet section works without page reload
7. Sign out clears both Privy state and `access_token` cookie
8. `pnpm exec tsc --noEmit` passes in both `frontend/` and `backend/`
