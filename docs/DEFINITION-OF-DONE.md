# Definition of Done — MQM POC / MVP

Status legend: DONE (implemented + validated in this repo), NEEDS-ENV (needs a
real staging environment/SSO), NEEDS-HUMAN (needs a person to sign off).

## POC gate

| Item | Status | Evidence |
|------|--------|----------|
| npm monorepo with policy/shared/reporter/mcp-server/audit-client | DONE | `packages/*`, `npm run typecheck` |
| Policy customized with pilot staging URLs | DONE | `packages/policy/mqm-policy.yaml` (`*.pilot-mortgage.example`) |
| Policy blocks SSN / denied fields pre-save | DONE | `npm test` (policy + redact suites) |
| Reporter writes allowlisted Tier 1 rows to SQLite | DONE | `@mqm/reporter`, seed inserts 24 rows |
| >= 20 test_runs rows from a run | DONE | `npm run seed:demo` -> 24 rows |
| MCP read tools live in a client | DONE | `npm run smoke` (get_flaky_tests returns live data) |
| Live answer without opening Playwright | DONE | `should_skip_browser`, flaky ranking from memory only |

## MVP gate

| Item | Status | Evidence |
|------|--------|----------|
| `get_failure_signature`, `should_skip_browser`, `get_env_facts` | DONE | `@mqm/shared/queries.ts`, smoke output |
| `mortgage-qa-triage` Cursor skill | DONE | `cursor/skills/mortgage-qa-triage/SKILL.md` |
| Playwright MCP wired (repro only, staging allowlist) | DONE | `cursor/mcp.json` (`--isolated --headless`, no `run_code_unsafe`) |
| Thin audit: metadata per tool call, no prompt/snapshot | DONE | `@mqm/audit-client`, smoke -> 4 audit rows (2 policy_block) |
| Audit trail queryable | DONE | `get_audit_trail` (RBAC: qa_lead/qc_analyst/platform) |
| Purge removes past-expiry rows | DONE | `npm run purge`, `purge.test.ts` |
| CI artifact + eval gate | DONE | `.github/workflows/qa-memory.yml` uploads `qa-memory.db` |
| 5-failure classification eval | DONE | `npm run eval` -> 5/5 (>= 0.8 gate) on golden set |
| Agent never persists snapshot in tested prompts | DONE | Tier 1 write drops raw error on PII; no snapshot tool exists |
| `app_id` on Tier 1 rows (multi-project ready) | DONE | `test_runs.app_id`, `MQM_APP_ID` |
| 3 journeys with TRID/URLA/ECOA checkpoints | DONE | `journeys/le_generation.yaml`, `cd_generation.yaml`, `urla_data_entry.yaml` |
| Machine-readable tool contract + drift guard | DONE | `docs/tools.json`, CI `git diff --exit-code` on manifest |
| Tier 2 locator PR home | DONE | `journeys/locators/` (README + curated file; agents cannot write) |
| Dev/QA both read flake history | DONE | `engineer` + `qa_engineer` roles both have read access |
| Compliance sign-off on `ai-inventory.yaml` | NEEDS-HUMAN | draft at `ai-inventory.yaml` (`review_status: draft_pending_signoff`) |
| 5 *real* CI failures triaged on staging | NEEDS-ENV | eval currently uses synthetic golden set; rerun with `MQM_RUN_E2E=1` |

## Explicitly deferred (post-MVP)

- Namespaces beyond `app_id` tagging (`pr`/`ops`/`compliance`)
- Gateway SSO / remote SSE transport, Redis Tier 0, Postgres HA
- Vector semantic search over signatures
- Auto-promotion of agent facts to Tier 2 (stays human-PR only by design)

## How to reproduce the gate locally

```bash
npm install
npm run typecheck
npm test
npm run seed:demo
npm run smoke
npm run eval
npm run purge
```
