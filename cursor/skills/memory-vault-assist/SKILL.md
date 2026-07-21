---
name: memory-vault-assist
description: Routes QA work through memory-vault plan_qa_workflow before any browser or write. Use for CI triage, story status, or what to do next on a user story.
---

# Memory Vault Assist

**Always start here** for QA workflow questions. Call **memory-vault** MCP first — never guess the next step.

## Step 1 — Plan

```
plan_qa_workflow(
  intent=<see below>,
  test_id=<optional>,
  user_story_id=<optional>,
  ci_failed=<true|false>,
  error_class=<optional>
)
```

| User intent | `intent` value |
|-------------|----------------|
| CI test failed / flaky | `triage_failure` + `test_id` |
| What's explored for US X? | `check_story_status` + `user_story_id` |
| Explore ACs (Flow 1 pilot) | `explore_story` + `user_story_id` |
| Write manual test cases | `write_test_cases` + `user_story_id` |

Omit `intent` when `test_id` or `user_story_id` alone is enough — planner infers.

## Step 2 — Blockers

If `blockers` is non-empty: report them to the user and **stop**. Do not open browser or write memory.

## Step 3 — Prompt or skill

- If `suggested_prompt` returned → use MCP `prompts/get` with that name
- If `suggested_skill` is `memory-vault-triage` → follow [memory-vault-triage](../memory-vault-triage/SKILL.md)
- Otherwise execute `ordered_plan` step by step

## Step 4 — Policy (every write)

- No raw snapshots, stack traces, prompts, or network bodies in memory
- Synthetic loan scenarios only
- Staging/UAT URLs only for browser
- Credentials never in graph — host resolves `credential_ref`

## Examples

**CI red:** `plan_qa_workflow(intent=triage_failure, test_id="le_generation/apr visible", ci_failed=true)`

**Story status:** `plan_qa_workflow(intent=check_story_status, user_story_id="471244")`

**What next:** `plan_qa_workflow(user_story_id="471244")` → read `stage` + `blockers` + `suggested_skill`
