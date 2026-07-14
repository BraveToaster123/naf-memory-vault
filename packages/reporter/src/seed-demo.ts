/**
 * Seed the Tier 1 store with synthetic run history so the MCP tools and eval
 * have data to work with before a live Playwright suite exists.
 *
 *   npm run seed:demo
 */
import {
  openDb,
  recordRunSummary,
  tagFailureSignature,
  rememberEnvFact,
  getPolicy,
  type TestRunInput,
  type TestStatus,
  type WriteContext,
} from "@mqm/shared";

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

// [testId, journeyId, patternOfStatuses]
const scenarios: Array<{ testId: string; journeyId: string; statuses: TestStatus[]; errClass?: string; errMsg?: string }> = [
  { testId: "le_generation/apr visible", journeyId: "le_generation", statuses: ["passed", "flaky", "passed", "passed", "flaky", "passed", "passed"], errClass: "TimeoutError", errMsg: "locator getByText('Annual Percentage Rate') not visible after 5000ms on firefox" },
  { testId: "le_generation/issue date", journeyId: "le_generation", statuses: ["passed", "passed", "flaky", "passed", "flaky", "flaky"], errClass: "TimeoutError", errMsg: "sso redirect slow, timeout after 5000ms" },
  { testId: "cd_generation/fee table", journeyId: "cd_generation", statuses: ["passed", "passed", "passed", "failed", "failed", "failed"], errClass: "AssertionError", errMsg: "expected fee table row 'Origination Charges' to be visible" },
  { testId: "urla_data_entry/required fields", journeyId: "urla_data_entry", statuses: ["passed", "passed", "passed", "passed", "passed"], errClass: "AssertionError", errMsg: "required field validation" },
];

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

  // Classify the two flaky signatures so should_skip_browser can short-circuit.
  const flakySigs = db
    .prepare(
      "SELECT failure_signature FROM test_runs WHERE test_id IN ('le_generation/apr visible','le_generation/issue date') AND failure_signature IS NOT NULL GROUP BY failure_signature",
    )
    .all() as { failure_signature: string }[];
  for (const { failure_signature } of flakySigs) {
    tagFailureSignature(
      db,
      { signature: failure_signature, classification: "flake", notes: "known staging/uat timing flake" },
      { ...ctx, tool: "tag_failure_signature" },
    );
  }

  // Classify the CD fee-table regression.
  const regSig = db
    .prepare("SELECT failure_signature FROM test_runs WHERE test_id = 'cd_generation/fee table' AND failure_signature IS NOT NULL LIMIT 1")
    .get() as { failure_signature: string } | undefined;
  if (regSig) {
    tagFailureSignature(
      db,
      { signature: regSig.failure_signature, classification: "regression", notes: "broke on deploy 18440 fee selector" },
      { ...ctx, tool: "tag_failure_signature" },
    );
  }

  rememberEnvFact(
    db,
    { env: "uat", fact: "SSO redirect is slow; add 2s settle before asserting LE fields", overlayKey: "default", source: "qa-team" },
    { ...ctx, tool: "remember_env_fact" },
  );

  db.close();
  // eslint-disable-next-line no-console
  console.log(`[seed:demo] inserted ${n} run summaries + tagged signatures + 1 env fact.`);
}

main();
