import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import type { PolicyDecision, Role, Tier, WriteContext } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface Policy {
  version: string;
  urls: {
    allowed_prefixes: string[];
    deny_prod: boolean;
    deny_patterns: string[];
  };
  environments: { allowed: string[]; production_agent_access: boolean };
  deny_fields: string[];
  deny_patterns: string[];
  loan_scenarios: { allowed_ids: string[]; deny_production_loan_ids: boolean };
  write_permissions: {
    tier0_automatic: string[];
    tier1_automatic: string[];
    tier1_denied: string[];
    tier2_approval_required: string[];
    tier2_workflow: string;
  };
  reporter: { allowed_columns: string[]; drop_run_on_pii_detected: boolean };
  raw: Record<string, unknown>;
}

/**
 * Compile a policy deny_pattern (which may use a leading `(?i)` inline flag,
 * unsupported by JS RegExp) into a real RegExp.
 */
export function compilePattern(pattern: string): RegExp {
  let flags = "";
  let src = pattern;
  if (src.startsWith("(?i)")) {
    flags = "i";
    src = src.slice(4);
  }
  return new RegExp(src, flags);
}

function defaultPolicyPath(): string {
  return (
    process.env.MQM_POLICY_PATH ??
    resolve(__dirname, "../../policy/mqm-policy.yaml")
  );
}

let cached: Policy | null = null;

export function loadPolicy(path: string = defaultPolicyPath()): Policy {
  const raw = parseYaml(readFileSync(path, "utf8")) as Record<string, unknown>;
  const policy: Policy = {
    version: String(raw.version ?? "mqm-policy-unknown"),
    urls: raw.urls as Policy["urls"],
    environments: raw.environments as Policy["environments"],
    deny_fields: (raw.deny_fields as string[]) ?? [],
    deny_patterns: (raw.deny_patterns as string[]) ?? [],
    loan_scenarios: raw.loan_scenarios as Policy["loan_scenarios"],
    write_permissions: raw.write_permissions as Policy["write_permissions"],
    reporter: raw.reporter as Policy["reporter"],
    raw,
  };
  return policy;
}

export function getPolicy(): Policy {
  if (!cached) cached = loadPolicy();
  return cached;
}

/** Test seam: override the cached policy. */
export function __setPolicy(p: Policy | null): void {
  cached = p;
}

export function isUrlAllowed(url: string, policy: Policy = getPolicy()): boolean {
  const prefixes = policy.urls?.allowed_prefixes ?? [];
  const denies = policy.urls?.deny_patterns ?? [];
  if (denies.some((d) => compilePattern(d).test(url))) return false;
  return prefixes.some((p) => url.startsWith(p));
}

export function isScenarioAllowed(id: string | undefined, policy: Policy = getPolicy()): boolean {
  if (!id) return true; // scenario is optional; only reject when explicitly provided
  return (policy.loan_scenarios?.allowed_ids ?? []).includes(id);
}

/** Which write-tools may a given role invoke? */
export function canWrite(role: Role, tool: string, policy: Policy = getPolicy()): boolean {
  if (role === "platform") return true;
  const wp = policy.write_permissions;
  const t0 = wp.tier0_automatic ?? [];
  const t1 = wp.tier1_automatic ?? [];
  const t2 = wp.tier2_approval_required ?? [];
  switch (role) {
    case "qa_lead":
      return [...t0, ...t1, ...t2].includes(tool);
    case "qa_engineer":
      return [...t0, ...t1].includes(tool);
    case "engineer":
      return t0.includes(tool);
    case "qc_analyst":
      return false;
    default:
      return false;
  }
}

/**
 * Scan a value tree for deny_patterns (PII). Returns the offending pattern
 * source string, or null if clean.
 */
export function findPiiPattern(value: unknown, policy: Policy = getPolicy()): string | null {
  const patterns = policy.deny_patterns.map((p) => ({ src: p, re: compilePattern(p) }));
  const seen = new Set<unknown>();
  const walk = (v: unknown): string | null => {
    if (v == null) return null;
    if (typeof v === "string") {
      for (const { src, re } of patterns) if (re.test(v)) return src;
      return null;
    }
    if (typeof v === "object") {
      if (seen.has(v)) return null;
      seen.add(v);
      for (const child of Object.values(v as Record<string, unknown>)) {
        const hit = walk(child);
        if (hit) return hit;
      }
    }
    return null;
  };
  return walk(value);
}

/** Remove any deny_fields from a payload (returns a shallow-cleaned copy). */
export function dropDeniedFields(
  payload: Record<string, unknown>,
  policy: Policy = getPolicy(),
): { cleaned: Record<string, unknown>; dropped: string[] } {
  const dropped: string[] = [];
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (policy.deny_fields.includes(k)) {
      dropped.push(k);
      continue;
    }
    cleaned[k] = v;
  }
  return { cleaned, dropped };
}

/**
 * The yellow "Memory Policy — enforced pre-save" box from the DoorDash diagram.
 * No write path may reach storage without passing through this.
 */
export function evaluatePolicy(
  payload: Record<string, unknown>,
  ctx: WriteContext,
  policy: Policy = getPolicy(),
): PolicyDecision {
  const policyVersion = policy.version;

  // 1. Role / tier write permission
  if (!canWrite(ctx.principal.role, ctx.tool, policy)) {
    return {
      outcome: ctx.tier === 2 ? "require_approval" : "deny",
      reason: `role ${ctx.principal.role} not permitted to write ${ctx.tool}`,
      policyVersion,
    };
  }

  // 2. Tier 2 is human-PR only — never a direct agent write.
  if (ctx.tier === 2) {
    return {
      outcome: "require_approval",
      reason: `tier2 write ${ctx.tool} requires ${policy.write_permissions.tier2_workflow}`,
      policyVersion,
    };
  }

  // 3. Drop denied fields, then scan remaining payload for PII.
  const { cleaned, dropped } = dropDeniedFields(payload, policy);
  const piiHit = findPiiPattern(cleaned, policy);
  if (piiHit) {
    return {
      outcome: "deny",
      reason: "pii_pattern",
      matchedPattern: piiHit,
      policyVersion,
    };
  }

  // 4. Synthetic loan scenario allowlist.
  const scenario = cleaned.loanScenarioId ?? cleaned.loan_scenario_id;
  if (scenario !== undefined && !isScenarioAllowed(String(scenario), policy)) {
    return {
      outcome: "deny",
      reason: `loan_scenario ${String(scenario)} not in synthetic allowlist`,
      policyVersion,
    };
  }

  return {
    outcome: "allow",
    reason: dropped.length ? `allowed; dropped denied fields: ${dropped.join(",")}` : "allowed",
    policyVersion,
    transformed: cleaned,
  };
}
