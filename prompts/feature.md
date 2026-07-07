# Prompt: Feature

Implement the feature described below.

## Process
1. Follow `AI_WORKFLOW.md`. Read `.cursor/project-constitution.md` and `ARCHITECTURE_INDEX.md`.
2. Read only the docs and inspect only the modules relevant to this feature. Never scan the whole repository unless explicitly requested.
3. Search for an existing implementation or pattern to reuse before writing anything new.

## Constraints
- Obey all `.cursor/rules/`. Preserve the existing architecture and all business rules.
- Match the nearest equivalent feature exactly (naming, layering, file placement).
- Backend: thin controller → service → repository; validate all input via DTOs.
- Frontend: thin route → hook → component; query keys in `lib/core/queryKeys.ts`, invalidation in `lib/core/invalidation.ts`.
- Avoid unnecessary abstractions, folders, files, helpers, and utilities. Prefer the simplest correct solution.
- Never modify unrelated code.

## Finish
- Run `pnpm exec tsc --noEmit` (backend + frontend). Add/update a test for new logic.
- Update the relevant canonical doc **only if** architecture or business rules changed.

---
## Your Input

**Feature**
<!-- one or two lines: what should exist that doesn't today -->

**Requirements**
<!-- specific behaviors it must have -->
-

**Constraints** (optional)
<!-- anything off-limits: don't touch X, must use Y, keep API shape, etc. -->
-

**Acceptance criteria** (optional)
<!-- how you'll know it's done -->
- [ ]
