/**
 * Emit a machine-readable tool manifest so other tools (e.g. a knowledge MCP,
 * a registry, or a doc generator) can discover this server's contract without
 * parsing TypeScript or launching the server.
 *
 *   npm run manifest      -> writes docs/tools.json
 *   npm run manifest -- -  -> prints JSON to stdout
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getPolicy } from "@memory-vault/shared";
import { tools, TOOL_META } from "./tools.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");

export interface ToolManifestEntry {
  name: string;
  description: string;
  kind: string;
  tier: number | null;
  domain: string;
  input_schema: unknown;
}

export interface ToolManifest {
  server: string;
  version: string;
  transport: "stdio";
  policy_version: string;
  /** How another tool authenticates the caller's role. */
  rbac: { role_env: "MEMORY_VAULT_USER_ROLE"; audit_roles: string[] };
  domains: string[];
  tools: ToolManifestEntry[];
}

export function buildManifest(): ToolManifest {
  const entries: ToolManifestEntry[] = tools.map((t) => {
    const meta = TOOL_META[t.name] ?? { kind: "read", tier: null, domain: "qa" };
    return {
      name: t.name,
      description: t.description ?? "",
      kind: meta.kind,
      tier: meta.tier,
      domain: meta.domain,
      input_schema: t.inputSchema,
    };
  });
  return {
    server: "memory-vault",
    version: "0.1.0",
    transport: "stdio",
    policy_version: getPolicy().version,
    rbac: { role_env: "MEMORY_VAULT_USER_ROLE", audit_roles: ["qa_lead", "qc_analyst", "platform"] },
    domains: [...new Set(entries.map((e) => e.domain))],
    tools: entries,
  };
}

const manifest = buildManifest();
const json = JSON.stringify(manifest, null, 2);

if (process.argv.includes("-")) {
  process.stdout.write(json + "\n");
} else {
  const outDir = resolve(repoRoot, "docs");
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, "tools.json");
  writeFileSync(outPath, json + "\n", "utf8");
  // eslint-disable-next-line no-console
  console.log(`[manifest] wrote ${manifest.tools.length} tools -> ${outPath}`);
}
