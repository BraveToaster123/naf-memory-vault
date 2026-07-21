# Deferred — Platform and namespaces

**Status:** deferred (post Q5)  
**Owner:** platform engineering

---

## Not in QA rollout Q1–Q5

These items are documented in [PLAN.md](../../PLAN.md) and [09-multi-domain-memory.md](../09-multi-domain-memory.md) but **intentionally deferred** until QA flows are stable.

---

## Deferred items

| Item | Why deferred | PLAN.md |
|------|--------------|---------|
| `pr` namespace | PR assistant not in QA pilot | Namespace roadmap |
| `ops` namespace | Needs SRE owner + incident ingest | Namespace roadmap |
| `compliance` namespace | QC refs; human-write only | Namespace roadmap |
| `product` namespace | Gateway session prefs overlap | Namespace roadmap |
| Context platform integration | stdio + Cursor sufficient for pilot | v3 + stack doc 08 |
| Gateway SSO | Per-machine env OK until shared DB | Phase 4 RBAC |
| HTTP/SSE MCP transport | Shared service prerequisite | Adoption guide gaps |
| Semantic / vector search | Substring OK at QA volume | Phase 5 / landscape §9 |
| `@mqm/core` / `@mqm/qa` package split | No multi-team consumers yet | Phase 5 |

---

## When to revisit

- Q5 exit + QA lead requests second team on same memory DB → gateway SSO
- PR assistant or SRE wants memory → assign namespace owner per [14-operational-readiness.md](../14-operational-readiness.md) §4
- Context platform (`naf-context-platform`) ready to register MCP → catalog + profiles

---

## Related

- [00-scope-and-principles.md](./00-scope-and-principles.md)
- [archive/design-essays/17-governed-memory-landscape.md](../archive/design-essays/17-governed-memory-landscape.md) Option C hybrid
