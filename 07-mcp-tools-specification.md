# 07 — MCP Tools Specification

## Servers

| Server | Package | Purpose |
|--------|---------|---------|
| `mortgage-qa-memory` | Custom `@mqm/mcp-server` | Tiered QA memory, policy-gated writes |
| `playwright` | `@playwright/mcp` | Browser automation (investigation only) |

---

## mortgage-qa-memory — Read tools

### `get_flaky_tests`

Rank tests by flakiness rate over active Tier 1 window.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `limit` | number | no | Default 20 |
| `min_runs` | number | no | Default 5 |
| `since_days` | number | no | Default 30 |

**Returns:** `{ test_id, flake_rate, runs, last_status }[]`

**Audit:** `memory_read` | **Tier:** 1 read

---

### `get_test_history`

| Param | Type | Required |
|-------|------|----------|
| `test_id` | string | yes |
| `limit` | number | no |

**Returns:** Run rows (no full error text — `error_class`, `failure_signature` only)

---

### `get_failure_signature`

Match normalized error to known cluster.

| Param | Type | Required |
|-------|------|----------|
| `test_id` | string | yes |
| `error_class` | string | yes |
| `error_hint` | string | no | Truncated message; redacted before match |

**Returns:**

```json
{
  "known": true,
  "signature": "fs_8a2c91",
  "classification": "flake | regression | unknown",
  "occurrence_count": 12,
  "recommendation": "skip_browser | investigate"
}
```

---

### `get_journey_map`

Load Tier 2 curated journey.

| Param | Type | Required |
|-------|------|----------|
| `journey_id` | string | yes |

**Returns:** Full YAML parsed to JSON (steps, checkpoints)

**Tier:** 2 read only

---

### `get_compliance_checkpoint`

| Param | Type | Required |
|-------|------|----------|
| `checkpoint_id` | string | yes |
| `since_days` | number | no |

**Returns:** Checkpoint definition + last N pass/fail from Tier 1

---

### `get_env_facts`

| Param | Type | Required |
|-------|------|----------|
| `env` | string | yes |
| `overlay_key` | string | no |

**Returns:** `{ fact, source, created_at }[]` (Tier 1, non-PII)

---

### `get_deploy_correlation`

| Param | Type | Required |
|-------|------|----------|
| `failure_signature` | string | yes |
| `since_days` | number | no |

**Returns:** Commits/releases where signature first spiked

---

### `should_skip_browser`

Decision tool — call before Playwright MCP.

| Param | Type | Required |
|-------|------|----------|
| `test_id` | string | yes |
| `error_class` | string | no |

**Returns:** `{ skip: boolean, reason: string }`

---

### `plan_qa_investigation`

Returns ordered tool plan for agent.

| Param | Type | Required |
|-------|------|----------|
| `test_id` | string | yes |
| `ci_failed` | boolean | no |

**Returns:** Step list (memory tools first, then conditional Playwright)

---

### `get_ai_inventory`

LL-2026-04 disclosure support.

**Returns:** Parsed `ai-inventory.yaml`

---

### `get_audit_trail`

QC query (RBAC: `qc_analyst`, `compliance` roles only).

| Param | Type | Required |
|-------|------|----------|
| `loan_scenario_id` | string | no |
| `journey_id` | string | no |
| `principal_id` | string | no |
| `start_date` | ISO date | yes |
| `end_date` | ISO date | yes |

**Returns:** Audit metadata rows (no prompts/snapshots)

---

### `export_qc_sample`

| Param | Type | Required |
|-------|------|----------|
| `start_date` | ISO date | yes |
| `end_date` | ISO date | yes |
| `journey_id` | string | no |

**Returns:** JSON bundle for examiner / release record

---

## mortgage-qa-memory — Write tools

All writes pass **shared save pipeline** + **policy pre-save**.

### `remember_session_note` (Tier 0)

| Param | Type | Required |
|-------|------|----------|
| `note` | string | yes | Max 500 chars; PII scan |

**TTL:** 8 hours

---

### `record_run_summary` (Tier 1)

| Param | Type | Required |
|-------|------|----------|
| `test_id` | string | yes |
| `status` | enum | yes | `passed\|failed\|flaky` |
| `duration_ms` | number | yes |
| `journey_id` | string | no |
| `error_class` | string | no |
| `loan_scenario_id` | string | no | Must be synthetic allowlist |

**Denied fields:** `snapshot`, `stack`, `prompt`, `network_body`

**TTL:** 30 days

---

### `tag_failure_signature` (Tier 1)

| Param | Type | Required |
|-------|------|----------|
| `signature` | string | yes |
| `classification` | enum | yes | `flake\|regression\|env` |
| `notes` | string | no | Max 200 chars |

---

### `remember_env_fact` (Tier 1)

| Param | Type | Required |
|-------|------|----------|
| `env` | string | yes |
| `fact` | string | yes |
| `overlay_key` | string | no |

Human QA explicit note — not agent-inferred from page content.

---

### `upsert_locator` (Tier 2 — approval required)

| Param | Type | Required |
|-------|------|----------|
| `app` | string | yes |
| `element_key` | string | yes |
| `selector` | string | yes |
| `app_version` | string | yes |

**v1 behavior:** Opens draft PR to `journeys/locators/` — does not write directly.

---

### `propose_checkpoint` (Tier 2 — approval required)

| Param | Type | Required |
|-------|------|----------|
| `journey_id` | string | yes |
| `checkpoint` | object | yes |

**v1 behavior:** Issue or draft PR — human merge required.

---

## Denied tools (never implement)

| Tool | Reason |
|------|--------|
| `remember_raw_snapshot` | PII / retention risk |
| `remember_network_body` | Loan payload risk |
| `remember_prompt` | Unbounded sensitive copy |
| `export_full_error` | Use signature instead |

---

## Playwright MCP — allowed tools (investigation)

| Tool | Policy note |
|------|-------------|
| `browser_navigate` | URL must match allowlist |
| `browser_snapshot` | Agent context only; never call memory write after |
| `browser_click`, `browser_type` | Staging only |
| `browser_verify_*` | Preferred for checkpoint validation |
| `browser_generate_locator` | Output → human PR, not auto Tier 2 |
| `browser_start_tracing` / `stop` | Evidence blob 90d TTL |
| `browser_run_code_unsafe` | **DISABLED** |

---

## Error responses

```json
{
  "error": "policy_denied",
  "reason": "pii_pattern",
  "policy_version": "mqm-policy-1",
  "audit_id": "uuid"
}
```

Agent must surface `reason` to user; must not retry with same payload.

---

## RBAC matrix

| Tool | qa_engineer | qa_lead | qc_analyst | platform |
|------|-------------|---------|------------|----------|
| get_flaky_tests | ✓ | ✓ | ✓ | ✓ |
| record_run_summary | ✓ | ✓ | — | — |
| remember_env_fact | ✓ | ✓ | — | — |
| get_audit_trail | — | ✓ | ✓ | ✓ |
| export_qc_sample | — | ✓ | ✓ | — |
| upsert_locator | draft | approve | — | ✓ |
| propose_checkpoint | draft | approve | — | ✓ |
| Policy edit | — | — | — | ✓ |

Implement via `principal.role` from SSO env `MQM_USER_ROLE`.

---

## Tool call audit summary format

```json
{
  "tool": { "server": "mortgage-qa-memory", "name": "get_flaky_tests" },
  "args_summary": "limit=20,min_runs=5",
  "outcome": "success",
  "records_returned": 8
}
```

Never log full args if they may contain error strings from CI.
