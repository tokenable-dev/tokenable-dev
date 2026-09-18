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
