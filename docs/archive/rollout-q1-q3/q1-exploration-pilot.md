# Q1 — Exploration memory pilot

**Phase:** Q1 · **Status:** not_started  
**Owner:** QA lead + platform engineering  
**Flow:** 1  
**Duration:** 4–6 weeks  
**PLAN.md:** v3 Phase 3 (scoped) + Phase 2 console slice

---

## Goal

Prove governed **exploration memory** works for real user stories with an external QA team — before CI triage or full agent pipeline.

---

## Features in this phase

| Feature | Doc |
|---------|-----|
| `ac-explorer` pilot (2–3 stories) | [q1-ac-explorer-pilot.md](./q1-ac-explorer-pilot.md) |
| Entity schema contract | [q1-entity-schema-contract.md](./q1-entity-schema-contract.md) |
| Console KG read panel | [q1-kg-console-read.md](./q1-kg-console-read.md) |
| Staging URLs + credentials | [q1-staging-and-credentials.md](./q1-staging-and-credentials.md) |

---

## Week 0 — Kickoff checklist

- [ ] External QA team named; 2–3 user stories selected
- [ ] Staging URLs in policy ([q1-staging-and-credentials.md](./q1-staging-and-credentials.md))
- [ ] Pilot kit distributed: `cursor/mcp.json` (`memory-vault`), `ac-explorer` agent, 1-pager
- [ ] Retention decision: exploration entities Tier 1 (30d) — document exceptions
- [ ] Entity schema contract reviewed ([q1-entity-schema-contract.md](./q1-entity-schema-contract.md))

---

## Weeks 1–2 — Pilot run

- [ ] Each story explored via `@ac-explorer {ID}`
- [ ] KG entities visible in console ([q1-kg-console-read.md](./q1-kg-console-read.md))
- [ ] Weekly review: policy blocks, entity quality, agent friction

---

## Phase exit criteria

- [ ] ≥2 stories explored; memory persists across sessions
- [ ] Zero unexplained PII in graph (spot-check + policy block log)
- [ ] `testcase-writer` drafts TCs from memory **without browser** on ≥1 story
- [ ] Entity schema signed by QA lead
- [ ] Blockers for Q2 logged

---

## Out of scope (Q1)

- `testcase-writer`, `ado-publisher`, `automation-generator` production rollout
- CI reporter, flake triage, `memory-vault` QA tools
- `pr` / `ops` / `compliance` namespaces
- Gateway SSO

---

## Related

- [README.md](./README.md)
- [00-scope-and-principles.md](../../rollout/00-scope-and-principles.md)
- [PLAN.md](../../PLAN.md) v3 Phase 3
