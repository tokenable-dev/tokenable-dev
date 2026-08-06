# Security

Security model, secret management, and threat considerations for the Tokenable platform.

---

## Authentication & Session Security

### JWT cookies

- Platform issues an `HttpOnly` JWT cookie (`access_token`) after Privy authentication
- `Secure` flag: set when `FRONTEND_URL` starts with `https://` or `COOKIE_SECURE=true`
- `SameSite=Lax` (implicit Nest default); CORS `credentials: true`
- TTL: 7 days (configurable via `JWT_EXPIRES_SEC`)
- `JWT_SECRET` must be a cryptographically random string (≥ 64 chars recommended)

### Privy token verification

- Backend verifies Privy tokens via **JWKS** (Privy-hosted public key endpoint)
- Optional: `PRIVY_JWT_VERIFICATION_KEY` — set the Privy PEM public key from the Dashboard; avoids JWKS network fetch on every request (faster + more resilient)
- `PRIVY_APP_SECRET` is server-only — never exposed to frontend

### Admin session

- Marketplace admin cookie (`marketplace_admin`) is HMAC-signed with `MARKETPLACE_ADMIN_SESSION_SECRET`
- Admin credentials are hashed in `marketplace_admins` table (bcrypt)
- Admin routes use `MarketplaceAdminService.assertAdminSession()`, not `JwtAuthGuard`

---

## Private Key Management

| Key | What it controls | Risk if compromised |
|-----|-----------------|---------------------|
| `RWA_OWNER_PRIVATE_KEY` | MINTER_ROLE + BURNER_ROLE | Unauthorized mints or burns of all tokens |
| `PLATFORM_FEE_PRIVATE_KEY` | Self-vault seller USDC payouts (`PLATFORM_FEE_RECIPIENT`) | Drain of accumulated marketplace fee / hold USDC |
| `RWA_CUSTODY_PRIVATE_KEY` | Transfers from custody wallet | NFTs in custody could be stolen |
| `JWT_SECRET` | All platform session cookies | Account impersonation |
| `MARKETPLACE_ADMIN_SESSION_SECRET` | Admin console sessions | Admin access |

**Required practices:**
- Never commit private keys to git (`.env` files are gitignored)
- Store on EC2 in `/home/ubuntu/.env.production.backend` (file permissions 600)
- Rotate immediately if any key is ever logged or exposed
- On key rotation: `MARKETPLACE_ADMIN_SESSION_SECRET` change forces all admin re-login

---

## Blockchain Security

### Backend-only on-chain writes

The platform's hot wallet is the only signer for mint and burn. This means:
- Users **cannot** directly mint or burn via the contract
- Seaport trading (which users sign) only moves already-minted NFTs; it does not call mint/burn

### Smart contract access control

```
DEFAULT_ADMIN_ROLE → upgrades + role grants (deployer)
MINTER_ROLE → mint, mintBatch (backend wallet)
BURNER_ROLE → adminBurn (backend wallet)
PAUSER_ROLE → pause / unpause (backend wallet or separate ops key)
```

UUPS upgrades require `DEFAULT_ADMIN_ROLE`. The admin key should be a hardware wallet or multisig in production.

### Vault custody

NFTs sit in the platform custody wallet between mint and delivery. The custody wallet private key (`RWA_CUSTODY_PRIVATE_KEY`) must be kept secure — compromise allows custody NFT theft.

### Re-entrancy

Not applicable: the contract has no external value flows (no ETH/ERC-20 in TokenableRWA). Seaport handles USDC settlement via its own well-audited logic.

---

## API Security

### Input validation

- NestJS `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`
- All DTOs use `class-validator` decorators
- No raw user strings reach SQL (TypeORM parameterized queries)

### Rate limiting

Two layers, both per client IP:

**nginx (ingress — `nginx/nginx.conf`, `nginx/nginx.tls.conf`)**
- `/api/*`: 20 req/s (burst 40), max 20 concurrent connections
- `POST /api/auth/privy/session`, `POST /api/site-access/verify`: 2 req/s (burst 5)
- Exceeding limits returns HTTP 429. Upstream proxy timeouts are fixed (connect 5s / read 60s) so a slow backend can't pin nginx workers.

**NestJS `@nestjs/throttler` (application — global guard in `app.module.ts`)**
- Global default: 300 req/min per IP (`THROTTLE_GLOBAL_LIMIT_PER_MIN`; `THROTTLE_ENABLED=0` disables, e.g. load tests)
- Stricter `@Throttle` overrides: `POST /auth/privy/session` 20/min, `POST /site-access/verify` 10/min, `/cardhedger/*` proxy 60/min, `/psa/*` 30/min, `GET /blockchain/rwa/tokens/:address` 30/min
- `GET /health` is `@SkipThrottle()` (Docker/LB probes)
- Client IP comes from the `X-Real-IP` header set by nginx (`trust proxy` enabled in `main.ts`); browser traffic proxied via the Next.js server would otherwise share one container IP.

PSA API rate limiting is additionally implemented upstream-side in `psa-public-api.service.ts` (client-side token rotation).

### CORS

`CORS_ORIGIN` lists allowed origins (comma-separated). CORS `credentials: true` — required for cookie auth.

**Important:** Never set `CORS_ORIGIN=*` in production with `credentials: true`.

### Helmet

`helmet` middleware is enabled in `main.ts` with `contentSecurityPolicy: false` (Next.js handles its own CSP) and `crossOriginEmbedderPolicy: false`.

### Compression

`compression()` applied globally. Not a security concern but avoids exposing internal headers through compressed responses.

---

## Site Access Gate

For staging environments, `SITE_ACCESS_ENABLED=true` requires all non-public API calls to include a `site_access` cookie.

**Public paths** (bypass gate): `/api/health`, `/api/auth/*`, `/api/site-access/*`, Cardhedger webhooks.

**Secret:** `SITE_ACCESS_PASSWORD` / `SITE_ACCESS_SECRET` (session HMAC). These are in the committed `.env` — **rotate before any public exposure**.

---

## Secrets in Repository

**Known secrets in committed dev `.env` files** (should be rotated before production exposure):

| File | Secret | Sensitivity |
|------|--------|-------------|
| `frontend/.env` | Alchemy RPC key | Medium — rate-limited; rotate before exposing publicly |
| `frontend/.env` | `SITE_ACCESS_*` | Low — dev only |
| `backend/.env` | All API keys, private keys | HIGH — never commit production values |
| `contracts/.env` | `DEPLOYER_PRIVATE_KEY` | HIGH — controls contract upgrades |

**Policy:** Development `.env` files are committed for developer convenience. Production secrets must only exist in `/home/ubuntu/.env.production.backend` on EC2 (not in git).

---

## IPFS Metadata

NFT metadata and images are stored on IPFS (Pinata). Once pinned:
- Metadata is **immutable** — `tokenURI` never changes after mint
- Images are **publicly accessible** via the Pinata gateway
- `PINATA_JWT` is a write credential — keep private; it allows uploading to your Pinata account

---

## KYC

KYC verification is admin-managed:
- `users.kyc_status` is set by admin action or webhook
- Audit trail in `user_kyc_events` (append-only)
- KYC `approved` is required for vault/sell access (frontend gate)
- Internal dev email bypasses KYC in frontend access gate (`accountAccess.ts`) — remove in production

---

## Threat Model Summary

| Threat | Mitigated by |
|--------|-------------|
| Unauthorized mint | MINTER_ROLE, JWT guard on `/rwa/mint`, linked wallet check |
| Double-mint same cert | `VaultRefAlreadyActive` contract error, DB cycle check |
| Unauthorized burn | BURNER_ROLE, admin session required |
| Session hijacking | HttpOnly cookie, Secure flag, JWKS verification |
| Private key exposure | `.env` gitignored, EC2 file permissions |
| Admin impersonation | bcrypt password hash, HMAC session cookie |
| CSRF | `SameSite=Lax` cookie, CORS allowlist |
| XSS | Helmet, Next.js default CSP |
| SQL injection | TypeORM parameterized queries |
| Re-entrancy | Not applicable (no ETH flows in TokenableRWA) |
