# Deploy configuration

Env files live **only on the EC2 host**, not in this repo.

| File on EC2 | Used when | Contents |
|-------------|-----------|----------|
| `/home/ubuntu/.env.production.backend` | Container **runtime** | Secrets, Alchemy, DB, JWT, Privy secret |
| `/home/ubuntu/.env.production.frontend` | Frontend Docker **build** (CI copies via SSH) | `NEXT_PUBLIC_*` only |

## Why frontend is not “just edit and restart”

Next.js bakes `NEXT_PUBLIC_*` into the JS bundle at **image build** time.  
`docker-compose env_file` cannot rewrite an already-built frontend image.

Flow:

1. Create/edit `/home/ubuntu/.env.production.frontend` on EC2 (once).
2. Push to `develop` / `main`.
3. GitHub Actions SSHs to that host, copies the file, builds the frontend image, pushes ECR, then compose pull on EC2.

## One-time EC2 setup

```bash
nano /home/ubuntu/.env.production.frontend
```

Put the same kind of `NEXT_PUBLIC_*` keys you use locally in `frontend/.env` (chain RPC/RWA/USDC, Privy App ID, fee, GA). Use a **public** Sepolia RPC in this file; Alchemy stays only in `.env.production.backend`.

Required keys (CI/Dockerfile fail if missing):

- `NEXT_PUBLIC_CHAIN_11155111_RPC_URL`
- `NEXT_PUBLIC_CHAIN_11155111_RWA`
- `NEXT_PUBLIC_CHAIN_11155111_USDC`
- `NEXT_PUBLIC_PRIVY_APP_ID`

## GitHub Actions secrets

Keep only: `AWS_*`, `ECR_REGISTRY`, `DEV_EC2_*`, `PROD_EC2_*`.  
Do **not** store `NEXT_PUBLIC_*` in GitHub.

## RWA contract addresses (ERC721 preset)

Set **backend** `CHAIN_{id}_RWA_ADDRESS` and **frontend** `NEXT_PUBLIC_CHAIN_{id}_RWA` to the same value on each host.

| Chain | ID | Local (`backend/.env`, `frontend/.env`) | EC2 (`.env.production.*`) |
|-------|-----|----------------------------------------|---------------------------|
| Sepolia | 11155111 | `0x70FDfd126b902173720412b2B8AD844E728F49af` | `0xF7242F62153ac2F42CbF331724F38B93829381c3` |
| Ethereum mainnet | 1 | `0x1ee4a6a6cbc4E15f73125233bc9447208c2dB8C1` | `0xa8a7568E0A5f0dC2F5143ad09D12a032b3c145ad` |
| Polygon mainnet | 137 | `0x0DE88f46A0790E3B08fA2eB96BE2819480E0e478` | `0x4d1FA7a19C5b6a5fd4aB0E9521eb5Ef252993d35` |

After changing addresses on EC2:

- **Backend:** `docker compose -f docker-compose.yml -f docker-compose.ec2.yml up -d --no-deps --force-recreate backend`
- **Frontend:** edit `.env.production.frontend`, then push to `develop`/`main` (or re-run Deploy) so CI rebuilds the image.

Ensure `RWA_OWNER_PRIVATE_KEY` on each host has `MINTER_ROLE` on that host’s RWA contracts.

Default chain (Ethereum mainnet):

- `DEFAULT_CHAIN_ID=1` in `.env.production.backend`
- `NEXT_PUBLIC_DEFAULT_CHAIN_ID=1` in `.env.production.frontend` (rebuild frontend after change)
