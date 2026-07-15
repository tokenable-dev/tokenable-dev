# Privy wallet funding (MoonPay)

Production USDC top-ups use Privy’s **official fiat on-ramp** via **MoonPay** (card, **Apple Pay**, **Google Pay** inside the MoonPay checkout). Users start funding from the **header wallet menu → Add funds** (desktop dropdown + mobile drawer).

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
| Header **Add funds** | `HeaderWalletMenuPanel` → `usePrivyFiatOnramp` |
| Shared on-ramp hook | `frontend/hooks/wallet/usePrivyFiatOnramp.ts` |
| Funding readiness | `usePrivyFundingStatus` → `GET /api/privy/apps/settings` |
| MoonPay sandbox flag | `privyClientConfig.fundingMethodConfig.moonpay.useSandbox` |
| Testnet pay QA | `NEXT_PUBLIC_PRIVY_FUNDING_USE_ONRAMP_ON_TESTNET=true` + aligned `NEXT_PUBLIC_PRIVY_FUNDING_CHAIN_ID` |
| SDK patch (legacy UserPill Add funds) | `frontend/scripts/patch-privy-isactive.mjs` |
| Dev lab | `/dev/privy` · `PrivyFeaturesLab.tsx` |

**Not used:** Stripe Embedded, Coinbase Onramp, Meld, Bridge bank deposits.

## Privy Dashboard checklist

1. **Account Funding** — [dashboard.privy.io/apps?page=funding](https://dashboard.privy.io/apps?page=funding)
2. **Tokens and networks → Edit** — set **Ethereum + USDC** (or Sepolia + USDC for dev). **Not ETH** — Tokenable on-ramp targets USDC.
3. **Payment methods → Fiat onramps** — turn the **master toggle ON** (gray/off = app blocks Add funds even if MoonPay shows “Enabled”).
4. Enable **MoonPay** (publishable + secret API keys)
5. **Allowed domains:** `http://localhost:3000`, staging, production
6. **Backend:** `PRIVY_APP_SECRET` for diagnostics API

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
2. Sign in → header wallet chip → **Add funds**
3. Or `/dev/privy` → “Start MoonPay on-ramp”
4. In **production** MoonPay checkout, Apple Pay / Google Pay appear when device + region support them
5. Sandbox may not deliver real USDC to testnets — goal is UI/API flow validation

See also: [privy-auth-migration.md](./privy-auth-migration.md)
