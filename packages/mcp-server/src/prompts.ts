// MCP-native prompt catalog — portable workflows for memory-vault MCP hosts.
import type { Prompt, PromptMessage } from "@modelcontextprotocol/sdk/types.js";

export const PROMPT_META: Record<string, { domain: "qa" | "core" }> = {
  triage_qa_failure: { domain: "qa" },
  lookup_story_status: { domain: "qa" },
  explore_acceptance_criteria: { domain: "qa" },
  write_test_cases: { domain: "qa" },
  publish_test_cases: { domain: "qa" },
  generate_automation: { domain: "qa" },
};

const FLOW1_POLICY = `Hard rules (never violate):
1. Credentials never in memory — resolve from host credential_ref / env only.
2. Never persist raw snapshots, prompts, stack traces, or network bodies to memory-vault.
3. Never use browser_run_code_unsafe. Staging/UAT URLs only (policy allowlist).
4. Synthetic loan scenarios only — never paste real borrower data.
5. If plan_qa_workflow returns blockers — stop and report them; do not proceed.`;

function normalizeStoryId(raw: string): string {
  return raw.replace(/^US\s*/i, "").trim();
}

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
  {
    name: "explore_acceptance_criteria",
    description: "Explore ADO acceptance criteria in staging via Playwright; store US_{ID}_AC{N} entities.",
    arguments: [
      { name: "user_story_id", description: "ADO user story ID", required: true },
    ],
  },
  {
    name: "write_test_cases",
    description: "Write ADO-format manual test cases from exploration memory (memory-only, no browser).",
    arguments: [
      { name: "user_story_id", description: "ADO user story ID", required: true },
    ],
  },
  {
    name: "publish_test_cases",
    description: "Publish draft test cases to Azure DevOps after human confirmation.",
    arguments: [
      { name: "user_story_id", description: "ADO user story ID", required: true },
    ],
  },
  {
    name: "generate_automation",
    description: "Generate NUnit + Playwright C# automation from exploration memory and codebase.",
    arguments: [
      { name: "user_story_id", description: "ADO user story ID", required: true },
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
    const storyId = normalizeStoryId(args.user_story_id ?? "");
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

  if (name === "explore_acceptance_criteria") {
    const storyId = normalizeStoryId(args.user_story_id ?? "");
    const text = `Explore acceptance criteria for user story US ${storyId} in staging.

Start with: plan_qa_workflow(intent=explore_story, user_story_id="${storyId}")

Then invoke @ac-explorer ${storyId} (or follow memory-vault-explore skill).

${FLOW1_POLICY}

Store per AC: US_${storyId}_AC{N} with status, steps, locators, expected.
Store summary: US_${storyId}_Summary with locator_catalog.
AC-only actions — no exploratory detours.`;

    return [{ role: "user", content: { type: "text", text } }];
  }

  if (name === "write_test_cases") {
    const storyId = normalizeStoryId(args.user_story_id ?? "");
    const text = `Write ADO-format manual test cases for user story US ${storyId} from exploration memory.

Start with: plan_qa_workflow(intent=write_test_cases, user_story_id="${storyId}")

Then invoke @testcase-writer US ${storyId} (or follow memory-vault-write-tcs skill).

${FLOW1_POLICY}

Rules:
- Memory-only — no browser access.
- One test case per AC; steps from US_${storyId}_AC{N} entities only.
- After writing, store US_${storyId}_TestCasesDraft with draft TC content.`;

    return [{ role: "user", content: { type: "text", text } }];
  }

  if (name === "publish_test_cases") {
    const storyId = normalizeStoryId(args.user_story_id ?? "");
    const text = `Publish manual test cases for user story US ${storyId} to Azure DevOps.

Start with: plan_qa_workflow(intent=publish_test_cases, user_story_id="${storyId}")

Then invoke @ado-publisher US ${storyId} (or follow memory-vault-publish skill).

${FLOW1_POLICY}

Rules:
- Read US_${storyId}_TestCasesDraft from memory.
- Ask user to confirm before creating ADO work items.
- After publish, store US_${storyId}_TestCases with created TC IDs.`;

    return [{ role: "user", content: { type: "text", text } }];
  }

  if (name === "generate_automation") {
    const storyId = normalizeStoryId(args.user_story_id ?? "");
    const text = `Generate NUnit + Playwright C# automation for user story US ${storyId}.

Start with: plan_qa_workflow(intent=generate_automation, user_story_id="${storyId}")

Then invoke @automation-generator for US ${storyId} (or follow memory-vault-generate skill).

${FLOW1_POLICY}

Rules:
- Read US_${storyId}_AC{N}, US_${storyId}_Summary, US_${storyId}_TestCases from memory.
- Reuse existing NAFLink page objects and helpers — no duplicate locators.
- Happy path only. Run dotnet build + dotnet test before marking complete.
- Human PR review required before merge.`;

    return [{ role: "user", content: { type: "text", text } }];
  }

  throw new Error(`unknown_prompt: ${name}`);
}
