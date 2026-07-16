# 02 — DoorDash Memory Pattern (Diagram Review)

## Source

DoorDash described the memory architecture behind **Ask DoorDash** in a three-part engineering deep dive, summarized by [InfoQ (July 2026)](https://www.infoq.com/news/2026/07/doordash-ai-ask-assistant/). The diagram provided in this project illustrates how they separate **memory generation**, **tooling**, **storage**, **policy**, and **agents** — with a dedicated **eval platform** feedback loop.

![DoorDash agentic memory architecture](../../assets/doordash-memory-architecture.png)

---

## Diagram breakdown

### 1. Memory Generation (left)

| Block | What DoorDash stores | Signals / captures |
|-------|---------------------|-------------------|
| **Conversational Memory** | In-session preferences | Intent, need, feedback during live chat |
| **Long Term Memory** | Cross-session user profile | Dietary prefs, item attributes, lifestyle |
| **Eval Platform** | Quality measurement | GEPA, human annotation; metrics: completeness, accuracy, freshness |

**Flow:** Conversational memory feeds long-term memory. Eval platform has a bidirectional dotted line to conversational memory — continuous quality improvement.

**Reported production impact (DoorDash):**
- +24% grocery checkout conversion with computed consumer memory
- +17% basket size, −7% conversational turns
- 2,000+ automated evals/day; regression testing 6h → 20m

---

### 2. Tooling (center-left)

| Block | Role |
|-------|------|
| **Shared Memory Client** | Single read/write path for all agents: `read fact`, `append facts` |
| **Shared Save Pipeline** | Processing before storage |

**Shared Save Pipeline steps (in order):**

1. **Sanitize the conversation** — remove noise
2. **Extract profiles / facts** — identify useful information
3. **Extract durable facts** — decide what survives the session
4. **Deduplicate and merge** — update existing facts, avoid duplicates

This pipeline is the **most important pattern** for our mortgage QA use case. It is where we enforce "memory summarizer, not memory hoarder."

---

### 3. Storage (center)

**Agentic Memory Store** — central repository shared by all agents:

- Structured memory blocks
- Unstructured conversational facts
- **Semantic search** for retrieval

DoorDash retrieves relevant memories via vector search, ranks them, and injects into prompts — separating memory management from model inference.

---

### 4. Memory Policy (center-right)

**Policy controls (pre-save enforcement):**

| Control | Purpose |
|---------|---------|
| Allowed data types | Schema-level allowlist |
| **Retention rules** | How long facts live |
| **Sensitivity / PII rules** | Block or redact regulated data |
| Scope | User vs org level |
| Agent permissions | Which agents can read/write what |

**Enforcement:** Policy is applied **before** data enters the Agentic Memory Store. Dotted feedback line returns to Shared Save Pipeline on deny or transform.

This directly addresses the team concern: *"memory MCP will store data we don't want long term."* DoorDash's answer is not "store less accidentally" — it is **policy enforced pre-save**.

---

### 5. Agents (right)

| Agent | Domain |
|-------|--------|
| New Vertical Assistant | e.g. Grocery |
| Restaurant Assistant | Discovery |
| Future Agents | Dynamic personalization for any new agent |

**Platform model:** Domain teams build agents; platform team owns orchestration, MCP tooling, memory, eval (per InfoQ summary).

---

## What DoorDash teaches us

| Lesson | Application to MQM |
|--------|-------------------|
| Memory is a **platform capability**, not a feature of one bot | One `mortgage-qa-memory` MCP serves Cursor, PR assistant, future agents |
| **Three memory types** | Session (Tier 0), operational history (Tier 1), curated definitions (Tier 2) |
| **Pipeline before store** | Never write raw Playwright output directly to DB |
| **Policy pre-save** | `mqm-policy.yaml` is not documentation — it is code path |
| **Eval closes the loop** | Golden CI failures + human annotation on memory quality |
| **Deterministic shortcuts** | DoorDash updates artifacts without LLM; we run deterministic CI smoke without agent |
| **MCP exposes business tools** | Our MCP exposes QA tools, not raw DB |

---

## Mapping: DoorDash → Mortgage QA Memory

```
DoorDash                          Mortgage QA Memory (MQM)
─────────────────────────────────────────────────────────────
Conversational Memory      →      Tier 0 session notes (8h TTL)
Long Term Memory           →      Tier 1 flake metrics, signatures (30d)
Agentic Memory Store       →      Tier 1 SQLite + Tier 2 journey YAML
Shared Memory Client       →      mortgage-qa-memory MCP server
Shared Save Pipeline       →      sanitize → extract → dedupe → policy
Memory Policy              →      mqm-policy.yaml (PII, retention, writes)
Semantic search            →      Optional Phase 2: search failure_signatures
Eval Platform              →      eval/ci-failures.jsonl + checkpoint metrics
Restaurant / Grocery Agent →      Cursor QA agent, PR assistant
MCP tool layer (catalog…)  →      Playwright MCP + Azure MCP + KB MCP
```

---

## Mapping: DoorDash memory types → mortgage QA

DoorDash uses three memory systems (per InfoQ):

| DoorDash type | Definition | MQM equivalent |
|---------------|------------|----------------|
| **Long-term** | Offline from historical behavior | Aggregated flake rates, failure signatures, checkpoint pass rates over time |
| **Session** | Conversational context | Current triage thread, last N investigation steps (ephemeral) |
| **Agentic** | Explicit user-provided facts | QA `remember_env_fact`: "staging EU needs MFA bypass header" |

We **do not** mirror DoorDash consumer profiling (cuisine prefs, basket history). We mirror the **architecture shape** with **QA-specific facts**.

---

## What we adopt vs what we skip

### Adopt

- Shared save pipeline with sanitization
- Pre-save policy enforcement
- Shared MCP client (single memory server for all agents)
- Eval platform with completeness / accuracy / freshness metrics
- Separation of session vs durable vs curated memory

### Skip (for mortgage QA)

- Unstructured conversational facts with open-ended retention
- Vector embedding of full conversation text
- User-level personalization profiles
- Automatic promotion of agent-observed facts to long-term without human review

### Adapt

- **Semantic search** → search normalized `failure_signature` and `error_class`, not raw errors
- **Append facts** → `record_run_summary` only; no `append raw_snapshot`
- **Long-term memory** → statistical aggregates, not narrative memory

---

## Policy-first implementation (from diagram)

The diagram's **Memory Policy → enforced pre-save** block maps to concrete code:

```typescript
async function saveToMemory(tier: 0 | 1 | 2, payload: unknown, ctx: WriteContext) {
  const sanitized = sanitize(payload);
  const facts = extractFacts(sanitized);
  const merged = dedupeAndMerge(facts, existingStore);

  const decision = evaluatePolicy(merged, {
    tier,
    principal: ctx.principal,
    agent: ctx.agent,
    policyVersion: POLICY.version,
  });

  if (decision.outcome === "deny") {
    await auditLog({ action_class: "policy_block", ...decision });
    throw new PolicyDeniedError(decision.reason);
  }

  await writeToTier(tier, decision.transformedFacts);
  await auditLog({ action_class: "memory_write", ... });
}
```

No code path may call `writeToTier` without passing through `evaluatePolicy`.

---

## Eval platform design (from diagram)

DoorDash metrics: **completeness, accuracy, freshness**. For MQM:

| Metric | Definition | Measurement |
|--------|------------|-------------|
| **Completeness** | Do we capture every CI failure as a run summary? | Reporter coverage % |
| **Accuracy** | Does `get_flaky_tests` match human labels? | Golden set precision/recall |
| **Freshness** | Are locators and journeys current for app version? | Stale locator age vs release tag |

**Human annotation loop:** QA lead labels 20 failures/month; compare to agent triage outcome; tune policy and skill.

---

## Org model (from DoorDash + InfoQ)

| Team | Owns |
|------|------|
| **Platform** | MCP server, policy, audit proxy, gateway integration, purge jobs |
| **QA** | Journey YAML, checkpoints, golden eval set, Playwright suite naming |
| **Engineering** | Reporter, app `data-testid` contracts, PR assistant hooks |
| **Compliance** | Policy review, AI inventory, QC query requirements |

---

## Summary

The DoorDash diagram is the reference architecture for **governed agent memory**. For mortgage QA, we reuse the **pipeline + policy + shared client + eval** shape while restricting **what counts as a durable fact** to redacted test intelligence — not loan content.

The team's retention concern is answered by the yellow **Memory Policy** block: **enforced pre-save**, not hoped-for post-hoc cleanup.
