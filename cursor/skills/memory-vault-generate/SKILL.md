---
name: memory-vault-generate
description: Generate NUnit + Playwright C# automation from memory-vault exploration data and NAFLink codebase. Human PR review required before merge.
---

# Memory Vault — Generate Automation (Flow 1)

Use when generating Playwright C# tests from exploration memory.

## Step 0 — Plan

```
plan_qa_workflow(intent=generate_automation, user_story_id=<ID>)
```

If `blockers` non-empty, stop and report missing exploration or TC data.

## Step 1 — Invoke generator

Run `@automation-generator automate ACs for US <ID>` or follow MCP prompt `generate_automation`.

## Memory inputs (priority)

1. `US_{ID}_TestCases` — published ADO TC IDs
2. `US_{ID}_AC{N}` + `US_{ID}_Summary` — steps and locators
3. NAFLink codebase — existing `Pages/`, `AppLogic/`, `TC{StoryID}_*` tests

## Hard rules

1. Happy path only — negative/edge stay in manual TCs
2. Reuse existing page objects and helpers — no duplicate locators
3. Naming: `TC{StoryID}_Verify{Feature}` (NAFLink Profile A)
4. **Build-verify loop:** `dotnet build` → `dotnet test --filter <method>` → report pass/fail
5. **Human PR required** before merge — do not push or commit without user approval
6. Never store credentials or raw snapshots in memory

## Human gate (required)

Present generated code diff summary and ask user to review before committing.

## Escalation

- Locator mismatch vs memory → flag for QA lead; do not guess
- Build fails → fix and re-run; do not mark complete until green
