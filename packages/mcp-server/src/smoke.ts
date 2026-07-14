/**
 * End-to-end MCP smoke test. Spawns the server over stdio, lists tools, calls a
 * read tool, a gated write, and a denied Tier 2 write, then verifies audit rows.
 *
 *   npm run smoke   (run `npm run seed:demo` first)
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { openDb } from "@mqm/shared";

function textOf(res: { content?: Array<{ type: string; text?: string }> }): string {
  return res.content?.find((c) => c.type === "text")?.text ?? "";
}

async function main(): Promise<void> {
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", "packages/mcp-server/src/index.ts"],
    env: { ...process.env, MQM_USER_ROLE: "qa_engineer", MQM_ENV: "local" } as Record<string, string>,
  });
  const client = new Client({ name: "mqm-smoke", version: "0.1.0" });
  await client.connect(transport);

  const { tools } = await client.listTools();
  console.log(`tools: ${tools.length} ->`, tools.map((t) => t.name).join(", "));

  const flaky = await client.callTool({ name: "get_flaky_tests", arguments: { limit: 5 } });
  console.log("\nget_flaky_tests:\n" + textOf(flaky as never));

  const skip = await client.callTool({
    name: "should_skip_browser",
    arguments: { test_id: "le_generation/apr visible" },
  });
  console.log("\nshould_skip_browser:\n" + textOf(skip as never));

  const denied = await client.callTool({
    name: "record_run_summary",
    arguments: {
      test_id: "le_generation/apr visible",
      status: "failed",
      duration_ms: 900,
      error_class: "AssertionError",
      error_hint: "borrower 123-45-6789 mismatch",
      loan_scenario_id: "synthetic-retail-01",
    },
  });
  console.log("\nrecord_run_summary (PII in error, expect denied):\n" + textOf(denied as never));

  const tier2 = await client.callTool({
    name: "upsert_locator",
    arguments: { app: "lo", element_key: "apr", selector: "#apr", app_version: "2.14.0" },
  });
  console.log("\nupsert_locator (expect require_approval):\n" + textOf(tier2 as never));

  await client.close();

  const db = openDb();
  const n = db.prepare("SELECT COUNT(*) AS n FROM audit_events").get() as { n: number };
  const blocked = db.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE action_class = 'policy_block'").get() as { n: number };
  db.close();
  console.log(`\naudit_events rows: ${n.n} (policy_block: ${blocked.n})`);
  if (n.n < 4) {
    console.error("SMOKE FAIL: expected an audit row per tool call");
    process.exit(1);
  }
  console.log("SMOKE PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
