# Q4 — mortgage-qa-triage skill

**Phase:** Q4 · **Status:** not_started  
**Owner:** QA team  
**Flow:** 2  
**PLAN.md:** v2 skill + v3 adoption

---

## Problem

On CI failure, agents must consult memory **before** opening Playwright — save time on known flakes.

## User story

As a QA engineer investigating a failed staging test, I want the triage skill to rank flakes and skip browser when memory says so.

---

## In scope

- Roll out [mortgage-qa-triage](../../cursor/skills/mortgage-qa-triage/SKILL.md) to pilot team
- MCP: `mortgage-qa-memory` (QA tools + KG) per [q4-unified-mcp-server.md](./q4-unified-mcp-server.md)
- Workflow: `get_failure_signature` → `should_skip_browser` → `get_journey_map` → optional Playwright
- `record_run_summary` after investigation (no raw errors)

## Out of scope

- Exploration pipeline (Q1–Q3)

---

## Deliverables

| Item | Path |
|------|------|
| Skill | `cursor/skills/mortgage-qa-triage/SKILL.md` |
| QA tools | `packages/mcp-server/src/index.ts` |

---

## Acceptance criteria

- [ ] 5 real staging failures triaged (documented in pilot log)
- [ ] ≥1 case: `should_skip_browser: true` — no browser opened
- [ ] ≥1 case: investigate path uses journey + env facts
- [ ] No policy blocks from storing raw snapshots (agents followed skill rules)
- [ ] `npm run eval` ≥ 0.6 on golden set (CI gate)

---

## Verification

```bash
npm run eval
npm run smoke
```

---

## Related

- [03-qa-automation-playwright.md](../03-qa-automation-playwright.md)
- [07-mcp-tools-specification.md](../07-mcp-tools-specification.md)
