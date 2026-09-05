# PSA grade policy (SSOT)

Mint eligibility and Cardhedger history tiers must stay aligned between backend and frontend. **Do not add a shared npm package** — keep two copies and lock them with the parity spec.

| Copy | Path |
|------|------|
| Backend (mint / buckets / history) | `backend/src/marketplace/utils/psa-grade-policy.util.ts` |
| Frontend (display / Markets tiers) | `frontend/lib/market/psaGradePolicy.ts` |
| Contract tests | `backend/src/marketplace/utils/psa-grade-policy.util.spec.ts` |
| FE/BE lock | `backend/src/marketplace/utils/psa-grade-policy.fe-parity.spec.ts` |

## Rules both copies must share

| Class | When | Mint | History tier | Bucket score |
|-------|------|------|--------------|--------------|
| `psa_10` | numeric floor 10 | yes | `PSA_10` | `"10"` |
| `psa_sub10` | numeric floor 1–9 | yes | `PSA_1`…`PSA_9` | `"1"`…`"9"` |
| `psa_qualifier` | AUTH / AUTHENTIC (no 1–10) | yes | `PSA_AUTH` | `"auth"` |
| `unknown` | none of the above | **no** | default `PSA_10` (history fallback) | `null` |

Numeric score may come from `gradeScore` or from label/description text (`PSA 7`, `GEM MT 10`).

## Intentional difference

`psaGradePolicyInputFromGraded` field maps are **not** required to match.

- Backend: mint / catalog write path — `psa.gradeScore` / `grade.score` / `graded.gradeScore` only.
- Frontend: display fallbacks may also read `psa.company`, `psa.score`, `psa.grade`.

Do not widen the backend map just to match the frontend; that can change mint eligibility.

Display-only helpers (`formatPsaGradedByDisplay`) live on the frontend.
