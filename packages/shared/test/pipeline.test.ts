import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { loadPolicy } from "../src/policy.js";
import { recordRunSummary, tagFailureSignature } from "../src/pipeline.js";
import { getFlakyTests, getTestHistory, shouldSkipBrowser } from "../src/queries.js";
import type { TestRunInput, WriteContext } from "../src/types.js";

const policy = loadPolicy();
const ctx: WriteContext = {
  tier: 1,
  tool: "record_run_summary",
  principal: { userId: "u1", role: "qa_engineer" },
};

function freshDb(): Database.Database {
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
    source TEXT, created_at TEXT NOT NULL, expires_at TEXT NOT NULL);`);
  return db;
}

const run = (over: Partial<TestRunInput>): TestRunInput => ({
  testId: "le_generation/apr",
  status: "passed",
  durationMs: 100,
  journeyId: "le_generation",
  appId: "loan-origination-portal",
  env: "staging",
  loanScenarioId: "synthetic-retail-01",
  ...over,
});

test("recordRunSummary stores an allowed run", () => {
  const db = freshDb();
  const res = recordRunSummary(db, run({ status: "passed" }), ctx, policy);
  assert.equal(res.decision.outcome, "allow");
  assert.ok(res.row);
  const count = db.prepare("SELECT COUNT(*) AS n FROM test_runs").get() as { n: number };
  assert.equal(count.n, 1);
});

test("run with PII in error is dropped (not stored)", () => {
  const db = freshDb();
  const res = recordRunSummary(
    db,
    run({ status: "failed", errorClass: "AssertionError", errorMessage: "borrower 123-45-6789 mismatch" }),
    ctx,
    policy,
  );
  assert.equal(res.decision.outcome, "deny");
  assert.equal(res.decision.reason, "pii_in_error_dropped");
  const count = db.prepare("SELECT COUNT(*) AS n FROM test_runs").get() as { n: number };
  assert.equal(count.n, 0);
});

test("failed run stores a signature and no raw error columns exist", () => {
  const db = freshDb();
  recordRunSummary(
    db,
    run({ status: "failed", errorClass: "TimeoutError", errorMessage: "locator not visible after 5000ms" }),
    ctx,
    policy,
  );
  const row = db.prepare("SELECT * FROM test_runs LIMIT 1").get() as Record<string, unknown>;
  assert.equal(row.error_class, "TimeoutError");
  assert.match(String(row.failure_signature), /^fs_/);
  assert.ok(!("full_error_message" in row));
  assert.ok(!("stack_trace" in row));
});

test("getFlakyTests ranks by flake rate above min_runs", () => {
  const db = freshDb();
  for (let i = 0; i < 6; i++) {
    recordRunSummary(db, run({ testId: "flaky/one", status: i % 2 ? "failed" : "passed", errorClass: "TimeoutError", errorMessage: "timeout" }), ctx, policy);
    recordRunSummary(db, run({ testId: "stable/two", status: "passed" }), ctx, policy);
  }
  const flaky = getFlakyTests(db, { minRuns: 5 });
  assert.equal(flaky[0]?.test_id, "flaky/one");
  assert.ok((flaky[0]?.flake_rate ?? 0) > 0);
  assert.equal(getTestHistory(db, "flaky/one").length > 0, true);
});

test("shouldSkipBrowser returns skip for a tagged flake seen >= 3x", () => {
  const db = freshDb();
  let sig = "";
  for (let i = 0; i < 3; i++) {
    const res = recordRunSummary(db, run({ testId: "le_generation/issue-date", status: "flaky", errorClass: "TimeoutError", errorMessage: "sso slow timeout" }), ctx, policy);
    sig = res.row?.failure_signature ?? sig;
  }
  tagFailureSignature(db, { signature: sig, classification: "flake", notes: "uat sso" }, { ...ctx, tool: "tag_failure_signature" }, policy);
  const decision = shouldSkipBrowser(db, { testId: "le_generation/issue-date" });
  assert.equal(decision.skip, true);
});
