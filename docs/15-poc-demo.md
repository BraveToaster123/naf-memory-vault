# 15 — POC Demo Guide

**Audience:** platform lead, QA lead, security/compliance, or engineering manager.  
**Duration:** 15–20 minutes live (10 minutes if you only run `npm run smoke`).  
**Goal:** Prove agents can **remember QA intelligence across sessions** without hoarding loan NPI — and show the **multi-namespace platform** path (QA today, PR/ops/compliance next).

---

## What is already proven (no extra build)

Your POC gate passes locally. Evidence: `npm run smoke` → **SMOKE PASS**, `npm test`, `npm run eval`.

| Story | Status | One-liner for the room |
|-------|--------|------------------------|
| QA flake memory | ✅ | Agent ranks flaky tests without opening a browser |
| Policy blocks PII | ✅ | SSN in error text → denied, not stored |
| Tier 2 human-only | ✅ | Locator changes require PR, not agent write |
| Audit trail | ✅ | Every tool call logged; QC can query |
| KG memory (Anthropic parity) | ✅ | Same 9 tools as `server-memory`, plus governance |
| Namespace isolation | ✅ | `qa_engineer` cannot read `compliance` |
| Unit tests green | ✅ | `npm test` (33 tests) |

You do **not** need staging, Playwright CI, or SSO for this demo.

---

## 10-minute prep (before the meeting)

```powershell
cd C:\Projects\naf-memory-vault
npm install
npm run seed:demo
npm run seed:demo:namespaces
npm run smoke
```

Expected last line: **`SMOKE PASS`**.

### Launch Memory Console (static UI — recommended for stakeholders)

```powershell
npm run console
```

Open **http://127.0.0.1:4173** — local desktop inspector: flaky tests, skip-browser, journeys, policy blocks.

One-shot prep + smoke + launch:

```powershell
npm run demo
```

(`demo` seeds Tier 1 + namespace KG data, runs smoke, then starts the console — leave terminal open.)

Optional: open these files in tabs for “show the policy” moments:

- [packages/policy/memory-vault-policy.yaml](../packages/policy/memory-vault-policy.yaml) — namespaces + deny patterns
- [journeys/le_generation.yaml](../journeys/le_generation.yaml) — Tier 2 curated journey
- [archive/design-essays/17-governed-memory-landscape.md](./archive/design-essays/17-governed-memory-landscape.md) — how we compare to DoorDash / OSS peers

### Cursor setup (if demoing in IDE)

Copy or symlink [cursor/mcp.json](../cursor/mcp.json) into your Cursor MCP config (single `memory-vault` server). For Playwright repro, see [cursor/mcp.browser.json.example](../cursor/mcp.browser.json.example). Restart Cursor after changing MCP config.

### Deploy to another machine

1. Clone repo; Node 20+
2. `npm install && npm run demo` (or `seed:demo` + `smoke` if you skip the console)
3. Expect terminal **SMOKE PASS**; console at **http://127.0.0.1:4173** if you ran `demo`
4. Merge `memory-vault` from `cursor/mcp.json` into Cursor; open repo as workspace
5. **Optional:** real staging URLs in policy only when using Playwright MCP

---

## Demo script C — Memory Console (10 min, best stakeholder UI)

1. Run `npm run demo` (or `seed:demo` + `console` if smoke already passed).
2. Open **http://127.0.0.1:4173**.
3. Walk through panels:

| Panel | Say this |
|-------|----------|
| **Flaky tests** | “Ranked from CI memory — no Playwright.” |
| **Click a row** | “Skip-browser decision + run history — signatures only, no raw errors.” |
| **Journey map** | “Tier 2 human-curated checkpoints from git YAML.” |
| **Policy blocks** | “Every deny is logged — PII and Tier 2 blocks show up here after smoke.” |

No MCP Inspector required for this path. Inspector remains optional for tool/schema debugging.

---

## Demo script A — Terminal only (10 min, lowest risk)

Run `npm run smoke` and walk through the output in order.

| Step | Output section | Say this |
|------|----------------|----------|
| 1 | `tools: 22` | “One MCP server: QA domain tools plus the same knowledge-graph surface as Anthropic’s reference memory — but governed.” |
| 2 | `get_flaky_tests` | “Synthetic CI history — no browser. This is what agents check first on triage.” |
| 3 | `should_skip_browser: skip: true` | “Known flake — agent should stop here and not burn Playwright minutes.” |
| 4 | `record_run_summary` **denied** (SSN) | “Policy pre-save: mortgage teams cannot accidentally persist borrower data.” |
| 5 | `upsert_locator` **tier2_requires_pr_approval** | “Curated locators are human-PR only — agents propose, humans approve.” |
| 6 | `create_entities` PII-denied | “Same gate on knowledge-graph observations — not just CI rows.” |
| 7 | `read_graph(compliance)` **namespace_rbac_denied** | “Multi-team memory: compliance namespace exists but QA role cannot read it.” |
| 8 | `audit_events rows` | “Hash-chained audit — who called what, allow or deny, no raw payloads.” |

Close with: “QA namespace is live; PR/ops/compliance namespaces are seeded for the platform story — see Demo B.”

---

## Demo script B — Cursor live (15–20 min)

Use the [memory-vault-triage](../cursor/skills/memory-vault-triage/SKILL.md) skill or paste prompts below.

### Act 1 — QA engineer (default `MEMORY_VAULT_USER_ROLE=qa_engineer`)

1. **“Call `get_flaky_tests` with limit 5. Which test is flakiest?”**  
   → Shows ranked flake list from seeded DB.

2. **“Call `should_skip_browser` for `le_generation/apr visible`. Should we open Playwright?”**  
   → `skip: true` — memory-before-browser.

3. **“Call `get_journey_map` for `le_generation`. What TRID checkpoints exist?”**  
   → Tier 2 curated YAML (human-approved).

4. **“Call `get_env_facts` for env `uat`.”**  
   → Seeded env quirk (SSO slow).

5. **“Try `record_run_summary` with error_hint containing `123-45-6789`. What happens?”**  
   → Policy deny — compliance moment.

6. **“Call `read_graph` in namespace `qa`. Then try namespace `compliance`.”**  
   → QA ok; compliance denied for this role.

### Act 2 — Engineer / dev memory (`pr` namespace)

Temporarily set in MCP env: `MEMORY_VAULT_USER_ROLE=engineer` (restart MCP).

7. **“Call `read_graph` with namespace `pr`. What does engineering memory know about loan-api?”**  
   → Seeded PR entities (review patterns, deploy correlation).

8. **“Call `search_nodes` with query `auth` and namespace `pr`.”**  
   → Dev-layer search without seeing QA flake tables.

Reset role to `qa_engineer` after this act.

### Act 3 — Compliance / QC (`qc_analyst`)

Set `MEMORY_VAULT_USER_ROLE=qc_analyst`.

9. **“Call `read_graph` with namespace `compliance`.”**  
   → Seeded RFP answer refs (metadata only).

10. **“Call `get_audit_trail` for the last 7 days.”**  
    → QC sees tool calls and policy blocks (if date range matches seeded activity, use wide range: `2026-01-01` to `2026-12-31`).

**Note:** `qc_analyst` cannot write — good for “read-only oversight” story.

---

## What you are POC-ing vs what is roadmap

Use this table when someone asks “is it all built?”

| Capability | POC today | Phase 2+ |
|------------|-----------|----------|
| QA flake / journey / env memory | ✅ Demo | Hook real CI reporter |
| Policy + PII deny + audit | ✅ Demo | SSO-verified roles (not env var) |
| Core KG tools (`create_entities`, …) | ✅ Demo | Semantic search |
| Namespace **`qa`** | ✅ Active | — |
| Namespace **`pr`** | ✅ Seeded KG; no PR-specific tools yet | `get_repo_flake_patterns` (doc 09) |
| Namespace **`ops`** | ✅ Seeded KG only | Azure MCP incident ingest |
| Namespace **`compliance`** | ✅ Seeded KG; QC read | Human-only writes + KB links |
| Namespace **`product`** | 📋 Policy stub only | 7-day session prefs on gateway |
| Playwright repro on staging | ⚙️ MCP wired | NEEDS-ENV real URLs |
| Remote / team-shared server | ❌ stdio local | HTTP gateway + auth |

Honest pitch: **“We POC’d the governed platform and QA layer; other team layers are namespace + policy ready, not full productized yet.”**

---

## Architecture slide (30 seconds)

```
Cursor / Claude  →  memory-vault MCP  →  policy (memory-vault-policy.yaml)
                              ↓
                    Tier 1 SQLite (30d)  +  Tier 2 git YAML
                              ↓
                    hash-chained audit (metadata only)
```

**Versus Anthropic `server-memory`:** same graph tools, plus deny-by-default namespaces, TTL, audit, QA domain pack.

**Versus DoorDash / Salesforce:** same ideas (pre-save gate, layered memory, namespaces) — our implementation is open in this repo.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `SMOKE FAIL` | Run `npm run seed:demo` first |
| Empty `get_flaky_tests` | Re-run seed; check `MEMORY_VAULT_DB_PATH` points at `./data/memory-vault.db` |
| MCP not in Cursor | Restart Cursor; verify `mcp.json` paths are relative to repo root |
| Legacy MCP name (`naf-qa-memory`, `mortgage-qa-memory`) | Remove from user MCP settings; use only `memory-vault` ([q4-unified-mcp-server.md](./rollout/q4-unified-mcp-server.md)) |
| `namespace_rbac_denied` when you expected allow | Check `MEMORY_VAULT_USER_ROLE` matches [memory-vault-policy.yaml](../packages/policy/memory-vault-policy.yaml) `namespaces.*.readers` |
| Windows `npx tsx` slow | First call may take ~10s — normal |

---

## One-page checklist for stakeholders

Print or share:

- [ ] `npm run smoke` → **SMOKE PASS**
- [ ] Flaky test ranking without browser
- [ ] PII write denied with `matched_pattern`
- [ ] Tier 2 locator returns `require_approval`
- [ ] `compliance` namespace denied for `qa_engineer`
- [ ] `pr` namespace readable for `engineer` (after namespace seed)
- [ ] Audit rows increment on every tool call
- [ ] Policy file is human-readable YAML, not buried in code

---

## After the demo — suggested next steps to discuss

See [14-operational-readiness.md](./14-operational-readiness.md) for full checklists. Summary:

1. **Pilot on one journey** — wire real Playwright reporter to staging (NEEDS-ENV, [§5](./14-operational-readiness.md#5-real-staging-ci-data-needs-env)).
2. **Name namespace owners** — fill §4 worksheet; open `ops`/`compliance` writers in policy.
3. **Compliance sign-off** — [ai-inventory.yaml](../ai-inventory.yaml) (NEEDS-HUMAN, [§6](./14-operational-readiness.md#6-compliance-sign-off-needs-human)).
4. **Caller identity** — replace `MEMORY_VAULT_USER_ROLE` env with gateway SSO when shared server ([§3](./14-operational-readiness.md#3-auth-when-do-you-need-per-user-identity)).

---

## Related docs

- [POC.md](./POC.md) — 5-minute quickstart
- [PLAN.md](../PLAN.md) — package map, roadmap, namespace plan
- [14-operational-readiness.md](./14-operational-readiness.md) — production gates, namespace owners, non-savable list
- [archive/design-essays/16-playbook-mirror-privatize.md](./archive/design-essays/16-playbook-mirror-privatize.md) — mirror + privatize Anthropic memory
- [archive/design-essays/17-governed-memory-landscape.md](./archive/design-essays/17-governed-memory-landscape.md) — external projects survey
