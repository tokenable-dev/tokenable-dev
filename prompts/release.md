# Prompt: Release Verification

Verify the repository is ready for the release/deploy described below. **Verification and reporting — do not change behavior.**

## Process
1. Follow `AI_WORKFLOW.md`. Read `.cursor/project-constitution.md` and `ARCHITECTURE_INDEX.md`.
2. Read only the docs and config relevant to deployment (`docs/guides/deployment.md`, `docs/security.md`, `docker-compose*`, `.github/workflows/`). Never scan the whole repository unless explicitly requested.

## Check
- **Documentation** — matches current behavior; no drift in changed areas.
- **Environment variables** — every new/changed var is documented in `local-setup.md` + `deployment.md`; required prod vars present.
- **Production configuration** — `TYPEORM_SYNC=false`, correct `CORS_ORIGIN`/`FRONTEND_URL`, `NEXT_PUBLIC_*` build args set.
- **Security** — no committed production secrets; obeys `.cursor/rules/security.mdc`.
- **Schema** — entity changes reflected in the matching `backend/sql/schema/` domain file and `database.md`.
- **Build** — `pnpm build` (frontend) and backend build succeed; `pnpm sync-abi` run if the contract changed.
- **Tests** — `pnpm exec tsc --noEmit` (both), `pnpm test:ci` (backend), `pnpm test` (contracts) pass.

## Output
- A go / no-go checklist with any blockers called out explicitly. Do not modify code.

---
## Your Input

**Release**
<!-- e.g. "promote develop to main" or "deploy vault delivery feature" -->

**Target environment**
<!-- dev EC2 / prod EC2 -->

**Notable changes in this release** (optional)
<!-- new env vars, migrations, contract changes, config changes to double-check -->
-

**Skip** (optional)
<!-- checks that don't apply this time, with reason -->
-
