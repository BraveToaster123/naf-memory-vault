# Q1 — ac-explorer pilot

**Phase:** Q1 · **Status:** not_started  
**Owner:** external QA team (execution) + platform (kit)  
**Flow:** 1  
**PLAN.md:** v3 Phase 3 (pilot one agent)

---

## Problem

Agents need **real** exploration data in governed memory before the full pipeline is wired. External QA validates the workflow on their stories and app.

## User story

As a QA engineer on the pilot team, I want to explore acceptance criteria in staging and have steps/locators stored in memory so a teammate can continue or write test cases without re-exploring.

---

## In scope

- `@ac-explorer {storyId}` on 2–3 ADO user stories
- MCP server: `memory-vault` (`packages/mcp-server/src/index.ts`)
- `namespace: qa` on all KG writes
- Playwright MCP for browser (staging allowlist)
- Modes: AC exploration (primary); TC execution optional

## Out of scope

- Publishing TCs to ADO (Q2)
- CI flake tools
- Azure DevOps MCP (optional for Q1 if ACs pasted manually)

---

## Dependencies

- [q1-staging-and-credentials.md](./q1-staging-and-credentials.md)
- [q1-entity-schema-contract.md](./q1-entity-schema-contract.md)
- Governed memory core ✅ (`npm run smoke`)

---

## Deliverables

| Item | Path |
|------|------|
| Agent definition | `cursor/qa-testing-agents/ac-explorer.agent.md` |
| MCP config | `cursor/mcp.json` → `memory-vault` block |
| Pilot runbook | This doc + kickoff checklist in [q1-exploration-pilot.md](./q1-exploration-pilot.md) |

---

## Acceptance criteria

- [ ] ≥2 stories completed with `US_{ID}_AC{N}` entities in `qa` namespace
- [ ] `US_{ID}_Summary` entity present per story
- [ ] No credentials stored in observations (policy scan clean)
- [ ] Second session/agent can `read_graph` / `search_nodes` and see same data
- [ ] QA lead sign-off on exploration quality

---

## Verification

```bash
npm run smoke
# After pilot: open console KG panel or call read_graph(namespace=qa)
```

Manual: invoke `@ac-explorer {ID}` in Cursor; inspect memory via console or MCP.

---

## Open questions

| Question | Owner | Default |
|----------|-------|---------|
| Which 2–3 stories? | QA lead | — |
| ADO MCP in Q1 or manual AC paste? | QA lead | Manual OK for Q1 |
| TC execution mode in pilot? | QA lead | Optional |

---

## Related

- [cursor/qa-testing-agents/README.md](../../cursor/qa-testing-agents/README.md)
- [FLOW2-INTEGRATION.md](../FLOW2-INTEGRATION.md)
