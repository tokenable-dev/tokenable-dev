/**
 * Privy server integration — single entry point for the backend.
 *
 * ## Flow
 * 1. Frontend sends Privy access token → `POST /auth/privy/session`
 * 2. `PrivyService.verifyAccessToken` validates JWT via `@privy-io/node`
 * 3. `parsePrivyUserProfile` maps linked accounts → local user fields
 * 4. `UserService.findOrCreateFromPrivy` upserts user + `syncPrivyWallets`
 *
 * ## Env
 * - `PRIVY_APP_ID`, `PRIVY_APP_SECRET` — required
 * - `PRIVY_JWT_VERIFICATION_KEY` — optional PEM (skips JWKS fetch)
 *
 * Frontend mirror: `frontend/lib/privy/`
 */

export { PrivyService } from './privy.service';
export { extractBearerToken } from './privy-auth.util';
export { parsePrivyUserProfile } from './privy-user.parser';
export type { ParsedPrivyProfile } from './privy.types';
export {
  readPrivyEnv,
  isPrivyConfigured,
  type PrivyEnvConfig,
} from './privy.config';
