# Frontend (Next.js)

```bash
pnpm install
pnpm dev
```

- App: [http://localhost:3000](http://localhost:3000)
- Env: `frontend/.env` — `NEXT_PUBLIC_RWA_CONTRACT_ADDRESS`, `NEXT_PUBLIC_USDC_CONTRACT_ADDRESS`, `NEXT_PUBLIC_ALCHEMY_RPC_URL` (see [local-setup.md](../docs/guides/local-setup.md))

## Main routes

| Route | Purpose |
|-------|---------|
| `/` | Landing + Card Ladder market indexes |
| `/markets` | Collection list / exchange (legacy `/exchange` redirects here) |
| `/markets/top100/card/[cardId]` | Top 100 card detail |
| `/portfolio` | Holdings + daily chart |
| `/watchlist` | Saved collections (login required) |
| `/vault` | PSA mint wizard (IPFS + on-chain mint) |
| `/marketplace/collections/[key]` | Collection trading |
| `/marketplace/[tokenId]` | Token detail |
| `/marketplace/admin/*` | Admin console (separate login) |
| `/site-access` | Staging password gate (when enabled) |

Full reference: **[../docs/frontend/routes.md](../docs/frontend/routes.md)**

Project docs: **[../docs/README.md](../docs/README.md)** · Architecture: **[../docs/architecture/frontend.md](../docs/architecture/frontend.md)** · Deploy: **[../docs/guides/deployment.md](../docs/guides/deployment.md)**
