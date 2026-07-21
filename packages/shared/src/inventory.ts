import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";

/** Load the LL-2026-04 AI tool inventory YAML (metadata only — no secrets). */
export function loadAiInventory(path?: string): Record<string, unknown> {
  const p = resolve(path ?? process.env.MEMORY_VAULT_AI_INVENTORY_PATH ?? "./ai-inventory.yaml");
  return parseYaml(readFileSync(p, "utf8")) as Record<string, unknown>;
}
