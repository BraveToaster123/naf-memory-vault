# Q1 — KG console (read-only)

**Phase:** Q1 · **Status:** not_started  
**Owner:** platform engineering  
**Flow:** 1 (primary); supports Flow 2 audit view later  
**PLAN.md:** v3 Phase 2 (scoped to KG read)

---

## Problem

Flow 1 exploration data lives in KG tables (`kg_entities`, `kg_observations`, `kg_relations`) but the [Memory Console](../../packages/console/) only shows **Flow 2** flake panels. QA leads cannot inspect what `ac-explorer` wrote without MCP or raw DB access.

## User story

As a QA lead, I want to browse exploration entities in a local web UI so I can review pilot output before trusting downstream agents.

---

## In scope

- New console panels (read-only GET APIs):
  - **Story explorer** — `search_nodes` on `qa` namespace, filter `US_*`
  - **Entity detail** — observations + relations for selected entity
  - **Graph summary** — entity/relation counts for `qa`
- Reuse `@mqm/shared`: `readGraph`, `searchNodes`, `openNodes` from `kg.ts`
- Same DB path as MCP (`MQM_DB_PATH`)

## Out of scope

- Create / update / delete in UI (see [deferred-console-writes.md](./deferred-console-writes.md))
- Flake panel changes (existing panels stay)
- Remote / multi-user hosting

---

## Dependencies

- Governed KG engine ✅ (`packages/shared/src/kg.ts`)
- [q1-ac-explorer-pilot.md](./q1-ac-explorer-pilot.md) — data to display

---

## Deliverables

| Item | Path |
|------|------|
| API routes | `packages/console/src/server.ts` |
| UI panels | `packages/console/public/index.html`, `styles.css` |
| Shared imports | `readGraph`, `searchNodes`, `openNodes` from `@mqm/shared` |

### Proposed API

| Route | Returns |
|-------|---------|
| `GET /api/kg/summary?namespace=qa` | Entity/observation/relation counts |
| `GET /api/kg/search?q=US_&namespace=qa` | Matching nodes |
| `GET /api/kg/entities/:name?namespace=qa` | Entity + observations + relations |

---

## Acceptance criteria

- [ ] After `ac-explorer` pilot, `US_*` entities visible in console
- [ ] Click entity → observations rendered (no raw HTML injection)
- [ ] Console header still says read-only
- [ ] `npm run console` works with empty graph (graceful empty state)
- [ ] No write endpoints added

---

## Verification

```bash
npm run seed:demo
npm run console
# open http://127.0.0.1:4173 — KG panel shows qa entities after implementation
```

---

## Related

- [packages/console/src/server.ts](../../packages/console/src/server.ts) — current read-only flake APIs
- [deferred-console-writes.md](./deferred-console-writes.md)
