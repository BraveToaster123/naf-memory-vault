import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { createEntities } from "../src/kg.js";
import {
  buildTriagePlan,
  detectStoryStage,
  planQaWorkflow,
  resolveIntent,
  storyEntityPrefix,
} from "../src/workflow-planner.js";
import type { WriteContext } from "../src/types.js";
import { loadPolicy } from "../src/policy.js";

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
    CREATE TABLE test_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_id TEXT NOT NULL, status TEXT NOT NULL, duration_ms INTEGER NOT NULL,
      journey_id TEXT, error_class TEXT, failure_signature TEXT,
      loan_scenario_id TEXT, env TEXT, recorded_at TEXT NOT NULL);
    CREATE TABLE failure_signatures (
      signature TEXT PRIMARY KEY, classification TEXT, notes TEXT, tagged_at TEXT);
  `);
  return db;
}

const ctx: WriteContext = {
  tier: 1,
  tool: "create_entities",
  principal: { userId: "u1", role: "qa_engineer" },
  namespace: "qa",
};

test("resolveIntent infers from test_id or user_story_id", () => {
  assert.equal(resolveIntent({ test_id: "le_generation/apr" }), "triage_failure");
  assert.equal(resolveIntent({ user_story_id: "471244" }), "check_story_status");
  assert.throws(() => resolveIntent({}), /intent_required/);
});

test("storyEntityPrefix normalizes US prefix", () => {
  assert.equal(storyEntityPrefix("471244"), "US_471244_");
  assert.equal(storyEntityPrefix("US 471244"), "US_471244_");
});

test("detectStoryStage classifies exploration entities", () => {
  assert.deepEqual(detectStoryStage("471244", []), {
    stage: "not_explored",
    acCount: 0,
    hasSummary: false,
    hasDraftTestCases: false,
    hasTestCases: false,
  });
  assert.equal(
    detectStoryStage("471244", ["US_471244_AC1", "US_471244_Summary"]).stage,
    "explored",
  );
  assert.equal(
    detectStoryStage("471244", ["US_471244_TestCasesDraft", "US_471244_AC1"]).stage,
    "test_cases_drafted",
  );
  assert.equal(
    detectStoryStage("471244", ["US_471244_TestCases", "US_471244_AC1"]).stage,
    "test_cases_published",
  );
});

test("buildTriagePlan skips browser steps when flake known", () => {
  const plan = buildTriagePlan("le_generation/apr", true, true);
  assert.equal(plan.stage, "known_flake");
  assert.equal(plan.ordered_plan.length, 3);
  assert.equal(plan.suggested_skill, "memory-vault-triage");
});

test("planQaWorkflow check_story_status finds explored story", () => {
  const db = freshDb();
  createEntities(
    db,
    [
      { name: "US_471244_AC1", entityType: "acceptance_criterion", observations: ["status: PASS"] },
      { name: "US_471244_Summary", entityType: "story_summary", observations: ["overall_status: PASS"] },
    ],
    ctx,
    policy,
  );
  const plan = planQaWorkflow(db, { intent: "check_story_status", user_story_id: "471244" });
  assert.equal(plan.workflow, "story_pipeline");
  assert.equal(plan.stage, "explored");
  assert.equal(plan.suggested_skill, "memory-vault-write-tcs");
  assert.equal(plan.ordered_plan[0]?.tool, "search_nodes");
});

test("planQaWorkflow write_test_cases blocks without exploration", () => {
  const db = freshDb();
  const plan = planQaWorkflow(db, { intent: "write_test_cases", user_story_id: "999" });
  assert.ok(plan.blockers.some((b) => b.includes("explore_story")));
  assert.equal(plan.suggested_skill, "memory-vault-write-tcs");
});

test("planQaWorkflow explore_story suggests memory-vault-explore", () => {
  const db = freshDb();
  const plan = planQaWorkflow(db, { intent: "explore_story", user_story_id: "471244" });
  assert.equal(plan.suggested_skill, "memory-vault-explore");
  assert.equal(plan.suggested_prompt, "explore_acceptance_criteria");
  assert.equal(plan.blockers.length, 0);
});

test("planQaWorkflow publish_test_cases unblocked with draft entity", () => {
  const db = freshDb();
  createEntities(
    db,
    [
      { name: "US_471244_AC1", entityType: "acceptance_criterion", observations: ["status: PASS"] },
      {
        name: "US_471244_TestCasesDraft",
        entityType: "test_cases_draft",
        observations: ["tc_count: 1"],
      },
    ],
    ctx,
    policy,
  );
  const plan = planQaWorkflow(db, { intent: "publish_test_cases", user_story_id: "471244" });
  assert.equal(plan.suggested_skill, "memory-vault-publish");
  assert.equal(plan.blockers.length, 0);
});

test("planQaWorkflow publish_test_cases blocks without draft", () => {
  const db = freshDb();
  createEntities(
    db,
    [{ name: "US_471244_AC1", entityType: "acceptance_criterion", observations: ["status: PASS"] }],
    ctx,
    policy,
  );
  const plan = planQaWorkflow(db, { intent: "publish_test_cases", user_story_id: "471244" });
  assert.ok(plan.blockers.some((b) => b.includes("TestCasesDraft")));
});

test("planQaWorkflow generate_automation unblocked with exploration", () => {
  const db = freshDb();
  createEntities(
    db,
    [{ name: "US_471244_AC1", entityType: "acceptance_criterion", observations: ["status: PASS"] }],
    ctx,
    policy,
  );
  const plan = planQaWorkflow(db, { intent: "generate_automation", user_story_id: "471244" });
  assert.equal(plan.suggested_skill, "memory-vault-generate");
  assert.equal(plan.blockers.length, 0);
});
