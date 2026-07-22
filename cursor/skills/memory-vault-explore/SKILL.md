---
name: memory-vault-explore
description: Explore ADO acceptance criteria in staging via Playwright; store steps and locators in memory-vault. Use when starting a user story or capturing UI workflow for test case writing.
---

# Memory Vault — Explore Story (Flow 1)

Use when walking acceptance criteria in the browser for a user story.

## Step 0 — Plan

```
plan_qa_workflow(intent=explore_story, user_story_id=<ID>)
```

If `blockers` non-empty, stop and report them.

## Step 1 — Invoke explorer

Run `@ac-explorer <ID>` or follow MCP prompt `explore_acceptance_criteria`.

## Prerequisites

- MCP: `memory-vault`, `playwright`, `azure-devops-mcp` (optional if ACs pasted manually)
- QA profile: `app_url`, `credential_ref` from host env — **never** store passwords in memory
- Policy: staging/UAT allowlist only

## Hard rules

1. AC-only browser actions — no exploratory detours
2. Store `US_{ID}_AC{N}` per acceptance criterion and `US_{ID}_Summary` locator catalog
3. No raw snapshots, stack traces, or network bodies in memory writes
4. Never use `browser_run_code_unsafe`
5. Stop on first AC failure; do not retry silently

## Memory entities written

| Entity | Content |
|--------|---------|
| `US_{ID}_AC{N}` | status, steps, locators, expected, actual (if FAIL) |
| `US_{ID}_Summary` | overall_status, acs_covered, locator_catalog |

## Next step

When exploration complete → `memory-vault-write-tcs` or `plan_qa_workflow(intent=write_test_cases, user_story_id=<ID>)`
