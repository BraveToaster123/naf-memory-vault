# 01 — Architecture Overview

## Purpose

Define the end-to-end architecture for **Mortgage QA Memory (MQM)**: a custom MCP server plus Playwright automation that gives QA agents institutional memory while enforcing mortgage-appropriate data boundaries.

---

## System context

This system sits inside a broader internal AI platform:

| Existing asset | Role relative to MQM |
|----------------|---------------------|
| **Gemini gateway** | Model routing, cost attribution, audit ingest for all agent calls |
| **KB MCP** | TRID guides, lender overlays, test standards, runbooks |
| **Doc wizard** | Links apps to KB; supplies `app_id`, `overlay_key` for journeys |
| **Azure MCP** | CI failures, PR metadata, pipeline artifacts, blob trace storage |
| **PR assistant** | Surfaces flake scores and checkpoint regressions on PRs |
| **Cursor** | Primary agent runtime for QA engineers |

MQM is **not** a replacement for those systems. It is the **QA-specific memory and browser coordination layer**.

---

## Component diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Cursor (QA Agent)                              │
└───────────────┬──────────────────────────────┬──────────────────────────┘
                │                              │
       ┌────────▼────────┐            ┌─────────▼─────────┐
       │ mortgage-qa-  │            │  Playwright MCP   │
       │ memory MCP    │            │  (@playwright/mcp) │
       └────────┬────────┘            └─────────┬─────────┘
                │                              │
       ┌────────▼──────────────────────────────▼─────────┐
       │              Audit Client / Gateway               │
       │   (principal, policy version, thin metadata)    │
       └────────┬──────────────────────────────┬─────────┘
                │                              │
    ┌───────────▼──────────┐        ┌──────────▼──────────┐
    │   QA Memory Stores   │        │   Evidence Blobs     │
    │  T0 / T1 / T2        │        │   (90d TTL)          │
    └───────────▲──────────┘        └─────────────────────┘
                │
    ┌───────────┴──────────┐
    │  Playwright Reporter │────── Azure CI (deterministic tests)
    └──────────────────────┘
```

---

## Memory tiers

| Tier | Name | Medium | TTL | Writer | Reader |
|------|------|--------|-----|--------|--------|
| **0** | Session | Redis or in-process | 8 hours | Agent (automatic) | Agent |
| **1** | Operational | SQLite / Postgres | 30 days | Reporter + gated MCP tools | Agent + dashboards |
| **2** | Curated | Git YAML in `journeys/` | Until superseded | Humans via PR only | Agent (read-only) |
| **A** | Audit metadata | Postgres | 365 days | Audit client (automatic) | QC / compliance |
| **E** | Audit evidence | Blob storage | 90 days | Playwright trace upload | QC (time-limited) |

**Critical rule:** Tier 0 and Tier 1 never contain raw borrower NPI, full snapshots, or network response bodies.

---

## Shared save pipeline

Every write path — reporter or MCP tool — passes through the same pipeline (adapted from DoorDash):

```
Input (raw test result, session note, agent proposal)
    │
    ▼
┌─────────────┐
│  1. Sanitize │  Strip URLs with tokens, credential keys, known PII patterns
└──────┬──────┘
       ▼
┌─────────────┐
│  2. Extract  │  Pull durable facts: failure_signature, error_class, pass/fail
└──────┬──────┘
       ▼
┌─────────────┐
│  3. Dedupe   │  Merge with existing signature; update counts, not duplicate rows
└──────┬──────┘
       ▼
┌─────────────┐
│  4. Policy   │  Retention, tier, role, field deny list — PRE-SAVE
└──────┬──────┘
       ├── DENY ──► audit log (policy_block) + return error to agent
       └── ALLOW ──► write to target tier + audit log (memory_write)
```

---

## Dual execution modes

### Mode A — Deterministic CI (production path)

- `npx playwright test` in Azure Pipeline
- Custom `MqmReporter` writes Tier 1 summaries only
- No LLM, no Playwright MCP, no Cursor
- Produces compliance smoke signal per release

### Mode B — Agentic triage (investigation path)

- QA engineer in Cursor after CI failure
- Agent calls `mortgage-qa-memory` first (memory before action)
- If not known flake → Playwright MCP reproduces on staging
- Agent writes `record_run_summary` (redacted) only — never raw snapshot to MCP

```
                    CI (Mode A)                    Triage (Mode B)
                         │                              │
                   playwright test                  Cursor agent
                         │                              │
                   MqmReporter                   memory MCP first
                         │                              │
                   Tier 1 SQLite                  Playwright MCP (if needed)
                         │                              │
                   artifact upload                  record_run_summary
```

---

## Canonical workflows

### 1. CI failure triage

1. Azure MCP → failed run, commit, PR
2. `get_failure_signature` / `get_flaky_tests` / `get_test_history`
3. If stable known flake → stop, comment on PR
4. Else `get_journey_map` + `get_env_facts`
5. Playwright MCP → repro one step on staging (isolated profile)
6. `record_run_summary` with `error_class` only
7. PR assistant → flake/regression summary

### 2. Pre-release compliance smoke

1. CI runs journeys tagged `[le_generation]`, `[cd_generation]`, etc.
2. Reporter records checkpoint pass/fail per build
3. Release gate fails if `severity: blocking` checkpoint fails
4. `export_qc_sample` bundles metadata for release record

### 3. Locator / journey curation (human path)

1. Agent proposes locator or checkpoint via PR to `journeys/*.yaml`
2. QA lead reviews and merges
3. Tier 2 updated; agents read on next session

---

## Security boundaries

| Control | Implementation |
|---------|----------------|
| URL allowlist | `mqm-policy.yaml` — staging/UAT only |
| No prod browser | Audit proxy denies prod origins |
| No RCE | `browser_run_code_unsafe` disabled |
| Isolated sessions | `--isolated` in CI and triage |
| Synthetic loan data | `loan_scenario_id` from fixtures only |
| Write deny list | raw_snapshot, raw_prompt, network_body blocked at MCP |
| Segregation of duties | Tier 2 = PR approval; policy changes = platform team |

---

## Evaluation platform

Borrowed from DoorDash's memory eval loop:

| Metric | Target | Method |
|--------|--------|--------|
| Flake classification accuracy | ≥ 85% | Golden set `eval/ci-failures.jsonl` |
| Checkpoint regression detection | 100% blocking | CI smoke per release |
| Audit query latency | < 30s | QC spot checks by journey_id |
| PII block rate | 100% | Inject synthetic SSN into test error; assert deny |
| Memory purge compliance | 0 expired rows | Nightly purge job |

---

## Build order

| Phase | Deliverable | Depends on |
|-------|-------------|------------|
| **0** | `mqm-policy.yaml`, redaction lib | — |
| **1** | Playwright reporter + SQLite | Phase 0 |
| **2** | MCP read tools + audit client | Phase 1 |
| **3** | Journey YAML + Cursor skill | Phase 2 |
| **4** | Playwright MCP triage loop | Phase 3 |
| **5** | CI artifact + purge + eval golden set | Phase 4 |
| **6** | Gateway audit middleware | Phase 2+ |

Do not skip Phase 0. Policy before code prevents retrofitting privacy controls.

---

## Success criteria

- QA engineers ask "is this flaky?" and get an answer from memory **without opening CI UI**
- Compliance can query which AI tools touched a `loan_scenario_id` and which checkpoints ran
- No Tier 1 row contains SSN, account numbers, or full page snapshots
- Median CI triage time reduced ≥ 50% within 90 days of adoption
