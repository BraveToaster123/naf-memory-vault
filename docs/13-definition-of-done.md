# 13 — Definition of Done (POC / MVP)

Status legend: DONE (implemented + validated in this repo), NEEDS-ENV (needs a
real staging environment/SSO), NEEDS-HUMAN (needs a person to sign off).

**Operational gates (non-savable list, auth, namespace owners, compliance):**
[14-operational-readiness.md](./14-operational-readiness.md).

## POC gate

| Item | Status | Evidence |
|------|--------|----------|
| npm monorepo with policy/shared/reporter/mcp-server/audit-client/console | DONE | `packages/*`, `npm run typecheck` |
| Policy customized with pilot staging URLs | DONE | `packages/policy/mqm-policy.yaml` (`*.pilot-mortgage.example`) |
| Policy blocks SSN / denied fields pre-save | DONE | `npm test` (policy + redact + kg suites) |
| Reporter writes allowlisted Tier 1 rows to SQLite | DONE | `@mqm/reporter`, seed inserts 24 rows |
| >= 20 test_runs rows from a run | DONE | `npm run seed:demo` -> 24 rows |
| MCP read tools live in a client | DONE | `npm run smoke` (get_flaky_tests returns live data) |
| Live answer without opening Playwright | DONE | `should_skip_browser`, flaky ranking from memory only |

## MVP gate

| Item | Status | Evidence |
|------|--------|----------|
| `get_failure_signature`, `should_skip_browser`, `get_env_facts` | DONE | `@mqm/shared/queries.ts`, smoke output |
| Core KG tools (9-tool `server-memory` parity) | DONE | `packages/shared/src/kg.ts`, smoke `create_entities` / `read_graph` |
| Namespace RBAC on KG reads/writes | DONE | smoke `read_graph(compliance)` denied for qa_engineer |
| `mortgage-qa-triage` Cursor skill | DONE | `cursor/skills/mortgage-qa-triage/SKILL.md` |
| Playwright MCP wired (repro only, staging allowlist) | DONE | `cursor/mcp.json` (`--isolated --headless`, no `run_code_unsafe`) |
| Thin audit: metadata per tool call, no prompt/snapshot | DONE | `@mqm/audit-client`, smoke audit rows |
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
| Multi-namespace structure (`qa`/`pr`/`ops`/`compliance`/`product`) | DONE | `mqm-policy.yaml` `namespaces:` + `npm run seed:demo:namespaces` |
| Namespace owners assigned for locked namespaces | NEEDS-HUMAN | Worksheet in [14-operational-readiness.md §4](./14-operational-readiness.md#4c-sign-off-worksheet-fill-in-names) |
| Compliance sign-off on `ai-inventory.yaml` | NEEDS-HUMAN | draft at `ai-inventory.yaml` (`review_status: draft_pending_signoff`) |
| 5 *real* CI failures triaged on staging | NEEDS-ENV | eval uses synthetic golden set; checklist in [13 §5](./14-operational-readiness.md#5-real-staging-ci-data-needs-env) |

## Explicitly deferred (post-MVP)

- Domain tool packs for `ops` / `compliance` / `product` (structure exists; writers locked)
- Gateway SSO / verified caller identity (replace trust-on-honor `MQM_USER_ROLE`)
- Remote SSE / Streamable HTTP transport, Redis Tier 0, Postgres HA
- Vector semantic search over signatures
- Auto-promotion of agent facts to Tier 2 (stays human-PR only by design)
- MCP resource live update notifications (`resources/subscribe`)

## How to reproduce the gate locally

```bash
npm install
npm run typecheck
npm test
npm run seed:demo
npm run seed:demo:namespaces
npm run smoke
npm run eval
npm run purge
```
