# QA Pilot Intake (questions + exercises)

**Audience:** QA automation engineers validating Memory Vault integration (Flow 2 today, Flow 1 pilot next).  
**Time:** ~45–60 minutes first run.  
**Return:** filled [`templates/qa-pilot-intake-response.yaml`](./templates/qa-pilot-intake-response.yaml) to your QA lead or platform contact.

**Companion docs:**

| Doc | Use when |
|-----|----------|
| [POC.md](./POC.md) | Fast local setup |
| [15-poc-demo.md](./15-poc-demo.md) | Stakeholder demo script |
| [rollout/q4-ci-triage.md](./rollout/q4-ci-triage.md) | Flow 2 exit gates |
| [archive/rollout-q1-q3/q1-exploration-pilot.md](./archive/rollout-q1-q3/q1-exploration-pilot.md) | Flow 1 pilot scope |
| [roadmap-and-open-items.md](./roadmap-and-open-items.md) | What platform is building next |

**Last updated:** 2026-07-21

---

## How to run this in Cursor

1. Clone or open **`naf-memory-vault`** and your consumer repo (e.g. `NAFTech.NAFLink.UITestAutomation`).
2. Copy [`templates/qa-pilot-intake-response.yaml`](./templates/qa-pilot-intake-response.yaml) to `qa-pilot-intake-response.yaml` (do not commit secrets or PII).
3. In Cursor, attach the template and prompt:

   ```
   Open qa-pilot-intake-response.yaml.
   Run Exercise 1 commands in order and paste outputs.
   Run Exercise 2 MCP prompts and summarize under each test.
   Ask me Section 3 decision questions one group at a time.
   Never store credentials, stack traces, or borrower data in memory tools.
   ```

4. Return the completed YAML file (PR, Teams, or email).

---

## Prerequisites

| Item | Required for |
|------|----------------|
| Node.js ≥ 20 | Exercise 1 |
| `naf-memory-vault` cloned locally | Exercise 1 |
| Cursor with `memory-vault` MCP ([`cursor/mcp.json`](../cursor/mcp.json)) | Exercise 2 |
| NAFLink repo + `Validate-MemoryVault.ps1` (if integrated) | Exercise 1 optional rows |
| Synthetic loan scenarios only | All exercises |

**Hard rules:** No real borrower data, SSNs, passwords, or full stack traces in chat, YAML, or memory tools.

---

## Exercise 1 — Terminal & integration checks

Run from a terminal. Record **PASS** / **FAIL** and the decisive output line in your response file.

| ID | Command | Expected | Notes |
|----|---------|----------|-------|
| **E1.1** | `node -v` | Major version ≥ 20 | |
| **E1.2** | `cd <vault-repo> && npm install` | Completes without error | |
| **E1.3** | `npm test` | All unit tests pass | Policy, redact, pipeline, graph |
| **E1.4** | `npm run seed:demo` | Seeds `./data/memory-vault.db` | Run before smoke/eval |
| **E1.5** | `npm run smoke` | Last line: **`SMOKE PASS`** | QA + KG tools (unified server) |
| **E1.6** | `npm run eval` | Accuracy ≥ 0.8 (after seed) | Flake-classification gate |
| **E1.7** | `npm run console` then open http://127.0.0.1:4173 | Flaky panel loads | Optional visual check |
| **E1.8** | `npm run demo` | SMOKE PASS + console starts | Optional one-shot path |
| **E1.9** | `.\scripts\Validate-MemoryVault.ps1` (NAFLink repo) | **PASS** | Skip if consumer not wired |
| **E1.10** | `dotnet test <suite> --settings NAFLink.RunSet.runsettings` with `memory_vault_enabled=true` | Tests run; rows added to DB | Record `test_runs` count |

### Exercise 1 — MCP server visibility

| ID | Check | Expected |
|----|-------|----------|
| **E1.11** | Cursor → MCP panel → `memory-vault` | Green / connected |
| **E1.12** | Agent calls `get_flaky_tests` | JSON list returned (demo or real) |

---

## Exercise 2 — Cursor MCP prompt drills

Paste each prompt in a **new Cursor chat** with `memory-vault` MCP enabled. Agent must call tools — not guess from training data.

### Flow 2 — CI triage

| ID | Prompt | Pass criteria |
|----|--------|---------------|
| **E2.1** | `Call get_flaky_tests with limit 5. List the top 3 test_ids and flake rates.` | Ranked list from DB |
| **E2.2** | `Call should_skip_browser for test_id "le_generation/apr visible". Should we open Playwright? Why?` | `skip: true` on demo seed; explains flake |
| **E2.3** | `Call plan_qa_workflow(intent=triage_failure, test_id="<YOUR_REAL_TEST_ID>", ci_failed=true). Follow ordered_plan. Do not open browser yet.` | Memory tools first; browser only if plan says so |
| **E2.4** | `Call get_journey_map for journey_id "le_generation". List TRID checkpoints.` | Returns curated YAML checkpoints |
| **E2.5** | `Try record_run_summary with error_hint containing "SSN 123-45-6789". What happened?` | Policy deny; row not stored |
| **E2.6** | `Use memory-vault-triage skill. Investigate: test_id=<real>, error_class=<real>. Do not paste stack trace or borrower data.` | Classifies flake vs regression; memory before browser |

### Flow 1 — Story pipeline (when pilot starts)

| ID | Prompt | Pass criteria |
|----|--------|---------------|
| **E2.7** | `Call plan_qa_workflow(intent=check_story_status, user_story_id="<PILOT_STORY_ID>")` | Returns stage + blockers |
| **E2.8** | `Call search_nodes for entity name US_<PILOT_STORY_ID>_Summary` | Empty before explore; populated after `ac-explorer` |
| **E2.9** | `@testcase-writer US <PILOT_STORY_ID>` (after exploration) | ADO-format TCs from memory only; no browser |

---

## Section 3 — Decision questions (your answers guide development)

Answer in the YAML file. Short answers OK.

### Pilot scope

| ID | Question |
|----|----------|
| **Q3.1** | Which 2–3 ADO user story IDs should be Flow 1 pilot stories? Why? |
| **Q3.2** | When use **Flow 1** (`ac-explorer` → memory) vs **Consolidate_NL**? One example each. |
| **Q3.3** | Which CI suites get `memory_vault_enabled=true` first? Target `test_runs` count in 30 days? |

### Environment & URLs

| ID | Question |
|----|----------|
| **Q3.4** | Exact QA base URL(s) for policy allowlist? |
| **Q3.5** | UAT in scope for agents, or QA only? |
| **Q3.6** | Default repro path: Playwright MCP, BrowserStack, or manual only? |
| **Q3.7** | Can PingOne SSO + MFA be automated for browser agents? (`yes` / `no` / `partial`) |

### Test identity & journeys

| ID | Question |
|----|----------|
| **Q3.8** | Do your `test_id` values match what the reporter writes? Give 2 real examples. |
| **Q3.9** | Are seed journeys accurate? (`le_generation`, `cd_generation`, `urla_data_entry`) — yes/no per file |
| **Q3.10** | Missing journeys we should add? |

### Triage & retention

| ID | Question |
|----|----------|
| **Q3.11** | When is `should_skip_browser` “correct”? (e.g. same signature 3× in 7 days) |
| **Q3.12** | Triage outcome labels you want: flake, app_bug, test_bug, env, … |
| **Q3.13** | 30-day exploration TTL enough, or promote locators to Tier 2 sooner? |

### ADO & automation conventions

| ID | Question |
|----|----------|
| **Q3.14** | Every manual TC starts from login? Who approves ADO publish? |
| **Q3.15** | Still use `TC{StoryID}_Verify{Feature}` naming? One test per story? |

### Blockers

| ID | Question |
|----|----------|
| **Q3.16** | What blocked unassisted setup? |
| **Q3.17** | Top 3 requests for platform team? |

---

## Minimal path (15 minutes)

If time is short, run only: **E1.4**, **E1.5**, **E1.9**, **E2.2**, **E2.6**, and answer **Q3.1**, **Q3.3**, **Q3.4**, **Q3.8**.

---

## What platform does with your file

| Your input | Guides |
|------------|--------|
| E1 pass/fail | Integration health, env fixes |
| E2 agent behavior | MCP wiring, skill tuning |
| Q3.1–Q3.3 | Pilot + CI corpus plan |
| Q3.4–Q3.7 | Policy URLs, credential model |
| Q3.8–Q3.10 | Reporter + journey YAML work |
| Q3.11–Q3.13 | Triage rules, retention |
| Q3.14–Q3.15 | Flow 1 agent copy + ADO gates |
| Q3.16–Q3.17 | Workshop priorities |
