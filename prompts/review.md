# Prompt: Review

Review the work described below. **Review only — do not implement or modify code.**

## Process
1. Follow `AI_WORKFLOW.md`. Read `.cursor/project-constitution.md` and `ARCHITECTURE_INDEX.md`.
2. Read only the docs and inspect only the modules affected by the change. Never scan the whole repository unless explicitly requested.

## Check
- **Architecture** — correct layering (controller → service → repository; thin route → hook → component); no business logic in controllers.
- **Cursor Rules** — conforms to all `.cursor/rules/` (especially `simplicity.mdc`).
- **Business rules** — no violation of `docs/business-rules.md`.
- **TypeScript** — no `any`, no unsafe casts, readable types.
- **Duplicated logic** — reuses existing services/hooks/utilities; no needless new abstractions.
- **Documentation** — canonical docs updated iff architecture/business rules changed.
- **Security** — obeys `.cursor/rules/security.mdc` (no leaked secrets, backend-only on-chain writes, validated input).
- **Performance** — no upstream calls on hot read paths; no obvious N+1; no gratuitous memoization.

## Output
- A concise findings list grouped by the categories above.
- Flag each issue as **must-fix** / **should-fix** / **nit**. Do not apply changes.

---
## Your Input

**Under review**
<!-- branch, PR, files, or "the changes in this session" -->

**Focus** (optional)
<!-- narrow the review, e.g. "security only" or "just the vault delivery logic" -->

**Context** (optional)
<!-- what the change is meant to do, so review can judge intent vs implementation -->
