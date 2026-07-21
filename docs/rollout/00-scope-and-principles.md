# Scope and principles — QA rollout

**Status:** active  
**Owner:** platform engineering + QA lead

---

## Scope

### In scope

- **`qa` namespace only** — exploration entities, flake data, journeys, env facts
- **Flow 1** — story pipeline: `ac-explorer` → memory → writer → publisher → generator
- **Flow 2** — CI triage: reporter → flake tools → `mortgage-qa-triage` skill
- **Memory console** — read-first; KG panel in Q1, flake polish in Q5
- **External QA pilot** — validate with another team's QA engineers in Q1

### Out of scope (see deferred docs)

- `pr`, `ops`, `compliance`, `product` namespaces
- Context platform / gateway SSO (until Q5+ / deferred)
- Semantic / vector search
- Shared remote memory service
- Raw SQL edits in console (writes go through policy gate)

---

## Principles

1. **Memory before browser** — triage and exploration consult memory MCP first ([mortgage-qa-triage skill](../../cursor/skills/mortgage-qa-triage/SKILL.md)).
2. **Policy pre-save on every write** — no bypass ([mqm-policy.yaml](../../packages/policy/mqm-policy.yaml)).
3. **Tier 1 by default** — agent exploration expires in 30d; promote to Tier 2 only via human PR.
4. **Credentials never in graph** — `credential_ref` names a secret the host resolves ([q1-staging-and-credentials.md](./q1-staging-and-credentials.md)).
5. **One team, one namespace** — cross-namespace work deferred until platform phase.
6. **Read UI before write UI** — console shows data before any governed delete/approve buttons.

---

## Numbering

| Label | Meaning |
|-------|---------|
| **Q1–Q5** | QA rollout phases (this folder) |
| **PLAN v3 Phase 1–5** | Repo roadmap in [PLAN.md](../../PLAN.md) — different numbering |
| **Flow 1 / Flow 2** | Story pipeline vs CI triage |

---

## Who reads what

| Role | Start here |
|------|------------|
| QA lead | [README.md](./README.md) → Q1 umbrella |
| Pilot QA engineer | [q1-ac-explorer-pilot.md](./q1-ac-explorer-pilot.md) |
| Platform engineer | Q1 console + Q4 reporter docs |
| Compliance | [q5-ai-inventory-signoff.md](./q5-ai-inventory-signoff.md), [14-operational-readiness.md](../14-operational-readiness.md) |
