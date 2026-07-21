/**
 * Seed the Tier 1 store with synthetic run history so the MCP tools and eval
 * have data to work with before a live Playwright suite exists.
 *
 *   npm run seed:demo
 *
 * Covers every test in eval/ci-failures.jsonl so the eval gate is meaningful.
 */
import {
  openDb,
  recordRunSummary,
  tagFailureSignature,
  rememberEnvFact,
  getPolicy,
  type Classification,
  type TestRunInput,
  type TestStatus,
  type WriteContext,
} from "@memory-vault/shared";

const ctx: WriteContext = {
  tier: 1,
  tool: "record_run_summary",
  principal: { userId: "seed", role: "qa_engineer" },
  policyVersion: getPolicy().version,
};

const base = (over: Partial<TestRunInput>): TestRunInput => ({
  testId: "le_generation/apr visible",
  status: "passed",
  durationMs: 800 + Math.floor(Math.random() * 400),
  journeyId: "le_generation",
  appId: "loan-origination-portal",
  browser: "chromium",
  os: process.platform,
  env: "staging",
  commitSha: "seed-" + Math.random().toString(16).slice(2, 8),
  loanScenarioId: "synthetic-retail-01",
  ...over,
});

interface Scenario {
  testId: string;
  journeyId: string;
  statuses: TestStatus[];
  errClass?: string;
  errMsg?: string;
  /** How this test's failure signature should be classified (drives eval). */
  classify?: Classification;
  notes?: string;
}

// One entry per test in eval/ci-failures.jsonl (plus healthy noise).
const scenarios: Scenario[] = [
  {
    testId: "le_generation/apr visible",
    journeyId: "le_generation",
    statuses: ["passed", "flaky", "passed", "passed", "flaky", "passed", "passed"],
    errClass: "TimeoutError",
    errMsg: "locator getByText('Annual Percentage Rate') not visible after 5000ms on firefox",
    classify: "flake",
    notes: "firefox staging timing flake",
  },
  {
    testId: "le_generation/issue date",
    journeyId: "le_generation",
    statuses: ["passed", "passed", "flaky", "passed", "flaky", "flaky"],
    errClass: "TimeoutError",
    errMsg: "sso redirect slow, timeout after 5000ms",
    classify: "flake",
    notes: "uat sso slow flake",
  },
  {
    testId: "cd_generation/fee table",
    journeyId: "cd_generation",
    statuses: ["passed", "passed", "passed", "failed", "failed", "failed"],
    errClass: "AssertionError",
    errMsg: "expected fee table row 'Origination Charges' to be visible",
    classify: "regression",
    notes: "broke on deploy 18440 fee selector",
  },
  {
    testId: "urla_data_entry/required fields",
    journeyId: "urla_data_entry",
    statuses: ["passed", "passed", "failed", "failed", "failed"],
    errClass: "AssertionError",
    errMsg: "required-field validation did not block submit after rule change",
    classify: "regression",
    notes: "new validation rule 2026-07-01",
  },
  {
    testId: "eclose_package/consent",
    journeyId: "eclose_package",
    statuses: ["passed", "passed", "failed", "failed"],
    errClass: "Error",
    errMsg: "third-party e-sign iframe failed to load",
    classify: "regression",
    notes: "e-sign iframe load failure",
  },
];

function latestSignature(db: ReturnType<typeof openDb>, testId: string): string | undefined {
  const row = db
    .prepare(
      "SELECT failure_signature FROM test_runs WHERE test_id = ? AND failure_signature IS NOT NULL ORDER BY created_at DESC LIMIT 1",
    )
    .get(testId) as { failure_signature: string } | undefined;
  return row?.failure_signature;
}

function main(): void {
  const db = openDb();
  let n = 0;
  for (const s of scenarios) {
    for (const status of s.statuses) {
      const failing = status === "failed" || status === "flaky";
      const res = recordRunSummary(
        db,
        base({
          testId: s.testId,
          journeyId: s.journeyId,
          status,
          errorClass: failing ? s.errClass : undefined,
          errorMessage: failing ? s.errMsg : undefined,
        }),
        ctx,
      );
      if (res.decision.outcome === "allow") n++;
    }
  }

  // Tag each scenario's signature so get_failure_signature / eval can classify.
  let tagged = 0;
  for (const s of scenarios) {
    if (!s.classify) continue;
    const sig = latestSignature(db, s.testId);
    if (!sig) continue;
    const d = tagFailureSignature(
      db,
      { signature: sig, classification: s.classify, notes: s.notes },
      { ...ctx, tool: "tag_failure_signature" },
    );
    if (d.outcome === "allow") tagged++;
  }

  rememberEnvFact(
    db,
    { env: "uat", fact: "SSO redirect is slow; add 2s settle before asserting LE fields", overlayKey: "default", source: "qa-team" },
    { ...ctx, tool: "remember_env_fact" },
  );

  db.close();
  // eslint-disable-next-line no-console
  console.log(`[seed:demo] inserted ${n} run summaries + tagged ${tagged} signatures + 1 env fact.`);
}

main();
