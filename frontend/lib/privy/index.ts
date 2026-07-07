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
 * ## Env
 * - `NEXT_PUBLIC_PRIVY_APP_ID` — required
 * - Default login: Google + email OTP (`resolvePrivyLoginMethods`)
 * - `NEXT_PUBLIC_PRIVY_LOGIN_MINIMAL=true` — email only
 * - `NEXT_PUBLIC_PRIVY_FULL_LOGIN=true` — all methods (dev)
 * - `NEXT_PUBLIC_PRIVY_WALLET_LOGIN=true` — external wallet login
 *
 * Backend mirror: `backend/src/auth/privy/`
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

export { PrivyAppProviders, PrivyProviders } from "./PrivyAppProviders";
export { PrivySessionBridge, PrivyAuthBridge } from "./PrivySessionBridge";
export { PrivySignInLauncher } from "./PrivySignInLauncher";
export { PrivyWalletLauncher } from "./PrivyWalletLauncher";
