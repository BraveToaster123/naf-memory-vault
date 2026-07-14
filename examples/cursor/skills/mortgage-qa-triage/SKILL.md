# Mortgage QA Triage

Use this skill when investigating Playwright CI failures on mortgage UI flows (staging/UAT only).

## Prerequisites

- MCP servers: `mortgage-qa-memory`, `playwright` (optional until repro needed)
- Synthetic loan scenarios only — never paste real borrower data
- Policy: `mqm-policy-1`

## Hard rules (never violate)

1. **Memory before browser** — always call `get_flaky_tests`, `get_failure_signature`, or `get_test_history` first.
2. **Never persist** raw snapshots, prompts, stack traces, or network bodies to memory MCP.
3. **Never use** `browser_run_code_unsafe`.
4. **Never navigate** to URLs outside policy allowlist (staging/UAT only).
5. If `should_skip_browser` returns `skip: true` — stop and report known flake.
6. `record_run_summary` accepts only: `test_id`, `status`, `duration_ms`, `journey_id`, `error_class`, `loan_scenario_id`.

## Workflow

### Step 1 — Recall (memory MCP)

```
get_failure_signature(test_id, error_class, error_hint=<truncated>)
get_test_history(test_id, limit=10)
get_flaky_tests(limit=10)
should_skip_browser(test_id)
```

If known stable flake → write summary for user; **do not open browser**.

### Step 2 — Context (memory MCP)

```
get_journey_map(journey_id)   # from test title [journey_id]
get_env_facts(env, overlay_key)
plan_qa_investigation(test_id, ci_failed=true)
```

### Step 3 — Reproduce (Playwright MCP — only if Step 1 says investigate)

```
browser_navigate(staging URL from journey map)
browser_verify_text_visible (for checkpoint targets)
browser_start_tracing (optional)
browser_stop_tracing → note evidence ref only
```

**Do not** save `browser_snapshot` output to any file or memory tool.

### Step 4 — Record (memory MCP)

```
record_run_summary(
  test_id,
  status,
  duration_ms,
  journey_id,
  error_class,
  loan_scenario_id="synthetic-retail-01"
)
```

### Step 5 — Report

Tell the user:
- Flake vs new regression classification
- Checkpoint that failed (if any)
- Suggested human next step (fix locator PR, env issue, app bug)
- Audit note: policy-compliant investigation completed

## Test title convention

Tests embed journey ID: `[le_generation] APR is visible on Loan Estimate`

## Escalation

- Blocking TRID checkpoint failure on release branch → escalate to QA lead + compliance smoke owner
- PII detected in CI error → report platform team; do not store error

## Related docs

- `mcp-memory/05-data-retention-and-privacy.md`
- `mcp-memory/07-mcp-tools-specification.md`
