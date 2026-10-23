# Frontend (Next.js)

```bash
pnpm install
pnpm dev
```

- App: [http://localhost:3000](http://localhost:3000)
- Env: `frontend/.env` — `NEXT_PUBLIC_CHAIN_11155111_RPC_URL`, `_RWA`, `_USDC` (see [local-setup.md](../docs/guides/local-setup.md), [blockchain.md](../docs/architecture/blockchain.md))

## Docs in this folder (only three)

| File | Purpose |
|------|---------|
| **[README.md](./README.md)** (this file) | Run locally, main routes, pointers |
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | Code layout contract, hooks map, styles, assets |
| **[design-system/README.md](./design-system/README.md)** | Design tokens/`tk-*`, brand/a11y, prototypes, screen inventory |

## Main routes

| Route | Purpose |
|-------|---------|
| `/` | Landing + market grids |
| `/markets` | Collection list / exchange (legacy `/exchange` redirects here) |
| `/portfolio` | Holdings + daily chart |
| `/watchlist` | Saved collections (login required) |
| `/vault` | PSA mint wizard (IPFS + on-chain mint) |
| `/marketplace/collections/[key]` | Collection trading |
| `/marketplace/[tokenId]` | Redirects to collection detail + listing modal |
| `/marketplace/admin/*` | Admin console (separate login) |
| `/site-access` | Staging password gate (when enabled) |

Full route table: **[../docs/frontend/routes.md](../docs/frontend/routes.md)**

Project docs: **[../docs/README.md](../docs/README.md)** · Frontend notes: **[../docs/architecture/frontend.md](../docs/architecture/frontend.md)** · Deploy: **[../docs/guides/deployment.md](../docs/guides/deployment.md)** · DS guide: **[../docs/guides/design-system-reference.md](../docs/guides/design-system-reference.md)**
