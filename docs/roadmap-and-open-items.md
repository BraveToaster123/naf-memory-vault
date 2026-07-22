# Roadmap & open items (current vs future)

**Audience:** MCP/platform engineering, QA lead, AI enablement, compliance.  
**Purpose:** Single list of what works today, what needs updating now, and what comes next — especially for NAFLink and similar consumers.  
**Source of truth for phase specs:** [rollout/README.md](./rollout/README.md)

**Last updated:** 2026-07-21

---

## Status snapshot

| Area | Today | Next |
|------|-------|------|
| **Flow 2 — CI triage** | POC: smoke PASS, triage skill, reporter package, unified `memory-vault` MCP | Real CI corpus, shared DB, 5 triaged failures |
| **Flow 1 — Story pipeline** | Agents + skills + planner prompts in repo; NAFLink kit documented | Pilot stories, Playwright + ADO MCP in consumer, QA URL allowlist |
| **Packaging** | Local `npx tsx`, `private: true` monorepo | Internal npm or registry publish + version pinning |
| **Auth / RBAC** | `MEMORY_VAULT_USER_ROLE` env honor system | Gateway SSO when shared team DB |
| **Policy URLs** | Pilot placeholders in `memory-vault-policy.yaml` | Real QA/UAT allowlist (QA input via [qa-pilot-intake.md](./qa-pilot-intake.md)) |
| **Compliance** | Policy enforced in code; `ai-inventory.yaml` draft | Q5 sign-off, scheduled purge |

---

## Current — update or fix now

These unblock pilots without large new features.

### Platform / MCP

| Item | Why | Owner | Doc |
|------|-----|-------|-----|
| **QA/UAT URL allowlist** | Playwright MCP + agents blocked on placeholders | Platform + QA | [archive/rollout-q1-q3/q1-staging-and-credentials.md](./archive/rollout-q1-q3/q1-staging-and-credentials.md) |
| **Standard `mcp.json` template** | Per-engineer drift; NAFLink needs memory + Playwright + ADO | Platform | [`cursor/mcp.json`](../cursor/mcp.json) |
| **Shared DB path** | Per-machine SQLite = no team flake history | Platform + QA | [rollout/q4-playwright-reporter.md](./rollout/q4-playwright-reporter.md) |
| **Package publish decision** | `file:` / clone path does not scale | Platform | [00-adoption-guide.md](./00-adoption-guide.md) §4 |
| **`credential_ref` interim** | Env resolver now; gateway later | Platform + security | [archive/rollout-q1-q3/q3-qa-profile.md](./archive/rollout-q1-q3/q3-qa-profile.md) |
| **Env var changelog** | Consumer breaks on renames | Platform | Document in release notes when renaming `MEMORY_VAULT_*` |

### QA / consumer (NAFLink)

| Item | Why | Owner |
|------|-----|-------|
| **Enable reporter on staging CI** | Demo seed ≠ real triage | QA |
| **Run [qa-pilot-intake.md](./qa-pilot-intake.md)** | Supplies pilot stories, URLs, test_id conventions | QA |
| **Journey YAML accuracy review** | Seed files may not match NAFLink flows | QA lead |
| **Flow 1 vs Consolidate_NL guidance** | Avoid duplicate agent paths | QA lead |

### Vault repo hygiene

| Item | Why | Owner |
|------|-----|-------|
| **Fix Flow 1 agent README** | Says “credentials in memory MCP” — contradicts `credential_ref` | QA automation (on copy) |
| **Harmonize ADO MCP tool prefixes** | `Azure DevOps/*` vs `microsoft/azure-devops-mcp/*` in archived agents | QA automation |
| **Declare missing tools in agents** | `browser_navigate_back`, `askQuestions` referenced but not always available | QA automation |
| **Remove broken `cursor/docs/*` refs** | Agent copy fails in consumer repos | QA automation |

### Compliance (parallel — Q5)

| Item | Why | Owner |
|------|-----|-------|
| **`ai-inventory.yaml` sign-off** | LL-2026-04 gate | Compliance |
| **Scheduled `npm run purge`** | Tier 1 TTL enforcement | Platform |
| **Namespace owner checklist** | RBAC writers in policy | Engineering mgr |

---

## Future features — by phase

Maps to rollout **Q1–Q5**. NAFLink may deliver **Flow 2 production (Q4)** before **Flow 1 (Q1–Q3)** — that order is OK; track both tracks.

### Q1 — Exploration pilot (Flow 1)

| Feature | Description | Exit signal |
|---------|-------------|-------------|
| QA profile YAML | `app_url`, `ado_project`, `credential_ref`, `automation: naflink` | Profile signed by QA lead |
| `ac-explorer` in consumer repo | Browser walk → `US_{ID}_AC{N}` entities | ≥2 stories explored |
| Entity schema contract | Observation keys for AC entities | QA lead sign-off |
| Console KG read (optional) | Browse pilot story memory | Platform |

### Q2 — Story pipeline

| Feature | Description | Exit signal |
|---------|-------------|-------------|
| Azure DevOps MCP | Publish TCs from memory | ADO MCP wired |
| `testcase-writer` + `ado-publisher` | Memory → ADO work items | ≥1 story TCs in ADO |
| Human confirm before ADO create | Process gate | Documented approver |
| Tier 2 locator promotion | `upsert_locator` → PR only | One locator PR from pilot |

### Q3 — Automation from memory

| Feature | Description | Exit signal |
|---------|-------------|-------------|
| `automation-generator` | NUnit + Playwright C# from memory | ≥1 story builds green |
| `qa-assistant` | Read-only locator/status lookup | Answers pilot story Qs |
| Mandatory human review before merge | Process gate | Documented |

### Q4 — CI triage production (Flow 2)

| Feature | Description | Exit signal |
|---------|-------------|-------------|
| CI → `test_runs` | Reporter on real staging suites | >100 real rows (team target) |
| Triage skill rollout | `memory-vault-triage` | 5 failures triaged |
| Journey YAML complete | TRID checkpoints for key flows | QA lead signed |
| Unified MCP entry | Single `memory-vault` server in engineer config | Done |

### Q5 — Hardening

| Feature | Description | Exit signal |
|---------|-------------|-------------|
| Purge job | Daily Tier 1 hard-delete | Scheduled in pilot env |
| Console on real data | Flake panel not seed-only | QA validated |
| `ai-inventory` production status | Compliance approved | `review_status` updated |
| Eval on real corpus | `npm run eval` on NAFLink signatures | Accuracy gate met |

---

## Deferred (not in current pilot)

| Item | Trigger to revisit |
|------|-------------------|
| Hosted MCP gateway + SSO | Shared team DB, second consumer team |
| `pr` / `compliance` namespaces | PR assistant or QC workflows onboard |
| Context platform integration | Cursor stdio insufficient |
| Schema validation in code for `US_*` entities | After 2+ pilot stories |
| BrowserStack policy path | QA answers Q3.6 in intake |
| Auto-promotion exploration → Tier 2 | Explicitly out of scope |

See [rollout/deferred-platform-and-namespaces.md](./rollout/deferred-platform-and-namespaces.md).

---

## Platform decision queue (workshop)

Decisions that need owners — not more architecture slides.

1. **Publish path** — internal npm for `@memory-vault/*` packages, or stay `file:` until Q2?
2. **URL allowlist** — approve QA/UAT hostnames from intake responses.
3. **CI DB pattern** — artifact download vs shared volume vs future hosted DB.
4. **MCP template** — standard Cursor config (memory + Playwright + ADO + env placeholders).
5. **Purge + inventory** — who runs `npm run purge` and signs `ai-inventory.yaml`?

---

## Success metrics (pilot)

| Metric | Target |
|--------|--------|
| Engineers with working MCP (unassisted) | ≥80% |
| Real `test_runs` rows | >100 after first CI campaign |
| Failures triaged via MCP | ≥5 documented |
| `should_skip_browser` agreed correct | ≥2 |
| Flow 1 stories fully explored | ≥2 (Q1) |
| TCs published from memory | ≥1 story (Q2) |
| Automation from memory, builds green | ≥1 story (Q3) |

---

## Related docs

| Doc | Contents |
|-----|----------|
| [qa-pilot-intake.md](./qa-pilot-intake.md) | QA exercises + questions → response YAML |
| [14-operational-readiness.md](./14-operational-readiness.md) | Auth stages, non-savable list, gates |
| [18-official-mcp-packages-risk-brief.md](./18-official-mcp-packages-risk-brief.md) | Why governed memory vs `server-memory` |
| [PLAN.md](../PLAN.md) | v1 design → v2 build → v3 roadmap |
| [archive/flow1-agents/](./archive/flow1-agents/) | Agent defs to copy for Flow 1 |
