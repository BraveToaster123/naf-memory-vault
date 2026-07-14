# 03 — QA Automation & Playwright MCP

## Overview

MQM uses **two Playwright integration points**:

1. **Deterministic test runner** — `@playwright/test` in CI with custom reporter
2. **Agentic browser** — official [`@playwright/mcp`](https://playwright.dev/docs/getting-started-mcp) for investigation in Cursor

They must not be conflated. CI is the source of truth; MCP is the microscope.

---

## Playwright MCP capabilities

From [Playwright MCP documentation](https://playwright.dev/docs/getting-started-mcp):

| Category | Tools | MQM usage |
|----------|-------|-----------|
| Navigation | `browser_navigate`, `browser_reload`, tabs | Repro staging journeys |
| Interaction | `browser_click`, `browser_type`, `browser_fill_form` | Step through disclosure flows |
| Observation | `browser_snapshot` | **In agent context only — never persist raw output** |
| Verification | `browser_verify_element_visible`, `browser_verify_text_visible` | TRID checkpoint validation |
| Debug | `browser_console_messages`, network tools | Investigate integration failures |
| Test authoring | `browser_generate_locator` | Propose locators for human PR |
| Evidence | `browser_start_tracing`, `browser_stop_tracing`, video | Upload to blob with 90d TTL |
| Code execution | `browser_run_code_unsafe` | **DISABLED in enterprise config (RCE)** |

### Why accessibility snapshots

Playwright MCP uses the **accessibility tree**, not pixels:

- ~200–400 tokens per snapshot vs thousands for screenshots
- Deterministic element `ref` handles
- No vision model required

**Risk:** Snapshots contain **live form values** (borrower name, income, etc.). Hence MQM policy blocks persisting snapshot text.

---

## Playwright MCP vs Playwright CLI

Microsoft notes in the [playwright-mcp repo](https://github.com/microsoft/playwright-mcp):

| Approach | Best for |
|----------|----------|
| **MCP** | Exploratory automation, self-healing, long-running loops with persistent browser context |
| **CLI + skills** | Token-efficient coding agents running concise commands in large repos |

**MQM recommendation:**

- **Cursor triage** → Playwright MCP (multi-step reasoning over page structure)
- **"Run test file"** from Cursor → `npx playwright test path.spec.ts` (CLI, not MCP)
- **CI** → always CLI runner

---

## Flakiness memory (operational Tier 1)

### Reference implementation

Fork the pattern from [flakiness-knowledge-graph-mcp](https://github.com/vola-trebla/flakiness-knowledge-graph-mcp):

```
playwright test
    └── MqmReporter
            └── qa-memory.db (SQLite)
                    └── mortgage-qa-memory MCP (read tools)
```

### Reporter captures (allowlist)

| Field | Store? |
|-------|--------|
| `test_id` | Yes |
| `journey_id` (from title tag) | Yes |
| `status` (passed/failed/flaky) | Yes |
| `duration_ms` | Yes |
| `browser`, `os`, `env` | Yes |
| `commit_sha` | Yes |
| `loan_scenario_id` (synthetic) | Yes |
| `error_class` (e.g. TimeoutError) | Yes |
| `failure_signature` (normalized hash) | Yes |
| Full error message | **Normalize + truncate; deny if PII** |
| Stack trace | **No** |
| Screenshot | **Blob ref only, 90d TTL** |

### Normalized failure signature

```typescript
function normalizeError(msg: string): string {
  return msg
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]")
    .replace(/\b\d{10,}\b/g, "[NUM]")
    .replace(/https?:\/\/\S+/g, "[URL]")
    .slice(0, 500);
}

function signature(testId: string, error: string): string {
  return sha256(`${testId}:${normalizeError(error)}`).slice(0, 16);
}
```

### MCP read tools (from flakiness pattern)

| Tool | Returns |
|------|---------|
| `get_flaky_tests` | Tests ranked by flake rate (min run threshold) |
| `get_test_history` | Run history for one test |
| `get_failure_patterns` | Failure rate by browser × OS |
| `get_flakiness_trend` | Daily flake rate for one test |
| `get_error_groups` | Clustered normalized errors |
| `correlate_git_commit_flakiness` | Commit where test went stable→flaky |

### Complementary: trace decoder MCP

[playwright-trace-decoder-mcp](https://github.com/vola-trebla/flakiness-knowledge-graph-mcp) (paired project):

- **Memory MCP** answers: "Is this historically flaky?"
- **Trace decoder** answers: "What happened in this specific run?"

Use together in triage workflow; store **trace_ref** pointer only in Tier 1.

---

## Mortgage journey tests

### Naming convention

Embed journey ID in test title for reporter parsing:

```typescript
test('[le_generation] APR is visible on Loan Estimate', async ({ page }) => {
  await page.goto(`/loans/${SYNTHETIC_LOAN_ID}/le`);
  await expect(page.getByText('Annual Percentage Rate')).toBeVisible();
});
```

Reporter regex: `title.match(/\[(\w+)\]/)?.[1]` → `journey_id`

### Journey YAML (Tier 2)

See [examples/journeys/le_generation.yaml](./examples/journeys/le_generation.yaml).

Checkpoints link to regulations: TRID, ECOA, RESPA, state overlays.

### Compliance smoke suite

Tag tests for release gate:

```typescript
test.describe('compliance-smoke @blocking', () => {
  // runs on every release candidate
});
```

---

## Playwright MCP configuration

See [examples/cursor/mcp.json](./examples/cursor/mcp.json).

| Flag | Value | Reason |
|------|-------|--------|
| `--headless` | CI-like repro | Consistent |
| `--isolated` | true | No cookie/profile bleed |
| `--browser=chromium` | default | Match CI primary |
| `browser_run_code_unsafe` | disabled | RCE risk |

### URL allowlist

Policy enforces staging/UAT prefixes before `browser_navigate` executes. Audit proxy can double-check.

### Storage state

- **Do not** persist auth state with real user cookies long-term
- Use synthetic test accounts; rotate credentials
- If `storage_state` needed, encrypt file and TTL ≤ 8h in Tier 0

---

## Agent triage workflow (Playwright MCP)

```
┌─────────────────────────────────────────────────────────┐
│ 1. memory: get_flaky_tests / get_failure_signature      │
│    └─ if known_flake → STOP (no browser)                │
├─────────────────────────────────────────────────────────┤
│ 2. memory: get_journey_map + get_env_facts              │
├─────────────────────────────────────────────────────────┤
│ 3. playwright: browser_navigate (staging URL only)      │
│ 4. playwright: browser_snapshot (agent context only)  │
│ 5. playwright: browser_verify_text_visible (checkpoint) │
│ 6. playwright: browser_stop_tracing → evidence blob     │
├─────────────────────────────────────────────────────────┤
│ 7. memory: record_run_summary (error_class, no snapshot)│
│ 8. audit: log all tool calls with principal + policy    │
└─────────────────────────────────────────────────────────┘
```

---

## CI pipeline integration

```yaml
# Azure Pipeline excerpt
- script: npx playwright test --project=chromium
  env:
    MQM_DB_PATH: $(Pipeline.Workspace)/qa-memory.db
    MQM_ENV: ci
    MQM_LOAN_SCENARIO: synthetic-retail-01
    CI_COMMIT_SHA: $(Build.SourceVersion)

- script: node packages/shared/dist/purge-expired.js

- publish: $(Pipeline.Workspace)/qa-memory.db
  artifact: qa-memory-snapshot-$(Build.BuildId)
```

**No Playwright MCP in CI.** Agent token cost and data leakage risk are both too high.

---

## Multi-tenant / lender overlay testing

Mortgage apps often vary by `overlay_key`:

| Memory field | Example |
|--------------|---------|
| `overlay_key` | `credit_union_west`, `imb_default` |
| `env` | `staging`, `uat-eu` |
| `env_fact` | "Overlay X hides FHA banner in UAT" |

`get_env_facts(env, overlay_key)` returns quirks before Playwright opens browser — reduces repeat failures.

---

## Metrics

| Metric | Source |
|--------|--------|
| Flake rate per test | Tier 1 aggregation |
| Time to triage | Audit timestamps: CI fail → agent conclusion |
| Repro success rate | Playwright MCP runs that confirm regression |
| Checkpoint pass rate | Reporter + journey_id |
| Token cost per triage | Gemini gateway logs |

---

## Anti-patterns

| Don't | Do instead |
|-------|------------|
| Store `browser_snapshot` in MCP DB | Assert checkpoint pass/fail boolean |
| Run agent in CI | Deterministic reporter only |
| Use prod URL in Playwright MCP | Policy allowlist |
| Enable `browser_run_code_unsafe` | Use `browser_generate_locator` + human PR |
| Full error text in long-term memory | `failure_signature` + `error_class` |
| One-off chat memory | Shared MCP server with policy |
