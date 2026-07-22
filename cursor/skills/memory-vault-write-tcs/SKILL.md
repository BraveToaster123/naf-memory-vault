---
name: memory-vault-write-tcs
description: Write ADO-format manual test cases from memory-vault exploration data. No browser. Use after ac-explorer has stored US_{ID}_AC{N} entities.
---

# Memory Vault — Write Test Cases (Flow 1)

Use when drafting manual test cases from exploration memory.

## Step 0 — Plan

```
plan_qa_workflow(intent=write_test_cases, user_story_id=<ID>)
```

If `blockers` non-empty (no exploration data), stop and direct user to `memory-vault-explore`.

## Step 1 — Invoke writer

Run `@testcase-writer US <ID>` or follow MCP prompt `write_test_cases`.

## Hard rules

1. **Memory-only** — no browser, no invented steps
2. One test case per AC; login step on every TC
3. After writing, store **`US_{ID}_TestCasesDraft`** entity with draft TC content
4. Never persist credentials or borrower data

## Draft entity shape

`US_{ID}_TestCasesDraft` observations:

- `tc_count` — number of test cases
- `tc_{N}_title` — TC title
- `tc_{N}_ac_index` — source AC number
- `tc_{N}_steps` — Action / Expected Result steps (ADO format)

## Next step

Human review draft TCs → `memory-vault-publish` or `plan_qa_workflow(intent=publish_test_cases, user_story_id=<ID>)`
