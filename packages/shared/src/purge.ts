import { openDb, type DB } from "./db.js";
import { purgeExpiredKg } from "./kg.js";

export interface PurgeResult {
  test_runs: number;
  failure_signatures: number;
  env_facts: number;
  kg_entities: number;
  kg_observations: number;
  kg_relations: number;
}

/** Hard-delete every Tier 1 row (including core knowledge-graph rows) whose expires_at is in the past. */
export function purgeExpired(db: DB, now: string = new Date().toISOString()): PurgeResult {
  const runs = db.prepare("DELETE FROM test_runs WHERE expires_at < ?").run(now);
  const sigs = db.prepare("DELETE FROM failure_signatures WHERE expires_at < ?").run(now);
  const env = db.prepare("DELETE FROM env_facts WHERE expires_at < ?").run(now);
  const kg = purgeExpiredKg(db, now);
  return {
    test_runs: runs.changes,
    failure_signatures: sigs.changes,
    env_facts: env.changes,
    kg_entities: kg.entities,
    kg_observations: kg.observations,
    kg_relations: kg.relations,
  };
}

// CLI entrypoint: `tsx packages/shared/src/purge.ts`
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("purge.ts")) {
  const db = openDb();
  const result = purgeExpired(db);
  db.close();
  console.log(`[mqm-purge] deleted ${JSON.stringify(result)} at ${new Date().toISOString()}`);
}
