import { createHash, randomUUID } from "node:crypto";
import type { DB, AuditEventRow, Principal } from "@memory-vault/shared";

export interface AuditInput {
  principal: Principal;
  actionClass: "memory_read" | "memory_write" | "browser_action" | "policy_block" | "prompt_get";
  toolServer: string;
  toolName: string;
  /** Short summary only — never raw args that may contain CI error text. */
  argsSummary?: string;
  journeyId?: string;
  loanScenarioId?: string;
  environment?: string;
  policyVersion: string;
  outcome: "success" | "failure" | "blocked";
  evidenceRef?: string;
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Append an audit event with a tamper-evident hash chain.
 * Stores metadata only — no prompts, no snapshots, no raw args.
 */
export function logAudit(db: DB, input: AuditInput): AuditEventRow {
  const prev = db
    .prepare("SELECT record_hash FROM audit_events ORDER BY timestamp_utc DESC, rowid DESC LIMIT 1")
    .get() as { record_hash: string } | undefined;
  const prevHash = prev?.record_hash ?? null;

  const row: AuditEventRow = {
    audit_id: randomUUID(),
    timestamp_utc: new Date().toISOString(),
    principal_id: input.principal.userId,
    principal_role: input.principal.role,
    action_class: input.actionClass,
    tool_server: input.toolServer,
    tool_name: input.toolName,
    args_summary: input.argsSummary ?? null,
    journey_id: input.journeyId ?? null,
    loan_scenario_id: input.loanScenarioId ?? null,
    environment: input.environment ?? null,
    policy_version: input.policyVersion,
    outcome: input.outcome,
    evidence_ref: input.evidenceRef ?? null,
    prev_hash: prevHash,
    record_hash: "",
  };

  row.record_hash = sha256(
    [
      prevHash ?? "",
      row.audit_id,
      row.timestamp_utc,
      row.principal_id,
      row.action_class,
      row.tool_name,
      row.outcome,
      row.policy_version,
    ].join("|"),
  );

  db.prepare(
    `INSERT INTO audit_events
      (audit_id, timestamp_utc, principal_id, principal_role, action_class,
       tool_server, tool_name, args_summary, journey_id, loan_scenario_id,
       environment, policy_version, outcome, evidence_ref, prev_hash, record_hash)
     VALUES
      (@audit_id, @timestamp_utc, @principal_id, @principal_role, @action_class,
       @tool_server, @tool_name, @args_summary, @journey_id, @loan_scenario_id,
       @environment, @policy_version, @outcome, @evidence_ref, @prev_hash, @record_hash)`,
  ).run(row);

  return row;
}

export interface AuditQuery {
  startDate: string;
  endDate: string;
  journeyId?: string;
  loanScenarioId?: string;
  principalId?: string;
}

/** QC / compliance query surface (metadata only). */
export function getAuditTrail(db: DB, q: AuditQuery): AuditEventRow[] {
  return db
    .prepare(
      `SELECT * FROM audit_events
       WHERE timestamp_utc BETWEEN @start AND @end
         AND (@journey IS NULL OR journey_id = @journey)
         AND (@scenario IS NULL OR loan_scenario_id = @scenario)
         AND (@principal IS NULL OR principal_id = @principal)
       ORDER BY timestamp_utc ASC`,
    )
    .all({
      start: q.startDate,
      end: q.endDate,
      journey: q.journeyId ?? null,
      scenario: q.loanScenarioId ?? null,
      principal: q.principalId ?? null,
    }) as AuditEventRow[];
}
