# Q2 — ado-publisher

**Phase:** Q2 · **Status:** not_started  
**Owner:** QA team + platform  
**Flow:** 1  
**PLAN.md:** v3 Phase 3 seam #4 (MCP wiring)

---

## Problem

Test cases must land in Azure DevOps as work items linked to the user story.

## User story

As a QA engineer, I want exploration-derived test cases created in ADO automatically so traceability is maintained.

---

## In scope

- `@ado-publisher` after writer output
- Azure DevOps MCP in `cursor/mcp.json`
- Fix tool namespace mismatch: align `Azure DevOps/*` vs `microsoft/azure-devops-mcp/*`
- Link TCs to parent user story

## Out of scope

- Automation code commit (Q3)
- Cross-project ADO setup

---

## Dependencies

- [q2-testcase-writer.md](./q2-testcase-writer.md)
- ADO project + permissions for pilot team
- [q3-qa-profile.md](./q3-qa-profile.md) `ado_project` (can stub in Q2)

---

## Deliverables

| Item | Path |
|------|------|
| Agent | `cursor/qa-testing-agents/ado-publisher.agent.md` |
| MCP config | `cursor/mcp.json` → azure-devops-mcp block |

---

## Acceptance criteria

- [ ] Test Case work items created in correct ADO project
- [ ] TCs linked to user story (parent/related link)
- [ ] Publisher uses same MCP tool prefix as other agents
- [ ] No PII in TC fields beyond synthetic scenario refs

---

## Verification

Manual: full chain `@ac-explorer` → `@testcase-writer` → `@ado-publisher`; verify in ADO UI.

---

## Open questions

| Question | Owner |
|----------|-------|
| ADO project name for pilot team? | QA lead |
| Test plan / suite target? | QA lead |

---

## Related

- [08-integration-with-existing-stack.md](../08-integration-with-existing-stack.md)
