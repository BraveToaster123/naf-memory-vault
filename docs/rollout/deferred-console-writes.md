# Deferred — Console governed writes

**Status:** deferred (post Q5)  
**Owner:** platform engineering + QA lead  
**PLAN.md:** v3 Phase 4

---

## Not in Q1–Q5

Q1–Q5 keep the [Memory Console](../../packages/console/) **read-only**. Governed writes belong in a later phase.

---

## Future capabilities

| Action | Correct path | Wrong path |
|--------|--------------|------------|
| Delete bad exploration entity | MCP `delete_entities` via API wrapper + `evaluatePolicy` | Raw SQL DELETE |
| Edit observation | `delete_observations` + `add_observations` | SQL UPDATE |
| Approve Tier 2 locator | UI triggers PR workflow (`require_approval`) | Direct Tier 2 write |
| Run purge | `purge.ts` with dry-run preview | Manual row delete |
| Context notes on entity | Tagged observations (Phase 4) | Free-form DB edit |

---

## Prerequisites

- [q1-kg-console-read.md](./q1-kg-console-read.md) shipped and used by QA leads
- RBAC from gateway SSO (not env-var trust) for shared service
- Audit chain covers all write columns ([PLAN.md](../../PLAN.md) Phase 5)

---

## Related

- [q2-tier2-locators.md](./q2-tier2-locators.md) — PR-based Tier 2 today
- [PLAN.md](../../PLAN.md) v3 Phase 4
