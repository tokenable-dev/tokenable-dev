# Notion Export

> **Note:** The `Tech-Stack.md` and `API-Docs.md` Notion import files have been removed.
> They duplicated the main `docs/` tree and fell out of date quickly.
>
> Use the live docs in [`docs/`](../) as the single source of truth.

---

## Recommended Notion pages (copy from source)

| Topic | Source file |
|-------|------------|
| System overview | [architecture/overview.md](../architecture/overview.md) |
| Backend modules | [architecture/backend.md](../architecture/backend.md) |
| Frontend structure | [architecture/frontend.md](../architecture/frontend.md) |
| Database (17 tables) | [architecture/database.md](../architecture/database.md) |
| API reference | [api/README.md](../api/README.md) |
| Auth (Privy) | [api/auth.md](../api/auth.md) |
| Local setup | [guides/local-setup.md](../guides/local-setup.md) |
| Privy auth migration | [guides/privy-auth-migration.md](../guides/privy-auth-migration.md) |

## Draw.io diagrams (`diagrams/`)

The `diagrams/` subfolder contains `.drawio` (XML) files for system architecture, backend modules, frontend structure, and vault lifecycle. Open them with [draw.io](https://app.diagrams.net/) or the VS Code draw.io extension.

| File | Description |
|------|-------------|
| `01-system-architecture.drawio` | Overall Nginx / frontend / backend / DB topology |
| `02-backend-modules.drawio` | NestJS module graph |
| `03-frontend-structure.drawio` | Next.js component tree |
| `vault/` | Vault lifecycle diagrams (planned feature) |

These are not auto-synced with code changes.
