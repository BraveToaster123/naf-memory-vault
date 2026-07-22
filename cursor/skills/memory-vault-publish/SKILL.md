---
name: memory-vault-publish
description: Publish draft manual test cases from memory-vault to Azure DevOps. Requires human confirmation before creating work items.
---

# Memory Vault — Publish Test Cases (Flow 1)

Use when draft TCs in memory are ready for ADO.

## Step 0 — Plan

```
plan_qa_workflow(intent=publish_test_cases, user_story_id=<ID>)
```

If `blockers` non-empty (no `US_{ID}_TestCasesDraft`), stop and direct user to `memory-vault-write-tcs`.

## Step 1 — Invoke publisher

Run `@ado-publisher US <ID>` or follow MCP prompt `publish_test_cases`.

## Prerequisites

- MCP: `memory-vault`, `azure-devops-mcp`
- QA profile: `ado_project` from `qa-profile.yaml`

## Hard rules

1. Read `US_{ID}_TestCasesDraft` from memory — publish steps exactly as written
2. **Ask user to confirm** before creating any ADO work items
3. Skip duplicates if TCs already linked to the story
4. After publish, store **`US_{ID}_TestCases`** with created TC IDs
5. Never store credentials in memory

## Human gate (required)

```
Before I create N test cases in ADO and link them to US <ID>, confirm: proceed? (yes/no)
```

Do not call ADO create tools until user says yes.

## Next step

`memory-vault-generate` or `plan_qa_workflow(intent=generate_automation, user_story_id=<ID>)`
