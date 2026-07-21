import type { DB } from "./db.js";
import { searchNodes } from "./kg.js";
import { shouldSkipBrowser } from "./queries.js";

export type WorkflowIntent =
  | "triage_failure"
  | "check_story_status"
  | "explore_story"
  | "write_test_cases"
  | "publish_test_cases"
  | "generate_automation";

export interface WorkflowPlanStep {
  step: number;
  tool: string;
  args: Record<string, unknown>;
}

export interface WorkflowPlan {
  workflow: "ci_triage" | "story_pipeline";
  intent: WorkflowIntent;
  stage: string;
  memory_first: boolean;
  ordered_plan: WorkflowPlanStep[];
  suggested_prompt?: string;
  suggested_skill?: string;
  blockers: string[];
  policy_reminders: string[];
}

export interface PlanQaWorkflowInput {
  intent?: WorkflowIntent;
  test_id?: string;
  user_story_id?: string;
  error_class?: string;
  ci_failed?: boolean;
  namespace?: string;
}

const POLICY_REMINDERS = [
  "credentials never in graph — use host credential_ref",
  "no raw snapshots, stack traces, or network bodies in memory writes",
  "synthetic loan scenarios only",
  "staging/UAT URLs only for browser repro",
];

export function resolveIntent(input: PlanQaWorkflowInput): WorkflowIntent {
  if (input.intent) return input.intent;
  if (input.test_id) return "triage_failure";
  if (input.user_story_id) return "check_story_status";
  throw new Error("intent_required: provide intent, test_id, or user_story_id");
}

export function storyEntityPrefix(storyId: string): string {
  return `US_${storyId.replace(/^US\s*/i, "").trim()}_`;
}

export function detectStoryStage(
  storyId: string,
  entityNames: string[],
): { stage: string; acCount: number; hasSummary: boolean; hasTestCases: boolean } {
  const id = storyId.replace(/^US\s*/i, "").trim();
  const prefix = `US_${id}_`;
  const relevant = entityNames.filter((n) => n.startsWith(prefix) || n === `US_${id}`);
  if (relevant.length === 0) {
    return { stage: "not_explored", acCount: 0, hasSummary: false, hasTestCases: false };
  }
  const acCount = relevant.filter((n) => /^US_\d+_AC\d+$/i.test(n)).length;
  const hasSummary = relevant.includes(`US_${id}_Summary`);
  const hasTestCases = relevant.includes(`US_${id}_TestCases`);
  if (hasTestCases) return { stage: "test_cases_published", acCount, hasSummary, hasTestCases };
  if (acCount > 0 || hasSummary) return { stage: "explored", acCount, hasSummary, hasTestCases };
  return { stage: "partial", acCount, hasSummary, hasTestCases };
}

export function buildTriagePlan(testId: string, ciFailed: boolean, skipBrowser: boolean): WorkflowPlan {
  const steps: WorkflowPlanStep[] = [
    { step: 1, tool: "get_failure_signature", args: { test_id: testId, error_class: undefined } },
    { step: 2, tool: "get_test_history", args: { test_id: testId, limit: 10 } },
    { step: 3, tool: "should_skip_browser", args: { test_id: testId } },
  ];
  if (!skipBrowser) {
    const journeyId = testId.split("/")[0] ?? testId;
    steps.push(
      { step: 4, tool: "get_journey_map", args: { journey_id: journeyId } },
      { step: 5, tool: "get_env_facts", args: { env: "staging" } },
      { step: 6, tool: "playwright:browser_navigate", args: { note: "staging allowlist only" } },
      { step: 7, tool: "record_run_summary", args: { test_id: testId } },
    );
  }
  return {
    workflow: "ci_triage",
    intent: "triage_failure",
    stage: skipBrowser ? "known_flake" : "investigate",
    memory_first: true,
    ordered_plan: steps,
    suggested_prompt: "triage_qa_failure",
    suggested_skill: "memory-vault-triage",
    blockers: [],
    policy_reminders: POLICY_REMINDERS,
  };
}

function storyStatusPlan(
  storyId: string,
  namespace: string,
  stageInfo: ReturnType<typeof detectStoryStage>,
): WorkflowPlan {
  const id = storyId.replace(/^US\s*/i, "").trim();
  const steps: WorkflowPlanStep[] = [
    { step: 1, tool: "search_nodes", args: { query: `US_${id}`, namespace } },
    { step: 2, tool: "open_nodes", args: { names: [`US_${id}_Summary`], namespace } },
  ];
  const blockers: string[] = [];
  let suggested_skill: string | undefined;
  let suggested_prompt: string | undefined;

  if (stageInfo.stage === "not_explored") {
    blockers.push(`No exploration data for US ${id}. Run explore_story when Flow 1 pilot is active.`);
    suggested_skill = "memory-vault-assist";
  } else if (stageInfo.stage === "explored") {
    suggested_skill = "memory-vault-assist";
    suggested_prompt = "lookup_story_status";
  }

  return {
    workflow: "story_pipeline",
    intent: "check_story_status",
    stage: stageInfo.stage,
    memory_first: true,
    ordered_plan: steps,
    suggested_prompt,
    suggested_skill,
    blockers,
    policy_reminders: POLICY_REMINDERS,
  };
}

function flow1Plan(
  intent: WorkflowIntent,
  storyId: string,
  namespace: string,
  stageInfo: ReturnType<typeof detectStoryStage>,
): WorkflowPlan {
  const id = storyId.replace(/^US\s*/i, "").trim();
  const blockers: string[] = [];
  let stage = stageInfo.stage;
  let suggested_prompt: string | undefined;
  let suggested_skill = "memory-vault-assist";
  const steps: WorkflowPlanStep[] = [
    { step: 1, tool: "search_nodes", args: { query: `US_${id}`, namespace } },
  ];

  if (intent === "explore_story") {
    suggested_prompt = "explore_acceptance_criteria";
    if (stageInfo.stage !== "not_explored") {
      blockers.push(`US ${id} already has exploration data (${stageInfo.acCount} AC entities).`);
    }
    steps.push({ step: 2, tool: "playwright:browser_navigate", args: { note: "AC-only exploration; staging allowlist" } });
    stage = "explore_pending";
  } else if (intent === "write_test_cases") {
    suggested_prompt = "write_test_cases";
    if (stageInfo.acCount === 0 && !stageInfo.hasSummary) {
      blockers.push(`No US_${id}_AC* entities. Run explore_story first.`);
    }
    steps.push({ step: 2, tool: "open_nodes", args: { names: [`US_${id}_Summary`], namespace } });
    stage = "write_test_cases";
  } else if (intent === "publish_test_cases") {
    suggested_prompt = "publish_test_cases";
    blockers.push("Flow 1 ADO publisher deferred until QA profile + ADO MCP are wired.");
    stage = "publish_blocked";
  } else if (intent === "generate_automation") {
    suggested_prompt = "generate_automation";
    if (!stageInfo.hasTestCases && stageInfo.acCount === 0) {
      blockers.push(`No exploration or test case data for US ${id}.`);
    }
    stage = "automation_blocked";
    blockers.push("Flow 1 automation generator deferred until pilot confirms scope.");
  }

  return {
    workflow: "story_pipeline",
    intent,
    stage,
    memory_first: true,
    ordered_plan: steps,
    suggested_prompt,
    suggested_skill,
    blockers,
    policy_reminders: POLICY_REMINDERS,
  };
}

/** Governed workflow router — inspects memory and returns ordered next steps. */
export function planQaWorkflow(db: DB, input: PlanQaWorkflowInput): WorkflowPlan {
  const intent = resolveIntent(input);
  const namespace = input.namespace ?? "qa";

  if (intent === "triage_failure") {
    const testId = input.test_id;
    if (!testId) throw new Error("test_id_required for triage_failure");
    const skip = shouldSkipBrowser(db, { testId, errorClass: input.error_class });
    return buildTriagePlan(testId, Boolean(input.ci_failed), skip.skip);
  }

  const storyId = input.user_story_id;
  if (!storyId) throw new Error("user_story_id_required for story pipeline intents");

  const graph = searchNodes(db, namespace, storyEntityPrefix(storyId));
  const entityNames = graph.entities.map((e) => e.name);
  const stageInfo = detectStoryStage(storyId, entityNames);

  if (intent === "check_story_status") {
    return storyStatusPlan(storyId, namespace, stageInfo);
  }

  return flow1Plan(intent, storyId, namespace, stageInfo);
}
