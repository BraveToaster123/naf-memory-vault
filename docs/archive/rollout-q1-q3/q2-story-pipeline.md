# Q2 — Story pipeline

**Phase:** Q2 · **Status:** not_started  
**Owner:** QA lead  
**Flow:** 1  
**Duration:** 3–4 weeks  
**PLAN.md:** v3 Phase 3 (full pipeline steps 2–3)

---

## Goal

Complete Flow 1 from exploration → manual test cases → ADO — memory as handoff between agents.

**Depends on:** Q1 exit (entity contract + ≥1 story explored).

---

## Features

| Feature | Doc |
|---------|-----|
| testcase-writer | [q2-testcase-writer.md](./q2-testcase-writer.md) |
| ado-publisher | [q2-ado-publisher.md](./q2-ado-publisher.md) |
| Tier 2 locators | [q2-tier2-locators.md](./q2-tier2-locators.md) |

---

## Phase exit criteria

- [ ] One user story: explore → write TCs → publish to ADO → linked to story
- [ ] Writer never invents steps (memory-only rule enforced)
- [ ] ADO MCP wired in `cursor/mcp.json`
- [ ] Locator promotion path documented (Tier 2 PR when needed)

---

## Out of scope

- Playwright automation generation (Q3)
- CI triage (Q4)

---

## Related

- [q1-exploration-pilot.md](./q1-exploration-pilot.md)
- [cursor/qa-testing-agents/README.md](../../cursor/qa-testing-agents/README.md)
