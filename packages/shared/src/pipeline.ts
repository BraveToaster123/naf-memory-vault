import { randomUUID } from "node:crypto";
import type { DB } from "./db.js";
import { classifyAndRedact } from "./redact.js";
import { evaluatePolicy, getPolicy, type Policy } from "./policy.js";
import type {
  Classification,
  PolicyDecision,
  TestRunInput,
  TestRunRow,
  WriteContext,
} from "./types.js";

function retentionDays(policy: Policy, key: string, fallback: number): number {
  const retention = (policy.raw?.retention ?? {}) as Record<string, unknown>;
  const v = retention[key];
  return typeof v === "number" ? v : fallback;
}

function isoNow(): string {
  return new Date().toISOString();
}

function isoPlusDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export interface SaveResult {
  decision: PolicyDecision;
  row?: TestRunRow;
}

/**
 * The single guarded write path for Tier 1 run summaries.
 * sanitize -> extract -> policy pre-save -> dedupe/merge -> store.
 * No storage happens unless the policy decision is "allow".
 */
export function recordRunSummary(
  db: DB,
  input: TestRunInput,
  ctx: WriteContext,
  policy: Policy = getPolicy(),
): SaveResult {
  // 1. Sanitize: derive safe error fields; never keep the raw message.
  const { errorClass, failureSignature, redact } = classifyAndRedact(
    input.testId,
    input.errorMessage,
    input.errorClass,
    policy,
  );

  // Reporter rule: drop the whole run if raw error tripped a PII pattern.
  if (redact.containsPii && policy.reporter?.drop_run_on_pii_detected) {
    return {
      decision: {
        outcome: "deny",
        reason: "pii_in_error_dropped",
        matchedPattern: redact.matchedPattern,
        policyVersion: policy.version,
      },
    };
  }

  // 2. Extract: build the allowlisted storage payload (no raw error text).
  const payload: Record<string, unknown> = {
    testId: input.testId,
    status: input.status,
    durationMs: input.durationMs,
    journeyId: input.journeyId,
    appId: input.appId,
    browser: input.browser,
    os: input.os,
    env: input.env,
    commitSha: input.commitSha,
    loanScenarioId: input.loanScenarioId,
    errorClass,
    failureSignature,
  };

  // 3. Policy pre-save.
  const decision = evaluatePolicy(payload, ctx, policy);
  if (decision.outcome !== "allow") return { decision };

  // 4. Store + dedupe/merge signature.
  const ttl = retentionDays(policy, "tier1_operational_days", 30);
  const now = isoNow();
  const row: TestRunRow = {
    id: randomUUID(),
    test_id: input.testId,
    journey_id: input.journeyId ?? null,
    app_id: input.appId ?? null,
    status: input.status,
    duration_ms: input.durationMs ?? null,
    browser: input.browser ?? null,
    os: input.os ?? null,
    env: input.env ?? null,
    commit_sha: input.commitSha ?? null,
    loan_scenario_id: input.loanScenarioId ?? null,
    error_class: errorClass ?? null,
    failure_signature: failureSignature ?? null,
    created_at: now,
    expires_at: isoPlusDays(ttl),
  };

  db.prepare(
    `INSERT INTO test_runs
      (id, test_id, journey_id, app_id, status, duration_ms, browser, os, env,
       commit_sha, loan_scenario_id, error_class, failure_signature, created_at, expires_at)
     VALUES
      (@id, @test_id, @journey_id, @app_id, @status, @duration_ms, @browser, @os, @env,
       @commit_sha, @loan_scenario_id, @error_class, @failure_signature, @created_at, @expires_at)`,
  ).run(row);

  if (failureSignature && (input.status === "failed" || input.status === "flaky")) {
    upsertSignature(db, failureSignature, now, ttl);
  }

  return { decision, row };
}

function upsertSignature(db: DB, sig: string, now: string, ttlDays: number): void {
  const existing = db
    .prepare("SELECT occurrence_count FROM failure_signatures WHERE signature = ?")
    .get(sig) as { occurrence_count: number } | undefined;
  if (existing) {
    db.prepare(
      "UPDATE failure_signatures SET occurrence_count = occurrence_count + 1, last_seen = ?, expires_at = ? WHERE signature = ?",
    ).run(now, isoPlusDays(ttlDays), sig);
  } else {
    db.prepare(
      `INSERT INTO failure_signatures (signature, classification, notes, occurrence_count, first_seen, last_seen, expires_at)
       VALUES (?, 'unknown', NULL, 1, ?, ?, ?)`,
    ).run(sig, now, now, isoPlusDays(ttlDays));
  }
}

/** Tier 1 write: classify a known failure signature (flake/regression/env). */
export function tagFailureSignature(
  db: DB,
  args: { signature: string; classification: Classification; notes?: string },
  ctx: WriteContext,
  policy: Policy = getPolicy(),
): PolicyDecision {
  const decision = evaluatePolicy({ ...args }, ctx, policy);
  if (decision.outcome !== "allow") return decision;
  const now = isoNow();
  const ttl = retentionDays(policy, "tier1_operational_days", 30);
  db.prepare(
    `INSERT INTO failure_signatures (signature, classification, notes, occurrence_count, first_seen, last_seen, expires_at)
     VALUES (@signature, @classification, @notes, 1, @now, @now, @expires)
     ON CONFLICT(signature) DO UPDATE SET classification = @classification, notes = @notes, last_seen = @now`,
  ).run({
    signature: args.signature,
    classification: args.classification,
    notes: args.notes ?? null,
    now,
    expires: isoPlusDays(ttl),
  });
  return decision;
}

/** Tier 1 write: human-provided environment quirk. */
export function rememberEnvFact(
  db: DB,
  args: { env: string; fact: string; overlayKey?: string; source?: string },
  ctx: WriteContext,
  policy: Policy = getPolicy(),
): PolicyDecision {
  const decision = evaluatePolicy({ ...args }, ctx, policy);
  if (decision.outcome !== "allow") return decision;
  const now = isoNow();
  const ttl = retentionDays(policy, "tier1_operational_days", 30);
  db.prepare(
    `INSERT INTO env_facts (id, env, overlay_key, fact, source, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    args.env,
    args.overlayKey ?? null,
    args.fact,
    args.source ?? "human",
    now,
    isoPlusDays(ttl),
  );
  return decision;
}
