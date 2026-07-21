---
name: memory-vault-triage
description: Investigate Playwright CI failures on mortgage UI flows using memory-vault before ever opening a browser. Use when a mortgage staging/UAT test fails or flakes.
---

# Memory Vault — CI Triage

Use when investigating Playwright CI failures on mortgage UI flows (staging/UAT only).

Prefer starting with `plan_qa_workflow(intent=triage_failure, test_id=..., ci_failed=true)` from **memory-vault** MCP, then follow `ordered_plan`.

## Prerequisites

- MCP servers: `memory-vault`, `playwright` (optional until repro needed)
- Synthetic loan scenarios only — never paste real borrower data
- Policy: `memory-vault-policy-1`

## Hard rules (never violate)

1. Memory before browser — always call `get_failure_signature` / `should_skip_browser` / `get_test_history` first.
2. Never persist raw snapshots, prompts, stack traces, or network bodies to the memory MCP.
3. Never use `browser_run_code_unsafe`.
4. Never navigate to URLs outside the policy allowlist (staging/UAT only).
5. If `should_skip_browser` returns `skip: true` — stop and report the known flake.
6. `record_run_summary` accepts only: `test_id`, `status`, `duration_ms`, `journey_id`, `error_class`, `error_hint` (redacted), `loan_scenario_id`.

## Workflow

### Step 0 — Plan (memory-vault MCP)

```
plan_qa_workflow(intent=triage_failure, test_id=<id>, ci_failed=true)
```

If `blockers` non-empty, stop and report them.

### Step 1 — Recall (memory MCP)

```
get_failure_signature(test_id, error_class, error_hint=<truncated>)
get_test_history(test_id, limit=10)
should_skip_browser(test_id)
get_flaky_tests(limit=10)
```

If known stable flake -> write a summary for the user; do not open a browser.

### Step 2 — Context (memory MCP)

```
get_journey_map(journey_id)   # journey_id comes from the test title tag [journey_id]
get_env_facts(env, overlay_key)
plan_qa_investigation(test_id, ci_failed=true)
```

### Step 3 — Reproduce (Playwright MCP — only if Step 1 says investigate)

```
browser_navigate(staging URL from journey map)
browser_verify_text_visible(checkpoint target)
browser_start_tracing (optional) -> note evidence ref only
```

Do not save `browser_snapshot` output to any file or memory tool.

### Step 4 — Record (memory MCP)

```
record_run_summary(test_id, status, duration_ms, journey_id, error_class, loan_scenario_id="synthetic-retail-01")
```

### Step 5 — Report

Tell the user:
- Flake vs new regression classification
- Which checkpoint failed (if any)
- Suggested human next step (fix locator PR, env issue, app bug)
- Audit note: policy-compliant investigation completed

## Test title convention

Tests embed the journey ID: `[le_generation] APR is visible on Loan Estimate`

## Escalation

- Blocking TRID checkpoint failure on a release branch -> escalate to QA lead + compliance smoke owner
- PII detected in a CI error -> report to platform team; do not store the error
