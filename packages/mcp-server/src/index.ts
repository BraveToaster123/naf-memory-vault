import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { tools, READ_TOOLS } from "./tools.js";
import {
  openDb,
  getPolicy,
  recordRunSummary,
  tagFailureSignature,
  rememberEnvFact,
  getFlakyTests,
  getTestHistory,
  getFailureSignature,
  getEnvFacts,
  shouldSkipBrowser,
  getJourneyMap,
  getComplianceCheckpoint,
  type Principal,
  type Role,
  type TestStatus,
  type Classification,
} from "@mqm/shared";
import { logAudit, getAuditTrail } from "@mqm/audit-client";

const policy = getPolicy();
const db = openDb();

const principal: Principal = {
  userId: process.env.MQM_USER_ID ?? "local-user",
  role: (process.env.MQM_USER_ROLE as Role) ?? "qa_engineer",
  displayName: process.env.MQM_USER_NAME,
};

const AUDIT_ROLES: Role[] = ["qa_lead", "qc_analyst", "platform"];

const server = new Server(
  { name: "mortgage-qa-memory", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
function fail(reason: string, extra: Record<string, unknown> = {}) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ error: "policy_denied", reason, policy_version: policy.version, ...extra }, null, 2),
      },
    ],
    isError: true,
  };
}

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const name = req.params.name;
  const args = (req.params.arguments ?? {}) as Record<string, unknown>;
  const isRead = READ_TOOLS.has(name);

  const audit = (outcome: "success" | "failure" | "blocked", summary: string) =>
    logAudit(db, {
      principal,
      actionClass: outcome === "blocked" ? "policy_block" : isRead ? "memory_read" : "memory_write",
      toolServer: "mortgage-qa-memory",
      toolName: name,
      argsSummary: summary,
      journeyId: typeof args.journey_id === "string" ? args.journey_id : undefined,
      loanScenarioId: typeof args.loan_scenario_id === "string" ? args.loan_scenario_id : undefined,
      environment: process.env.MQM_ENV,
      policyVersion: policy.version,
      outcome,
    });

  try {
    switch (name) {
      case "get_flaky_tests": {
        const data = getFlakyTests(db, {
          limit: num(args.limit),
          minRuns: num(args.min_runs),
          sinceDays: num(args.since_days),
        });
        audit("success", `returned=${data.length}`);
        return ok(data);
      }
      case "get_test_history": {
        const data = getTestHistory(db, String(args.test_id), num(args.limit) ?? 10);
        audit("success", `test=${String(args.test_id)}`);
        return ok(data);
      }
      case "get_failure_signature": {
        const data = getFailureSignature(db, {
          testId: String(args.test_id),
          errorClass: str(args.error_class),
          errorHint: str(args.error_hint),
        });
        audit("success", `test=${String(args.test_id)}`);
        return ok(data);
      }
      case "should_skip_browser": {
        const data = shouldSkipBrowser(db, { testId: String(args.test_id), errorClass: str(args.error_class) });
        audit("success", `test=${String(args.test_id)},skip=${data.skip}`);
        return ok(data);
      }
      case "get_env_facts": {
        const data = getEnvFacts(db, String(args.env), str(args.overlay_key));
        audit("success", `env=${String(args.env)}`);
        return ok(data);
      }
      case "get_journey_map": {
        const data = getJourneyMap(String(args.journey_id));
        audit("success", `journey=${String(args.journey_id)}`);
        return ok(data);
      }
      case "get_compliance_checkpoint": {
        const data = getComplianceCheckpoint(db, String(args.journey_id), String(args.checkpoint_id), num(args.since_days) ?? 30);
        audit("success", `checkpoint=${String(args.checkpoint_id)}`);
        return ok(data);
      }
      case "plan_qa_investigation": {
        const skip = shouldSkipBrowser(db, { testId: String(args.test_id) });
        const plan = buildPlan(String(args.test_id), Boolean(args.ci_failed), skip.skip);
        audit("success", `test=${String(args.test_id)}`);
        return ok({ ...plan, skip_browser: skip });
      }

      case "record_run_summary": {
        const res = recordRunSummary(
          db,
          {
            testId: String(args.test_id),
            status: args.status as TestStatus,
            durationMs: num(args.duration_ms) ?? 0,
            journeyId: str(args.journey_id),
            errorClass: str(args.error_class),
            errorMessage: str(args.error_hint),
            loanScenarioId: str(args.loan_scenario_id),
            env: process.env.MQM_ENV,
          },
          { tier: 1, tool: name, principal, policyVersion: policy.version },
        );
        if (res.decision.outcome !== "allow") {
          audit("blocked", res.decision.reason);
          return fail(res.decision.reason, { matched_pattern: res.decision.matchedPattern });
        }
        audit("success", `stored=${res.row?.id}`);
        return ok({ stored: true, id: res.row?.id, signature: res.row?.failure_signature });
      }
      case "tag_failure_signature": {
        const d = tagFailureSignature(
          db,
          { signature: String(args.signature), classification: args.classification as Classification, notes: str(args.notes) },
          { tier: 1, tool: name, principal, policyVersion: policy.version },
        );
        if (d.outcome !== "allow") {
          audit("blocked", d.reason);
          return fail(d.reason);
        }
        audit("success", `sig=${String(args.signature)}`);
        return ok({ tagged: true });
      }
      case "remember_env_fact": {
        const d = rememberEnvFact(
          db,
          { env: String(args.env), fact: String(args.fact), overlayKey: str(args.overlay_key) },
          { tier: 1, tool: name, principal, policyVersion: policy.version },
        );
        if (d.outcome !== "allow") {
          audit("blocked", d.reason);
          return fail(d.reason);
        }
        audit("success", `env=${String(args.env)}`);
        return ok({ stored: true });
      }

      case "upsert_locator": {
        // Tier 2 is human-PR only. We never write directly.
        audit("blocked", "tier2_requires_pr_approval");
        return fail("tier2_requires_pr_approval", {
          next_step: "Open a PR to journeys/locators/ with the proposed selector for QA lead review.",
        });
      }

      case "get_audit_trail": {
        if (!AUDIT_ROLES.includes(principal.role)) {
          audit("blocked", "rbac_denied");
          return fail("rbac_denied", { required_roles: AUDIT_ROLES });
        }
        const data = getAuditTrail(db, {
          startDate: String(args.start_date),
          endDate: String(args.end_date),
          journeyId: str(args.journey_id),
          loanScenarioId: str(args.loan_scenario_id),
        });
        audit("success", `rows=${data.length}`);
        return ok(data);
      }

      default:
        return fail("unknown_tool", { tool: name });
    }
  } catch (e) {
    audit("failure", "exception");
    return fail("internal_error", { message: e instanceof Error ? e.message : String(e) });
  }
});

function buildPlan(testId: string, ciFailed: boolean, skip: boolean) {
  const steps = [
    { step: 1, tool: "get_failure_signature", args: { test_id: testId } },
    { step: 2, tool: "get_test_history", args: { test_id: testId } },
    { step: 3, tool: "should_skip_browser", args: { test_id: testId } },
  ];
  if (!skip) {
    steps.push(
      { step: 4, tool: "get_journey_map", args: { journey_id: testId.split("/")[0] ?? "" } as never },
      { step: 5, tool: "playwright:browser_navigate", args: { note: "staging allowlist only" } as never },
      { step: 6, tool: "record_run_summary", args: { test_id: testId } as never },
    );
  }
  return { ci_failed: ciFailed, ordered_plan: steps };
}

function num(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}
function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

const transport = new StdioServerTransport();
await server.connect(transport);
// eslint-disable-next-line no-console
console.error(`[mortgage-qa-memory] MCP server ready (role=${principal.role}, policy=${policy.version}).`);
