# AGENTS.md — mcp-memory

Governed **Mortgage QA Memory MCP** — docs in `docs/`, runnable packages in `packages/`.

## Read first

1. [README.md](./README.md) — index
2. [docs/00-adoption-guide.md](./docs/00-adoption-guide.md) — security, npm assessment, paths forward (any AI/project)
3. [docs/11-implementation.md](./docs/11-implementation.md) — packages + quickstart
4. [docs/10-doordash-salesforce-memory-deep-dive.md](./docs/10-doordash-salesforce-memory-deep-dive.md) — recreate reference
5. [docs/05-data-retention-and-privacy.md](./docs/05-data-retention-and-privacy.md) — storage rules
6. [packages/policy/mqm-policy.yaml](./packages/policy/mqm-policy.yaml) — enforce before any write path
7. [docs/16-playbook-mirror-privatize.md](./docs/16-playbook-mirror-privatize.md) — portable mirror + privatize playbook
8. [docs/14-operational-readiness.md](./docs/14-operational-readiness.md) — non-savable list, auth, namespace owners
9. [docs/17-governed-memory-landscape.md](./docs/17-governed-memory-landscape.md) — OSS / production survey

## Hard rules

- **Policy pre-save** on every memory write — no bypass
- **Never persist** raw snapshots, prompts, network bodies, SSN/account patterns
- **Tier 2** (journeys, locators, checkpoints) — human PR only, no agent auto-write
- **Playwright MCP** — staging/UAT allowlist; `browser_run_code_unsafe` disabled
- **Synthetic loan scenarios only** — see `loan_scenarios.allowed_ids` in policy
- **Do not use** `@modelcontextprotocol/server-memory` in production — use governed KG in `@mqm/shared`

## Layout

```
packages/policy/       mqm-policy.yaml
packages/shared/       pipeline, redact, policy, SQLite, KG
packages/reporter/     Playwright MqmReporter
packages/mcp-server/   mortgage-qa-memory MCP
packages/console/      read-only memory desktop inspector
packages/audit-client/ gateway audit ingest
journeys/              Tier 2 curated YAML
cursor/                MCP config + skills
ai-inventory.yaml      LL-2026-04 inventory (draft)
eval/                  golden CI failure labels
docs/                  unified documentation (00–18 + tools.json)
```

## Related stack (external)

Gemini gateway, KB MCP, doc wizard, PR assistant, Azure MCP — see [docs/08-integration-with-existing-stack.md](./docs/08-integration-with-existing-stack.md).
