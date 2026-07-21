# POC — 5-minute handoff

**Audience:** QA engineer or platform lead trying the repo on a new machine.

## 1. Install and seed

```powershell
cd C:\Projects\naf-memory-vault
npm install
npm run demo
```

Expect terminal **SMOKE PASS** and console at **http://127.0.0.1:4173** (leave terminal open).

Or without console:

```powershell
npm run seed:demo
npm run smoke
```

## 2. Wire Cursor

1. Open this repo as the workspace (MCP paths are relative to repo root).
2. Merge [`cursor/mcp.json`](../cursor/mcp.json) into Cursor MCP settings — one server: `mortgage-qa-memory`.
3. Restart Cursor.
4. Optional: add skill [`cursor/skills/mortgage-qa-triage/`](../cursor/skills/mortgage-qa-triage/SKILL.md).

## 3. Try it

**MCP tool panel:** run `get_flaky_tests` with `limit: 5`.

**Chat:** “Triage `le_generation/apr visible` — should we skip browser?”

**Console:** flaky list → click row → skip-browser + history.

## 4. Optional browser repro

Merge [`cursor/mcp.browser.json.example`](../cursor/mcp.browser.json.example) for Playwright MCP. Requires real staging URLs in [`packages/policy/mqm-policy.yaml`](../packages/policy/mqm-policy.yaml).

## What you do NOT need

- `ac-explorer` / story-pipeline agents (archived under [`archive/flow1-agents/`](./archive/flow1-agents/))
- Azure DevOps MCP (until story pipeline pilot)
- Real staging CI (demo uses synthetic `seed:demo` data)

## More detail

- Stakeholder demo script: [15-poc-demo.md](./15-poc-demo.md)
- Production gates: [14-operational-readiness.md](./14-operational-readiness.md)
- Wire real Playwright CI: [FLOW2-INTEGRATION.md](./FLOW2-INTEGRATION.md)
