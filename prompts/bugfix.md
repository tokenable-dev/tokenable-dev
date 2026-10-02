# Prompt: Bug Fix

Fix the bug described below.

## Process
1. Follow `AI_WORKFLOW.md`. Read `.cursor/project-constitution.md` and `ARCHITECTURE_INDEX.md`.
2. Read only the docs and inspect only the modules involved in the bug. Never scan the whole repository unless explicitly requested.
3. **Identify the root cause first. Explain it before changing any code.**

## Constraints
- Apply the **smallest correct fix** that addresses the root cause.
- Do NOT refactor unrelated code. Do NOT "clean up while you're there."
- Obey all `.cursor/rules/`. Preserve the existing architecture and all business rules.
- Reuse existing patterns; avoid new abstractions, folders, files, or helpers.

## Finish
- Run `pnpm exec tsc --noEmit` (backend + frontend). Add a regression test if the bug was in logic.
- Update docs **only if** the fix revealed that documentation was wrong.

---
## Your Input

**Bug**
<!-- what is happening that shouldn't -->

**Expected behavior**
<!-- what should happen instead -->

**Steps to reproduce** (optional)
<!-- how to trigger it; input values, route, chain, user state -->
-

**Notes** (optional)
<!-- error message, logs, suspected area, when it started -->
