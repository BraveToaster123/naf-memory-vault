# Documentation — Governed QA Memory MCP

Single doc tree: design, implementation, security, adoption, and operational gates. **No v1/v2 split.**

---

## Start here

| Audience | Read first |
|----------|------------|
| **Another AI / new project** | [00-adoption-guide.md](./00-adoption-guide.md) |
| **Engineer shipping code** | [11-implementation.md](./11-implementation.md) → [13-definition-of-done.md](./13-definition-of-done.md) |
| **Leadership / security** | [18-official-mcp-packages-risk-brief.md](./18-official-mcp-packages-risk-brief.md) → [14-operational-readiness.md](./14-operational-readiness.md) |
| **Stakeholder demo** | [15-poc-demo.md](./15-poc-demo.md) |
| **QA phased rollout** | [rollout/README.md](./rollout/README.md) |

**Stakeholder path:** 18 → 14 → 15 → live `npm run smoke`

**QA delivery path:** [rollout/README.md](./rollout/README.md) → Q1 umbrella → feature docs

---

## Security & npm packages

| Doc | Contents |
|-----|----------|
| [00-adoption-guide.md](./00-adoption-guide.md) | npm assessment, security model, paths forward |
| [18-official-mcp-packages-risk-brief.md](./18-official-mcp-packages-risk-brief.md) | Why not vanilla `server-memory` |
| [14-operational-readiness.md](./14-operational-readiness.md) | Non-savable list, auth stages, namespace owners |
| [05-data-retention-and-privacy.md](./05-data-retention-and-privacy.md) | Tier 0/1/2 philosophy |

---

## Features & implementation

| Doc | Contents |
|-----|----------|
| [11-implementation.md](./11-implementation.md) | Packages, quickstart, hard rules |
| [16-playbook-mirror-privatize.md](./16-playbook-mirror-privatize.md) | Mirror `server-memory` + own governance |
| [07-mcp-tools-specification.md](./07-mcp-tools-specification.md) | Full tool catalog (design) |
| [tools.json](./tools.json) | Machine-readable contract (`npm run manifest`) |
| [12-integration-mcp.md](./12-integration-mcp.md) | Consume/extend MCP; engine vs domain seam |
| [09-multi-domain-memory.md](./09-multi-domain-memory.md) | Namespace rollout |

---

## Design & architecture

| # | Document |
|---|----------|
| — | [PROJECT-CONTEXT.md](./PROJECT-CONTEXT.md) |
| 01 | [Architecture overview](./01-architecture-overview.md) |
| 02 | [DoorDash memory pattern](./02-doordash-memory-pattern.md) |
| 03 | [QA automation & Playwright MCP](./03-qa-automation-playwright.md) |
| 04 | [Mortgage compliance & audit](./04-mortgage-compliance-audit.md) |
| 05 | [Data retention & privacy](./05-data-retention-and-privacy.md) |
| 06 | [Build from scratch](./06-build-from-scratch.md) |
| 07 | [MCP tools specification](./07-mcp-tools-specification.md) |
| 08 | [Integration with existing stack](./08-integration-with-existing-stack.md) |
| 09 | [Multi-domain memory](./09-multi-domain-memory.md) |
| 10 | [DoorDash & Salesforce deep dive](./10-doordash-salesforce-memory-deep-dive.md) |

---

## QA rollout (Q1–Q5)

Phased delivery for external QA pilot, story pipeline, CI triage, and hardening.
**`qa` namespace only** — see [rollout/00-scope-and-principles.md](./rollout/00-scope-and-principles.md).

| Phase | Umbrella |
|-------|----------|
| Q1 | [rollout/q1-exploration-pilot.md](./rollout/q1-exploration-pilot.md) |
| Q2 | [rollout/q2-story-pipeline.md](./rollout/q2-story-pipeline.md) |
| Q3 | [rollout/q3-automation-and-assistant.md](./rollout/q3-automation-and-assistant.md) |
| Q4 | [rollout/q4-ci-triage.md](./rollout/q4-ci-triage.md) |
| Q5 | [rollout/q5-qa-hardening.md](./rollout/q5-qa-hardening.md) |

Full feature index: [rollout/README.md](./rollout/README.md).

---

## Gates & landscape

| Doc | Contents |
|-----|----------|
| [13-definition-of-done.md](./13-definition-of-done.md) | POC/MVP engineering gates |
| [14-operational-readiness.md](./14-operational-readiness.md) | Production/compliance gates |
| [17-governed-memory-landscape.md](./17-governed-memory-landscape.md) | OSS + production survey |
