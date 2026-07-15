// MCP-native prompt catalog — makes the "memory before browser" QA triage
// workflow (previously only available as the Cursor-specific
// cursor/skills/mortgage-qa-triage/SKILL.md file) discoverable and runnable
// by ANY MCP host via prompts/list + prompts/get. Cursor's skill file still
// works as-is; this is the portable equivalent for other clients.
import type { Prompt, PromptMessage } from "@modelcontextprotocol/sdk/types.js";

export const PROMPT_META: Record<string, { domain: "qa" | "core" }> = {
  triage_qa_failure: { domain: "qa" },
};

export const prompts: Prompt[] = [
  {
    name: "triage_qa_failure",
    description:
      "Memory-before-browser triage for a failed/flaky Playwright test on a mortgage UI journey. Same hard rules as the mortgage-qa-triage Cursor skill, exposed natively over MCP so any host can run it.",
    arguments: [
      { name: "test_id", description: "Full test id, e.g. le_generation/apr visible", required: true },
      { name: "ci_failed", description: "true|false — was this triggered by a CI failure?", required: false },
      { name: "journey_id", description: "Override; otherwise derived from the test_id's [journey] tag", required: false },
    ],
  },
];

/** Render a prompt by name. Throws on an unknown prompt name. */
export function renderPrompt(name: string, args: Record<string, string>): PromptMessage[] {
  if (name !== "triage_qa_failure") throw new Error(`unknown_prompt: ${name}`);

  const testId = args.test_id ?? "";
  const journeyId = args.journey_id || testId.split("/")[0] || "";
  const ciFailed = args.ci_failed === "true";

  const text = `Investigate this Playwright failure using mortgage-qa-memory before opening a browser.

Target: test_id="${testId}", journey_id="${journeyId}", ci_failed=${ciFailed}.

Hard rules (never violate):
1. Memory before browser — call get_failure_signature / should_skip_browser / get_test_history first.
2. Never persist raw snapshots, prompts, stack traces, or network bodies to the memory MCP.
3. Never use browser_run_code_unsafe. Staging/UAT URLs only (policy allowlist).
4. If should_skip_browser returns skip: true — stop and report the known flake; do not open a browser.
5. record_run_summary accepts only: test_id, status, duration_ms, journey_id, error_class, error_hint (redacted), loan_scenario_id.
6. Synthetic loan scenarios only — never paste real borrower data.

Step 1 — Recall (mortgage-qa-memory MCP):
  get_failure_signature(test_id="${testId}")
  get_test_history(test_id="${testId}", limit=10)
  should_skip_browser(test_id="${testId}")

If should_skip_browser.skip is true: stop here, report the known flake, and go to Step 5.

Step 2 — Context (mortgage-qa-memory MCP):
  get_journey_map(journey_id="${journeyId}")
  get_env_facts(env, overlay_key)
  plan_qa_investigation(test_id="${testId}", ci_failed=${ciFailed})

Step 3 — Reproduce (playwright MCP — only if Step 1 said investigate):
  browser_navigate to the staging URL from the journey map; verify the failing checkpoint.
  Do not save browser_snapshot output to any file or memory tool.

Step 4 — Record (mortgage-qa-memory MCP):
  record_run_summary(test_id="${testId}", status, duration_ms, journey_id="${journeyId}", error_class, loan_scenario_id="synthetic-retail-01")

Step 5 — Report to the user:
  - Flake vs new-regression classification
  - Which checkpoint failed (if any)
  - Suggested human next step (fix locator PR, env issue, app bug)
  - Audit note that this was a policy-compliant, memory-first investigation

Escalate instead of proceeding if: a blocking TRID checkpoint fails on a release branch (-> QA lead + compliance smoke owner), or PII is detected in a CI error (-> platform team; do not store the error).`;

  return [{ role: "user", content: { type: "text", text } }];
}
