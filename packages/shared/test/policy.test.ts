import { test } from "node:test";
import assert from "node:assert/strict";
import { loadPolicy, evaluatePolicy, isUrlAllowed, dropDeniedFields } from "../src/policy.js";
import type { WriteContext } from "../src/types.js";

const policy = loadPolicy();

const qaEngineer = (tier: 0 | 1 | 2, tool: string): WriteContext => ({
  tier,
  tool,
  principal: { userId: "u1", role: "qa_engineer" },
});

test("SSN payload is denied pre-save", () => {
  const d = evaluatePolicy(
    { testId: "t1", note: "borrower 123-45-6789 failed" },
    qaEngineer(1, "record_run_summary"),
    policy,
  );
  assert.equal(d.outcome, "deny");
  assert.equal(d.reason, "pii_pattern");
});

test("clean tier1 write is allowed for qa_engineer", () => {
  const d = evaluatePolicy(
    { testId: "t1", status: "passed", durationMs: 120 },
    qaEngineer(1, "record_run_summary"),
    policy,
  );
  assert.equal(d.outcome, "allow");
});

test("tier2 write requires human approval (never direct)", () => {
  const d = evaluatePolicy(
    { app: "lo", element_key: "apr", selector: "#apr", app_version: "1.0" },
    { tier: 2, tool: "upsert_locator", principal: { userId: "lead", role: "qa_lead" } },
    policy,
  );
  assert.equal(d.outcome, "require_approval");
});

test("qc_analyst cannot write run summaries", () => {
  const d = evaluatePolicy(
    { testId: "t1", status: "passed", durationMs: 1 },
    { tier: 1, tool: "record_run_summary", principal: { userId: "qc", role: "qc_analyst" } },
    policy,
  );
  assert.equal(d.outcome, "deny");
});

test("non-synthetic loan scenario is denied", () => {
  const d = evaluatePolicy(
    { testId: "t1", status: "passed", durationMs: 1, loanScenarioId: "prod-loan-9931" },
    qaEngineer(1, "record_run_summary"),
    policy,
  );
  assert.equal(d.outcome, "deny");
  assert.match(d.reason, /not in synthetic allowlist/);
});

test("denied fields are stripped before storage", () => {
  const { cleaned, dropped } = dropDeniedFields(
    { testId: "t1", raw_snapshot: "<html>...</html>", stack_trace: "at x" },
    policy,
  );
  assert.deepEqual(Object.keys(cleaned), ["testId"]);
  assert.ok(dropped.includes("raw_snapshot"));
  assert.ok(dropped.includes("stack_trace"));
});

test("url allowlist blocks prod and allows staging", () => {
  assert.equal(isUrlAllowed("https://staging.pilot-mortgage.example/loans/1/le", policy), true);
  assert.equal(isUrlAllowed("https://app.prod.pilot-mortgage.example/loans/1", policy), false);
  assert.equal(isUrlAllowed("https://evil.example/x", policy), false);
});
