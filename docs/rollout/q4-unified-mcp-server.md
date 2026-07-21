# Q4 — Unified MCP server

**Phase:** Q4 · **Status:** not_started  
**Owner:** platform engineering  
**Flow:** 1 + 2  
**PLAN.md:** v3 consolidation

---

## Problem

`cursor/mcp.json` exposes two servers — `mortgage-qa-memory` (QA + KG) and `naf-qa-memory` (graph only). Pilots confuse which to use.

## User story

As a QA engineer, I want one memory MCP server name so agents and skills don't point at the wrong entry.

---

## In scope

- Standardize on **`mortgage-qa-memory`** (`packages/mcp-server/src/index.ts`) for Flow 1 + 2
- Q1 may use `naf-qa-memory` alone; migrate pilot config at Q4 start
- Update skill, agents, profile `memory_server` field
- Document when `graph-index.ts` is dev-only vs deprecated for pilots

## Out of scope

- Merging code paths if already unified in `index.ts` (verify — index may already expose both tool sets)

---

## Deliverables

| Item | Path |
|------|------|
| Primary server | `packages/mcp-server/src/index.ts` |
| Graph-only entry | `packages/mcp-server/src/graph-index.ts` (dev/smoke) |
| Config | `cursor/mcp.json` |
| Profile | [q3-qa-profile.md](./q3-qa-profile.md) |

---

## Acceptance criteria

- [ ] Pilot `cursor/mcp.json` has one memory server block
- [ ] `npm run smoke` passes (full QA + KG tools)
- [ ] All agent docs reference same server name
- [ ] README quickstart matches

---

## Verification

```bash
npm run smoke
npm run manifest   # tools.json drift check if wired in CI
```

---

## Related

- [12-integration-mcp.md](../12-integration-mcp.md)
