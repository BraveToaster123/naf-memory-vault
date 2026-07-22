# NAFLink Flow 1 — consumer copy kit

**Audience:** NAFLink QA automation engineers wiring the story pipeline.  
**Vault source:** [`cursor/qa-testing-agents/`](../../cursor/qa-testing-agents/) and Flow 1 skills.

**Last updated:** 2026-07-21

---

## What to copy into `NAFTech.NAFLink.UITestAutomation`

| Vault path | NAFLink destination |
|------------|---------------------|
| `cursor/qa-testing-agents/*.agent.md` | `.cursor/agents/` or `.github/agents/` |
| `cursor/skills/memory-vault-assist/` | `.cursor/skills/memory-vault-assist/` |
| `cursor/skills/memory-vault-explore/` | `.cursor/skills/memory-vault-explore/` |
| `cursor/skills/memory-vault-write-tcs/` | `.cursor/skills/memory-vault-write-tcs/` |
| `cursor/skills/memory-vault-publish/` | `.cursor/skills/memory-vault-publish/` |
| `cursor/skills/memory-vault-generate/` | `.cursor/skills/memory-vault-generate/` |
| `cursor/skills/memory-vault-triage/` | `.cursor/skills/memory-vault-triage/` (Flow 2) |
| `cursor/mcp.flow1.json.example` | Merge into `.cursor/mcp.json` |
| `cursor/qa-profile.example.yaml` | `qa-profile.yaml` (gitignore; no secrets in repo) |

Point `memory-vault` MCP env at shared or local `memory-vault.db` (same path as Flow 2 reporter).

---

## Environment

| Variable | Purpose |
|----------|---------|
| `MEMORY_VAULT_DB_PATH` | SQLite path (shared with reporter) |
| `MEMORY_VAULT_POLICY_PATH` | Path to `memory-vault-policy.yaml` |
| `MEMORY_VAULT_JOURNEYS_DIR` | Curated journey YAML |
| `AZURE_DEVOPS_EXT_PAT` | ADO MCP (publish only) |
| `CREDENTIAL_REF_NAFLINK_QA_USERNAME` | PingOne login (host env) |
| `CREDENTIAL_REF_NAFLINK_QA_PASSWORD` | PingOne login (host env) |

**Never** store credentials in memory-vault observations.

---

## Policy PR (platform)

Add QA URL to vault policy `allowed_prefixes`:

```yaml
- https://qa.ll.nafinc.com
```

---

## Pilot runbook (2 stories)

1. `plan_qa_workflow(intent=explore_story, user_story_id="<ID>")` → `@ac-explorer <ID>`
2. `plan_qa_workflow(intent=write_test_cases, user_story_id="<ID>")` → `@testcase-writer US <ID>`
3. Human review `US_{ID}_TestCasesDraft` in memory / chat output
4. `plan_qa_workflow(intent=publish_test_cases, user_story_id="<ID>")` → `@ado-publisher US <ID>` — confirm before ADO create
5. `plan_qa_workflow(intent=generate_automation, user_story_id="<ID>")` → `@automation-generator` — build + test + human PR

Validate with [`qa-pilot-intake.md`](./qa-pilot-intake.md) exercises E2.7–E2.9.

---

## Flow 1 vs Consolidate_NL

| Use Flow 1 | Use Consolidate_NL |
|------------|-------------------|
| New / unknown UI | Well-covered area with page objects |
| Need real locators from browser | ADO text + codebase sufficient |
| Pilot story exploration | Bulk automation on familiar flows |

Entry skill: **`memory-vault-assist`** — always `plan_qa_workflow` first.

---

## Human gates (required)

| Step | Gate |
|------|------|
| ADO publish | User confirms before `wit_create_work_item` |
| Automation merge | Human PR review; agent does not force-push |
| Locator promotion | PR to `journeys/` (Tier 2) |

---

## Related

- [roadmap-and-open-items.md](./roadmap-and-open-items.md)
- [FLOW2-INTEGRATION.md](./FLOW2-INTEGRATION.md)
- [cursor/qa-testing-agents/README.md](../cursor/qa-testing-agents/README.md)
