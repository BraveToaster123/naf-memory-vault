# 06 — Build From Scratch

## Prerequisites

- Node.js 20+
- npm workspaces
- Existing Playwright tests (or pilot suite to create)
- Cursor with MCP enabled
- Azure DevOps or GitHub Actions
- Postgres or SQLite for audit (SQLite OK for pilot)

---

## Repository layout

```text
mortgage-qa-memory/                    # implementation repo (separate from this doc folder)
├── packages/
│   ├── policy/
│   │   └── mqm-policy.yaml
│   ├── shared/
│   │   ├── src/types.ts
│   │   ├── src/redact.ts
│   │   ├── src/pipeline.ts          # sanitize → extract → dedupe → policy
│   │   └── src/purge.ts
│   ├── reporter/
│   │   └── src/flakiness-reporter.ts
│   ├── mcp-server/
│   │   └── src/index.ts
│   └── audit-client/
│       └── src/log.ts
├── journeys/                          # Tier 2 — git-reviewed
├── fixtures/loan-scenarios/
├── eval/ci-failures.jsonl
├── cursor/
│   ├── mcp.json
│   └── skills/mortgage-qa-triage/SKILL.md
├── data/                              # gitignored
│   └── qa-memory.db
├── docker-compose.yml                 # optional Postgres
└── package.json
```

This repo combines **unified docs** (`docs/`) and **runnable packages** (`packages/`). The layout above is what ships today.

---

## Phase 0 — Policy & shared libs (days 1–2)

### Tasks

1. Customize [packages/policy/mqm-policy.yaml](../../packages/policy/mqm-policy.yaml); set your staging URLs
2. Implement `classifyAndRedact()` in `packages/shared/src/redact.ts`
3. Implement `evaluatePolicy()` reading deny_fields, deny_patterns, write_permissions
4. Document owner in policy file

### Verify

```bash
npm test -- --grep redact
# Inject SSN string → allowed: false
```

---

## Phase 1 — Reporter + SQLite (days 3–5)

### Tasks

1. Create `MqmReporter` implementing `@playwright/test` Reporter interface
2. Schema:

```sql
CREATE TABLE test_runs (
  id TEXT PRIMARY KEY,
  test_id TEXT NOT NULL,
  journey_id TEXT,
  status TEXT NOT NULL,
  duration_ms INTEGER,
  browser TEXT,
  os TEXT,
  env TEXT,
  commit_sha TEXT,
  loan_scenario_id TEXT,
  error_class TEXT,
  failure_signature TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
```

3. Wire reporter in `playwright.config.ts`
4. Tag tests: `[le_generation]`, `[cd_generation]`
5. Set env vars in CI: `MQM_DB_PATH`, `MQM_ENV`, `MQM_LOAN_SCENARIO`, `CI_COMMIT_SHA`

### Verify

```bash
npx playwright test
sqlite3 data/qa-memory.db "SELECT count(*) FROM test_runs;"
# Must be > 0; no column contains SSN pattern
```

---

## Phase 2 — MCP server read tools (days 6–10)

### Dependencies

```json
{
  "@modelcontextprotocol/sdk": "^1.0.0",
  "better-sqlite3": "^11.0.0",
  "yaml": "^2.0.0",
  "zod": "^3.0.0"
}
```

### Implement first tools

| Tool | Priority |
|------|----------|
| `get_flaky_tests` | P0 |
| `get_test_history` | P0 |
| `get_journey_map` | P0 |
| `get_failure_signature` | P1 |
| `get_env_facts` | P1 |

### Cursor config

Copy [cursor/mcp.json](../../cursor/mcp.json).

### Verify

In Cursor: *"Call get_flaky_tests — what's the flakiest test this week?"*

---

## Phase 3 — Audit client (days 8–12)

### Tasks

1. `logAudit()` with hash chain (`prev_hash`, `record_hash`)
2. Local ingest endpoint or direct Postgres insert
3. Wire into every MCP tool handler
4. **Do not** log raw tool args — log `args_summary` only

### Audit table

```sql
CREATE TABLE audit_events (
  audit_id UUID PRIMARY KEY,
  timestamp_utc TIMESTAMPTZ NOT NULL,
  principal JSONB NOT NULL,
  action_class TEXT NOT NULL,
  tool JSONB NOT NULL,
  context JSONB,
  policy_version TEXT NOT NULL,
  outcome TEXT NOT NULL,
  evidence_ref TEXT,
  prev_hash TEXT,
  record_hash TEXT NOT NULL
);
```

### Verify

Run MCP tool → row appears in `audit_events` with no prompt text.

---

## Phase 4 — Journey YAML + checkpoints (days 10–14)

1. Add [journeys/le_generation.yaml](../../journeys/le_generation.yaml) (or author your own) under `journeys/`
2. Add `cd_generation.yaml`, `urla_data_entry.yaml`
3. PR review by QA lead
4. Implement `get_compliance_checkpoint` reading checkpoint results from reporter

---

## Phase 5 — Cursor skill + Playwright MCP (days 14–18)

1. Copy [cursor/skills/mortgage-qa-triage/SKILL.md](../../cursor/skills/mortgage-qa-triage/SKILL.md)
2. Add Playwright MCP to `mcp.json`
3. Test triage workflow on real CI failure
4. Confirm agent does **not** persist snapshot when asked

### Verify

- Known flake → agent stops without browser
- New failure → Playwright repro on staging → `record_run_summary` only

---

## Phase 6 — CI artifact + purge (days 18–21)

```yaml
- run: npx playwright test
- run: node packages/shared/dist/purge.js
- publish: qa-memory.db
```

Nightly cron on server hosting central DB (if moved to Postgres).

---

## Phase 7 — Eval golden set (days 21–25)

`eval/ci-failures.jsonl`:

```jsonl
{"test_id":"le_generation/apr","label":"flake","signature":"fs_abc","notes":"firefox staging timeout"}
{"test_id":"cd_generation/fees","label":"regression","signature":"fs_def","notes":"deploy 18440 broke fee table"}
```

Measure agent classification accuracy monthly.

---

## Phase 8 — Gateway middleware (optional, days 25+)

Extend Gemini gateway:

1. Attach SSO principal
2. Log metadata per request
3. NPI pattern block on user messages
4. Route `MQM_AUDIT_URL` to same store

---

## Minimal 3-day demo

| Day | Deliverable |
|-----|-------------|
| **1** | Policy + reporter → `qa-memory.db` |
| **2** | MCP `get_flaky_tests` + `get_journey_map` in Cursor |
| **3** | Ask Cursor "is le_generation flaky?" — memory only, no browser |

---

## Team ownership

| Role | Owns |
|------|------|
| Platform engineer | Policy, MCP server, audit, purge, gateway |
| QA engineer | Journeys, checkpoints, golden set, Playwright titles |
| App engineer | `data-testid` contracts, synthetic fixtures |
| Compliance | AI inventory sign-off, QC query validation |

---

## Technology choices

| Decision | Pilot | Production |
|----------|-------|------------|
| Tier 1 DB | SQLite | Postgres |
| Tier 0 session | In-process Map | Redis |
| Audit store | SQLite / Postgres | Postgres + backup |
| Evidence blobs | Azure Blob | Azure Blob lifecycle 90d |
| MCP transport | stdio | stdio (local); SSE if remote |

---

## Bootstrap checklist (greenfield)

If cloning into a fresh org repo, copy these paths from this monorepo:

```bash
cp -r packages/ journeys/ cursor/ ai-inventory.yaml eval/ ./
```

Policy lives at `packages/policy/mqm-policy.yaml` — customize staging URLs before first write.

---

## Definition of done (v1)

- [ ] Reporter runs in CI; DB artifact published
- [ ] 5+ MCP read tools working in Cursor
- [ ] 3 journey YAML files in git with TRID checkpoints
- [ ] Policy blocks SSN in test error strings
- [ ] Audit row per MCP call; no raw prompts stored
- [ ] Purge job deletes expired Tier 1 rows
- [ ] Cursor skill documented and tested on 5 real failures
- [ ] `ai-inventory.yaml` reviewed by compliance
- [ ] Golden eval set ≥ 20 labeled failures
