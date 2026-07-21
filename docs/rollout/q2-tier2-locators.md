# Q2 — Tier 2 locators

**Phase:** Q2 · **Status:** not_started  
**Owner:** QA lead  
**Flow:** 1  
**PLAN.md:** v2 tier2_approval + journeys

---

## Problem

Some locators should **outlive** 30-day Tier 1 exploration memory. Tier 2 requires human PR — agents propose only.

## User story

As a QA lead, I want stable locators curated in git so automation and journeys don't break when exploration entities expire.

---

## In scope

- `upsert_locator` MCP tool → `require_approval` response (no direct write)
- Human opens PR to `journeys/locators/*.yaml` or journey YAML
- Document when to promote vs keep Tier 1

## Out of scope

- UI approve button (deferred)
- Auto-promotion from exploration

---

## Deliverables

| Item | Path |
|------|------|
| MCP tool | `upsert_locator` in `packages/mcp-server/src/tools.ts` |
| Curated locators | `journeys/locators/` |
| Policy | `tier2_approval_required` in `mqm-policy.yaml` |

---

## Acceptance criteria

- [ ] Agent call to `upsert_locator` returns `require_approval` with PR instructions
- [ ] QA lead completes one locator PR from pilot story
- [ ] `get_journey_map` / agents read Tier 2 locators after merge
- [ ] Retention rules documented in kickoff notes

---

## Verification

```bash
npm run smoke   # upsert_locator tier2_requires_pr_approval
```

---

## Related

- [journeys/locators/README.md](../../journeys/locators/README.md)
- [deferred-console-writes.md](./deferred-console-writes.md)
