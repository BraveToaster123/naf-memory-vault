# Q5 — Purge and retention

**Phase:** Q5 · **Status:** not_started  
**Owner:** platform engineering  
**Flow:** both  
**PLAN.md:** v3 retention + purge

---

## Problem

Tier 1 data must **expire**. Without scheduled purge, SQLite grows and retention policy is theoretical.

## User story

As a platform engineer, I want automated hard-delete of expired rows so we don't hoard QA data past policy TTL.

---

## In scope

- Schedule `npm run purge` (policy: daily 02:00 UTC)
- Tier 1: `test_runs`, KG entities/observations/relations, `env_facts`, signatures
- Document promotion rules: exploration Tier 1 vs locator Tier 2
- Monitor purge health (log row counts deleted)

## Out of scope

- Soft delete / archive tier (memcp-style — future)

---

## Deliverables

| Item | Path |
|------|------|
| Purge job | `packages/shared/src/purge.ts` |
| Policy schedule | `memory-vault-policy.yaml` → `retention.auto_purge` |
| CI optional | `.github/workflows/qa-memory.yml` |

---

## Acceptance criteria

- [ ] Purge runs on schedule in pilot environment
- [ ] Expired seed rows removed in test run
- [ ] QA lead informed of 30d exploration TTL in writing
- [ ] Tier 2 git YAML unaffected by purge

---

## Verification

```bash
npm test          # purge.test.ts
npm run purge
```

---

## Related

- [PLAN.md](../../PLAN.md) v3 namespace roadmap
