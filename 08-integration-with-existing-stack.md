# 08 — Integration With Existing Stack

## Overview

MQM is a **QA memory layer** inside your existing internal AI platform — not a standalone product.

```
                    ┌─────────────────┐
                    │  Gemini Gateway │  (product + eng agents)
                    └────────┬────────┘
                             │ audit ingest
     ┌───────────────────────┼───────────────────────┐
     │                       │                       │
┌────▼────┐            ┌─────▼─────┐           ┌─────▼─────┐
│  KB MCP │            │  MQM MCP  │           │ Azure MCP │
│ TRID    │            │ QA memory │           │ CI / PR   │
│ overlays│            │ flake     │           │ blobs     │
└────┬────┘            └─────┬─────┘           └─────┬─────┘
     │                       │                       │
     └───────────────────────┼───────────────────────┘
                             │
                    ┌────────▼────────┐
                    │     Cursor      │
                    │  + Playwright   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  PR Assistant   │
                    └─────────────────┘
```

---

## Gemini gateway (product people + QA agents)

| Integration | How |
|-------------|-----|
| Audit ingest | `MQM_AUDIT_URL` → gateway `/audit/ingest` |
| Model attribution | Log `provider`, `model`, `gateway_request_id` on every agent turn |
| Cost per workflow | Tag requests `use_case=mortgage_qa_triage` |
| NPI guard | Gateway blocks user messages matching SSN patterns |
| Prompt storage | Store `prompt_template_id` only |

**QA engineers** using Cursor for triage route through same gateway as product people — unified governance.

---

## KB MCP (knowledge base)

| KB content | Used by MQM |
|------------|-------------|
| TRID timing rules | Checkpoint definitions in journey YAML |
| Lender overlays | `overlay_key` on journeys and env_facts |
| Test standards | Cursor skill references |
| Integration runbooks | `plan_qa_investigation` supplemental context |
| Postmortems | Linked from `get_env_facts` sources |

### Link pattern (doc wizard)

Doc wizard registers apps:

```yaml
app_id: loan-origination-portal
kb_articles:
  - trid-le-disclosure-overview
  - staging-test-accounts
journeys:
  - le_generation
  - cd_generation
```

MQM `get_journey_map` returns steps; KB MCP supplies narrative for agent when step fails.

---

## Doc wizard

| Function | MQM tie-in |
|----------|------------|
| App catalog | `app_id`, `overlay_key` on memory records |
| Auto-link docs | Journey YAML references KB article IDs |
| Onboarding new app | Triggers creation of journey stub + synthetic `loan_scenario_id` |

**Flow:** New app onboarded → doc wizard PR adds journey template → QA fills checkpoints → Tier 2 merged.

---

## Azure MCP

| Azure resource | MQM usage |
|----------------|-----------|
| Pipeline failures | Trigger triage workflow; fetch `commit_sha` |
| Test artifacts | Download Playwright HTML report pointer |
| Blob storage | Trace/video evidence (90d lifecycle) |
| PR metadata | PR assistant correlation |
| Boards | Optional: attach `export_qc_sample` to release work item |

### CI → MQM data flow

```
Azure Pipeline
  → playwright test + MqmReporter
  → publish qa-memory.db artifact
  → Azure MCP fetches artifact for agent triage session
```

---

## PR assistant

When PR touches UI or Playwright tests, PR assistant comment includes:

```markdown
## QA Memory Summary
- **Flake score** (7d): 12% on `le_generation/apr` (known flake — see fs_8a2c91)
- **Compliance smoke**: 14/14 blocking checkpoints passed on CI build 18442
- **New signatures**: none

> AI-assisted summary from Mortgage QA Memory. Audit ref: `audit-batch-uuid`.
```

### Inputs

- `get_flaky_tests` filtered to tests in PR diff paths
- Checkpoint regressions vs base branch build
- `should_skip_browser` outcome if triage already ran

---

## Cursor

### MCP servers (see examples/cursor/mcp.json)

- `mortgage-qa-memory` — always on for QA repos
- `playwright` — on for UI repos / triage sessions
- `azure` — optional per skill
- `kb` — optional per skill

### Skills

| Skill | When |
|-------|------|
| `mortgage-qa-triage` | CI failure investigation |
| `compliance-smoke-review` | Release manager pre-deploy |
| `locator-capture` | After UI refactor (human PR for Tier 2) |

### Hooks (optional)

Align with sandbox `.cursor/hooks` pattern:

- `beforeMCPExecution` — log tool name to local audit buffer
- `afterShellExecution` — block `playwright` against prod URL env vars

---

## Playwright MCP + MQM coordination

| Step | Server |
|------|--------|
| Is it flaky? | MQM |
| What journey? | MQM |
| Open browser | Playwright |
| Validate checkpoint | Playwright `browser_verify_*` |
| Record outcome | MQM `record_run_summary` |
| Log action | Audit client |

**Rule in skill:** Never call `record_run_summary` with output from `browser_snapshot`.

---

## Future agents on same memory platform

DoorDash pattern: one memory store, many agents.

| Future agent | Memory reuse |
|--------------|--------------|
| Release advisor | Checkpoint pass rates from Tier 1 |
| Incident copilot | `failure_signature` correlated to deploys |
| Onboarding agent | Journey YAML as app map |
| Security questionnaire | Separate KB path — do not mix with QA Tier 1 |

Same MCP server, different Cursor skills — **scoped by RBAC and tool allowlists**.

---

## Environment variables (standard)

| Variable | Used by |
|----------|---------|
| `MQM_POLICY_PATH` | MCP server |
| `MQM_DB_PATH` | Reporter + MCP |
| `MQM_AUDIT_URL` | Audit client |
| `MQM_ENV` | `ci`, `staging`, `local` |
| `MQM_LOAN_SCENARIO` | Synthetic scenario ID |
| `MQM_USER` / `MQM_USER_ROLE` | Principal in audit |
| `CI_COMMIT_SHA` / `GITHUB_SHA` | Deploy correlation |

---

## Deployment topology

| Environment | Components |
|-------------|------------|
| **Developer laptop** | Cursor + MCP stdio + local SQLite |
| **CI** | Reporter only → artifact |
| **Shared QA service** (optional) | Central Postgres + MCP SSE + purge cron |
| **Production** | **No Playwright MCP.** No MQM write from prod. |

---

## Integration checklist

- [ ] Gateway accepts MQM audit events
- [ ] KB articles linked from journey YAML
- [ ] Doc wizard lists `journeys` per app
- [ ] Azure pipeline publishes `qa-memory.db`
- [ ] PR assistant template includes flake summary block
- [ ] Cursor `mcp.json` committed per repo or org template
- [ ] SSO principal flows to `MQM_USER` / role
- [ ] Blob lifecycle 90d on trace container
