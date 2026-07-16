// Core knowledge-graph memory engine — `domain: "core"` in packages/mcp-server/src/tools.ts.
//
// Same entity / relation / observation model as the official reference
// server (@modelcontextprotocol/server-memory: create_entities, create_relations,
// add_observations, delete_*, read_graph, search_nodes, open_nodes), but every
// write passes through `evaluatePolicy` first, so it inherits the governance
// that npm package has none of:
//   - PII / secret deny-pattern scan on every name/type/observation string
//   - namespace isolation + per-namespace writer/reader RBAC (doc 09)
//   - Tier 1 TTL (namespace retention_days) instead of an unmanaged flat file
//   - hash-chained audit logging (wired in packages/mcp-server/src/index.ts)
//
// Reusable as-is for any namespace (qa/pr/ops/compliance/product) — no
// mortgage-QA-specific logic lives here.
import type { DB } from "./db.js";
import { evaluatePolicy, getPolicy, namespaceRetentionDays, type Policy } from "./policy.js";
import type {
  KgDenied,
  KgEntity,
  KgEntityInput,
  KgGraph,
  KgObservationAdd,
  KgObservationDelete,
  KgRelationInput,
  KgWriteResult,
  WriteContext,
} from "./types.js";

function isoNow(): string {
  return new Date().toISOString();
}

function isoPlusDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function ttlFor(policy: Policy, namespace: string): string {
  return isoPlusDays(namespaceRetentionDays(namespace, 30, policy));
}

interface EntityRow {
  namespace: string;
  name: string;
  entity_type: string;
}

function entityExists(db: DB, namespace: string, name: string, now: string): boolean {
  return !!db
    .prepare("SELECT 1 FROM kg_entities WHERE namespace = ? AND name = ? AND expires_at > ?")
    .get(namespace, name, now);
}

function loadObservations(db: DB, namespace: string, name: string, now: string): string[] {
  const rows = db
    .prepare(
      "SELECT content FROM kg_observations WHERE namespace = ? AND entity_name = ? AND expires_at > ? ORDER BY created_at ASC",
    )
    .all(namespace, name, now) as { content: string }[];
  return rows.map((r) => r.content);
}

/**
 * create_entities — ignores entities that already exist (matches upstream
 * behavior: use add_observations to extend an existing entity). Each new
 * entity's name/type/observations are scanned for PII before insert; a hit
 * skips that entity only (does not fail the whole batch).
 */
export function createEntities(
  db: DB,
  entities: KgEntityInput[],
  ctx: WriteContext,
  policy: Policy = getPolicy(),
): KgWriteResult<KgEntity> {
  const namespace = ctx.namespace ?? "qa";
  const now = isoNow();
  const created: KgEntity[] = [];
  const skippedExisting: string[] = [];
  const denied: KgDenied[] = [];

  for (const e of entities) {
    if (entityExists(db, namespace, e.name, now)) {
      skippedExisting.push(e.name);
      continue;
    }
    const observations = [...new Set(e.observations ?? [])];
    const decision = evaluatePolicy({ name: e.name, entityType: e.entityType, observations }, ctx, policy);
    if (decision.outcome !== "allow") {
      denied.push({ key: e.name, reason: decision.reason, matchedPattern: decision.matchedPattern });
      continue;
    }
    const expiresAt = ttlFor(policy, namespace);
    db.prepare(
      "INSERT INTO kg_entities (namespace, name, entity_type, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
    ).run(namespace, e.name, e.entityType, now, expiresAt);
    for (const content of observations) {
      db.prepare(
        "INSERT OR IGNORE INTO kg_observations (namespace, entity_name, content, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
      ).run(namespace, e.name, content, now, expiresAt);
    }
    created.push({ name: e.name, entityType: e.entityType, observations });
  }

  return { outcome: "allow", created, skippedExisting, denied };
}

/**
 * create_relations — ignores exact (from, to, relationType) duplicates.
 * Unlike upstream, also requires both endpoints to already exist in the
 * namespace, so the graph never accumulates edges to entities that were
 * never created (e.g. because they were denied for PII).
 */
export function createRelations(
  db: DB,
  relations: KgRelationInput[],
  ctx: WriteContext,
  policy: Policy = getPolicy(),
): KgWriteResult<KgRelationInput> {
  const namespace = ctx.namespace ?? "qa";
  const now = isoNow();
  const created: KgRelationInput[] = [];
  const skippedExisting: string[] = [];
  const denied: KgDenied[] = [];

  for (const r of relations) {
    const key = `${r.from}->${r.relationType}->${r.to}`;
    const exists = db
      .prepare(
        "SELECT 1 FROM kg_relations WHERE namespace = ? AND from_entity = ? AND to_entity = ? AND relation_type = ? AND expires_at > ?",
      )
      .get(namespace, r.from, r.to, r.relationType, now);
    if (exists) {
      skippedExisting.push(key);
      continue;
    }
    if (!entityExists(db, namespace, r.from, now) || !entityExists(db, namespace, r.to, now)) {
      denied.push({ key, reason: "entity_not_found" });
      continue;
    }
    const decision = evaluatePolicy({ ...r }, ctx, policy);
    if (decision.outcome !== "allow") {
      denied.push({ key, reason: decision.reason, matchedPattern: decision.matchedPattern });
      continue;
    }
    const expiresAt = ttlFor(policy, namespace);
    db.prepare(
      "INSERT INTO kg_relations (namespace, from_entity, to_entity, relation_type, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(namespace, r.from, r.to, r.relationType, now, expiresAt);
    created.push(r);
  }

  return { outcome: "allow", created, skippedExisting, denied };
}

export interface ObservationAddResult {
  entityName: string;
  added: string[];
}

/** add_observations — errors (per-entity) if the entity doesn't exist; dedupes content. */
export function addObservations(
  db: DB,
  adds: KgObservationAdd[],
  ctx: WriteContext,
  policy: Policy = getPolicy(),
): { results: ObservationAddResult[]; notFound: string[]; denied: KgDenied[] } {
  const namespace = ctx.namespace ?? "qa";
  const now = isoNow();
  const results: ObservationAddResult[] = [];
  const notFound: string[] = [];
  const denied: KgDenied[] = [];

  for (const add of adds) {
    if (!entityExists(db, namespace, add.entityName, now)) {
      notFound.push(add.entityName);
      continue;
    }
    const existing = new Set(loadObservations(db, namespace, add.entityName, now));
    const addedForEntity: string[] = [];
    for (const content of [...new Set(add.contents)]) {
      if (existing.has(content)) continue;
      const decision = evaluatePolicy({ entityName: add.entityName, content }, ctx, policy);
      if (decision.outcome !== "allow") {
        denied.push({ key: `${add.entityName}:${content}`, reason: decision.reason, matchedPattern: decision.matchedPattern });
        continue;
      }
      const expiresAt = ttlFor(policy, namespace);
      db.prepare(
        "INSERT OR IGNORE INTO kg_observations (namespace, entity_name, content, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
      ).run(namespace, add.entityName, content, now, expiresAt);
      addedForEntity.push(content);
    }
    if (addedForEntity.length) results.push({ entityName: add.entityName, added: addedForEntity });
  }

  return { results, notFound, denied };
}

/** delete_entities — single gate (role + namespace), then cascades observations + relations. */
export function deleteEntities(
  db: DB,
  entityNames: string[],
  ctx: WriteContext,
  policy: Policy = getPolicy(),
): { decision: ReturnType<typeof evaluatePolicy>; deleted: string[] } {
  const namespace = ctx.namespace ?? "qa";
  const decision = evaluatePolicy({ entityNames }, ctx, policy);
  if (decision.outcome !== "allow") return { decision, deleted: [] };

  const deleted: string[] = [];
  for (const name of entityNames) {
    const res = db.prepare("DELETE FROM kg_entities WHERE namespace = ? AND name = ?").run(namespace, name);
    if (res.changes > 0) deleted.push(name);
    db.prepare("DELETE FROM kg_observations WHERE namespace = ? AND entity_name = ?").run(namespace, name);
    db.prepare("DELETE FROM kg_relations WHERE namespace = ? AND (from_entity = ? OR to_entity = ?)").run(
      namespace,
      name,
      name,
    );
  }
  return { decision, deleted };
}

/** delete_observations — silently ignores content that isn't present (matches upstream). */
export function deleteObservations(
  db: DB,
  deletions: KgObservationDelete[],
  ctx: WriteContext,
  policy: Policy = getPolicy(),
): { decision: ReturnType<typeof evaluatePolicy> } {
  const namespace = ctx.namespace ?? "qa";
  const decision = evaluatePolicy({ deletions }, ctx, policy);
  if (decision.outcome !== "allow") return { decision };

  for (const d of deletions) {
    for (const content of d.observations) {
      db.prepare("DELETE FROM kg_observations WHERE namespace = ? AND entity_name = ? AND content = ?").run(
        namespace,
        d.entityName,
        content,
      );
    }
  }
  return { decision };
}

/** delete_relations — exact-match delete; silently ignores missing relations. */
export function deleteRelations(
  db: DB,
  relations: KgRelationInput[],
  ctx: WriteContext,
  policy: Policy = getPolicy(),
): { decision: ReturnType<typeof evaluatePolicy> } {
  const namespace = ctx.namespace ?? "qa";
  const decision = evaluatePolicy({ relations }, ctx, policy);
  if (decision.outcome !== "allow") return { decision };

  for (const r of relations) {
    db.prepare(
      "DELETE FROM kg_relations WHERE namespace = ? AND from_entity = ? AND to_entity = ? AND relation_type = ?",
    ).run(namespace, r.from, r.to, r.relationType);
  }
  return { decision };
}

function entityRowToEntity(db: DB, namespace: string, row: EntityRow, now: string): KgEntity {
  return { name: row.name, entityType: row.entity_type, observations: loadObservations(db, namespace, row.name, now) };
}

/** read_graph — the full (non-expired) graph for one namespace. */
export function readGraph(db: DB, namespace: string): KgGraph {
  const now = isoNow();
  const entityRows = db
    .prepare("SELECT namespace, name, entity_type FROM kg_entities WHERE namespace = ? AND expires_at > ?")
    .all(namespace, now) as EntityRow[];
  const relationRows = db
    .prepare(
      "SELECT from_entity AS f, to_entity AS t, relation_type AS r FROM kg_relations WHERE namespace = ? AND expires_at > ?",
    )
    .all(namespace, now) as { f: string; t: string; r: string }[];
  return {
    entities: entityRows.map((row) => entityRowToEntity(db, namespace, row, now)),
    relations: relationRows.map((row) => ({ from: row.f, to: row.t, relationType: row.r })),
  };
}

function relationsAmong(db: DB, namespace: string, names: Set<string>, now: string): KgRelationInput[] {
  const relationRows = db
    .prepare(
      "SELECT from_entity AS f, to_entity AS t, relation_type AS r FROM kg_relations WHERE namespace = ? AND expires_at > ?",
    )
    .all(namespace, now) as { f: string; t: string; r: string }[];
  return relationRows
    .filter((row) => names.has(row.f) && names.has(row.t))
    .map((row) => ({ from: row.f, to: row.t, relationType: row.r }));
}

/**
 * search_nodes — substring match (case-insensitive) across entity name,
 * type, and observation content. Relations returned only when both
 * endpoints are in the matched set (matches upstream semantics).
 */
export function searchNodes(db: DB, namespace: string, query: string): KgGraph {
  const now = isoNow();
  const q = query.toLowerCase();
  const entityRows = db
    .prepare("SELECT namespace, name, entity_type FROM kg_entities WHERE namespace = ? AND expires_at > ?")
    .all(namespace, now) as EntityRow[];

  const matched: KgEntity[] = [];
  for (const row of entityRows) {
    const observations = loadObservations(db, namespace, row.name, now);
    const hit =
      row.name.toLowerCase().includes(q) ||
      row.entity_type.toLowerCase().includes(q) ||
      observations.some((o) => o.toLowerCase().includes(q));
    if (hit) matched.push({ name: row.name, entityType: row.entity_type, observations });
  }

  const names = new Set(matched.map((e) => e.name));
  return { entities: matched, relations: relationsAmong(db, namespace, names, now) };
}

/** open_nodes — the requested entities plus relations strictly between them. */
export function openNodes(db: DB, namespace: string, names: string[]): KgGraph {
  const now = isoNow();
  const wanted = new Set(names);
  const entityRows = db
    .prepare("SELECT namespace, name, entity_type FROM kg_entities WHERE namespace = ? AND expires_at > ?")
    .all(namespace, now) as EntityRow[];
  const matched = entityRows
    .filter((row) => wanted.has(row.name))
    .map((row) => entityRowToEntity(db, namespace, row, now));
  return { entities: matched, relations: relationsAmong(db, namespace, wanted, now) };
}

/** kg_* row counts whose expires_at is in the past — used by purge.ts. */
export function purgeExpiredKg(db: DB, now: string = isoNow()): { entities: number; observations: number; relations: number } {
  const observations = db.prepare("DELETE FROM kg_observations WHERE expires_at < ?").run(now).changes;
  const relations = db.prepare("DELETE FROM kg_relations WHERE expires_at < ?").run(now).changes;
  const entities = db.prepare("DELETE FROM kg_entities WHERE expires_at < ?").run(now).changes;
  return { entities, observations, relations };
}
