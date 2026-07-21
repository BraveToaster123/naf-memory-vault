# Q2 — testcase-writer

**Phase:** Q2 · **Status:** not_started  
**Owner:** QA team  
**Flow:** 1  
**PLAN.md:** v3 Phase 3

---

## Problem

Manual test cases must reflect **real** UI steps from exploration — not LLM guesses.

## User story

As a QA engineer, I want test cases generated from exploration memory so I can publish accurate ADO TCs without re-walking the app.

---

## In scope

- `@testcase-writer US {ID}` after `ac-explorer` data exists
- Reads `US_{ID}_AC{N}` per [q1-entity-schema-contract.md](./q1-entity-schema-contract.md)
- One TC per AC; login step from profile/credentials host
- Stops if memory empty — directs user to `@ac-explorer`

## Out of scope

- Browser access (writer is memory-only)
- ADO publish (see [q2-ado-publisher.md](./q2-ado-publisher.md))

---

## Dependencies

- Q1 exit + signed entity contract
- `naf-qa-memory` or unified MCP with KG read tools

---

## Deliverables

| Item | Path |
|------|------|
| Agent | `cursor/qa-testing-agents/testcase-writer.agent.md` |
| Sequential thinking MCP | `cursor/mcp.json` (if used) |

---

## Acceptance criteria

- [ ] Writer produces ADO-format TCs from Q1 pilot story memory
- [ ] No fabricated locators (cross-check against exploration entities)
- [ ] Empty memory → clear error, no output
- [ ] QA lead approves TC quality on ≥1 story

---

## Verification

Manual: `@testcase-writer US {pilotId}` after exploration; compare steps to console KG panel.

---

## Related

- [q1-entity-schema-contract.md](./q1-entity-schema-contract.md)
