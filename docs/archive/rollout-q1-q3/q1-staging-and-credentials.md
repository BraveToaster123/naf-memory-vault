# Q1 — Staging URLs and credentials

**Phase:** Q1 · **Status:** not_started  
**Owner:** platform engineering + QA lead  
**Flow:** 1  
**PLAN.md:** v3 Phase 3 seam #1 (credentials)

---

## Problem

Pilot QA needs real staging access. Policy must allow their URLs. Credentials must **never** land in the knowledge graph.

## User story

As a platform engineer, I want staging allowlisted and credentials resolved outside memory so agents can log in without storing secrets.

---

## In scope

- Replace pilot placeholders in `mqm-policy.yaml` → `urls.allowed_prefixes`
- Document `credential_ref` pattern for pilot hosts (Cursor env / vault — not graph)
- Playwright MCP: `browser_run_code_unsafe` stays disabled
- `MQM_ENV` set per pilot machine (`staging` or `uat`)

## Out of scope

- Production URLs (deny_prod stays true)
- Gateway SSO (deferred)
- Storing login steps that include passwords in observations

---

## Deliverables

| Item | Path |
|------|------|
| Policy URLs | `packages/policy/mqm-policy.yaml` |
| Pilot env example | `.env.example` comments |
| Host resolver | Cursor/user env: `CREDENTIAL_REF_NAFLINK_QA` or team standard |

### credential_ref pattern

```yaml
# Injected into agent host config — NOT written to memory
login:
  method: pingone-sso
  credential_ref: naflink-qa   # resolves from env/vault at runtime
```

Agent reads credentials from host resolution only. Policy `deny_patterns` blocks `password:`, tokens, etc. in observations.

---

## Acceptance criteria

- [ ] Real staging/UAT base URLs in `allowed_prefixes`
- [ ] `deny_prod: true` unchanged
- [ ] Pilot runbook states: never paste creds into `add_observations`
- [ ] Spot-check: no secret-shaped strings in graph after pilot week 1
- [ ] Playwright navigates staging without policy URL deny

---

## Verification

```bash
npm test                    # policy blocks SSN etc.
npm run smoke
```

Manual: attempt `record_run_summary` or `add_observations` with `password: foo` → denied.

---

## Open questions

| Question | Owner |
|----------|-------|
| Exact staging hostnames? | QA lead |
| Vault vs local env for pilot? | Platform |
| Per-user vs shared QA creds? | QA lead + security |

---

## Related

- [14-operational-readiness.md](../14-operational-readiness.md) §3 auth stages
- [q3-qa-profile.md](./q3-qa-profile.md) — formalized profile (Q3)
