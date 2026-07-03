# Prompt: Documentation

Update the documentation described below.

## Process
1. Follow `AI_WORKFLOW.md`. Read `.cursor/project-constitution.md` and `ARCHITECTURE_INDEX.md`.
2. Identify the **single canonical document** that owns this topic (see `ARCHITECTURE_INDEX.md` and `docs/README.md`). Read only that document and the code it describes.

## Constraints
- Update **only the canonical source**. Do not restate the same knowledge in multiple files — cross-link instead.
- Document **verified behavior only**. Never speculate or document planned features as if implemented.
- If documentation conflicts with implementation, **report the conflict** — do not guess which is correct.
- Obey `.cursor/rules/documentation.mdc`. Keep tables/diagrams in sync with code.
- Do not create new documents unless a genuinely new canonical topic exists.

## Finish
- If you added a new `docs/` file, add it to `docs/SUMMARY.md` and link it from `docs/README.md`.

---
## Your Input

**What changed / what's wrong**
<!-- the behavior that changed, or the inaccurate/missing information -->

**Affected area** (optional)
<!-- subsystem or doc you think owns this, e.g. "auth", "vault lifecycle" -->

**Source of truth** (optional)
<!-- the code/PR that proves the new behavior, so docs match reality -->
