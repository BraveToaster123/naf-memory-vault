# 10 — DoorDash & Salesforce Memory Deep Dive

Reference for **recreating governed multi-domain memory** in Mortgage QA Memory (MQM). Sources are primary engineering posts from DoorDash and Salesforce (2026).

---

## Source links

### DoorDash

| Post | URL | Focus |
|------|-----|-------|
| Engineering overview | [Building DoorDash Assistant](https://careersatdoordash.com/blog/building-doordash-assistant-an-engineering-overview/) | Runtime, MCP, Managed Agent Services, three memory layers |
| Intelligence (Part 2) | [Building Ask DoorDash (Part 2): Intelligence](https://careersatdoordash.com/blog/building-ask-doordash-part-two-intelligence/) | Agent memory system, retrieval pipeline, conversational flywheel |
| Unified memory platform | [Unified consumer memory at scale](https://careersatdoordash.com/blog/doordash-unified-consumer-memory-for-personalization-at-scale/) | Memory blocks, manifests, batch generation, encoding |
| Summary | [InfoQ Ask DoorDash](https://www.infoq.com/news/2026/07/doordash-ai-ask-assistant/) | Production metrics, eval scale |

### Salesforce

| Post | URL | Focus |
|------|-----|-------|
| Agentic Memory Q&A | [How Agentic Memory Enables Reliable AI Agents](https://engineering.salesforce.com/how-agentic-memory-enables-durable-reliable-ai-agents-across-millions-of-enterprise-users/) | Write/read gates, profile graph, Data 360 |
| Context engineering | [Agentforce Guide](https://www.salesforce.com/agentforce/guide/) | Atlas Reasoning Engine, context assembly |

---

## DoorDash — three memory layers

```
┌─────────────────────────────────────────────────────────────────┐
│                    THREE MEMORY LAYERS                           │
├─────────────────┬─────────────────┬─────────────────────────────┤
│ Long-term       │ In-session      │ Conversational / Agentic    │
│ Daily/weekly    │ Realtime        │ Async after each turn       │
│ batch LLM       │ cart, search,   │ explicit user-stated facts  │
│                 │ browse signals  │                             │
└─────────────────┴─────────────────┴─────────────────────────────┘
         │                  │                      │
         └──────────────────┴──────────────────────┘
                            │
              Graduation: recurring in-session → long-term batch
              Explicit facts → consolidation on next batch cycle
```

| Layer | Cadence | Contents | DoorDash examples |
|-------|---------|----------|-------------------|
| **Long-term** | Daily/weekly batch | Versioned memory blocks from behavioral history | Dietary prefs, brand affinity (Oatly), store loyalty, dining patterns |
| **In-session** | Realtime | Current intent with high recency weight | Cart contents, active searches, items viewed/rejected |
| **Conversational / agentic** | Fire-and-forget async | Explicit durable facts from chat | "Vegetarian for household of two", "prefer further Safeway" |

### What they save vs skip (agentic memory)

**Save:**
- Explicit stable facts: vegetarian, household size, brand prefs
- Grocery: casual "I prefer Oatly" → durable brand signal
- Recurring habits with durability language ("always", "never")

**Skip:**
- One-time mentions ("for a friend tonight")
- Ambiguous statements overridden in later turns
- Restaurant: "I don't want ramen" without "always/never" → transient mood
- Passive acceptance of agent suggestions (not user-initiated framing)
- Health/medical information — **never written, even on explicit request**

### Production impact (7-day window, early rollout)

| Metric | With memory vs without |
|--------|------------------------|
| Grocery checkout conversion | **+24%** relative |
| Grocery basket size | **+17%** |
| Conversational turns | **−7%** |
| Restaurant open-ended query conversion | **+15%** relative |
| Misunderstood user intent | **−33%** likelihood |
| Egregiously irrelevant results | **−24%** likelihood |

---

## DoorDash — system architecture (five pillars from diagram)

```
Memory Generation          Tooling                    Storage
─────────────────         ─────────                  ─────────
• Conversational ───────► Shared Memory Client ───► Agentic Memory Store
• Long-term      ───────► Shared Save Pipeline      (SQL + vector ANN)
• Eval Platform  ◄──────►   sanitize                  namespaces
                           extract facts             semantic search
                           durable facts
                           dedupe/merge
                                    │
                                    ▼
                              Memory Policy
                              • allowed data types
                              • retention / TTL
                              • sensitivity / PII
                              • scope (user/org)
                              • agent permissions
                              enforced PRE-SAVE
                                    │
                                    ▼
                              Agents (MCP tools)
                              • Grocery agent
                              • Restaurant agent
                              • Future agents
```

### Three system layers (Intelligence post)

| Layer | Technology | Responsibility |
|-------|------------|----------------|
| **Long-term memory engine** | Offline batch LLM pipelines | Behavioral signals → structured memory blocks |
| **Managed Agent Services** | Distributed SQL + vector ANN | Store blocks + embeddings; namespace isolation; no task awareness |
| **Tooling** | Shared save pipeline + MCP | Write path: format/ingest. Read path: plan, retrieve, rank, package |

---

## DoorDash — long-term memory blocks

### Block types (Table from unified memory post)

| Memory Block | Components | Captures |
|--------------|------------|----------|
| Dietary Preference | narrative, type, strictness | Dietary/cuisine choices |
| Dining Patterns | cuisine prefs, behavior, food types | Restaurant behavior |
| Item Brand | brand narrative, brand ID, keywords | Brand affinities per entity |
| Item Taxonomy | narrative, substitute/support signals, keywords | Category preferences |
| Store Preferences | primary stores, loyalty, reorder tendency | Merchant loyalty |
| Cross Channel Patterns | complementary, substitution, seasonal | Multi-vertical behavior |

### Versioned manifest (decouples generation from consumption)

```yaml
version: 3a
blocks:
  dietary_preference:
    dietary_narrative:
      schema_version: v1.1
      model_id: dietary_llm_v2
  item_brand:
    brand_narrative:
      schema_version: v1.0
      model_id: brand_llm_v1
  item_taxonomy:
    taxonomy_narrative:
      schema_version: v1.2
      model_id: taxonomy_llm_v2
```

**Lineage per component:** model ID, generation timestamp, prompt hash, response hash.

**A/B at manifest level:** deploy 3a to 10%, 3b to 90%; reconstruct any consumer's memory as of any historical date.

### Pydantic schemas

Components are atomic units with strict schemas, versioned independently — not free-text logs.

---

## DoorDash — ingestion pipeline

Two paths (reads never blocked):

1. **Immediate text availability** — block content in storage instantly (zero wait for embeddings)
2. **Async embeddings** — message queue OR dynamic server-side embedding at write time (primary production path)

| Mode | When |
|------|------|
| Pre-computed embeddings | Bulk offline batch (millions of users) |
| Dynamic server-side embedding | Real-time conversational facts |

**Why dynamic won:** swap embedding models without reprocessing entire corpus; facts searchable instantly on write.

---

## DoorDash — namespace partitioning

**Two dimensions:** signal type × consumer identity

| Namespace type | Isolation | Shared? |
|----------------|-----------|---------|
| Brand affinities | Per signal type | No — grocery agent can't leak restaurant data |
| Taxonomy patterns | Per signal type | No |
| Conversational facts | Per signal type | No |
| Cross-vertical durable facts | Unified | **Yes** — vegetarian learned in grocery available to restaurant agent |

---

## DoorDash — memory orchestration (4-stage read pipeline)

Agents see simple tools; system runs four stages internally:

### Stage 1: Intent and scope resolution

Map task → memory needs:

| User intent | Memories needed |
|-------------|-----------------|
| "Find dinner spot" | Cuisine tendencies, price point, recent orders |
| "Make chicken tikka masala" | Pantry inventory, portion sizes, protein prefs |
| "Shop my usuals" | Order history, replenishment patterns |
| "Get snacks" | Brand affinities, dietary constraints |

Also applies **freshness constraints** — recent order activity needs stricter recency floor than lifestyle prefs.

### Stage 2: Query planning

Three axes per query:

| Axis | Options |
|------|---------|
| **Modality** | Semantic (embeddings), keyword (deterministic), structured fetch |
| **Target** | Namespace or memory chunk |
| **Filter envelope** | top-K, similarity floor, fact-category, recency window |

**Over-fetch** — strict post-filtering drops candidates; planner fetches extra to avoid context starvation.

### Stage 3: Retrieval and ranking

- Parallel search across partitions
- Graceful degradation if one partition fails
- Score by semantic similarity → merge → dedupe
- Recency breaks ties
- **Memory Bank Index** — compact token directory per namespace injected once per session so agent doesn't guess vocabulary
- **Scan before read** — cheap metadata scan (counts, categories) before full payload for large surfaces (order history)

### Stage 4: Context engineering

Returned fact shape:

```json
{
  "fact_id": "mem_892a",
  "category": "brand_preference",
  "content": "Prefers Oatly oat milk",
  "timestamp": "2026-05-12T14:23:00Z",
  "relevance_score": 0.91,
  "durability": "stated"
}
```

Agent skill/prompt defines usage: context, search input, or **exclusion** ("has olive oil at home — skip it").

---

## DoorDash — conversational memory flywheel (3 stages)

```
User turn completes
       │
       ▼
1. Signal emission (fire-and-forget, zero latency to user)
       │
       ▼
2. Extraction + classification (dedicated LLM = policy gate)
   • Save vs don't save rules
   • Domain-aware durability (restaurant vs grocery rules differ)
   • Active vs passive intent
       │
       ▼
3. Deduplication + consolidation
   • Search existing memories on same topic
   • Merge, update in place, resolve contradictions
       │
       ▼
   Write to long-term store
```

### Forgetting (harder than remembering)

1. Semantic search on deletion query → candidate set
2. **Separate LLM call** decides which candidates match delete request (avoid over-delete)
3. Delete is **synchronous** (not fire-and-forget) so agent can confirm to user

### Lifecycle / TTL philosophy

> A fact's lifecycle is a function of **what it is about**, not uniform decay.

- Stated lifestyle prefs: **no TTL** until consumer says otherwise
- Food preferences: slow evolution
- Ordering patterns: seasonal
- Pantry staples: item-specific consumption timescale
- NOT blanket "all facts older than X days are stale"

---

## DoorDash — MCP + Managed Agent Services

From engineering overview:

| Managed Service | Purpose |
|-----------------|---------|
| **Artifacts** | Versioned widgets (shopping lists); consumer edits **without LLM** between turns |
| **Session** | Turns, tool calls, results; namespaced per agent |
| **Memory** | Consumer personalization via `memory_search` MCP tool |

**Key pattern:** Deterministic artifact updates bypass LLM (like your deterministic CI smoke vs agentic triage).

**MCP tools:** Same server for Assistant + external integrations; each surface sees scoped tools.

**Grounding rule:** Every consumer-visible claim must come from tool call against system of record on that turn.

---

## DoorDash — eval platform (feeds memory quality)

| Component | Role |
|-----------|------|
| Session transcript | User inputs, agent responses, tool calls, grounding context |
| LLM-as-judge | Calibrated against human labels |
| Guardrail evals | Session integrity, safety |
| Capability evals | Result quality, execution quality |
| Simulator | Synthetic multi-turn sessions |
| Background agents | Cluster failures, investigate, generate reports |

**Scale:** 2,000+ automated evals/day; regression 6h → 20m.

**Memory-specific eval metrics:** completeness, accuracy, freshness (from diagram Eval Platform).

---

## Salesforce Agentic Memory — core model

### Problem statement

Stateless agents reset every interaction → repetitive questions, inconsistent behavior, outdated facts resurface.

**Failed approach:** Inject raw historical data into prompts → latency, cost, noise, no lifecycle control.

**Fix:** Memory as **structured records in real-time data layer**, separate from prompts.

### Architecture

```
Short-term context ──► Active session only
Long-term memory   ──► Anchored to Profile Graph (persists across sessions/channels)
Raw signals        ──► Pipeline: ADD | UPDATE | DELETE | DISREGARD
```

**Profile graph** = individual profile in Salesforce CRM (authoritative enterprise record).

**Platform:** Agent Memory powered by **Data 360** (Salesforce's data cloud).

---

## Salesforce — memory record structure

Memory approached as **clean structured data** with explicit fields:

| Field | Purpose |
|-------|---------|
| `type` | Memory category |
| `time` | Temporal bounds |
| `source` | Origin system (CRM, chat transcript, bot, document) |
| `confidence` | Uncertainty level — not false certainty |
| `lifecycle` | Retention, compaction, deletion controls |

### Memory types modeled

| Type | Challenge |
|------|-----------|
| **Episodic** | Must preserve event order; summarization over time reduces noise |
| **Long-term** | Stable facts across sessions |
| **Short-term** | Must stay separate to prevent transient/sensitive info persisting |

---

## Salesforce — write gates

Only **high-quality candidates** enter memory.

| Gate behavior | Purpose |
|---------------|---------|
| Reject low-confidence extractions | Prevent noise accumulation |
| Reject one-time / sensitive session info | Prevent cross-session bleed |
| Prefer trusted enterprise records | CRM > casual conversational signals |
| Hybrid validation | Vector similarity + semantic meaning check |
| Prevent duplication | Don't store near-duplicate facts |
| Prevent drift | Update in place vs append-only log |

**Derivation pipeline inputs (not just agent chat):**
- Agentic conversations
- Service Cloud `livechattranscript` (human agent chats)
- Einstein Bot conversations
- Documents (Excel, PDF) via zero-copy connector
- All Data 360 connector sources

**Metadata-driven:** Memory derivation candidates pre-defined as metadata fed into pipeline.

**Actor-text-blob tuple** or **actor-text-actor triplet** — industry pattern Salesforce aligns with.

---

## Salesforce — read gates

| Design choice | Rationale |
|---------------|-----------|
| Task-relevant subset only | Not top-K everything |
| Precomputed embeddings | Fast similarity search |
| Compact structured records | Low latency per agent turn |
| Session caching | Active session memory cached |
| Smaller models for extract/validate | Cost control |
| Larger models for complex reasoning only | Reserve expensive inference |

**Performance rule:** Slow memory retrieval = agent feels broken. Every turn has strict latency budget.

---

## Salesforce — confidence scoring

When enterprise systems contradict conversational signals:
- Memory must represent **uncertainty**, not pick a winner silently
- Confidence field exposed to agent reasoning
- Trusted source hierarchy: CRM record > casual chat mention

---

## Salesforce — adaptive context + session traces

| Capability | Purpose |
|------------|---------|
| **Adaptive Context** | Dynamically refine, prioritize, prune information during task |
| **Session traces** | Structured reasoning/decision trace per execution |
| **Relational history** | Connect decisions to enterprise outcomes over time |
| **Replay testing** | Evaluate correctness, freshness, safety |

Makes agent behavior **governable and explainable** for enterprise audit.

---

## Salesforce — memory compaction

Episodic memory **summarized over time** — preserve signal, reduce noise (similar to DoorDash not storing raw chat logs).

---

## Side-by-side comparison

| Dimension | DoorDash | Salesforce | MQM (your build) |
|-----------|----------|------------|------------------|
| **Long-term source** | Behavioral batch LLM | Profile graph + multi-source derivation | CI reporter aggregates + curated YAML |
| **Session** | Cart, search, browse | Active session context | Tier 0 Redis 8h |
| **Explicit/agentic** | Conversational extraction async | Write-gated derivation | `remember_env_fact` + human notes |
| **Storage** | SQL + vector ANN | Data 360 real-time layer | SQLite 30d + git YAML |
| **Schema** | Pydantic memory blocks + manifests | Typed fields (type, time, source, confidence) | Policy + journey YAML + run summary schema |
| **Write policy** | Extraction prompt as gate | Write gates + hybrid validation | `mqm-policy.yaml` pre-save |
| **Read policy** | 4-stage task-aware pipeline | Read gates + task subset | `plan_qa_investigation`, `should_skip_browser` |
| **Namespaces** | Signal type × consumer | Profile-scoped | `qa`, `pr`, `ops`, `compliance` |
| **Forgetting** | 2-stage semantic + LLM delete | Lifecycle controls + erasure | TTL purge + deny list |
| **Eval** | LLM judge + simulator 2k/day | Replay testing | `ci-failures-golden.jsonl` |
| **Deterministic shortcuts** | Artifact edits without LLM | Agentforce Script deterministic steps | CI Playwright without agent |
| **MCP** | `memory_search`, catalog, cart | Actions + Data 360 | `mortgage-qa-memory` + Playwright |

---

## Recreation blueprint for MQM

### From DoorDash — adopt these patterns

| Pattern | MQM implementation |
|---------|-------------------|
| Three memory layers | Tier 0 session / Tier 1 operational / Tier 2 curated |
| Shared save pipeline | `sanitize → extract → dedupe → policy` in `packages/shared/pipeline.ts` |
| Memory policy pre-save | `mqm-policy.yaml` |
| Namespace isolation | `qa`, `pr`, `ops`, `compliance` namespaces |
| Task-aware retrieval | `plan_qa_investigation`, journey-specific checkpoint queries |
| Scan before read | `get_flaky_tests` before Playwright MCP |
| Fire-and-forget write (session) | `record_run_summary` async after triage |
| Synchronous delete/confirm | Human-approved locator/checkpoint removal via PR |
| Memory Bank Index | `get_journey_map` + locator registry = agent vocabulary |
| Versioned manifests | `journeys/*.yaml` with version + `schema_version` per checkpoint |
| Eval flywheel | Golden CI failures + monthly human labels |
| Deterministic non-LLM updates | CI reporter only in pipeline; artifact-style pass/fail |
| Pluggable across agents | Same MCP server for Cursor, PR assistant, future agents |

### From DoorDash — do NOT adopt (mortgage QA context)

| Pattern | Why skip |
|---------|----------|
| Consumer behavioral batch LLM | You don't have order history; you have test history |
| 100+ facts per user | QA needs aggregates, not profiles |
| No TTL on lifestyle prefs | You want explicit TTL on Tier 1 |
| Conversational flywheel from user chat | QA facts come from CI + explicit engineer notes |
| Dense embeddings + context graph | Overkill for v1; SQL signatures sufficient |

### From Salesforce — adopt these patterns

| Pattern | MQM implementation |
|---------|-------------------|
| Memory ≠ prompt text | Store `failure_signature`, not error dumps in prompts |
| Write gates | Policy deny list + role permissions |
| Read gates | `should_skip_browser`; task-specific tool subset per skill |
| Confidence scoring | `classification: flake \| regression \| unknown` + occurrence count |
| Source tracking | `source: reporter \| agent \| human` on every fact |
| Structured record fields | `types.ts` RunSummary + AuditEvent schemas |
| Profile graph anchor | `loan_scenario_id` (synthetic) + `app_id` + `overlay_key` |
| Multi-source derivation | Reporter + Azure MCP + KB MCP + session notes |
| Replay testing | Golden eval set |
| Episodic compaction | Summarize 30d runs → flake rate, not raw run list forever |
| Trusted > casual | Tier 2 git YAML > agent session notes |

### From Salesforce — do NOT adopt (v1)

| Pattern | Why defer |
|---------|-----------|
| Full Data 360 / profile graph | Use app registry + synthetic scenarios instead |
| Einstein Bot / livechat ingestion | Not your domain v1 |
| Episodic memory across channels | Single channel: QA/CI |

---

## Unified memory record schema (MQM hybrid)

Combine DoorDash fact shape + Salesforce metadata fields:

```typescript
type MqmMemoryFact = {
  fact_id: string;
  namespace: "qa" | "pr" | "ops" | "compliance" | "product";
  category: string;           // failure_signature | env_fact | checkpoint | locator
  content_summary: string;    // redacted, max 200 chars
  timestamp: string;
  relevance_score?: number;   // read-time only
  durability: "stated" | "inferred" | "aggregated";
  confidence: number;         // 0-1 from occurrence count / human label
  source: "reporter" | "agent" | "human" | "kb_ref";
  schema_version: string;
  policy_version: string;
  expires_at?: string;        // Tier 1 only
  lineage?: {
    commit_sha?: string;
    model_id?: string;        // if LLM extracted
    prompt_template_id?: string;
  };
};
```

---

## MCP tools to recreate DoorDash/Salesforce patterns

| Enterprise pattern | MQM tool |
|--------------------|----------|
| DoorDash `memory_search` | `get_journey_map`, `get_failure_signature`, `get_env_facts` |
| DoorDash scan-before-read | `get_flaky_tests` (metadata), then `get_test_history` |
| DoorDash extraction job | `record_run_summary` (gated) |
| DoorDash forget | `purge_scenario` + git revert for Tier 2 |
| Salesforce write gate | Policy engine in MCP server |
| Salesforce read gate | `should_skip_browser`, `plan_qa_investigation` |
| Salesforce confidence | `tag_failure_signature(classification, confidence)` |
| Salesforce replay eval | `eval/ci-failures-golden.jsonl` harness |

---

## Implementation priority (recreate order)

| Week | DoorDash pattern | Salesforce pattern | Deliverable |
|------|------------------|-------------------|-------------|
| 1 | Save pipeline + policy | Write gates | `pipeline.ts` + policy enforced |
| 2 | Memory blocks (manifests) | Structured record fields | Journey YAML with versions |
| 3 | Reporter → store | Multi-source (CI) | Tier 1 SQLite |
| 4 | 4-stage read (simplified) | Read gates | `plan_qa_investigation` |
| 5 | Namespace partition | Profile anchor | `namespace` column + RBAC |
| 6 | Eval platform | Replay testing | Golden set + monthly review |
| 7 | Conversational flywheel (limited) | Episodic compaction | `remember_env_fact` + purge |
| 8 | MCP memory tools | Audit traces | Full MCP + audit hash chain |

---

## Key quotes to remember

**DoorDash:** "Memory isn't a nice-to-have. It's the threshold that separates a useful agent from a merely impressive one."

**DoorDash:** "Knowing what to leave out" — exclusion harder than inclusion; irrelevant facts degrade reasoning.

**DoorDash:** "Treating memory as a tooling layer" — decouple from any single agent runtime.

**Salesforce:** "Memory as prompt text breaks down at enterprise scale" — needs structure, governance, explainability.

**Salesforce:** "Write gates ensure only high-quality candidates become memory; read gates limit retrieval to task-relevant records."

---

## Next doc

See [02-doordash-memory-pattern.md](./02-doordash-memory-pattern.md) for diagram mapping and [09-multi-domain-memory.md](./09-multi-domain-memory.md) for namespace rollout across departments.
