# Flow 2 — Playwright CI integration

Wire governed memory into a **consumer** Playwright repo so `get_flaky_tests` and triage tools use **real** staging runs (not `seed:demo`).

## Overview

```mermaid
flowchart LR
  CI[Playwright CI job]
  REP[MemoryVaultReporter]
  DB[(memory-vault.db)]
  MCP[memory-vault MCP]
  QA[QA in Cursor]
  CI --> REP --> DB
  DB --> MCP --> QA
```

## 1. Install reporter in your Playwright repo

From your Playwright project (not this repo):

```bash
# Option A: npm workspace file dependency (monorepo)
# package.json: "@memory-vault/reporter": "file:../naf-memory-vault/packages/reporter"

# Option B: copy packages/reporter + @memory-vault/shared until published
```

## 2. playwright.config.ts

```typescript
import { defineConfig } from "@playwright/test";
import MemoryVaultReporter from "@memory-vault/reporter";

export default defineConfig({
  reporter: [
    ["list"],
    [MemoryVaultReporter, {
      env: process.env.MEMORY_VAULT_ENV ?? "staging",
      appId: process.env.MEMORY_VAULT_APP_ID ?? "loan-origination-portal",
      loanScenarioId: process.env.MEMORY_VAULT_LOAN_SCENARIO ?? "synthetic-retail-01",
    }],
  ],
});
```

## 3. Environment (CI job)

| Variable | Example | Purpose |
|----------|---------|---------|
| `MEMORY_VAULT_DB_PATH` | `./data/memory-vault.db` | Shared SQLite path (artifact or mounted volume) |
| `MEMORY_VAULT_POLICY_PATH` | `../naf-memory-vault/packages/policy/memory-vault-policy.yaml` | Policy pre-save |
| `MEMORY_VAULT_ENV` | `staging` | Env tag on runs |
| `MEMORY_VAULT_LOAN_SCENARIO` | `synthetic-retail-01` | Must be in policy allowlist |
| `CI_COMMIT_SHA` | `${{ github.sha }}` | Run correlation |

**Important:** Reporter never stores raw error text — only `error_class` + normalized signature.

## 4. Policy — staging URLs

Replace pilot placeholders in [`memory-vault-policy.yaml`](../packages/policy/memory-vault-policy.yaml):

```yaml
urls:
  allowed_prefixes:
    - https://your-staging.example
    - https://your-uat.example
```

Playwright MCP (optional repro) must use the same allowlist.

## 5. Point Cursor at the same DB

In `cursor/mcp.json` for the QA engineer:

```json
"MEMORY_VAULT_DB_PATH": "./data/memory-vault.db"
```

Use the same path CI writes to (copy artifact locally, or shared team volume when gateway exists).

## 6. Triage workflow

1. CI fails → reporter writes Tier 1 row.
2. QA opens Cursor with `memory-vault-triage` skill.
3. Agent calls `get_failure_signature`, `should_skip_browser`, `get_test_history`.
4. If not known flake → optional Playwright MCP repro → `record_run_summary`.

## 7. Verify integration

```bash
# After a CI run with reporter enabled
npm run eval   # in naf-memory-vault — needs seeded signatures or real corpus
```

Pilot exit gate: triage ≥5 real staging failures via MCP ([q4-ci-triage.md](./rollout/q4-ci-triage.md)).

## Not in scope here

- Publishing `@memory-vault/reporter` to npm (internal registry TBD)
- Shared remote MCP server / SSO ([14-operational-readiness.md](./14-operational-readiness.md) §3)
