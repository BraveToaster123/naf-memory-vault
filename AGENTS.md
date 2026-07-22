# AGENTS.md — naf-memory-vault

Governed **memory-vault** MCP. Working POC/MVP (`packages/*`), now
pivoting to a governed knowledge-graph memory core (see PLAN.md v3).

## What this repo is

- A working MCP memory service for **Playwright QA memory** with **mortgage compliance audit**
- Adapted from **DoorDash** agentic memory + **Salesforce** Agentic Memory patterns
- **Tiered retention** — agents summarize, policy blocks PII/long-term hoarding

## Read first

1. [README.md](./README.md) — index
2. [PLAN.md](./PLAN.md) — design rationale (v1), what's built (v2), roadmap (v3)
3. [docs/rollout/README.md](./docs/rollout/README.md) — QA phased rollout (Q1–Q5 feature docs)
4. [packages/policy/memory-vault-policy.yaml](./packages/policy/memory-vault-policy.yaml) — enforce before any write path

## Hard rules for agents working here

- **Policy pre-save** on every memory write — no bypass
- **Never persist** raw snapshots, prompts, network bodies, SSN/account patterns
- **Tier 2** (journeys, locators, checkpoints) — human PR only, no agent auto-write
- **Playwright MCP** — staging/UAT allowlist; `browser_run_code_unsafe` disabled
- **Synthetic loan scenarios only** — see `loan_scenarios.allowed_ids` in policy

## Implementation layout

```
packages/policy/           memory-vault-policy.yaml — the one enforced policy
packages/shared/            pipeline, redact, types, graph store, policy engine
packages/reporter/          Playwright MemoryVaultReporter
packages/mcp-server/        `memory-vault` MCP (QA tools + governed KG)
packages/audit-client/      hash-chained audit log
journeys/                   Tier 2 curated YAML
cursor/agents/memory-vault-assist.agent.md   Entry agent — plan_qa_workflow first
cursor/skills/memory-vault-assist/           Workflow router skill
cursor/skills/memory-vault-triage/           CI triage skill (Flow 2)
cursor/skills/memory-vault-explore/          AC exploration (Flow 1)
cursor/skills/memory-vault-write-tcs/        Manual TC drafts (Flow 1)
cursor/skills/memory-vault-publish/          ADO publish (Flow 1)
cursor/skills/memory-vault-generate/         C# automation (Flow 1)
cursor/qa-testing-agents/                    Flow 1 agent definitions
cursor/mcp.flow1.json.example                memory-vault + playwright + ADO MCP
cursor/qa-profile.example.yaml               QA profile template
docs/naflink-flow1-kit.md                    NAFLink consumer copy checklist
docs/archive/flow1-agents/                   Historical copies (prefer cursor/qa-testing-agents/)
eval/                        golden CI failure labels
```

## Related stack (external repos)

- Gemini gateway (`ai-gateway`)
- KB MCP, doc wizard, PR assistant, Azure MCP — see PLAN.md v1 for the integration model
