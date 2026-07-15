# 12 — MCP Integration Guide

How another tool, agent, or MCP host (e.g. your knowledge MCP) consumes
Mortgage QA Memory (MQM), and how to extend it to new domains/namespaces.

This repo is intentionally shareable now, with clean seams so it can be split
into a generic engine + domain packs later (see "Cleanup roadmap").

---

## 1. What MQM exposes

| Surface | For whom | Contract |
|---------|----------|----------|
| MCP server (stdio) | Agents / MCP hosts | `docs/tools.json` (generated) |
| npm packages | CI, services, other TS tools | `@mqm/shared`, `@mqm/reporter`, `@mqm/audit-client` |
| Policy | Security / platform | `packages/policy/mqm-policy.yaml` |

The tool contract is machine-readable: run `npm run manifest` to (re)generate
[`tools.json`](./tools.json). A knowledge MCP can ingest that file directly
instead of parsing TypeScript.

---

## 2. Consume as an MCP server

Entry point: `packages/mcp-server/src/index.ts`, transport **stdio**.

```jsonc
// mcp.json (see cursor/mcp.json for the full pilot config)
{
  "mcpServers": {
    "mortgage-qa-memory": {
      "command": "npx",
      "args": ["tsx", "packages/mcp-server/src/index.ts"],
      "env": {
        "MQM_POLICY_PATH": "./packages/policy/mqm-policy.yaml",
        "MQM_DB_PATH": "./data/qa-memory.db",
        "MQM_JOURNEYS_DIR": "./journeys",
        "MQM_ENV": "local",
        "MQM_USER_ROLE": "qa_engineer",
        "MQM_USER_ID": "sso-subject"
      }
    }
  }
}
```

Any MCP client can then `listTools` + `callTool`. See
`packages/mcp-server/src/smoke.ts` for a working client example.

### Environment variables

| Var | Purpose | Default |
|-----|---------|---------|
| `MQM_POLICY_PATH` | Policy YAML (enforced pre-save) | bundled policy |
| `MQM_DB_PATH` | Tier 1 + audit SQLite | `./data/qa-memory.db` |
| `MQM_JOURNEYS_DIR` | Tier 2 curated journeys | `./journeys` |
| `MQM_ENV` | run context tag | `local` |
| `MQM_USER_ROLE` | caller role for RBAC | `qa_engineer` |
| `MQM_USER_ID` | caller identity for audit | `local-user` |
| `MQM_APP_ID` | project tag on Tier 1 rows | unset |

---

## 3. Consume as npm libraries

The generic memory-platform pieces live in `@mqm/shared` and are safe to embed
in other tools without the MCP server:

```ts
import { openDb, evaluatePolicy, recordRunSummary, purgeExpired } from "@mqm/shared";
import { logAudit } from "@mqm/audit-client";

const db = openDb();
const decision = evaluatePolicy(payload, { tier: 1, tool: "record_run_summary", principal });
// decision.outcome: "allow" | "deny" | "require_approval"
```

Contract: **no write reaches storage without passing `evaluatePolicy`.** Reuse
that invariant in any tool you build on top.

---

## 4. RBAC contract

Role comes from `MQM_USER_ROLE` (wire it from SSO at your gateway).  
**When auth is required:** see [14-operational-readiness.md §3](./14-operational-readiness.md#3-auth-when-do-you-need-per-user-identity) (POC = env var OK; shared server = SSO required).

| Role | Reads | Tier 0/1 writes | Tier 2 | Audit query |
|------|-------|-----------------|--------|-------------|
| `qa_engineer` | yes | yes | PR only | no |
| `qa_lead` | yes | yes | approve | yes |
| `engineer` | yes | Tier 0 only | PR only | no |
| `qc_analyst` | yes | no | no | yes |
| `platform` | yes | yes | yes | yes |

Tier 2 (journeys/locators/checkpoints) is **never** a direct write — the tool
returns `require_approval` and a human opens a PR.

---

## 5. Engine vs domain seam

Each tool is tagged in `packages/mcp-server/src/tools.ts` and in
`docs/tools.json`:

- `domain: "core"` — generic memory-platform capability (audit query today).
- `domain: "qa"` — mortgage-QA surface (flake, journeys, TRID, loan scenarios).

Generic, reuse-as-is modules (`@mqm/shared`):

| Module | Generic? |
|--------|----------|
| `policy.ts` (`evaluatePolicy`, RBAC, deny scan) | yes |
| `pipeline.ts` (sanitize -> extract -> dedupe -> policy) | yes (row shape is QA-specific) |
| `db.ts` (SQLite + audit schema) | yes (`test_runs` is QA-specific) |
| `redact.ts`, `signature.ts` | yes |
| `@mqm/audit-client` | yes |
| `queries.ts`, `reporter` | QA-specific |

---

## 6. Add a new domain / namespace

To extend memory to `pr` / `ops` / `compliance` (per the design repo's
`09-multi-domain-memory.md`) without forking:

1. Add a `namespace` (or reuse `app_id`) column to the relevant tables in
   `db.ts`, or add domain-specific tables.
2. Add domain tools to `tools.ts` with `domain: "<ns>"` + `TOOL_META`.
3. Add handlers in `index.ts` that call `evaluatePolicy` before any write.
4. Extend `mqm-policy.yaml` `roles` / `write_permissions` for the namespace.
5. Regenerate the manifest: `npm run manifest`.

The policy engine, audit, retention/purge, and RBAC all work unchanged — only
the tool surface and row shapes are domain-specific.

---

## 7. Cleanup roadmap (for full genericization later)

Non-breaking today; do when you need multi-product reuse:

1. Split `@mqm/shared` into `@mqm/core` (policy, redact, signature, audit,
   retention) and `@mqm/qa` (test_runs schema, queries, reporter).
2. Move `tools.ts` QA entries into a `@mqm/qa` domain pack; the server composes
   domain packs by config.
3. Generalize `db.ts` to a small storage interface so backends (SQLite ->
   Postgres/Redis) are swappable per tier.
4. Promote `docs/tools.json` generation into CI so the published contract never
   drifts from code.

Until then: share this repo as-is. It is a working QA-domain instance of a
reusable governed-memory pattern.
