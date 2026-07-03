# Privy wallet funding (MoonPay only)

Production USDC top-ups use Privy’s **official fiat on-ramp** via **MoonPay**. The header uses Privy’s native **`UserPill`** menu (**Add funds**) — no custom Tokenable account dropdown.

## Root cause reference

| Error | Meaning | Fix |
|-------|---------|-----|
| `Wallet funding is not enabled` | `fundingConfig` empty in Privy app settings | Enable MoonPay in Dashboard → Account Funding |
| `Funding chain 1 is not in PrivyProvider chains list` | Dashboard default is Ethereum mainnet (`eip155:1`) but app `supportedChains` omit chain 1 | Set Dashboard **Funding token** to **Polygon Amoy + USDC** or **Ethereum + USDC**; keep header network on Amoy for pay test |
| Add funds blocked / modal fails | `fundingReadiness.ready === false` | Complete MoonPay keys + aligned funding token in Dashboard |

Verify readiness:

```bash
curl -b cookies.txt http://127.0.0.1:4100/api/privy/apps/settings | jq '.fundingReadiness'
```

## Code integration

| Item | Location |
|------|----------|
| Header account UI | `PrivyUserPill` → Privy `UserPill` (Add funds, wallets, logout) |
| MoonPay sandbox flag | `privyClientConfig.fundingMethodConfig.moonpay.useSandbox` |
| Amoy pay test | `NEXT_PUBLIC_PRIVY_FUNDING_USE_ONRAMP_ON_TESTNET=true` + `useFiatOnramp` destination `eip155:80002` |
| SDK patch (UserPill Add funds chain) | `frontend/scripts/patch-privy-isactive.mjs` → Amoy `80002` |
| Readiness API | `GET /api/privy/apps/settings` → `fundingReadiness` |
| Dev lab (explicit `useFiatOnramp`) | `/dev/privy` · `PrivyFeaturesLab.tsx` |

**Not used:** Stripe Embedded, Coinbase Onramp, Meld, Bridge bank deposits.

## Privy Dashboard checklist (MoonPay only)

1. **Account Funding** — [dashboard.privy.io/apps?page=funding](https://dashboard.privy.io/apps?page=funding)
2. Enable **MoonPay** (publishable + secret API keys)
3. **Funding token:** Polygon Amoy + USDC (pay test) or Ethereum + USDC (MoonPay sandbox UI)
4. **Allowed domains:** `http://localhost:3000`, staging, production
5. **Backend:** `PRIVY_APP_SECRET` for diagnostics API

## Environment variables (pay test — Amoy)

```bash
# frontend/.env
NEXT_PUBLIC_PRIVY_FUNDING_ENVIRONMENT=sandbox
NEXT_PUBLIC_PRIVY_FUNDING_USE_ONRAMP_ON_TESTNET=true
NEXT_PUBLIC_PRIVY_FUNDING_CHAIN_ID=80002
NEXT_PUBLIC_DEFAULT_CHAIN_ID=80002

# backend/.env
PRIVY_FUNDING_TARGET_CAIP2=eip155:80002
```

## End-to-end test

1. `curl http://127.0.0.1:4100/api/privy/apps/settings | jq '.fundingReadiness'` → `ready: true`
2. Sign in → header **UserPill** → **Add funds**
3. Or `/dev/privy` → “Start MoonPay on-ramp”
4. MoonPay sandbox may not deliver real USDC to Amoy — goal is UI/API flow validation

See also: [privy-auth-migration.md](./privy-auth-migration.md)
