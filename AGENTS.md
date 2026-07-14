# AGENTS.md — mcp-memory

Governed **Mortgage QA Memory MCP** design repo. Documentation and templates today; implementation packages (`packages/`) come in Phase 1 per [06-build-from-scratch.md](./06-build-from-scratch.md).

## What this repo is

- Architecture and policy for **Playwright QA memory** with **mortgage compliance audit**
- Adapted from **DoorDash** agentic memory + **Salesforce** Agentic Memory patterns
- **Tiered retention** — agents summarize, policy blocks PII/long-term hoarding

## Read first

1. [README.md](./README.md) — index
2. [10-doordash-salesforce-memory-deep-dive.md](./10-doordash-salesforce-memory-deep-dive.md) — recreate reference
3. [05-data-retention-and-privacy.md](./05-data-retention-and-privacy.md) — storage rules
4. [policies/mqm-policy.yaml](./policies/mqm-policy.yaml) — enforce before any write path

## Hard rules for agents working here

- **Policy pre-save** on every memory write — no bypass
- **Never persist** raw snapshots, prompts, network bodies, SSN/account patterns
- **Tier 2** (journeys, locators, checkpoints) — human PR only, no agent auto-write
- **Playwright MCP** — staging/UAT allowlist; `browser_run_code_unsafe` disabled
- **Synthetic loan scenarios only** — see `loan_scenarios.allowed_ids` in policy

## Implementation layout (future)

```
packages/policy/       mqm-policy.yaml
packages/shared/       pipeline, redact, types
packages/reporter/     Playwright MqmReporter
packages/mcp-server/   mortgage-qa-memory MCP
packages/audit-client/ gateway audit ingest
journeys/              Tier 2 curated YAML
examples/              Cursor mcp.json, skills, inventory
eval/                  golden CI failure labels
```

## Related stack (external repos)

- Gemini gateway (`ai-gateway`)
- KB MCP, doc wizard, PR assistant, Azure MCP — integrate per [08-integration-with-existing-stack.md](./08-integration-with-existing-stack.md)
