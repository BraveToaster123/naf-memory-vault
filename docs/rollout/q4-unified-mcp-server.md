# Q4 — Unified MCP server

**Phase:** Q4 · **Status:** done (POC/MVP)  
**Owner:** platform engineering  
**Flow:** 1 + 2  
**PLAN.md:** v3 consolidation

---

## Problem

`cursor/mcp.json` exposed two memory servers — `mortgage-qa-memory` (QA + KG) and `naf-qa-memory` (graph only). Pilots confused which to use.

## Resolution

- **`cursor/mcp.json`** — single `mortgage-qa-memory` block
- **Agents + triage skill** — all reference `mortgage-qa-memory`
- **Playwright** — optional; see `cursor/mcp.browser.json.example`

---

## Acceptance criteria

- [x] Pilot `cursor/mcp.json` has one memory server block
- [x] `npm run smoke` passes (full QA + KG tools)
- [x] All agent docs reference same server name
- [x] README quickstart matches

---

## Verification

```bash
npm run smoke
npm run manifest
```

---

## Related

- [12-integration-mcp.md](../12-integration-mcp.md)
