/**
 * End-to-end MCP smoke test. Spawns the server over stdio, lists tools, calls a
 * read tool, a gated write, and a denied Tier 2 write, then verifies audit rows.
 *
 *   npm run smoke   (run `npm run seed:demo` first)
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { openDb } from "@memory-vault/shared";

function textOf(res: { content?: Array<{ type: string; text?: string }> }): string {
  return res.content?.find((c) => c.type === "text")?.text ?? "";
}

async function main(): Promise<void> {
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", "packages/mcp-server/src/index.ts"],
    env: { ...process.env, MEMORY_VAULT_USER_ROLE: "qa_engineer", MEMORY_VAULT_ENV: "local" } as Record<string, string>,
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

  // Core knowledge-graph memory — superset of @modelcontextprotocol/server-memory.
  const created = await client.callTool({
    name: "create_entities",
    arguments: {
      entities: [
        { name: "le_generation", entityType: "journey", observations: ["APR label flaky on staging"] },
        { name: "dirty_entity", entityType: "note", observations: ["borrower 123-45-6789 seen"] },
      ],
    },
  });
  console.log("\ncreate_entities (1 allowed, 1 PII-denied):\n" + textOf(created as never));

  const relations = await client.callTool({
    name: "create_relations",
    arguments: {
      relations: [
        // dirty_entity never got created above (PII-denied), so this edge is
        // rejected too — the graph never accumulates dangling relations.
        { from: "le_generation", to: "dirty_entity", relationType: "references" },
      ],
    },
  });
  console.log("\ncreate_relations (expect denied: entity_not_found):\n" + textOf(relations as never));

  const graph = await client.callTool({ name: "read_graph", arguments: {} });
  console.log("\nread_graph (qa namespace):\n" + textOf(graph as never));

  const search = await client.callTool({ name: "search_nodes", arguments: { query: "flaky" } });
  console.log("\nsearch_nodes('flaky'):\n" + textOf(search as never));

  const opsDenied = await client.callTool({ name: "read_graph", arguments: { namespace: "compliance" } });
  console.log("\nread_graph(compliance) as qa_engineer (expect namespace_rbac_denied):\n" + textOf(opsDenied as never));

  const resources = await client.listResources();
  console.log("\nresources:", resources.resources.map((r) => r.uri).join(", "));

  await client.close();

  const db = openDb();
  const n = db.prepare("SELECT COUNT(*) AS n FROM audit_events").get() as { n: number };
  const blocked = db.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE action_class = 'policy_block'").get() as { n: number };
  const kgEntities = db.prepare("SELECT COUNT(*) AS n FROM kg_entities WHERE namespace = 'qa'").get() as { n: number };
  db.close();
  console.log(`\naudit_events rows: ${n.n} (policy_block: ${blocked.n})`);
  console.log(`kg_entities rows (qa): ${kgEntities.n}`);
  if (n.n < 4) {
    console.error("SMOKE FAIL: expected an audit row per tool call");
    process.exit(1);
  }
  if (kgEntities.n < 1) {
    console.error("SMOKE FAIL: expected create_entities to persist at least one entity");
    process.exit(1);
  }
  console.log("SMOKE PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
