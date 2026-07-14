# Project context

How this repository was assembled and what problem it solves.

## Origin

Research and design sessions (July 2026) covering:

1. **DoorDash Ask DoorDash** — agentic memory, MCP tooling, eval at scale ([InfoQ](https://www.infoq.com/news/2026/07/doordash-ai-ask-assistant/))
2. **Enterprise AI platform** — Gemini gateway, KB MCP, doc wizard, PR assistant, Azure MCP, Cursor
3. **Mortgage industry** — LL-2026-04, TRID/compliance QA, vendor landscape (Blend MCP, Ocrolus, TD/PRMI)
4. **Playwright MCP + QA memory** — flakiness-knowledge-graph pattern, retention concerns
5. **DoorDash + Salesforce memory deep dives** — recreation blueprint

## Problem statement

> Build a **governed QA memory MCP** for mortgage technology teams that gives Cursor/Playwright agents institutional memory **without** storing loan NPI, raw snapshots, or unbounded conversation logs.

## Solution name

**Mortgage QA Memory (MQM)** — one memory platform, multiple namespaces (`qa`, `pr`, `ops`, `compliance`, `product`).

## Design influences

| Source | What we took |
|--------|--------------|
| DoorDash unified memory | Memory blocks, manifests, three layers, save pipeline, namespaces |
| DoorDash Intelligence post | 4-stage read, flywheel extraction, scan-before-read, task-aware retrieval |
| Salesforce Agentic Memory | Write/read gates, confidence, profile anchor, structured records |
| flakiness-knowledge-graph-mcp | Reporter → SQLite → MCP read pattern |
| Fannie Mae LL-2026-04 | Thin audit, AI inventory, QC query surface |

## Repository phases

| Phase | This repo | Separate implementation repo (future) |
|-------|-----------|--------------------------------------|
| **Now** | Docs, policy, examples, eval golden set | — |
| **Next** | — | `packages/*` TypeScript monorepo per doc 06 |

## Key stakeholder concerns addressed

- *"Memory MCP will store data we don't want long term"* → Tier 0/1/2 + deny-by-default + purge jobs (doc 05)
- *"Can we use memory for other AI aspects?"* → Namespaces (doc 09)
- *"Are companies succeeding?"* → DoorDash metrics, Salesforce platform, department ROI in doc 10

## External links (primary sources)

- https://careersatdoordash.com/blog/building-ask-doordash-part-two-intelligence/
- https://careersatdoordash.com/blog/doordash-unified-consumer-memory-for-personalization-at-scale/
- https://careersatdoordash.com/blog/building-doordash-assistant-an-engineering-overview/
- https://engineering.salesforce.com/how-agentic-memory-enables-durable-reliable-ai-agents-across-millions-of-enterprise-users/
- https://playwright.dev/docs/getting-started-mcp
- https://github.com/vola-trebla/flakiness-knowledge-graph-mcp
- https://singlefamily.fanniemae.com/news-events/lender-letter-ll-2026-04-governance-framework-use-artificial-intelligence-and-machine-learning

## Maintainer checklist

- [ ] Customize `policies/mqm-policy.yaml` staging URLs
- [ ] Security/compliance sign-off on doc 05 + `examples/ai-inventory.yaml`
- [ ] Add journey YAML for top 3 borrower flows
- [ ] Scaffold `packages/` when implementation starts
