import { openDb, type DB } from "./db.js";

export interface PurgeResult {
  test_runs: number;
  failure_signatures: number;
  env_facts: number;
}

/** Hard-delete every Tier 1 row whose expires_at is in the past. */
export function purgeExpired(db: DB, now: string = new Date().toISOString()): PurgeResult {
  const runs = db.prepare("DELETE FROM test_runs WHERE expires_at < ?").run(now);
  const sigs = db.prepare("DELETE FROM failure_signatures WHERE expires_at < ?").run(now);
  const env = db.prepare("DELETE FROM env_facts WHERE expires_at < ?").run(now);
  return {
    test_runs: runs.changes,
    failure_signatures: sigs.changes,
    env_facts: env.changes,
  };
}

// CLI entrypoint: `tsx packages/shared/src/purge.ts`
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("purge.ts")) {
  const db = openDb();
  const result = purgeExpired(db);
  db.close();
  console.log(`[mqm-purge] deleted ${JSON.stringify(result)} at ${new Date().toISOString()}`);
}
