# 11 — Implementation (POC / MVP)

Governed QA memory so Cursor + Playwright agents stop re-learning the same
flakes, **without** storing loan NPI, raw snapshots, or unbounded logs.

This repo ships **unified docs** ([docs/](./README.md)) and runnable code (`packages/*`).

```
generate (CI reporter)  ->  pipeline (sanitize/extract/dedupe)  ->  policy pre-save  ->  Tier 1 SQLite
                                                                                     ->  audit (metadata only)
agents (Cursor) --------------------------------- MCP tools ------------------------->  read Tier 1 + Tier 2 journeys
```

## What's proven here

- Policy enforced **pre-save** on every write (`@mqm/shared` `evaluatePolicy`)
- CI reporter writes allowlisted, PII-free run summaries to SQLite (`@mqm/reporter`)
- Cursor reads memory through an MCP server (`@mqm/mcp-server`)
- Thin, hash-chained audit metadata (`@mqm/audit-client`)
- Tiered retention + purge; Tier 2 journeys are human-PR only
- Flake-classification eval gate against a golden set

## Packages

| Package | Role |
|---------|------|
| `@mqm/policy` | `mqm-policy.yaml` — retention, deny patterns, write tiers, RBAC |
| `@mqm/shared` | types, redact, signature, **policy engine**, save pipeline, SQLite, queries, purge |
| `@mqm/reporter` | Playwright `MqmReporter` -> Tier 1 SQLite |
| `@mqm/mcp-server` | `mortgage-qa-memory` MCP tools (read + gated writes) |
| `@mqm/console` | Static read-only memory desktop inspector (`npm run console`) |
| `@mqm/audit-client` | append-only audit log + QC query |

## Quickstart

```bash
npm install
npm run typecheck        # type-check the whole monorepo
npm test                 # policy / redact / pipeline unit tests
npm run seed:demo        # populate ./data/qa-memory.db with synthetic history
npm run seed:demo:namespaces  # seed pr/ops/compliance KG demo data (for stakeholder POC)
npm run eval             # flake-classification accuracy gate (>= 0.6)
npm run purge            # hard-delete expired Tier 1 rows
```

Then point Cursor at [`cursor/mcp.json`](../../cursor/mcp.json) and ask:

> "Call get_flaky_tests — what's the flakiest test this week?"

Add the [`mortgage-qa-triage`](../../cursor/skills/mortgage-qa-triage/SKILL.md) skill
to enforce memory-before-browser.

**Stakeholder demo:** see [15-poc-demo.md](./15-poc-demo.md).  
**Production gates (compliance, namespaces, auth):** see [14-operational-readiness.md](./14-operational-readiness.md).  
**Memory Console:** `npm run console` → http://127.0.0.1:4173 (local desktop inspector in `packages/console`).

## MCP tools

Read: `get_flaky_tests`, `get_test_history`, `get_failure_signature`,
`should_skip_browser`, `get_env_facts`, `get_journey_map`,
`get_compliance_checkpoint`, `plan_qa_investigation`.

Gated writes: `record_run_summary`, `tag_failure_signature`,
`remember_env_fact` (Tier 1). `upsert_locator` (Tier 2) returns
`require_approval` — humans open a PR; the agent never writes curated memory.

RBAC comes from `MQM_USER_ROLE`; `get_audit_trail` is limited to
`qa_lead` / `qc_analyst` / `platform`.

## Hard rules

- Never persist raw snapshots, prompts, network bodies, or SSN/account patterns.
- Staging/UAT URL allowlist only; `browser_run_code_unsafe` disabled.
- Synthetic loan scenarios only (`loan_scenarios.allowed_ids`).
- Tier 2 (journeys, locators, checkpoints): human PR only.

## Project / job model

- **Project** scopes the data: every Tier 1 row carries `app_id`.
- **Job** scopes access: roles (`qa_engineer`, `engineer`, `qc_analyst`, …).
- One monorepo + one MCP; not a separate product per team or per project.

## Sharing / integrating this

This is a working QA-domain instance of a reusable governed-memory pattern, with
clean seams so it can be split into a generic engine + domain packs later.

- **Machine-readable tool contract:** [`tools.json`](./tools.json)
  (regenerate with `npm run manifest`). Point a knowledge MCP or registry at
  this instead of parsing TypeScript.
- **How other tools consume/extend it:** [12-integration-mcp.md](./12-integration-mcp.md)
  — stdio entrypoint, env vars, RBAC, the `core` vs `qa` domain seam, how to add
  a new namespace, and the cleanup roadmap for full genericization.
- **Engine vs domain:** each tool is tagged `domain: "core" | "qa"` in
  [`packages/mcp-server/src/tools.ts`](../../packages/mcp-server/src/tools.ts). The
  generic policy/pipeline/audit/retention logic lives in `@mqm/shared` +
  `@mqm/audit-client`; QA-specific schema/tools are isolated.

## Definition of done (v1)

See [13-definition-of-done.md](./13-definition-of-done.md).
