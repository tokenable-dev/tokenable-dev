# AI Workflow

The operating manual for any AI agent (or engineer) working in this repository. It ties together the constitution, the architecture index, the Cursor rules, and the docs into one procedure. Follow it for **every** task.

Assume you start with **zero memory of this project**. This file, plus the three documents it points to, is enough to work correctly.

---

## The Procedure

```
Feature request / bug / change
        │
        ▼
1. Read .cursor/project-constitution.md   (philosophy + invariants)
        │
        ▼
2. Read ARCHITECTURE_INDEX.md             ("I need to modify X → read these")
        │
        ▼
3. Read ONLY the docs for the affected subsystem
        │
        ▼
4. Inspect ONLY the modules/files that own that responsibility
        │
        ▼
5. Search for an existing implementation / pattern to reuse
        │
        ▼
6. Implement — match existing patterns, prefer the simplest solution
        │
        ▼
7. Run type checks + relevant tests
        │
        ▼
8. If architecture/behavior changed → update the docs in the same change
        │
        ▼
      Done
```

---

## Step Detail

### 1–2. Orient (always)
- `.cursor/project-constitution.md` — platform purpose, invariants, simplicity philosophy, "things that must never change."
- `ARCHITECTURE_INDEX.md` — the map from a subsystem to its docs, folders, and "read before changing" files.

### 3–4. Load minimal context
- Read only the docs and modules relevant to the task. **Never rescan the whole repository** unless explicitly asked, or unless doing a documentation-consistency audit.
- Use `ARCHITECTURE_INDEX.md`'s "Files to Always Read Before Modifying Each Area" table to pick the exact files.

### 5. Reuse before creating
- Search for existing services, hooks, utilities, DTOs, and query keys. Reuse them.
- Do not create a new abstraction when an existing one fits. Do not create a one-function file. (See `.cursor/rules/simplicity.mdc`.)

### 6. Implement
- Match the nearest equivalent feature exactly (naming, layering, file placement).
- Backend: controller (thin) → service (logic) → repository (TypeORM). DTOs validate all input.
- Frontend: thin route → hook → component. Query keys in `lib/core/queryKeys.ts`; invalidation in `lib/core/invalidation.ts`.
- Prefer explicit, readable code. Preserve business correctness above all.

### 7. Verify
- `cd backend && pnpm exec tsc --noEmit` and `cd frontend && pnpm exec tsc --noEmit`.
- Backend logic change → add/update a unit test. Contract change → update `contracts/test/TokenableRWA.test.ts` and run `pnpm test`; run `pnpm sync-abi` if the ABI changed.

### 8. Keep docs true
- If you changed how a subsystem works, update its doc in the same change. Docs are the single source of truth.
- If **documentation conflicts with implementation, report the conflict before coding** — do not silently follow one or the other.

---

## Guardrails (from the constitution)

- **Never** change: the `vaultRef` formula, JWT cookie name (`access_token`), admin cookie name (`marketplace_admin`), or the `collection_key` (v2) algorithm. See constitution § "Things That Must NEVER Be Changed."
- **Requires approval:** smart-contract upgrades, `BURNER_ROLE` grants, production migrations, CI/CD changes, secret rotation.
- **Never** call `mint()` / `adminBurn()` from the frontend — those are backend-only.
- **Never** call Cardhedger/PSA upstream on a hot read path — reads come from PostgreSQL snapshots.
- **Never** commit production secrets. See `.cursor/rules/security.mdc`.

---

## Where Knowledge Lives (one canonical source each)

| Topic | Canonical source |
|-------|------------------|
| How to work (this procedure) | `AI_WORKFLOW.md` |
| Philosophy, invariants, naming, patterns | `.cursor/project-constitution.md` |
| Subsystem → files navigation | `ARCHITECTURE_INDEX.md` |
| Simplicity rules | `.cursor/rules/simplicity.mdc` |
| Security rules | `.cursor/rules/security.mdc` |
| Backend / frontend / blockchain conventions | `.cursor/rules/{backend,frontend,blockchain}.mdc` |
| Business invariants | `docs/business-rules.md` |
| Subsystem behavior | `docs/architecture/*`, `docs/api/*` |

Do not restate rules across files. If a rule needs to change, change it at its canonical source and let the others link to it.
