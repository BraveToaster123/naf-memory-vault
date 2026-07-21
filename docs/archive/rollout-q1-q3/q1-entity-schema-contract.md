# Q1 — Entity schema contract

**Phase:** Q1 · **Status:** not_started  
**Owner:** platform engineering + QA lead (sign-off)  
**Flow:** 1  
**PLAN.md:** v3 Phase 3 seam #3

---

## Problem

Downstream agents (`testcase-writer`, `automation-generator`, console UI) need a **stable shape** for exploration entities — not ad-hoc observation text.

## User story

As a QA lead, I want a documented entity contract so I can trust what `ac-explorer` writes and what writers read.

---

## Contract (baseline)

All entities use `namespace: qa`, Tier 1 (30d TTL) unless promoted to Tier 2.

### Entity names

| Pattern | Writer | Purpose |
|---------|--------|---------|
| `US_{ID}_AC{N}` | ac-explorer | Per-acceptance-criterion exploration |
| `US_{ID}_TC{TestCaseID}` | ac-explorer (TC mode) | Executed TC results |
| `US_{ID}_Summary` | ac-explorer | Story summary + locator catalog |

`{ID}` = ADO user story work item ID. `{N}` = AC index (1-based).

### `US_{ID}_AC{N}` — required observations (keys as prefixed lines or structured tags)

| Key | Example | Required |
|-----|---------|----------|
| `status` | `PASS` / `FAIL` / `BLOCKED` | yes |
| `steps` | Numbered UI steps actually performed | yes |
| `locators` | Selector + label per interactive element | yes |
| `expected` | AC text or paraphrase | yes |
| `actual` | What was observed | if FAIL/BLOCKED |
| `blocker` | Why exploration stopped | if BLOCKED |
| `url` | Final page URL (staging only) | recommended |

### `US_{ID}_Summary` — required observations

| Key | Purpose |
|-----|---------|
| `overall_status` | PASS / PARTIAL / FAIL |
| `acs_covered` | List of AC indices explored |
| `locator_catalog` | Consolidated locators for the story |
| `notes` | Free text; no credentials |

### Relations (optional Q1)

| From | To | Type |
|------|-----|------|
| `US_{ID}_Summary` | `US_{ID}_AC{N}` | `covers_ac` |

---

## Retention

| Entity type | Default tier | Promote to Tier 2 when |
|-------------|--------------|------------------------|
| `US_*_AC*`, `US_*_Summary` | Tier 1 (30d) | — |
| Locator catalog (durable) | Tier 2 | QA lead PR via [q2-tier2-locators.md](./q2-tier2-locators.md) |

---

## In scope

- Document and validate contract against 2+ pilot stories
- QA lead sign-off

## Out of scope

- Schema enforcement in code (validation layer — future)
- Cross-story relations

---

## Deliverables

| Item | Path |
|------|------|
| Contract (this doc) | `docs/rollout/q1-entity-schema-contract.md` |
| Agent alignment | `cursor/qa-testing-agents/ac-explorer.agent.md` |
| Consumer alignment | `cursor/qa-testing-agents/testcase-writer.agent.md` |

---

## Acceptance criteria

- [ ] Pilot stories match naming patterns
- [ ] Required observation keys present on ≥80% of AC entities
- [ ] QA lead signed contract (name + date in kickoff notes)
- [ ] `testcase-writer` successfully parses pilot entities

---

## Related

- [cursor/qa-testing-agents/README.md](../../cursor/qa-testing-agents/README.md) — memory entity table
- [PLAN.md](../../PLAN.md) — retention tiers
