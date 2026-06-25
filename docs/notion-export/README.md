# Notion Import

Condensed docs for Notion. **Canonical source:** [GitHub `docs/`](https://github.com/tokenable-dev/tokenable-dev/tree/develop/docs)

## Import

| Notion page | File |
|-------------|------|
| **Tech Stack** | `Tech-Stack.md` |
| **API Docs** | `API-Docs.md` |

1. Notion → **Import → Markdown** → pick file  
2. Add a **Table of contents** block at the top  
3. Mermaid blocks may need redraw in Notion — use [GitHub diagram docs](https://github.com/tokenable-dev/tokenable-dev/blob/develop/docs/diagrams/marketplace-lifecycle.en.md)

## ZIP (both pages)

```bash
cd docs/notion-export && zip -r tokenable-notion.zip Tech-Stack.md API-Docs.md
```

## GitHub references

| Topic | Link |
|-------|------|
| **Docs index** | [docs/README.md](https://github.com/tokenable-dev/tokenable-dev/blob/develop/docs/README.md) |
| Architecture overview | [architecture/overview.md](https://github.com/tokenable-dev/tokenable-dev/blob/develop/docs/architecture/overview.md) |
| Backend modules | [architecture/backend.md](https://github.com/tokenable-dev/tokenable-dev/blob/develop/docs/architecture/backend.md) |
| Frontend structure | [architecture/frontend.md](https://github.com/tokenable-dev/tokenable-dev/blob/develop/docs/architecture/frontend.md) |
| Database (17 tables) | [architecture/database.md](https://github.com/tokenable-dev/tokenable-dev/blob/develop/docs/architecture/database.md) |
| API index | [api/README.md](https://github.com/tokenable-dev/tokenable-dev/blob/develop/docs/api/README.md) |
| Frontend routes | [frontend/routes.md](https://github.com/tokenable-dev/tokenable-dev/blob/develop/docs/frontend/routes.md) |
| Marketplace diagrams | [diagrams/marketplace-lifecycle.en.md](https://github.com/tokenable-dev/tokenable-dev/blob/develop/docs/diagrams/marketplace-lifecycle.en.md) |
| Local setup | [guides/local-setup.md](https://github.com/tokenable-dev/tokenable-dev/blob/develop/docs/guides/local-setup.md) |
| Deployment | [guides/deployment.md](https://github.com/tokenable-dev/tokenable-dev/blob/develop/docs/guides/deployment.md) |
| Notion — Tech Stack | [notion-export/Tech-Stack.md](https://github.com/tokenable-dev/tokenable-dev/blob/develop/docs/notion-export/Tech-Stack.md) |
| Notion — API Docs | [notion-export/API-Docs.md](https://github.com/tokenable-dev/tokenable-dev/blob/develop/docs/notion-export/API-Docs.md) |
| **Vault system (draw.io)** | [notion-export/diagrams/vault/](https://github.com/tokenable-dev/tokenable-dev/tree/develop/docs/notion-export/diagrams/vault) |

**Live API schemas:** `GET /api/docs` (local: `http://localhost:4100/api/docs`)

**Last synced:** 2026-06-17 · branch `develop`
