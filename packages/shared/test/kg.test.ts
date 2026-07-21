import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { loadPolicy } from "../src/policy.js";
import {
  createEntities,
  createRelations,
  addObservations,
  deleteEntities,
  deleteObservations,
  deleteRelations,
  readGraph,
  searchNodes,
  openNodes,
} from "../src/kg.js";
import type { WriteContext } from "../src/types.js";

const policy = loadPolicy();

function freshDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE kg_entities (
      namespace TEXT NOT NULL, name TEXT NOT NULL, entity_type TEXT NOT NULL,
      created_at TEXT NOT NULL, expires_at TEXT NOT NULL,
      PRIMARY KEY (namespace, name));
    CREATE TABLE kg_observations (
      namespace TEXT NOT NULL, entity_name TEXT NOT NULL, content TEXT NOT NULL,
      created_at TEXT NOT NULL, expires_at TEXT NOT NULL,
      PRIMARY KEY (namespace, entity_name, content));
    CREATE TABLE kg_relations (
      namespace TEXT NOT NULL, from_entity TEXT NOT NULL, to_entity TEXT NOT NULL,
      relation_type TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL,
      PRIMARY KEY (namespace, from_entity, to_entity, relation_type));
  `);
  return db;
}

const qaEngineer: WriteContext = {
  tier: 1,
  tool: "create_entities",
  principal: { userId: "u1", role: "qa_engineer" },
  namespace: "qa",
};

test("createEntities creates new entities and skips existing on retry", () => {
  const db = freshDb();
  const first = createEntities(
    db,
    [{ name: "le_generation", entityType: "journey", observations: ["flaky on staging"] }],
    qaEngineer,
    policy,
  );
  assert.equal(first.created.length, 1);
  assert.equal(first.denied.length, 0);

  const second = createEntities(
    db,
    [{ name: "le_generation", entityType: "journey", observations: ["ignored"] }],
    qaEngineer,
    policy,
  );
  assert.equal(second.created.length, 0);
  assert.deepEqual(second.skippedExisting, ["le_generation"]);
});

test("PII in an observation denies that entity only (does not fail the batch)", () => {
  const db = freshDb();
  const res = createEntities(
    db,
    [
      { name: "clean_entity", entityType: "note", observations: ["stable"] },
      { name: "dirty_entity", entityType: "note", observations: ["borrower 123-45-6789 seen"] },
    ],
    qaEngineer,
    policy,
  );
  assert.equal(res.created.length, 1);
  assert.equal(res.created[0]?.name, "clean_entity");
  assert.equal(res.denied.length, 1);
  assert.equal(res.denied[0]?.key, "dirty_entity");
  const stored = readGraph(db, "qa");
  assert.equal(stored.entities.length, 1);
});

test("unknown namespace is denied by default (isolate by default)", () => {
  const db = freshDb();
  const res = createEntities(
    db,
    [{ name: "x", entityType: "t", observations: [] }],
    { ...qaEngineer, namespace: "not-a-real-namespace" },
    policy,
  );
  assert.equal(res.created.length, 0);
  assert.match(res.denied[0]?.reason ?? "", /not permitted to write namespace/);
});

test("qc_analyst may not write to the qa namespace", () => {
  const db = freshDb();
  const res = createEntities(
    db,
    [{ name: "x", entityType: "t", observations: [] }],
    { tier: 1, tool: "create_entities", principal: { userId: "qc", role: "qc_analyst" }, namespace: "qa" },
    policy,
  );
  assert.equal(res.created.length, 0);
  assert.equal(res.denied.length, 1);
});

test("createRelations dedupes exact triples", () => {
  const db = freshDb();
  createEntities(db, [{ name: "a", entityType: "t" }, { name: "b", entityType: "t" }], qaEngineer, policy);
  const first = createRelations(db, [{ from: "a", to: "b", relationType: "depends_on" }], qaEngineer, policy);
  assert.equal(first.created.length, 1);
  const second = createRelations(db, [{ from: "a", to: "b", relationType: "depends_on" }], qaEngineer, policy);
  assert.equal(second.created.length, 0);
  assert.equal(second.skippedExisting.length, 1);
});

test("addObservations extends an existing entity and reports missing ones", () => {
  const db = freshDb();
  createEntities(db, [{ name: "le_generation", entityType: "journey", observations: ["v1"] }], qaEngineer, policy);
  const res = addObservations(
    db,
    [
      { entityName: "le_generation", contents: ["v1", "v2"] }, // v1 already present -> deduped
      { entityName: "missing_entity", contents: ["x"] },
    ],
    qaEngineer,
    policy,
  );
  assert.deepEqual(res.results, [{ entityName: "le_generation", added: ["v2"] }]);
  assert.deepEqual(res.notFound, ["missing_entity"]);
});

test("deleteEntities cascades observations and relations", () => {
  const db = freshDb();
  createEntities(db, [{ name: "a", entityType: "t", observations: ["o1"] }, { name: "b", entityType: "t" }], qaEngineer, policy);
  createRelations(db, [{ from: "a", to: "b", relationType: "depends_on" }], qaEngineer, policy);

  const res = deleteEntities(db, ["a"], { ...qaEngineer, tool: "delete_entities" }, policy);
  assert.equal(res.decision.outcome, "allow");
  assert.deepEqual(res.deleted, ["a"]);

  const graph = readGraph(db, "qa");
  assert.equal(graph.entities.length, 1);
  assert.equal(graph.relations.length, 0);
});

test("deleteObservations and deleteRelations silently ignore missing rows", () => {
  const db = freshDb();
  createEntities(db, [{ name: "a", entityType: "t", observations: ["o1"] }], qaEngineer, policy);
  const obsRes = deleteObservations(
    db,
    [{ entityName: "a", observations: ["o1", "never_existed"] }],
    { ...qaEngineer, tool: "delete_observations" },
    policy,
  );
  assert.equal(obsRes.decision.outcome, "allow");
  assert.equal(readGraph(db, "qa").entities[0]?.observations.length, 0);

  const relRes = deleteRelations(
    db,
    [{ from: "a", to: "z", relationType: "nope" }],
    { ...qaEngineer, tool: "delete_relations" },
    policy,
  );
  assert.equal(relRes.decision.outcome, "allow");
});

test("searchNodes matches on name, type, and observation content within a namespace", () => {
  const db = freshDb();
  createEntities(
    db,
    [
      { name: "le_generation", entityType: "journey", observations: ["APR mismatch on staging"] },
      { name: "cd_generation", entityType: "journey", observations: ["stable"] },
    ],
    qaEngineer,
    policy,
  );
  const byObservation = searchNodes(db, "qa", "apr mismatch");
  assert.deepEqual(byObservation.entities.map((e) => e.name), ["le_generation"]);

  const byType = searchNodes(db, "qa", "journey");
  assert.equal(byType.entities.length, 2);
});

test("openNodes returns only requested entities plus relations strictly between them", () => {
  const db = freshDb();
  createEntities(db, [{ name: "a", entityType: "t" }, { name: "b", entityType: "t" }, { name: "c", entityType: "t" }], qaEngineer, policy);
  createRelations(
    db,
    [
      { from: "a", to: "b", relationType: "depends_on" },
      { from: "a", to: "c", relationType: "depends_on" },
    ],
    qaEngineer,
    policy,
  );
  const opened = openNodes(db, "qa", ["a", "b"]);
  assert.deepEqual(opened.entities.map((e) => e.name).sort(), ["a", "b"]);
  assert.equal(opened.relations.length, 1);
  assert.equal(opened.relations[0]?.to, "b");
});

test("namespace isolation: writes to qa are invisible from another namespace's read", () => {
  const db = freshDb();
  createEntities(db, [{ name: "shared_name", entityType: "t" }], qaEngineer, policy);
  const prGraph = readGraph(db, "pr");
  assert.equal(prGraph.entities.length, 0);
});

test("credential observation is denied pre-save", () => {
  const db = freshDb();
  const res = createEntities(
    db,
    [{ name: "app_credentials", entityType: "secret", observations: ["password: hunter2"] }],
    qaEngineer,
    policy,
  );
  assert.equal(res.created.length, 0);
  assert.equal(res.denied.length, 1);
  assert.equal(res.denied[0]?.reason, "pii_pattern");
});

test("tier-2 graph write requires human approval", () => {
  const db = freshDb();
  const res = createEntities(
    db,
    [{ name: "curated", entityType: "journey", observations: ["step 1"] }],
    { ...qaEngineer, tier: 2 },
    policy,
  );
  assert.equal(res.created.length, 0);
  assert.match(res.denied[0]?.reason ?? "", /require|approval|pr/i);
});

test("oversized observation is blocked", () => {
  const db = freshDb();
  const huge = "x".repeat(2001);
  const res = createEntities(db, [{ name: "e", entityType: "t", observations: [huge] }], qaEngineer, policy);
  assert.equal(res.created.length, 0);
  assert.match(res.denied[0]?.reason ?? "", /exceeds/);
});
