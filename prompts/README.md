# Prompt Templates

Reusable entry points for common development tasks. They exist so you never have to re-explain how this repository works — the AI knowledge system (`AI_WORKFLOW.md`, `.cursor/project-constitution.md`, `ARCHITECTURE_INDEX.md`, `.cursor/rules/`, `docs/`) already contains that.

Each template is a thin wrapper: it points the AI at the workflow and adds the constraints specific to that kind of task. **They do not duplicate documentation.**

---

## Which Template?

| Your task | Template | It guarantees… |
|-----------|----------|----------------|
| Add new functionality | [`feature.md`](feature.md) | Reuses patterns, no needless abstractions |
| Fix incorrect behavior | [`bugfix.md`](bugfix.md) | Root cause first, smallest correct fix |
| Review completed work (read-only) | [`review.md`](review.md) | Checks architecture, rules, security, perf — no edits |
| Improve code without changing behavior | [`refactor.md`](refactor.md) | Behavior preserved, complexity reduced only when justified |
| Update canonical docs | [`documentation.md`](documentation.md) | One source of truth, verified behavior only |
| Verify readiness before a deploy | [`release.md`](release.md) | Env vars, migrations, config, tests — go/no-go |

---

## How to Use

1. Pick the template from the table above.
2. Reference it in chat and fill in its **Your Input** section (the fields at the bottom of each template). Only the first field is required; the rest are optional but sharpen the result.

```
Follow prompts/feature.md.

Feature: Add a "hide sold listings" toggle to the portfolio page.
Requirements:
- Persist the preference per wallet
- Default off
```

```
Follow prompts/bugfix.md.

Bug: Vault mint returns 500 when the PSA cert has a trailing space.
Expected: cert is trimmed and mint succeeds.
```

That's the whole prompt. The template supplies the workflow, constraints, and finish steps.

---

## Examples

**Feature**
```
Follow prompts/feature.md.
Let admins filter custody NFTs by depositor email.
```

**Bug fix**
```
Follow prompts/bugfix.md.
Portfolio total is double-counting hidden holdings on Amoy.
```

**Review**
```
Follow prompts/review.md.
Review the changes on this branch.
```

**Refactor**
```
Follow prompts/refactor.md.
Simplify the duplicated USDC-approval logic in the buy and bid flows.
```

**Documentation**
```
Follow prompts/documentation.md.
Follow prompts/documentation.md.
```

**Release**
```
Follow prompts/release.md.
Verify develop is ready to promote to main.
```

---

## Shared Baseline

Every template inherits these rules (do not restate them in your prompt):

- Follow `AI_WORKFLOW.md` first; read `.cursor/project-constitution.md` and `ARCHITECTURE_INDEX.md`.
- Read only the docs and modules relevant to the task. Never scan the whole repo unless asked.
- Obey all `.cursor/rules/`. Preserve existing architecture and business rules.
- Search for existing implementations and reuse patterns before creating anything new.
- Avoid unnecessary abstractions, folders, files, helpers, and utilities.
- Update docs only if architecture or business rules changed. Never modify unrelated code.
