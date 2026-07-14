import { defineConfig, devices } from "@playwright/test";

/**
 * Pilot Playwright config. The MqmReporter writes policy-gated Tier 1 run
 * summaries to SQLite. CI uses the deterministic runner only — never an agent.
 *
 * Env (set in CI):
 *   MQM_DB_PATH, MQM_ENV, MQM_LOAN_SCENARIO, MQM_APP_ID, CI_COMMIT_SHA
 */
export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    ["./packages/reporter/src/flakiness-reporter.ts"],
  ],
  use: {
    baseURL: process.env.MQM_BASE_URL ?? "https://staging.pilot-mortgage.example",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
