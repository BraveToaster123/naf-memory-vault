import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { purgeExpired } from "../src/purge.js";

function dbWithRows(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE test_runs (
    id TEXT PRIMARY KEY, test_id TEXT NOT NULL, journey_id TEXT, app_id TEXT,
    status TEXT NOT NULL, duration_ms INTEGER, browser TEXT, os TEXT, env TEXT,
    commit_sha TEXT, loan_scenario_id TEXT, error_class TEXT, failure_signature TEXT,
    created_at TEXT NOT NULL, expires_at TEXT NOT NULL);
   CREATE TABLE failure_signatures (
    signature TEXT PRIMARY KEY, classification TEXT NOT NULL, notes TEXT,
    occurrence_count INTEGER NOT NULL DEFAULT 1, first_seen TEXT NOT NULL,
    last_seen TEXT NOT NULL, expires_at TEXT NOT NULL);
   CREATE TABLE env_facts (
    id TEXT PRIMARY KEY, env TEXT NOT NULL, overlay_key TEXT, fact TEXT NOT NULL,
    source TEXT, created_at TEXT NOT NULL, expires_at TEXT NOT NULL);
   CREATE TABLE kg_entities (
    namespace TEXT NOT NULL, name TEXT NOT NULL, entity_type TEXT NOT NULL,
    created_at TEXT NOT NULL, expires_at TEXT NOT NULL, PRIMARY KEY (namespace, name));
   CREATE TABLE kg_observations (
    namespace TEXT NOT NULL, entity_name TEXT NOT NULL, content TEXT NOT NULL,
    created_at TEXT NOT NULL, expires_at TEXT NOT NULL,
    PRIMARY KEY (namespace, entity_name, content));
   CREATE TABLE kg_relations (
    namespace TEXT NOT NULL, from_entity TEXT NOT NULL, to_entity TEXT NOT NULL,
    relation_type TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL,
    PRIMARY KEY (namespace, from_entity, to_entity, relation_type));`);
  const past = "2000-01-01T00:00:00.000Z";
  const future = "2999-01-01T00:00:00.000Z";
  db.prepare("INSERT INTO test_runs (id, test_id, status, created_at, expires_at) VALUES (?,?,?,?,?)").run("a", "t", "passed", past, past);
  db.prepare("INSERT INTO test_runs (id, test_id, status, created_at, expires_at) VALUES (?,?,?,?,?)").run("b", "t", "passed", past, future);
  db.prepare("INSERT INTO env_facts (id, env, fact, created_at, expires_at) VALUES (?,?,?,?,?)").run("e1", "uat", "slow sso", past, past);
  db.prepare("INSERT INTO kg_entities (namespace, name, entity_type, created_at, expires_at) VALUES (?,?,?,?,?)").run("qa", "old_ent", "test", past, past);
  db.prepare("INSERT INTO kg_observations (namespace, entity_name, content, created_at, expires_at) VALUES (?,?,?,?,?)").run("qa", "old_ent", "stale", past, past);
  db.prepare("INSERT INTO kg_relations (namespace, from_entity, to_entity, relation_type, created_at, expires_at) VALUES (?,?,?,?,?,?)").run("qa", "old_ent", "other", "flaky_with", past, past);
  return db;
}

test("purgeExpired hard-deletes only past-expiry rows", () => {
  const db = dbWithRows();
  const result = purgeExpired(db);
  assert.equal(result.test_runs, 1);
  assert.equal(result.env_facts, 1);
  assert.equal(result.kg_entities, 1);
  assert.equal(result.kg_observations, 1);
  assert.equal(result.kg_relations, 1);
  const remaining = db.prepare("SELECT COUNT(*) AS n FROM test_runs").get() as { n: number };
  assert.equal(remaining.n, 1);
});
