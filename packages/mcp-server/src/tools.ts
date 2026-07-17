import type { Tool } from "@modelcontextprotocol/sdk/types.js";

/**
 * Tool catalog for the mortgage-qa-memory MCP server.
 *
 * ENGINE vs DOMAIN seam (for reuse across namespaces):
 *  - `domain: "core"`  -> generic memory-platform capability (policy, audit,
 *                          retention). Reusable as-is for any namespace.
 *  - `domain: "qa"`    -> mortgage-QA-specific surface (flake, journeys, TRID).
 *                          Swap these for a `pr`/`ops`/`compliance` domain pack.
 *
 * `kind` and `tier` describe the write model:
 *  - read           : no write, audited as memory_read
 *  - write          : Tier 0/1 gated write through the save pipeline
 *  - tier2_approval : never a direct write; returns require_approval (human PR)
 *  - audit          : QC/compliance query, RBAC-restricted
 */
export type ToolKind = "read" | "write" | "tier2_approval" | "audit";
export type ToolDomain = "core" | "qa";

export interface ToolMeta {
  kind: ToolKind;
  tier: 0 | 1 | 2 | null;
  domain: ToolDomain;
}

export const TOOL_META: Record<string, ToolMeta> = {
  get_flaky_tests: { kind: "read", tier: 1, domain: "qa" },
  get_test_history: { kind: "read", tier: 1, domain: "qa" },
  get_failure_signature: { kind: "read", tier: 1, domain: "qa" },
  should_skip_browser: { kind: "read", tier: 1, domain: "qa" },
  get_env_facts: { kind: "read", tier: 1, domain: "qa" },
  get_journey_map: { kind: "read", tier: 2, domain: "qa" },
  get_compliance_checkpoint: { kind: "read", tier: 2, domain: "qa" },
  plan_qa_investigation: { kind: "read", tier: null, domain: "qa" },
  record_run_summary: { kind: "write", tier: 1, domain: "qa" },
  tag_failure_signature: { kind: "write", tier: 1, domain: "qa" },
  remember_env_fact: { kind: "write", tier: 1, domain: "qa" },
  upsert_locator: { kind: "tier2_approval", tier: 2, domain: "qa" },
  get_audit_trail: { kind: "audit", tier: null, domain: "core" },

  // Core knowledge-graph memory — generic engine (kg.ts), namespace-isolated.
  // Same tool surface as @modelcontextprotocol/server-memory, plus policy
  // pre-save (PII deny, namespace RBAC), TTL, and audit.
  create_entities: { kind: "write", tier: 1, domain: "core" },
  create_relations: { kind: "write", tier: 1, domain: "core" },
  add_observations: { kind: "write", tier: 1, domain: "core" },
  delete_entities: { kind: "write", tier: 1, domain: "core" },
  delete_observations: { kind: "write", tier: 1, domain: "core" },
  delete_relations: { kind: "write", tier: 1, domain: "core" },
  read_graph: { kind: "read", tier: 1, domain: "core" },
  search_nodes: { kind: "read", tier: 1, domain: "core" },
  open_nodes: { kind: "read", tier: 1, domain: "core" },
};

export const tools: Tool[] = [
  {
    name: "get_flaky_tests",
    description: "Rank tests by flake rate over the active Tier 1 window. Call this first during triage.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Default 20" },
        min_runs: { type: "number", description: "Default 5" },
        since_days: { type: "number", description: "Default 30" },
      },
    },
  },
  {
    name: "get_test_history",
    description: "Recent run history for one test (no raw error text — class + signature only).",
    inputSchema: {
      type: "object",
      properties: { test_id: { type: "string" }, limit: { type: "number" } },
      required: ["test_id"],
    },
  },
  {
    name: "get_failure_signature",
    description: "Match a failure to a known signature cluster and get a skip/investigate recommendation.",
    inputSchema: {
      type: "object",
      properties: {
        test_id: { type: "string" },
        error_class: { type: "string" },
        error_hint: { type: "string", description: "Truncated message; redacted before matching" },
      },
      required: ["test_id"],
    },
  },
  {
    name: "should_skip_browser",
    description: "Decision tool — returns whether a known stable flake means you can skip opening Playwright.",
    inputSchema: {
      type: "object",
      properties: { test_id: { type: "string" }, error_class: { type: "string" } },
      required: ["test_id"],
    },
  },
  {
    name: "get_env_facts",
    description: "Non-PII environment quirks for an env/overlay (e.g. 'UAT SSO is slow').",
    inputSchema: {
      type: "object",
      properties: { env: { type: "string" }, overlay_key: { type: "string" } },
      required: ["env"],
    },
  },
  {
    name: "get_journey_map",
    description: "Load a Tier 2 curated journey (steps + TRID checkpoints) by id.",
    inputSchema: {
      type: "object",
      properties: { journey_id: { type: "string" } },
      required: ["journey_id"],
    },
  },
  {
    name: "get_compliance_checkpoint",
    description: "Checkpoint definition plus recent pass/fail runs for a journey.",
    inputSchema: {
      type: "object",
      properties: {
        journey_id: { type: "string" },
        checkpoint_id: { type: "string" },
        since_days: { type: "number" },
      },
      required: ["journey_id", "checkpoint_id"],
    },
  },
  {
    name: "plan_qa_investigation",
    description: "Return an ordered tool plan (memory first, browser only if needed).",
    inputSchema: {
      type: "object",
      properties: { test_id: { type: "string" }, ci_failed: { type: "boolean" } },
      required: ["test_id"],
    },
  },
  {
    name: "record_run_summary",
    description: "Tier 1 write. Persist an allowlisted, policy-gated run summary. Denied fields (snapshot/stack/prompt) are rejected.",
    inputSchema: {
      type: "object",
      properties: {
        test_id: { type: "string" },
        status: { type: "string", enum: ["passed", "failed", "flaky", "skipped"] },
        duration_ms: { type: "number" },
        journey_id: { type: "string" },
        error_class: { type: "string" },
        error_hint: { type: "string" },
        loan_scenario_id: { type: "string" },
      },
      required: ["test_id", "status", "duration_ms"],
    },
  },
  {
    name: "tag_failure_signature",
    description: "Tier 1 write. Classify a known failure signature as flake | regression | env.",
    inputSchema: {
      type: "object",
      properties: {
        signature: { type: "string" },
        classification: { type: "string", enum: ["flake", "regression", "env"] },
        notes: { type: "string" },
      },
      required: ["signature", "classification"],
    },
  },
  {
    name: "remember_env_fact",
    description: "Tier 1 write. Store a human-provided environment quirk (not agent-inferred page content).",
    inputSchema: {
      type: "object",
      properties: {
        env: { type: "string" },
        fact: { type: "string" },
        overlay_key: { type: "string" },
      },
      required: ["env", "fact"],
    },
  },
  {
    name: "upsert_locator",
    description: "Tier 2 (approval required). Opens a draft PR to journeys/locators — never writes directly.",
    inputSchema: {
      type: "object",
      properties: {
        app: { type: "string" },
        element_key: { type: "string" },
        selector: { type: "string" },
        app_version: { type: "string" },
      },
      required: ["app", "element_key", "selector", "app_version"],
    },
  },
  {
    name: "get_audit_trail",
    description: "QC query (qa_lead/qc_analyst/platform only). Audit metadata rows — no prompts/snapshots.",
    inputSchema: {
      type: "object",
      properties: {
        start_date: { type: "string" },
        end_date: { type: "string" },
        journey_id: { type: "string" },
        loan_scenario_id: { type: "string" },
      },
      required: ["start_date", "end_date"],
    },
  },

  // ── Core knowledge-graph memory ──────────────────────────────────────
  // Drop-in superset of @modelcontextprotocol/server-memory's tool surface.
  // Every tool accepts an optional `namespace` (default "qa"; one of
  // qa | pr | ops | compliance | product, see doc 09) — reads/writes are
  // scoped to that namespace and gated by policy RBAC + PII deny.
  {
    name: "create_entities",
    description:
      "Core memory write. Create entities (name, entityType, observations[]). Ignores names that already exist — use add_observations to extend one. Policy-gated: PII/secret patterns in any field deny that entity only.",
    inputSchema: {
      type: "object",
      properties: {
        entities: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              entityType: { type: "string" },
              observations: { type: "array", items: { type: "string" } },
            },
            required: ["name", "entityType"],
          },
        },
        namespace: { type: "string", description: "qa | pr | ops | compliance | product. Default qa." },
      },
      required: ["entities"],
    },
  },
  {
    name: "create_relations",
    description: "Core memory write. Create directed relations (from, to, relationType) in active voice. Ignores exact duplicates.",
    inputSchema: {
      type: "object",
      properties: {
        relations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              from: { type: "string" },
              to: { type: "string" },
              relationType: { type: "string" },
            },
            required: ["from", "to", "relationType"],
          },
        },
        namespace: { type: "string" },
      },
      required: ["relations"],
    },
  },
  {
    name: "add_observations",
    description: "Core memory write. Append new observation strings to existing entities. Entities that don't exist are reported, not created.",
    inputSchema: {
      type: "object",
      properties: {
        observations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              entityName: { type: "string" },
              contents: { type: "array", items: { type: "string" } },
            },
            required: ["entityName", "contents"],
          },
        },
        namespace: { type: "string" },
      },
      required: ["observations"],
    },
  },
  {
    name: "delete_entities",
    description: "Core memory write. Delete entities by name, cascading their observations and any relation touching them.",
    inputSchema: {
      type: "object",
      properties: {
        entityNames: { type: "array", items: { type: "string" } },
        namespace: { type: "string" },
      },
      required: ["entityNames"],
    },
  },
  {
    name: "delete_observations",
    description: "Core memory write. Remove specific observation strings from named entities.",
    inputSchema: {
      type: "object",
      properties: {
        deletions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              entityName: { type: "string" },
              observations: { type: "array", items: { type: "string" } },
            },
            required: ["entityName", "observations"],
          },
        },
        namespace: { type: "string" },
      },
      required: ["deletions"],
    },
  },
  {
    name: "delete_relations",
    description: "Core memory write. Remove exact-match relations (from, to, relationType).",
    inputSchema: {
      type: "object",
      properties: {
        relations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              from: { type: "string" },
              to: { type: "string" },
              relationType: { type: "string" },
            },
            required: ["from", "to", "relationType"],
          },
        },
        namespace: { type: "string" },
      },
      required: ["relations"],
    },
  },
  {
    name: "read_graph",
    description: "Core memory read. Return the full (non-expired) knowledge graph for a namespace.",
    inputSchema: {
      type: "object",
      properties: { namespace: { type: "string" } },
    },
  },
  {
    name: "search_nodes",
    description: "Core memory read. Substring search (case-insensitive) across entity name, type, and observation content within a namespace.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" }, namespace: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "open_nodes",
    description: "Core memory read. Fetch specific named entities plus relations strictly between them.",
    inputSchema: {
      type: "object",
      properties: {
        names: { type: "array", items: { type: "string" } },
        namespace: { type: "string" },
      },
      required: ["names"],
    },
  },
];

/** Read-only tool names (derived from TOOL_META). */
export const READ_TOOLS = new Set(
  Object.entries(TOOL_META)
    .filter(([, m]) => m.kind === "read")
    .map(([name]) => name),
);
