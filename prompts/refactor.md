# Prompt: Refactor

Refactor the code described below **without changing its behavior.**

## Process
1. Follow `AI_WORKFLOW.md`. Read `.cursor/project-constitution.md` and `ARCHITECTURE_INDEX.md`.
2. Read only the docs and inspect only the modules in scope. Never scan the whole repository unless explicitly requested.

## Constraints
- **Preserve behavior exactly.** No functional or API changes.
- Reduce complexity **only when justified** by real duplication or coupling (rule of thumb: 5+ occurrences, not 2).
- No architectural rewrites. No new layers, patterns, or "shared/common/base" folders.
- Do NOT split a file just because it is long. Prefer cohesive files.
- Obey all `.cursor/rules/` (`simplicity.mdc` governs here). Preserve business rules.
- Never modify unrelated code. Keep the diff minimal.

## Finish
- Run `pnpm exec tsc --noEmit` (backend + frontend). Existing tests must still pass; add tests only to lock in behavior you touched.
- Docs change only if a documented boundary moved.

---
## Your Input

**Refactor target**
<!-- the file(s) or code to simplify -->

**Justification**
<!-- the real duplication or complexity that makes this worthwhile -->

**Must preserve** (optional)
<!-- behavior, public API, or types that cannot change -->
-

**Out of scope** (optional)
<!-- what NOT to touch -->
-
