# Q5 — QA hardening

**Phase:** Q5 · **Status:** not_started  
**Owner:** platform + compliance + QA lead  
**Flow:** 1 + 2  
**Duration:** ongoing  
**PLAN.md:** v3 Phase 2 polish + operational readiness

---

## Goal

Production-adjacent gates for QA deployment: compliance sign-off, retention enforcement, console on real data.

**Depends on:** Q4 exit (or parallel compliance track).

---

## Features

| Feature | Doc |
|---------|-----|
| ai-inventory sign-off | [q5-ai-inventory-signoff.md](./q5-ai-inventory-signoff.md) |
| Purge and retention | [q5-purge-and-retention.md](./q5-purge-and-retention.md) |
| Console Flow 2 polish | [q5-console-flow2-polish.md](./q5-console-flow2-polish.md) |

---

## Phase exit criteria

- [ ] `ai-inventory.yaml` signed by compliance
- [ ] Daily purge job running in pilot environment
- [ ] Console reflects real CI + exploration data
- [ ] [14-operational-readiness.md](../14-operational-readiness.md) gates reviewed

---

## Related

- [13-definition-of-done.md](../13-definition-of-done.md)
