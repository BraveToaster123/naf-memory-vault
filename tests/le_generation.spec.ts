import { test, expect } from "@playwright/test";

/**
 * Pilot suite for the Loan Estimate journey. Test titles embed the journey id
 * tag `[le_generation]` so the MqmReporter can map runs to the journey map.
 *
 * These target the staging allowlist host and synthetic loan scenario only.
 * They are skipped unless MQM_RUN_E2E=1 so the repo installs/tests cleanly
 * without a live staging environment.
 */
const RUN = process.env.MQM_RUN_E2E === "1";
const LOAN = process.env.MQM_LOAN_SCENARIO ?? "synthetic-retail-01";

test.describe("compliance-smoke @blocking", () => {
  test.skip(!RUN, "set MQM_RUN_E2E=1 with a reachable staging environment");

  test("[le_generation] APR is visible on Loan Estimate", async ({ page }) => {
    await page.goto(`/loans/${LOAN}/le`);
    await expect(page.getByText("Annual Percentage Rate")).toBeVisible();
  });

  test("[le_generation] Finance Charge is visible on Loan Estimate", async ({ page }) => {
    await page.goto(`/loans/${LOAN}/le`);
    await expect(page.getByText("Finance Charge")).toBeVisible();
  });

  test("[le_generation] Date Issued is visible on Loan Estimate", async ({ page }) => {
    await page.goto(`/loans/${LOAN}/le`);
    await expect(page.getByText("Date Issued")).toBeVisible();
  });
});
