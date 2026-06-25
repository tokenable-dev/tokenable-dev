# Diagrams

Pipeline and architecture diagrams live in **`docs/diagrams/`** as **Mermaid** markdown (GitHub-renderable).

---

## Index

| File | Language | Description |
|------|----------|-------------|
| [marketplace-lifecycle.md](./marketplace-lifecycle.md) | Korean | Full pipeline — mint → Seaport listing → criteria bid → on-chain fill; DB schema; frontend (Part 4); backend (Part 5) |
| [marketplace-lifecycle.en.md](./marketplace-lifecycle.en.md) | English | Same content in English |

**Canonical DB detail:** [architecture/database.md](../architecture/database.md) (**17 tables** as of 2026-06)  
**Current routes:** [frontend/routes.md](../frontend/routes.md) (`/markets` replaces legacy `/exchange`)  
**Collection snapshot workers:** [architecture/materialized-market-snapshots.md](../architecture/materialized-market-snapshots.md)  
**Portfolio daily cron:** `portfolio_daily_snapshots` — [database.md § portfolio](../architecture/database.md#portfolio_daily_snapshots)  
**PSA / OCR API:** [api/psa.md](../api/psa.md)

> **Note:** Lifecycle diagram Parts 4–5 (frontend/backend file trees) may lag the repo. Prefer [architecture/backend.md](../architecture/backend.md), [architecture/frontend.md](../architecture/frontend.md), and [frontend/routes.md](../frontend/routes.md) for current structure.

---

## Viewing

Open the `.md` files on GitHub or in any Mermaid-compatible viewer (VS Code with a Mermaid extension, GitBook, etc.).
