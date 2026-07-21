# Q3 — qa-assistant

**Phase:** Q3 · **Status:** not_started  
**Owner:** QA team  
**Flow:** 1  
**PLAN.md:** v3 Phase 3

---

## Problem

Engineers need quick answers: "Was US 471244 explored?", "What's the locator for AC2?"

## User story

As a QA engineer, I want a read-only assistant that queries memory and ADO so I don't re-run explorers for status checks.

---

## In scope

- `@qa-assistant` — memory read + ADO read only
- Suggests `@ac-explorer` when story not explored
- No writes to memory or ADO

## Out of scope

- Browser automation
- CI flake triage (Q4 skill)

---

## Deliverables

| Item | Path |
|------|------|
| Agent | `cursor/qa-testing-agents/qa-assistant.agent.md` |

---

## Acceptance criteria

- [ ] Correctly reports explored vs not explored for pilot stories
- [ ] Returns locators from `US_{ID}_Summary` or AC entities
- [ ] Never calls write tools

---

## Related

- [q1-kg-console-read.md](./q1-kg-console-read.md) — human-facing alternative
