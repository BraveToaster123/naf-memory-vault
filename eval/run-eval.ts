/**
 * Flake-classification eval. Compares MQM's memory-derived classification
 * against the human-labeled golden set. Run after `npm run seed:demo`.
 *
 *   npm run eval
 *
 * Exits non-zero if accuracy falls below MQM_EVAL_MIN (default 0.6) so it can
 * gate CI. MVP target: >= 3 of 5 correct.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { openDb, getFailureSignature, type Classification } from "@mqm/shared";

const here = dirname(fileURLToPath(import.meta.url));

interface Golden {
  test_id: string;
  label: Classification;
  error_class?: string;
  notes?: string;
}

function predict(db: ReturnType<typeof openDb>, testId: string, errorClass?: string): Classification {
  const match = getFailureSignature(db, { testId, errorClass });
  if (!match.known) return "unknown";
  return match.classification;
}

function main(): void {
  const path = resolve(here, "ci-failures.jsonl");
  const golden = readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Golden);

  const db = openDb();
  let correct = 0;
  const rows: Array<Record<string, string>> = [];
  for (const g of golden) {
    const predicted = predict(db, g.test_id, g.error_class);
    const hit = predicted === g.label;
    if (hit) correct++;
    rows.push({ test_id: g.test_id, expected: g.label, predicted, result: hit ? "PASS" : "MISS" });
  }
  db.close();

  const accuracy = golden.length ? correct / golden.length : 0;
  const min = Number(process.env.MQM_EVAL_MIN ?? "0.8");

  // eslint-disable-next-line no-console
  console.table(rows);
  // eslint-disable-next-line no-console
  console.log(`\n[eval] ${correct}/${golden.length} correct (accuracy=${accuracy.toFixed(2)}, min=${min})`);

  if (accuracy < min) {
    // eslint-disable-next-line no-console
    console.error(`[eval] FAIL: accuracy ${accuracy.toFixed(2)} < ${min}. Seed data or tag more signatures.`);
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.log("[eval] PASS");
}

main();
