// MCP-native prompt catalog — portable workflows for memory-vault MCP hosts.
import type { Prompt, PromptMessage } from "@modelcontextprotocol/sdk/types.js";

export const PROMPT_META: Record<string, { domain: "qa" | "core" }> = {
  triage_qa_failure: { domain: "qa" },
  lookup_story_status: { domain: "qa" },
};

export const prompts: Prompt[] = [
  {
    name: "triage_qa_failure",
    description:
      "Memory-before-browser triage for a failed/flaky Playwright test. Same hard rules as memory-vault-triage skill.",
    arguments: [
      { name: "test_id", description: "Full test id, e.g. le_generation/apr visible", required: true },
      { name: "ci_failed", description: "true|false — was this triggered by a CI failure?", required: false },
      { name: "journey_id", description: "Override; otherwise derived from the test_id's [journey] tag", required: false },
    ],
  },
  {
    name: "lookup_story_status",
    description: "Read-only story pipeline status from memory-vault KG (US_{ID}_* entities).",
    arguments: [
      { name: "user_story_id", description: "ADO user story ID, e.g. 471244", required: true },
    ],
  },
];

/** Render a prompt by name. Throws on an unknown prompt name. */
export function renderPrompt(name: string, args: Record<string, string>): PromptMessage[] {
  if (name === "triage_qa_failure") {
    const testId = args.test_id ?? "";
    const journeyId = args.journey_id || testId.split("/")[0] || "";
    const ciFailed = args.ci_failed === "true";

    const text = `Investigate this Playwright failure using memory-vault before opening a browser.

Target: test_id="${testId}", journey_id="${journeyId}", ci_failed=${ciFailed}.

Start with: plan_qa_workflow(intent=triage_failure, test_id="${testId}", ci_failed=${ciFailed})

Hard rules (never violate):
1. Memory before browser — call get_failure_signature / should_skip_browser / get_test_history first.
2. Never persist raw snapshots, prompts, stack traces, or network bodies to the memory MCP.
3. Never use browser_run_code_unsafe. Staging/UAT URLs only (policy allowlist).
4. If should_skip_browser returns skip: true — stop and report the known flake; do not open a browser.
5. record_run_summary accepts only: test_id, status, duration_ms, journey_id, error_class, error_hint (redacted), loan_scenario_id.
6. Synthetic loan scenarios only — never paste real borrower data.

Follow ordered_plan from plan_qa_workflow. Report flake vs regression and suggested human next step.`;

    return [{ role: "user", content: { type: "text", text } }];
  }

  if (name === "lookup_story_status") {
    const storyId = (args.user_story_id ?? "").replace(/^US\s*/i, "").trim();
    const text = `Look up exploration and pipeline status for user story US ${storyId}.

Start with: plan_qa_workflow(intent=check_story_status, user_story_id="${storyId}")

Then:
1. search_nodes(query="US_${storyId}", namespace=qa)
2. open_nodes for US_${storyId}_Summary and US_${storyId}_AC* entities
3. Report stage, AC count, locators found, and suggested next step

Read-only — do not write to memory unless user explicitly asks to note something.
Never fabricate data; cite memory-vault as the source.`;

    return [{ role: "user", content: { type: "text", text } }];
  }

  throw new Error(`unknown_prompt: ${name}`);
}
