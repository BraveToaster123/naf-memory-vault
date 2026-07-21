# Q5 — Console Flow 2 polish

**Phase:** Q5 · **Status:** not_started  
**Owner:** platform engineering  
**Flow:** 2  
**PLAN.md:** v3 Phase 2

---

## Problem

Existing console panels target demo/seed data. After Q4, QA leads need the same UI on **real** CI history plus optional full audit trail.

## User story

As a QA lead, I want the memory console to show our team's real flake rankings and audit activity.

---

## In scope

- Flaky tests / test detail panels on real `test_runs` (post-reporter)
- Full audit trail panel (not only `policy_block` rows)
- Health badge shows real run count
- KG panel from [q1-kg-console-read.md](./q1-kg-console-read.md) on same page

## Out of scope

- Write / delete in UI ([deferred-console-writes.md](./deferred-console-writes.md))
- Hosted multi-user console

---

## Deliverables

| Item | Path |
|------|------|
| Console | `packages/console/` |
| API | extend `server.ts` — `/api/audit` |

---

## Acceptance criteria

- [ ] Flake list matches `get_flaky_tests` for pilot CI data
- [ ] Audit panel shows reads/writes/blocks from pilot week
- [ ] Single `npm run console` serves Flow 1 + Flow 2 views
- [ ] Stakeholder demo path updated in [15-poc-demo.md](../15-poc-demo.md) (optional follow-up)

---

## Related

- [q1-kg-console-read.md](./q1-kg-console-read.md)
- [15-poc-demo.md](../15-poc-demo.md)
