# Q4 — Unified MCP server

**Phase:** Q4 · **Status:** done (POC/MVP)  
**Owner:** platform engineering  
**Flow:** 1 + 2  
**PLAN.md:** v3 consolidation

---

## Problem

`cursor/mcp.json` once exposed two memory servers — `mortgage-qa-memory` (QA + KG) and `naf-qa-memory` (graph only). Pilots confused which to use. The surviving server is now named **`memory-vault`**.

## Resolution

- **`cursor/mcp.json`** — single `memory-vault` block
- **Agents + triage skill** — all reference `memory-vault`
- **Playwright** — optional; see `cursor/mcp.browser.json.example`
- **Removed** — `naf-qa-memory` server block and `packages/mcp-server/src/graph-index.ts` entry point (graph tools live in `index.ts`)

## Migration (legacy MCP server names)

Delete these from your **user** Cursor MCP settings if present (`naf-qa-memory`, `mortgage-qa-memory`). Keep only **`memory-vault`** from [`cursor/mcp.json`](../../cursor/mcp.json).

1. Remove legacy entries under `mcpServers` (`naf-qa-memory`, `mortgage-qa-memory`).
2. Add or keep `memory-vault` pointing at `packages/mcp-server/src/index.ts`.
3. Restart Cursor — stale names can trigger install/start attempts for servers that no longer exist.

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

- [tools.json](../tools.json) — machine-readable tool manifest
- [POC.md](../POC.md) — Cursor wiring
