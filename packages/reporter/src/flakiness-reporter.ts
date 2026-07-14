import type {
  FullConfig,
  Reporter,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";
import {
  openDb,
  recordRunSummary,
  getPolicy,
  type DB,
  type TestRunInput,
  type TestStatus,
  type WriteContext,
} from "@mqm/shared";

/**
 * MqmReporter — deterministic CI memory writer.
 *
 * Runs inside `playwright test` (never an agent). Extracts the journey id from
 * the test title tag `[journey_id]`, then writes an allowlisted, policy-gated
 * Tier 1 run summary. Raw errors, snapshots and stack traces never reach disk.
 */
export default class MqmReporter implements Reporter {
  private db!: DB;
  private readonly ctx: WriteContext;
  private written = 0;
  private dropped = 0;

  constructor() {
    this.ctx = {
      tier: 1,
      tool: "record_run_summary",
      principal: { userId: process.env.MQM_USER_ID ?? "ci", role: "qa_engineer" },
      policyVersion: getPolicy().version,
    };
  }

  onBegin(_config: FullConfig): void {
    this.db = openDb();
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const journeyId = test.title.match(/\[(\w+)\]/)?.[1];
    const input: TestRunInput = {
      testId: test.titlePath().slice(1).join(" > ") || test.title,
      status: mapStatus(result.status, test.outcome()),
      durationMs: result.duration,
      journeyId,
      appId: process.env.MQM_APP_ID,
      browser: test.parent.project()?.name,
      os: process.platform,
      env: process.env.MQM_ENV ?? "ci",
      commitSha: process.env.CI_COMMIT_SHA,
      loanScenarioId: process.env.MQM_LOAN_SCENARIO,
      errorClass: classifyError(result.error?.message),
      errorMessage: result.error?.message,
    };

    const res = recordRunSummary(this.db, input, this.ctx);
    if (res.decision.outcome === "allow") this.written++;
    else this.dropped++;
  }

  onEnd(): void {
    // eslint-disable-next-line no-console
    console.log(`[MqmReporter] wrote ${this.written} run summaries, dropped ${this.dropped} (policy).`);
    this.db?.close();
  }
}

function mapStatus(status: TestResult["status"], outcome: ReturnType<TestCase["outcome"]>): TestStatus {
  if (outcome === "flaky") return "flaky";
  if (status === "passed") return "passed";
  if (status === "skipped") return "skipped";
  return "failed";
}

/** Derive a coarse error class (never the raw message). */
function classifyError(message?: string): string | undefined {
  if (!message) return undefined;
  const m = message.match(/^([A-Za-z]+Error)\b/);
  if (m) return m[1];
  if (/timeout/i.test(message)) return "TimeoutError";
  if (/expect|assert/i.test(message)) return "AssertionError";
  return "Error";
}
