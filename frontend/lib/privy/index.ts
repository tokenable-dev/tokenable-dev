/**
 * Privy integration — single entry point for the frontend.
 *
 * ## Flow
 * 1. `PrivyAppProviders` — wraps app when `NEXT_PUBLIC_PRIVY_APP_ID` is set
 * 2. `PrivySignInLauncher` — auth UI → Privy `login()`
 * 3. `PrivySessionBridge` — Privy token → `POST /auth/privy/session` → Tokenable cookie
 * 4. `PrivyWalletLauncher` — activate / link wallet via Privy + refresh session
 * 5. `useSeaportOrderSigner` — Seaport EIP-712 via Privy SDK
 *
 * Canonical home: `frontend/lib/privy/`
 * Backend: `backend/src/auth/privy/` (token verify) + `backend/src/privy/` (API proxy/funding)
 * KYC/Sumsub: `frontend/lib/kyc/` + `backend/src/kyc/`
 */

export {
  PRIVY_APP_ID,
  isPrivyEnabled,
  isPrivyGoogleLoginEnabled,
  isPrivyWalletLoginEnabled,
  privyDefaultChain,
  privyClientConfig,
  privyConfig,
  wagmiPrivyConfig,
} from "./config";

export {
  syncPrivySession,
  refreshPrivyAuthSession,
  registerPrivySignOut,
} from "./session";

export {
  findPrivyWalletByAddress,
  isPrivyEmbeddedWallet,
  isPrivyExternalWallet,
  pickPrimaryPrivyWallet,
  resolveActivePrivyWallet,
  shouldUsePrivySdkForSigning,
} from "./wallet";

export { createPrivySeaportSigner, type PrivySignTypedDataFn } from "./signing";

export { useSeaportOrderSigner } from "./useSeaportOrderSigner";
export { usePrivyWalletUnlink } from "./useWalletUnlink";

export { PrivyAppProviders } from "./PrivyAppProviders";
export { PrivySessionBridge } from "./PrivySessionBridge";
export { PrivySignInLauncher } from "./PrivySignInLauncher";
export { PrivyWalletLauncher } from "./PrivyWalletLauncher";
