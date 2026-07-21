# Q5 — ai-inventory sign-off

**Phase:** Q5 · **Status:** not_started  
**Owner:** compliance + platform  
**Flow:** both  
**PLAN.md:** v2 DoD NEEDS-HUMAN

---

## Problem

Fannie Mae LL-2026-04 expects an AI tool inventory reviewed annually. POC inventory is `draft_pending_signoff`.

## User story

As compliance, I want a signed inventory of AI tools in the QA memory workflow before broader rollout.

---

## In scope

- Review [ai-inventory.yaml](../../ai-inventory.yaml)
- Confirm tools list: memory MCP, Playwright MCP, Cursor agent
- Update `review_status` after sign-off (human process)
- Align with [04-mortgage-compliance-audit.md](../04-mortgage-compliance-audit.md)

## Out of scope

- Inventing tools not in use
- Production gateway tools not yet deployed

---

## Acceptance criteria

- [ ] Compliance owner named in inventory
- [ ] `review_status` no longer `draft_pending_signoff`
- [ ] `next_review_date` set (+1 year)
- [ ] v2 DoD compliance row closed

---

## Related

- [18-official-mcp-packages-risk-brief.md](../18-official-mcp-packages-risk-brief.md)
- [14-operational-readiness.md](../14-operational-readiness.md)
