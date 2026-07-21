# Q4 — Journey YAML (Tier 2)

**Phase:** Q4 · **Status:** not_started  
**Owner:** QA lead  
**Flow:** 2  
**PLAN.md:** v2 DoD partial (1 of 3 journeys shipped)

---

## Problem

Triage and compliance checks need curated journey maps with TRID checkpoints. Three Tier 2 YAML files exist today (`le_generation`, `cd_generation`, `urla_data_entry`); content quality varies — treat as pilot seed, not production-complete.

## User story

As a QA lead, I want journey maps for key flows so agents know checkpoints without raw snapshots.

---

## In scope

- Complete Tier 2 YAML:
  - `journeys/cd_generation.yaml`
  - `journeys/urla_data_entry.yaml`
- Human PR approval for journey changes (Tier 2)
- `get_journey_map`, `get_compliance_checkpoint` read tools

## Out of scope

- Agent auto-write to journey files

---

## Deliverables

| Item | Path |
|------|------|
| Journeys | `journeys/*.yaml` |
| Read tools | `get_journey_map`, `get_compliance_checkpoint` |

---

## Acceptance criteria

- [ ] 3 journeys with TRID (or URLA/ECOA) checkpoints — v2 DoD met
- [ ] `get_journey_map` returns each from MCP smoke
- [ ] Console journey buttons load all three
- [ ] QA lead signed journey content

---

## Verification

```bash
npm run smoke
npm run console   # journey panel
```

---

## Related

- [journeys/le_generation.yaml](../../journeys/le_generation.yaml) — reference
