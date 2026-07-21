# Q4 — CI triage

**Phase:** Q4 · **Status:** not_started  
**Owner:** QA + platform  
**Flow:** 2  
**Duration:** 3–4 weeks (can overlap Q3)  
**PLAN.md:** v2 POC NEEDS-ENV gaps

---

## Goal

Flow 2 live: CI writes flake history; agents triage real staging failures with memory-before-browser.

---

## Features

| Feature | Doc |
|---------|-----|
| Playwright reporter | [q4-playwright-reporter.md](./q4-playwright-reporter.md) |
| Triage skill | [q4-triage-skill.md](./q4-triage-skill.md) |
| Journey YAML | [q4-journeys.md](./q4-journeys.md) |
| Unified MCP server | [q4-unified-mcp-server.md](./q4-unified-mcp-server.md) |

---

## Phase exit criteria

- [ ] Real `test_runs` from their CI (not seed-only)
- [ ] 5 staging failures triaged with skill; ≥1 `should_skip_browser` save
- [ ] 3 journeys with TRID checkpoints
- [ ] Single MCP server entry in pilot config

---

## Related

- [13-definition-of-done.md](../13-definition-of-done.md)
- [15-poc-demo.md](../15-poc-demo.md)
