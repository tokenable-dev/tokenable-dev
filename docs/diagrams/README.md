# Diagrams

Pipeline and architecture diagrams live in **`docs/diagrams/`** as **Mermaid** markdown (GitHub-renderable).

---

## Index

| File | Language | Description |
|------|----------|-------------|
| [marketplace-lifecycle.md](./marketplace-lifecycle.md) | Korean | Full pipeline — mint → Seaport listing → criteria bid → on-chain fill; DB schema; frontend (Part 4); backend (Part 5) |
| [marketplace-lifecycle.en.md](./marketplace-lifecycle.en.md) | English | Same content in English |

**Canonical DB detail:** [architecture/database.md](../architecture/database.md) (full ER diagram)  
**Collection snapshot workers:** [architecture/materialized-market-snapshots.md](../architecture/materialized-market-snapshots.md)  
**Portfolio daily cron:** `portfolio_daily_snapshots` — [database.md § portfolio](../architecture/database.md#portfolio_daily_snapshots)  
**PSA / OCR API:** [api/psa.md](../api/psa.md)

---

## Viewing

Open the `.md` files on GitHub or in any Mermaid-compatible viewer (VS Code with a Mermaid extension, GitBook, etc.).
