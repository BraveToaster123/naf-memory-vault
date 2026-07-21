# Q4 — Playwright reporter

**Phase:** Q4 · **Status:** not_started  
**Owner:** platform + QA (CI owner)  
**Flow:** 2  
**PLAN.md:** v2 POC reporter

---

## Problem

Flake tools need **real** run history. Seeded demo data proves the pattern; CI must feed SQLite.

## User story

As a QA engineer, I want every CI run summarized in memory so triage ranks real flakes.

---

## In scope

- Wire `@memory-vault/reporter` (`MemoryVaultReporter`) into pilot team's Playwright CI
- Allowed columns only per `memory-vault-policy.yaml` `reporter.allowed_columns`
- `drop_run_on_pii_detected: true` — drop row if PII in error path
- Synthetic `loan_scenario_id` only

## Out of scope

- Production CI
- Raw error text in DB

---

## Deliverables

| Item | Path |
|------|------|
| Reporter package | `packages/reporter/src/index.ts` |
| Policy allowlist | `packages/policy/memory-vault-policy.yaml` → `reporter:` |
| Consumer CI config | Pilot repo `playwright.config.ts` (their repo) |

---

## Acceptance criteria

- [ ] ≥20 `test_runs` rows from real CI (or sustained daily runs)
- [ ] `get_flaky_tests` returns their tests, not only seed data
- [ ] PII in simulated error → row dropped (unit test + spot-check)
- [ ] `MEMORY_VAULT_DB_PATH` documented for shared vs per-machine DB

---

## Verification

```bash
npm run seed:demo   # reference only
npm run smoke       # get_flaky_tests returns data
```

---

## Related

- [14-operational-readiness.md](../14-operational-readiness.md) §5
