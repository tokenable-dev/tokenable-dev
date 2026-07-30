# Deploy env — Sepolia-first (internal-dev Polygon/ETH)

Public users stay on **Sepolia**. Internal-dev emails (`tokenable.dev@gmail.com`, `ekvkd88@gmail.com`, `giunssen@gmail.com`, `dev@tokenable.io`, `jongnam0309@gmail.com`), the MetaMask wallet `0xd5abdd307414718c59949ac5465930a1f8a52691`, and the admin console can switch to **Polygon / Ethereum** only when those chains are fully configured.

## Backend EC2 `.env` — add / keep

Keep existing secrets. Apply these **deltas**:

```env
# Already correct for public Sepolia
DEFAULT_CHAIN_ID=11155111
PRIVY_FUNDING_TARGET_CAIP2=eip155:11155111

# Required for internal-dev Polygon switch (matches local + contracts/.openzeppelin/polygon.json)
CHAIN_137_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/<SAME_ALCHEMY_KEY>
CHAIN_137_RWA_ADDRESS=0x9ccF71bc790C9f43e42cFCa7aFd305A816497903
CHAIN_137_USDC_ADDRESS=0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359

# Ethereum — keep RPC+USDC; leave RWA commented until mainnet RWA is deployed
CHAIN_1_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/<SAME_ALCHEMY_KEY>
# CHAIN_1_RWA_ADDRESS=0x...
CHAIN_1_USDC_ADDRESS=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
```

Sepolia RWA on the current deploy host (`0x35b2368E718914e981b1C0043c76d4a573163D4A`) is fine — keep it. GitHub `NEXT_PUBLIC_CHAIN_11155111_RWA` **must match** this address.

After editing backend env on EC2:

```bash
cd /home/ubuntu/app   # or your compose dir
docker compose -f docker-compose.yml -f docker-compose.ec2.yml up -d backend
```

## GitHub Secrets / Variables (frontend bake)

`NEXT_PUBLIC_*` are baked at **image build** — set these, then redeploy `develop`:

| Name | Value |
|------|--------|
| `NEXT_PUBLIC_DEFAULT_CHAIN_ID` | `11155111` |
| `NEXT_PUBLIC_CHAIN_11155111_RPC_URL` | same Alchemy Sepolia URL as backend |
| `NEXT_PUBLIC_CHAIN_11155111_RWA` | `0x35b2368E718914e981b1C0043c76d4a573163D4A` (match backend) |
| `NEXT_PUBLIC_CHAIN_11155111_USDC` | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |
| `NEXT_PUBLIC_CHAIN_137_RPC_URL` | Polygon Alchemy URL |
| `NEXT_PUBLIC_CHAIN_137_RWA` | `0x9ccF71bc790C9f43e42cFCa7aFd305A816497903` (match deploy backend — not local) |
| `NEXT_PUBLIC_CHAIN_137_USDC` | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` |
| `NEXT_PUBLIC_PRIVY_FUNDING_ENVIRONMENT` | `sandbox` (or leave unset on `develop` — workflow defaults sandbox) |
| `NEXT_PUBLIC_PRIVY_FUNDING_USE_ONRAMP_ON_TESTNET` | `true` (or leave unset on `develop`) |
| `NEXT_PUBLIC_PRIVY_FUNDING_CHAIN_ID` | `11155111` (or leave unset — follows default chain) |

Do **not** set funding chain to `137` for the public Sepolia deploy. Internal-dev on Polygon still gets live MoonPay because the app uses the **active header network** when it is a mainnet.

Optional ETH (only after `CHAIN_1_RWA` exists):

| Name | Value |
|------|--------|
| `NEXT_PUBLIC_CHAIN_1_RPC_URL` | mainnet Alchemy |
| `NEXT_PUBLIC_CHAIN_1_RWA` | mainnet proxy |
| `NEXT_PUBLIC_CHAIN_1_USDC` | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |

## Smoke checklist

1. Anonymous / normal user → network chip hidden or Sepolia only; mint/list on Sepolia.
2. `tokenable.dev@gmail.com` → network switcher shows Sepolia + Polygon (ETH disabled until RWA).
3. Switch to Polygon → mint/admin calls send `x-tokenable-chain-id: 137`.
4. Add funds on Sepolia → MoonPay **sandbox** (`useSandbox: true`).
5. Internal-dev on Polygon → Add funds → MoonPay **live** (`useSandbox: false`, real card / Apple Pay / Google Pay).

## Polygon live payments (internal-dev)

App logic (already in code):

| Active network | Funding destination | MoonPay mode |
|----------------|---------------------|--------------|
| Sepolia (public default) | `eip155:11155111` | sandbox |
| Polygon (internal-dev switch) | `eip155:137` | **production** (forced — ignores `NEXT_PUBLIC_PRIVY_FUNDING_ENVIRONMENT=sandbox`) |

Keep GitHub funding secrets **Sepolia-first** (`CHAIN_ID=11155111`, `ENVIRONMENT=sandbox`, `USE_ONRAMP_ON_TESTNET=true`). Do **not** set funding chain to `137` globally.

### Privy Dashboard (required for live Polygon)

1. [Account Funding](https://dashboard.privy.io/apps?page=funding)
2. Enable **MoonPay** with **production** publishable + secret API keys (sandbox keys → test mode even on Polygon)
3. Funding token: **Polygon + USDC** (native). Sepolia can stay as an extra option for sandbox QA
4. Allowed domains: `https://tokenable-dev.com`, `https://www.tokenable-dev.com`, localhost if needed
5. Backend `PRIVY_FUNDING_TARGET_CAIP2=eip155:11155111` is fine for readiness — aligned set includes Polygon

### EC2 + GitHub (same as above)

- Backend: `CHAIN_137_*` set
- GitHub: `NEXT_PUBLIC_CHAIN_137_*` baked, then redeploy `develop`

### Manual test

1. Sign in as `tokenable.dev@gmail.com`
2. Header → Polygon
3. Wallet menu → Add funds → amount → choose MoonPay/card (popup allowed)
4. Checkout must **not** say test mode; destination USDC on Polygon
5. Complete a small real payment; confirm USDC on the wallet (may take minutes)