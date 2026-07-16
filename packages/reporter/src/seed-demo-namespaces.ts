/**
 * Seed multi-namespace knowledge-graph demo data for stakeholder POCs.
 * Run after `npm run seed:demo` so QA Tier 1 + KG namespaces are both populated.
 *
 *   npm run seed:demo:namespaces
 *
 * Uses `platform` role to write namespaces that default roles cannot (compliance).
 */
import {
  openDb,
  createEntities,
  createRelations,
  getPolicy,
  type WriteContext,
} from "@mqm/shared";

const policy = getPolicy();

function platformCtx(namespace: string, tool: string): WriteContext {
  return {
    tier: 1,
    tool,
    principal: { userId: "seed", role: "platform" },
    policyVersion: policy.version,
    namespace,
  };
}

function main(): void {
  const db = openDb();

  const pr = createEntities(
    db,
    [
      {
        name: "loan-api",
        entityType: "service",
        observations: [
          "PR reviews often miss integration tests on /auth/* paths",
          "flake cluster fs_cd_fee on cd_generation correlates with loan-api deploys",
        ],
      },
      {
        name: "cd_generation",
        entityType: "journey",
        observations: ["fee table selector broke on build 18440 — regression not flake"],
      },
    ],
    platformCtx("pr", "create_entities"),
    policy,
  );

  createRelations(
    db,
    [{ from: "loan-api", to: "cd_generation", relationType: "owns_journey" }],
    platformCtx("pr", "create_relations"),
    policy,
  );

  const compliance = createEntities(
    db,
    [
      {
        name: "soc2-q14-2026",
        entityType: "rfp_answer_ref",
        observations: [
          "Cited answer: agent memory stores test metadata only — see ai-inventory.yaml",
          "Policy version mqm-policy-1; annual review cadence",
        ],
      },
    ],
    platformCtx("compliance", "create_entities"),
    policy,
  );

  const ops = createEntities(
    db,
    [
      {
        name: "deploy-pipeline-x",
        entityType: "incident_signature",
        observations: ["staging deploy timeout 2026-07-01 — correlated with cd_generation failures"],
      },
    ],
    platformCtx("ops", "create_entities"),
    policy,
  );

  db.close();
  // eslint-disable-next-line no-console
  console.log(
    `[seed:demo:namespaces] pr=${pr.created.length} entities, compliance=${compliance.created.length}, ops=${ops.created.length}`,
  );
}

main();
