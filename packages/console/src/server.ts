/**
 * Memory Console — read-only desktop inspector for governed memory (POC).
 * Static UI + thin JSON API over @mqm/shared (same data as the MCP server).
 *
 *   npm run console
 *   open http://127.0.0.1:4173
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  openDb,
  getFlakyTests,
  getTestHistory,
  getFailureSignature,
  shouldSkipBrowser,
  getEnvFacts,
  getJourneyMap,
  type DB,
} from "@mqm/shared";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "../public");
const PORT = Number(process.env.MQM_CONSOLE_PORT ?? 4173);
const HOST = process.env.MQM_CONSOLE_HOST ?? "127.0.0.1";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body, null, 2));
}

function policyBlocks(db: DB, limit = 30) {
  return db
    .prepare(
      `SELECT timestamp_utc, principal_role, tool_name, args_summary, outcome, policy_version
       FROM audit_events
       WHERE action_class = 'policy_block'
       ORDER BY timestamp_utc DESC
       LIMIT ?`,
    )
    .all(limit);
}

async function handleApi(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  search: URLSearchParams,
  db: DB,
): Promise<boolean> {
  if (pathname === "/api/health") {
    const runs = db.prepare("SELECT COUNT(*) AS n FROM test_runs").get() as { n: number };
    json(res, 200, { ok: true, test_runs: runs.n, policy: process.env.MQM_POLICY_PATH ?? "default" });
    return true;
  }

  if (pathname === "/api/flaky") {
    const limit = Number(search.get("limit") ?? 10);
    json(res, 200, getFlakyTests(db, { limit, minRuns: 3 }));
    return true;
  }

  const testMatch = /^\/api\/tests\/(.+)$/.exec(pathname);
  if (testMatch?.[1] && req.method === "GET") {
    const testId = decodeURIComponent(testMatch[1]);
    json(res, 200, {
      test_id: testId,
      history: getTestHistory(db, testId, 10),
      skip_browser: shouldSkipBrowser(db, { testId }),
      signature: getFailureSignature(db, { testId }),
    });
    return true;
  }

  const journeyMatch = /^\/api\/journeys\/(.+)$/.exec(pathname);
  if (journeyMatch?.[1] && req.method === "GET") {
    try {
      const journeyId = decodeURIComponent(journeyMatch[1]);
      json(res, 200, getJourneyMap(journeyId));
    } catch (e) {
      json(res, 404, { error: "journey_not_found", message: e instanceof Error ? e.message : String(e) });
    }
    return true;
  }

  if (pathname === "/api/env") {
    const env = search.get("env") ?? "uat";
    json(res, 200, getEnvFacts(db, env));
    return true;
  }

  if (pathname === "/api/policy-blocks") {
    const limit = Number(search.get("limit") ?? 30);
    json(res, 200, policyBlocks(db, limit));
    return true;
  }

  return false;
}

function serveStatic(res: ServerResponse, relPath: string): boolean {
  const safe = relPath.replace(/\.\./g, "");
  const file = join(PUBLIC, safe === "/" ? "index.html" : safe);
  if (!existsSync(file)) return false;
  const ext = extname(file);
  res.writeHead(200, { "Content-Type": MIME[ext] ?? "application/octet-stream" });
  res.end(readFileSync(file));
  return true;
}

function main(): void {
  const db = openDb();

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${HOST}`);
      if (url.pathname.startsWith("/api/")) {
        const handled = await handleApi(req, res, url.pathname, url.searchParams, db);
        if (handled) return;
        json(res, 404, { error: "not_found" });
        return;
      }
      if (serveStatic(res, url.pathname)) return;
      json(res, 404, { error: "not_found" });
    } catch (e) {
      json(res, 500, { error: "internal_error", message: e instanceof Error ? e.message : String(e) });
    }
  });

  server.listen(PORT, HOST, () => {
    // eslint-disable-next-line no-console
    console.log(`[console] http://${HOST}:${PORT}  (memory desktop inspector; Ctrl+C to stop)`);
    // eslint-disable-next-line no-console
    console.log(`[console] DB: ${process.env.MQM_DB_PATH ?? "./data/qa-memory.db"}`);
  });
}

main();
