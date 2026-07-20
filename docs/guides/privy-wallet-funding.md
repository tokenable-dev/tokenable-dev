# Privy wallet funding (MoonPay)

Production USDC top-ups use Privy’s **official fiat on-ramp** via **MoonPay** (card, **Apple Pay**, **Google Pay** inside the MoonPay checkout). Users start funding from the **header wallet menu → Add funds** (desktop dropdown + mobile drawer).

## Dashboard vs app network

Privy Dashboard **Onramps → Chain** lists **mainnets only** (e.g. Ethereum + USDC). There is no Sepolia option — this is normal.

| Layer | Network | Role |
|-------|---------|------|
| **Dashboard** | Ethereum + USDC | MoonPay provider config |
| **App (dev)** | Sepolia (`11155111`) via env | Where `useFiatOnramp` sends USDC (UI/API test) |
| **App (prod)** | Ethereum mainnet (`1`) | Live USDC delivery |

Sepolia dev goal: **open MoonPay checkout** (card / Apple Pay / Google Pay when supported). Sandbox may **not** deliver USDC to Sepolia wallets.

## Root cause reference

| Error | Meaning | Fix |
|-------|---------|-----|
| `Wallet funding is not enabled` | `fundingConfig` empty in Privy app settings | Enable MoonPay in Dashboard → Account Funding |
| `Funding chain 1 is not in PrivyProvider chains list` | Dashboard default chain not in `supportedChains` | Keep Dashboard **Ethereum + USDC**; app env sets Sepolia target |
| Add funds blocked / modal fails | `fundingReadiness.ready === false` | Complete MoonPay keys + aligned funding token; or dev bypass below |
| Readiness API 401 | Site access gate | Pass site gate first (`SITE_ACCESS_*`) |

Verify readiness:

```bash
curl -b cookies.txt http://127.0.0.1:4100/api/privy/apps/settings | jq '.fundingReadiness'
```

## Code integration

| Item | Location |
|------|----------|
| Header **Add funds** | `HeaderWalletMenuPanel` → `usePrivyFiatOnramp` |
| Shared on-ramp hook | `frontend/hooks/wallet/usePrivyFiatOnramp.ts` |
| Funding readiness | `usePrivyFundingStatus` → `GET /api/privy/apps/settings` |
| MoonPay sandbox flag | `privyClientConfig.fundingMethodConfig.moonpay.useSandbox` |
| Sepolia pay QA | `NEXT_PUBLIC_PRIVY_FUNDING_USE_ONRAMP_ON_TESTNET=true` + `NEXT_PUBLIC_PRIVY_FUNDING_CHAIN_ID=11155111` |
| Dev bypass (sandbox) | `NEXT_PUBLIC_PRIVY_FUNDING_SKIP_READINESS_CHECK=true` — try checkout even when readiness API says not ready |
| Analytics | `fiat_onramp_started` on successful checkout open |
| Dev lab | `/dev/privy` · `PrivyFeaturesLab.tsx` |

**Not used:** Stripe Embedded, Coinbase Onramp, Meld, Bridge bank deposits.

## Privy Dashboard checklist

1. **Account Funding** — [dashboard.privy.io/apps?page=funding](https://dashboard.privy.io/apps?page=funding)
2. **Tokens and networks → Edit** — set **Ethereum + USDC** (mainnet only in UI). **Not ETH** — Tokenable on-ramp targets USDC.
3. **Payment methods → Fiat onramps** — turn the **master toggle ON**
4. Enable **MoonPay** (publishable + secret API keys)
5. **Allowed domains:** `http://localhost:3000`, staging HTTPS, production
6. **Backend:** `PRIVY_APP_SECRET` for diagnostics API

## Environment variables (Sepolia sandbox dev)

```bash
# frontend/.env
NEXT_PUBLIC_PRIVY_FUNDING_ENVIRONMENT=sandbox
NEXT_PUBLIC_PRIVY_FUNDING_USE_ONRAMP_ON_TESTNET=true
NEXT_PUBLIC_PRIVY_FUNDING_CHAIN_ID=11155111
NEXT_PUBLIC_PRIVY_FUNDING_DEFAULT_AMOUNT=50
NEXT_PUBLIC_PRIVY_FUNDING_SKIP_READINESS_CHECK=true   # optional — force checkout attempt in sandbox
NEXT_PUBLIC_DEFAULT_CHAIN_ID=11155111

# backend/.env
PRIVY_FUNDING_TARGET_CAIP2=eip155:11155111
PRIVY_APP_SECRET=...
```

Production: set `NEXT_PUBLIC_PRIVY_FUNDING_ENVIRONMENT=production`, `NEXT_PUBLIC_PRIVY_FUNDING_CHAIN_ID=1`, `PRIVY_FUNDING_TARGET_CAIP2=eip155:1`, remove skip-readiness flag.

## End-to-end test

1. Pass site access gate (if `SITE_ACCESS_ENABLED=true`)
2. `curl -b cookies.txt http://127.0.0.1:4100/api/privy/apps/settings | jq '.fundingReadiness'` → prefer `ready: true`
3. Sign in → header wallet chip → **Add funds**
4. Or `/dev/privy` → funding status panel + **Start MoonPay on-ramp**
5. MoonPay sandbox opens — validate card checkout UI; Apple/Google Pay need HTTPS staging + supported device
6. Sandbox may not deliver USDC to Sepolia — goal is UI/API flow validation

See also: [privy-auth-migration.md](./privy-auth-migration.md)
