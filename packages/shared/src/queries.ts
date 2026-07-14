import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import type { DB } from "./db.js";
import { normalizeError, signature } from "./signature.js";
import type { Classification, EnvFactRow, TestRunRow } from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

export interface FlakyTest {
  test_id: string;
  flake_rate: number;
  runs: number;
  last_status: string;
}

/** Rank tests by flake rate over the active Tier 1 window. */
export function getFlakyTests(
  db: DB,
  opts: { limit?: number; minRuns?: number; sinceDays?: number } = {},
): FlakyTest[] {
  const limit = opts.limit ?? 20;
  const minRuns = opts.minRuns ?? 5;
  const sinceDays = opts.sinceDays ?? 30;
  const since = new Date(Date.now() - sinceDays * 86400000).toISOString();

  const rows = db
    .prepare(
      `SELECT test_id,
              COUNT(*) AS runs,
              SUM(CASE WHEN status IN ('failed','flaky') THEN 1 ELSE 0 END) AS bad
       FROM test_runs
       WHERE created_at >= ?
       GROUP BY test_id
       HAVING runs >= ?
       ORDER BY (CAST(bad AS REAL) / runs) DESC, runs DESC
       LIMIT ?`,
    )
    .all(since, minRuns, limit) as { test_id: string; runs: number; bad: number }[];

  return rows.map((r) => {
    const last = db
      .prepare("SELECT status FROM test_runs WHERE test_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(r.test_id) as { status: string } | undefined;
    return {
      test_id: r.test_id,
      flake_rate: Number((r.bad / r.runs).toFixed(3)),
      runs: r.runs,
      last_status: last?.status ?? "unknown",
    };
  });
}

/** Run history for one test (no full error text — only class + signature). */
export function getTestHistory(db: DB, testId: string, limit = 10): Partial<TestRunRow>[] {
  return db
    .prepare(
      `SELECT test_id, journey_id, status, duration_ms, browser, env, commit_sha,
              error_class, failure_signature, created_at
       FROM test_runs WHERE test_id = ? ORDER BY created_at DESC LIMIT ?`,
    )
    .all(testId, limit) as Partial<TestRunRow>[];
}

export interface SignatureMatch {
  known: boolean;
  signature: string | null;
  classification: Classification;
  occurrence_count: number;
  recommendation: "skip_browser" | "investigate";
}

/** Match a failure to a known signature cluster. */
export function getFailureSignature(
  db: DB,
  args: { testId: string; errorClass?: string; errorHint?: string },
): SignatureMatch {
  // Prefer a signature computed from the (redacted) hint; else the test's latest.
  let sig: string | null = null;
  if (args.errorHint) {
    sig = signature(args.testId, normalizeError(args.errorHint));
  } else {
    const latest = db
      .prepare(
        "SELECT failure_signature FROM test_runs WHERE test_id = ? AND failure_signature IS NOT NULL ORDER BY created_at DESC LIMIT 1",
      )
      .get(args.testId) as { failure_signature: string } | undefined;
    sig = latest?.failure_signature ?? null;
  }

  if (!sig) {
    return { known: false, signature: null, classification: "unknown", occurrence_count: 0, recommendation: "investigate" };
  }

  const known = db
    .prepare("SELECT classification, occurrence_count FROM failure_signatures WHERE signature = ?")
    .get(sig) as { classification: Classification; occurrence_count: number } | undefined;

  if (!known) {
    return { known: false, signature: sig, classification: "unknown", occurrence_count: 0, recommendation: "investigate" };
  }
  return {
    known: true,
    signature: sig,
    classification: known.classification,
    occurrence_count: known.occurrence_count,
    recommendation: known.classification === "flake" ? "skip_browser" : "investigate",
  };
}

export interface SkipDecision {
  skip: boolean;
  reason: string;
}

/** Decision tool — call before opening Playwright MCP. */
export function shouldSkipBrowser(
  db: DB,
  args: { testId: string; errorClass?: string; minOccurrences?: number },
): SkipDecision {
  const min = args.minOccurrences ?? 3;
  const match = getFailureSignature(db, { testId: args.testId, errorClass: args.errorClass });
  if (match.known && match.classification === "flake" && match.occurrence_count >= min) {
    return {
      skip: true,
      reason: `known flake ${match.signature} seen ${match.occurrence_count}x — no browser needed`,
    };
  }
  return { skip: false, reason: "no known stable flake; investigate" };
}

/** Non-expired environment quirks for an env/overlay. */
export function getEnvFacts(db: DB, env: string, overlayKey?: string): EnvFactRow[] {
  if (overlayKey) {
    return db
      .prepare(
        "SELECT * FROM env_facts WHERE env = ? AND (overlay_key = ? OR overlay_key IS NULL) AND expires_at > ? ORDER BY created_at DESC",
      )
      .all(env, overlayKey, nowIso()) as EnvFactRow[];
  }
  return db
    .prepare("SELECT * FROM env_facts WHERE env = ? AND expires_at > ? ORDER BY created_at DESC")
    .all(env, nowIso()) as EnvFactRow[];
}

function journeysDir(): string {
  return process.env.MQM_JOURNEYS_DIR ?? "./journeys";
}

/** Load a Tier 2 curated journey (read-only). */
export function getJourneyMap(journeyId: string): Record<string, unknown> {
  const safe = journeyId.replace(/[^a-z0-9_-]/gi, "");
  const path = resolve(journeysDir(), `${safe}.yaml`);
  return parseYaml(readFileSync(path, "utf8")) as Record<string, unknown>;
}

/** Checkpoint definition + recent pass/fail from Tier 1. */
export function getComplianceCheckpoint(
  db: DB,
  journeyId: string,
  checkpointId: string,
  sinceDays = 30,
): { checkpoint: unknown; recent_runs: Partial<TestRunRow>[] } {
  const journey = getJourneyMap(journeyId);
  const checkpoints = (journey.checkpoints as Array<Record<string, unknown>>) ?? [];
  const checkpoint = checkpoints.find((c) => c.id === checkpointId) ?? null;
  const since = new Date(Date.now() - sinceDays * 86400000).toISOString();
  const recent = db
    .prepare(
      "SELECT test_id, status, failure_signature, created_at FROM test_runs WHERE journey_id = ? AND created_at >= ? ORDER BY created_at DESC LIMIT 20",
    )
    .all(journeyId, since) as Partial<TestRunRow>[];
  return { checkpoint, recent_runs: recent };
}
