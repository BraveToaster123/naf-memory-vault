# naf-memory-vault

Governed **Mortgage QA Memory MCP** (MQM). **Status:** working POC/MVP, now pivoting toward a governed knowledge-graph
memory core. See [PLAN.md](./PLAN.md) for the full history (v1 design → v2
build → v3 roadmap) — start there.

A governed MCP memory service for **Playwright QA automation**, with **tiered
retention** and **mortgage compliance audit**, adapted from DoorDash's and
Salesforce's agentic memory architectures.

See [AGENTS.md](./AGENTS.md) for agent working rules.

---

## Who this is for

- Platform / QA engineers building internal AI tooling on **Cursor**, **Gemini
  gateway**, **KB MCP**, and **Azure MCP**
- Mortgage technology teams that need QA intelligence **without** creating a
  second store of loan data or NPI
- Teams evaluating **Playwright MCP** + a **QA memory expander** they control
  end-to-end

---

## Quickstart

```bash
npm install
npm run typecheck
npm test
npm run seed:demo
npm run smoke          # expect SMOKE PASS
npm run console        # http://127.0.0.1:4173
```

One-shot demo (seed + namespace seed + smoke + console):

```bash
npm run demo
```

Then point Cursor at [`cursor/mcp.json`](./cursor/mcp.json) (`mortgage-qa-memory` only) and add the
[`mortgage-qa-triage`](./cursor/skills/mortgage-qa-triage/SKILL.md) skill.

For browser repro, merge blocks from [`cursor/mcp.browser.json.example`](./cursor/mcp.browser.json.example).

See [docs/POC.md](./docs/POC.md) for 5-minute handoff. Full demo: [docs/15-poc-demo.md](./docs/15-poc-demo.md).

## Layout

| Path | Contents |
|------|----------|
| `packages/policy/mqm-policy.yaml` | The one enforced policy: retention, deny patterns, RBAC, write tiers |
| `packages/shared`, `packages/reporter`, `packages/mcp-server`, `packages/audit-client` | Runnable monorepo — see [PLAN.md](./PLAN.md) |
| `packages/console` | Flow 2 demo UI (flake/journeys — not full KG browser) |
| `journeys/*.yaml` | Tier 2 curated mortgage journeys |
| `ai-inventory.yaml` | LL-2026-04 AI tool inventory |
| `cursor/mcp.json`, `cursor/skills/mortgage-qa-triage/` | Cursor MCP + triage skill |
| `docs/archive/flow1-agents/` | Story-pipeline agents (deferred until Q1 pilot) |
| `eval/` | Flake-classification eval gate |

---

## Related external references

- [DoorDash Ask DoorDash / InfoQ summary](https://www.infoq.com/news/2026/07/doordash-ai-ask-assistant/) — agentic memory + MCP + eval at scale
- [Playwright MCP docs](https://playwright.dev/docs/getting-started-mcp) — browser automation via MCP
- [flakiness-knowledge-graph-mcp](https://github.com/vola-trebla/flakiness-knowledge-graph-mcp) — reporter + SQLite + MCP pattern
- [Fannie Mae LL-2026-04](https://singlefamily.fanniemae.com/news-events/lender-letter-ll-2026-04-governance-framework-use-artificial-intelligence-and-machine-learning) — AI governance for seller/servicers (effective Aug 6, 2026)
- [Blend Autopilot MCP](https://blend.com/company/newsroom/blend-launches-autopilot-mcp-server-opening-lending-platform-fi-built-ai-agents/) — lending MCP reference architecture

## Next steps

See [PLAN.md](./PLAN.md) v3 for the live roadmap and open questions for the QA
team.
