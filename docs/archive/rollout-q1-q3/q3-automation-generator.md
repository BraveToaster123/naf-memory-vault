# Q3 — automation-generator

**Phase:** Q3 · **Status:** not_started  
**Owner:** automation engineering  
**Flow:** 1  
**PLAN.md:** v3 Phase 3

---

## Problem

Manual TCs and exploration memory should drive **real** Playwright automation — not greenfield guesses.

## User story

As a QA automation engineer, I want C# Playwright tests generated from memory so I spend time reviewing code, not re-discovering locators.

---

## In scope

- Profile A (NAFLink) — `c:\Projects\naf-link\` or team E2E repo
- Reads `US_{ID}_AC{N}`, `US_{ID}_TC*`, `US_{ID}_Summary`
- Build + verify loop per agent definition
- ADO traceability update after test passes

## Out of scope

- Profile B (`greenfield-e2e`) — document gap; hand-authored or agent update later
- Committing without human review

---

## Dependencies

- Q2 pipeline complete
- [q3-qa-profile.md](./q3-qa-profile.md) `automation: naflink`

---

## Deliverables

| Item | Path |
|------|------|
| Agent | `cursor/qa-testing-agents/automation-generator.agent.md` |
| E2E target | Team NAFLink Playwright repo |

---

## Acceptance criteria

- [ ] Generated test compiles and runs against staging
- [ ] Locators match exploration memory (spot-check)
- [ ] ADO TC updated with automation link after pass
- [ ] `askQuestions` tool declared if agent uses it

---

## Related

- [cursor/qa-testing-agents/automation-generator.agent.md](../../cursor/qa-testing-agents/automation-generator.agent.md)
