# Q3 — QA profile

**Phase:** Q3 · **Status:** not_started  
**Owner:** platform engineering  
**Flow:** 1  
**PLAN.md:** v3 Phase 3 profile mechanism

---

## Problem

Agents are hard-wired to NAF URLs, ADO project, and MCP server names. A single **profile** decouples agents from environment specifics.

## User story

As a platform engineer, I want one injected profile per team/app so agents work across environments without editing `.agent.md` files.

---

## Profile shape (baseline)

```yaml
app_url: https://qa.ll.nafinc.com
ado_project: Lender Link Project Management
login:
  method: pingone-sso
  credential_ref: naflink-qa    # name only — host resolves secret
memory_server: naf-qa-memory    # or mortgage-qa-memory after Q4
automation: naflink             # or greenfield-e2e (Profile B)
playwright_mcp: playwright
ado_mcp: azure-devops-mcp
```

Host (Cursor / context platform) resolves `credential_ref` from env or vault — never stored in graph.

---

## In scope

- Document profile schema (this doc)
- Refactor agent `.agent.md` files to reference profile keys (not hard-coded URLs)
- Pilot team profile file (gitignored secrets; committed example template)

## Out of scope

- Full context-platform resolver (deferred)
- Profile B automation path

---

## Deliverables

| Item | Path |
|------|------|
| Schema | This doc |
| Example | `cursor/qa-profile.example.yaml` (optional, when implemented) |
| Agent updates | `cursor/qa-testing-agents/*.agent.md` |

---

## Acceptance criteria

- [ ] No plaintext credentials in agent definitions or memory
- [ ] Pilot team runs agents with one profile switch (env or file)
- [ ] `memory_server` name matches `cursor/mcp.json`

---

## Related

- [q1-staging-and-credentials.md](./q1-staging-and-credentials.md)
- [PLAN.md](../../PLAN.md) v3 Phase 3 profile block
- [deferred-platform-and-namespaces.md](./deferred-platform-and-namespaces.md)
