# Vault System — Draw.io Diagrams

**Status:** Architecture assessed · **Not implemented** in codebase  
**Branch:** `develop`

## Open in draw.io

1. [diagrams.net](https://app.diagrams.net) → **Open Existing Diagram**
2. Select files from this folder
3. Or VS Code/Cursor with **Draw.io Integration** extension

## Diagram index

| # | File | Contents |
|---|------|----------|
| 00 | [00-vault-lifecycle-overview.drawio](./00-vault-lifecycle-overview.drawio) | End-to-end: intake → custody → mint → trade → redemption → re-vault |
| 01 | [01-vault-data-model.drawio](./01-vault-data-model.drawio) | Core tables & relationships |
| 02 | [02-vault-state-machines.drawio](./02-vault-state-machines.drawio) | Submission + item + mint job + redemption states |
| 03 | [03-vault-intake-evidence.drawio](./03-vault-intake-evidence.drawio) | Intake session, evidence bundle, verification gates |
| 04 | [04-vault-mint-orchestration.drawio](./04-vault-mint-orchestration.drawio) | Platform-owned mint, SLA, cert registry |
| 05 | [05-vault-redemption.drawio](./05-vault-redemption.drawio) | Burn, outbound ship, custody exit |
| 06 | [06-vault-source-of-truth.drawio](./06-vault-source-of-truth.drawio) | Hybrid SoT + reconciliation |
| 07 | [07-vault-open-questions.drawio](./07-vault-open-questions.drawio) | **Unresolved decisions** (resolve pre-build) |
| 08 | [08-vault-architecture-review-board.drawio](./08-vault-architecture-review-board.drawio) | **Complete review board** — all domains, entities, SoT, risks, V2 |
| 08-ko | [08-vault-architecture-review-board.ko.drawio](./08-vault-architecture-review-board.ko.drawio) | **전체 리뷰 보드 (한글)** — 도메인, 엔티티, SoT, 리스크, V2 |

## Agreed architecture (summary)

| Area | Decision |
|------|----------|
| Model | `vault_submissions` → many `vault_submission_items` |
| Public ID | `TBV-{YYYY}-{SEQ6}` + `item_ref` `TBV-...-01` |
| Evidence | Private object storage (S3/R2), **not** IPFS |
| Mint executor | **Platform** (relayer / MINTER_ROLE), not user wallet |
| `completed` | Custody verified **and** on-chain mint confirmed |
| Redemption | Delist → burn → cert registry release → outbound ship |
| Cert uniqueness | `asset_cert_registry` — one active cert at a time |
| MVP inbound | FedEx manual tracking + Track API poll |
| Custody MVP | Manual verify + evidence required + supervisor session lock |

## Implementation phases (planned)

```
V0  Schema + state machines + TBV ID + events partition
V1  Inbound intake + evidence + manual custody + PSA cert validate
V1.5 Platform mint orchestration (vault_mint_jobs + queue)
V2  Multi-card + OCR + redemption outbound
V3  NFT V2 (MINTER_ROLE, certKey on-chain)
V4  PSA Vault API reconciliation + enterprise four-eyes
```

## GitHub links

| Resource | URL |
|----------|-----|
| This folder | [diagrams/vault/](https://github.com/tokenable-dev/tokenable-dev/tree/develop/docs/notion-export/diagrams/vault) |
| Tech Stack (Notion) | [Tech-Stack.md](https://github.com/tokenable-dev/tokenable-dev/blob/develop/docs/notion-export/Tech-Stack.md) |
| Current `/vault` page | Mint wizard only — not this system |

**Last updated:** 2026-06-17
