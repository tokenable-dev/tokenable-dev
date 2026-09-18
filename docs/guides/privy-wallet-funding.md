# Privy wallet funding (MoonPay)

Production USDC top-ups use Privy’s **official fiat on-ramp** via **MoonPay** (card, **Apple Pay**, **Google Pay** inside the MoonPay checkout). Users start funding from the **header wallet menu → Add funds** (desktop dropdown + mobile drawer).

## Dashboard vs app network

| Layer | Network | Role |
|-------|---------|------|
| **Public app (current deploy)** | Sepolia (`11155111`) | Default for all users; MoonPay **sandbox** via `USE_ONRAMP_ON_TESTNET=true` |
| **Internal-dev / admin** | Polygon / Ethereum when `CHAIN_*` + `NEXT_PUBLIC_CHAIN_*` are set | Live MoonPay on mainnet destinations |
| **Dashboard** | Sepolia + USDC (sandbox) and/or Polygon + USDC (live) | MoonPay provider config |

Mainnet destinations always use **live MoonPay** (`environment: production`). Sandbox cannot deliver Polygon USDC. Public users cannot leave Sepolia until launch.

## Root cause reference

| Error | Meaning | Fix |
|-------|---------|-----|
| MoonPay “test mode” on Polygon | App still on sandbox / Sepolia funding chain | Set `NEXT_PUBLIC_PRIVY_FUNDING_CHAIN_ID=137`; mainnet forces production |
| `Wallet funding is not enabled` | `fundingConfig` empty in Privy app settings | Enable MoonPay in Dashboard → Account Funding |
| `Funding chain … not in PrivyProvider chains list` | Dashboard default chain not in `supportedChains` | Keep Polygon/Ethereum in Dashboard; ensure `CHAIN_137_*` / `NEXT_PUBLIC_CHAIN_137_*` configured |
| Add funds blocked / modal fails | `fundingReadiness.ready === false` | Complete MoonPay **production** keys + Polygon (or Ethereum) funding token |
| `Buy 0X…` / Stripe path | `destination.asset` was a USDC **contract address** | Must be symbol **`"usdc"`** — contract addresses route to Stripe Embedded, which does not support Polygon USDC |
| `Unable to initialize flow` | MoonPay popup (`@privy-io/popup`) blocked — often from auto-opening after amount step without a click | Do **not** pass `defaultFundingMethod: "card"`; allow popups; click MoonPay / card in the method screen |
| `Manifest: Line: 1… Syntax error` | Browser tried to parse a non-JSON web manifest (unrelated to funding) | Ignore for Add funds debugging |

Verify readiness:

```bash
curl -b cookies.txt http://127.0.0.1:4100/api/privy/apps/settings | jq '.fundingReadiness'
```

## Code integration

| Item | Location |
|------|----------|
| Header **Add funds** | `HeaderWalletMenuPanel` → `usePrivyFiatOnramp` → **`useFundWallet` + MoonPay** |
| Shared funding hook | `frontend/hooks/wallet/usePrivyFiatOnramp.ts` |
| Funding readiness | `usePrivyFundingStatus` → `GET /api/privy/apps/settings` |
| MoonPay sandbox flag | `privyClientConfig.fundingMethodConfig.moonpay.useSandbox` (false on mainnet) |
| Destination chain | Active app chain when mainnet; else `NEXT_PUBLIC_PRIVY_FUNDING_CHAIN_ID` |

**Not used for Add funds:** `useFiatOnramp` (multi-provider router including Stripe — Stripe Embedded does not support Polygon USDC and fails with `Init failed` / unsupported asset). Stripe Embedded / Coinbase Onramp / Meld / Bridge bank deposits are out of scope.

## Privy Dashboard checklist (Polygon live)

1. **Account Funding** — [dashboard.privy.io/apps?page=funding](https://dashboard.privy.io/apps?page=funding)
2. **Tokens and networks → Edit** — set **Polygon + USDC** (native USDC). **Not testnet.**
3. **Payment methods → Fiat onramps** — master toggle **ON**
4. Enable **MoonPay** with **production** publishable + secret API keys (sandbox keys → test mode UI)
5. **Allowed domains:** `http://localhost:3000`, staging HTTPS, production
6. **Backend:** `PRIVY_APP_SECRET` for diagnostics API

## Environment variables

### Polygon production (live USDC)

```bash
# frontend/.env
NEXT_PUBLIC_PRIVY_FUNDING_ENVIRONMENT=production
NEXT_PUBLIC_PRIVY_FUNDING_CHAIN_ID=137
NEXT_PUBLIC_PRIVY_FUNDING_USE_ONRAMP_ON_TESTNET=false
NEXT_PUBLIC_PRIVY_FUNDING_DEFAULT_AMOUNT=50
# Do NOT set SKIP_READINESS_CHECK for live purchases

# backend/.env
PRIVY_FUNDING_TARGET_CAIP2=eip155:137
```

Mainnet destinations ignore sandbox even if `NEXT_PUBLIC_PRIVY_FUNDING_ENVIRONMENT=sandbox` is left over — live MoonPay is forced.

### Sepolia sandbox QA (optional)

```bash
NEXT_PUBLIC_PRIVY_FUNDING_ENVIRONMENT=sandbox
NEXT_PUBLIC_PRIVY_FUNDING_USE_ONRAMP_ON_TESTNET=true
NEXT_PUBLIC_PRIVY_FUNDING_CHAIN_ID=11155111
NEXT_PUBLIC_PRIVY_FUNDING_SKIP_READINESS_CHECK=true   # optional
PRIVY_FUNDING_TARGET_CAIP2=eip155:11155111
```

## End-to-end test (Polygon)

1. Header network → **Polygon**
2. Sign in → wallet menu → **Add funds**
3. MoonPay should **not** show test mode; destination USDC on Polygon
4. Complete card / Apple Pay / Google Pay checkout (real payment in production)
5. Confirm USDC balance on the account wallet after settlement (may take minutes)

See also: [Auth API](../api/auth.md) · [marketplace-admin.md](./marketplace-admin.md)
