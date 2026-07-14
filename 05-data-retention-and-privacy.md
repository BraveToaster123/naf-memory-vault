# 05 — Data Retention & Privacy

## Problem statement

> "Our concern with memory MCP is it will store data we don't want it to store long term."

This is the correct default posture for mortgage. The solution is **not** avoiding memory — it is **governed, tiered, deny-by-default storage** aligned with DoorDash's **Memory Policy enforced pre-save** pattern.

---

## Design principle

| Wrong mental model | Right mental model |
|------------------|-------------------|
| Memory expander | **Memory summarizer** |
| Remember the page | Remember **that step 4 failed with TimeoutError on Firefox** |
| Richer context = better | **Safer derivatives = shippable** |
| Agent decides what to keep | **Policy decides before write** |

---

## Three memory tiers

```
Tier 0 — Session (ephemeral)
├── Current investigation notes
├── Draft locator candidates
├── Last N tool outcomes (summarized)
├── TTL: 8 hours
└── Store: Redis or in-process; wiped on session end

Tier 1 — Operational (short-term)
├── Flake rates, run counts
├── failure_signature (normalized hash)
├── error_class, pass/fail per checkpoint
├── env_facts (explicit QA notes)
├── TTL: 30 days (configurable 7–30)
└── Store: SQLite / Postgres with expires_at column

Tier 2 — Curated (long-term, human-approved)
├── Journey YAML definitions
├── Compliance checkpoint definitions
├── Approved locator registry
├── TTL: until superseded by new version
└── Store: Git repository (PR review required)
```

---

## Never store long-term

| Data type | Risk | Store instead |
|-----------|------|---------------|
| Real SSN, account #, DOB | NPI | `contains_npi: true` flag in audit only |
| Borrower name from staging | PII | Synthetic `loan_scenario_id` |
| Raw a11y snapshot text | Field values leak | `snapshot_hash` + checkpoint pass/fail |
| Full prompts | Data exfil copy | `prompt_template_id` |
| Full LLM responses | Same | One-line `outcome.summary` |
| Network response bodies | Loan payloads | HTTP status + route pattern |
| Screenshots with filled forms | Visual PII | Blurred blob 90d or omit |
| Credit / income values | Regulated | Boolean checkpoint result |
| Production cookies / URLs | Security | Staging allowlist only |
| Full stack traces | May embed PII | `error_class` + normalized signature |

---

## Policy enforcement (pre-save)

From [policies/mqm-policy.yaml](./policies/mqm-policy.yaml):

```yaml
deny_fields:
  - raw_snapshot
  - raw_prompt
  - network_body
  - screenshot_bytes

deny_patterns:
  - '\b\d{3}-\d{2}-\d{4}\b'
  - '\b\d{9}\b'
  - 'password|secret|token|api_key'

write_permissions:
  tier0_automatic: [remember_session_note]
  tier1_automatic: [record_run_summary, tag_failure_signature]
  tier2_approval_required: [upsert_locator, propose_checkpoint]
```

### Code path (mandatory)

```typescript
// NO bypass path to database
async function memoryWrite(tool: string, payload: unknown, ctx: Context) {
  if (POLICY.deny_fields.some(f => payloadHasField(payload, f))) {
    return deny("deny_field", tool, ctx);
  }
  const text = JSON.stringify(payload);
  for (const pattern of POLICY.deny_patterns) {
    if (new RegExp(pattern, "i").test(text)) {
      return deny("pii_pattern", tool, ctx);
    }
  }
  if (!POLICY.write_permissions.tier1_automatic.includes(tool)) {
    return deny("tool_not_allowed", tool, ctx);
  }
  const facts = extractFacts(sanitize(payload));
  await db.insert(withExpiresAt(facts, days(30)));
  return allow(ctx);
}
```

---

## Retention schedule

| Store | TTL | Purge method |
|-------|-----|--------------|
| Tier 0 session | 8 hours | Redis EXPIRE / session close hook |
| Tier 1 operational | 30 days | `DELETE WHERE expires_at < now()` daily cron |
| Tier 2 curated | Until PR supersedes | Git history (normal SCM) |
| Audit metadata | 365 days | Partition drop or archive |
| Audit evidence blobs | 90 days | Blob lifecycle rule; retain tombstone ref |

### Purge job

```sql
DELETE FROM test_runs WHERE expires_at < datetime('now');
DELETE FROM env_facts WHERE expires_at < datetime('now');
-- Audit metadata: separate job per legal retention
```

**Hard delete** for Tier 0/1 — not soft-delete. Reduces forensic recovery risk for QA data.

---

## Session vs durable memory

### Tier 0 — safe for richer context if ephemeral

Allowed in session (8h):
- "Investigating `le_generation` APR failure on Firefox"
- "Steps tried: navigate → wait → verify APR"
- Draft locator string **before** human approval

**On session end:** delete all Tier 0; optionally promote **summary only** to Tier 1 via `record_run_summary`.

### Tier 1 — aggregates only

Examples of valid long-term (30d) rows:

```json
{
  "test_id": "le_generation/apr visible",
  "failure_signature": "fs_8a2c91",
  "error_class": "TimeoutError",
  "flake_rate_7d": 0.18,
  "browser": "firefox",
  "env": "staging"
}
```

---

## Playwright-specific privacy controls

| Control | Setting |
|---------|---------|
| Profile mode | `--isolated` (default) |
| URL allowlist | Policy `allowed_prefixes` |
| `browser_run_code_unsafe` | Disabled |
| Snapshot persistence | **Blocked** at MCP write gate |
| Trace upload | Blob with 90d lifecycle; access RBAC |
| Test data | Fixtures in `fixtures/loan-scenarios/` only |
| Storage state files | Encrypted; Tier 0 TTL; no prod cookies |

### Optional: snapshot sanitizer

If Tier 0 must cache snapshot briefly, strip `value=` attributes:

```typescript
function sanitizeSnapshot(tree: string): string {
  return tree.replace(/value="[^"]*"/g, 'value="[REDACTED]"');
}
```

---

## Audit without hoarding

| Audit field | Retain 365d? |
|-------------|--------------|
| principal, timestamp | Yes |
| tool.server, tool.name | Yes |
| journey_id, loan_scenario_id | Yes |
| policy.version, outcome.status | Yes |
| model.provider, model.model | Yes |
| evidence.trace_ref | Ref yes; blob 90d only |
| raw prompt / response | **Never** |
| snapshot_hash | Yes (hash only) |

---

## Data classification tags

Every Tier 1 record carries:

| Tag | Meaning |
|-----|---------|
| `public` | Journey IDs, flake stats |
| `internal` | Env facts, locator drafts |
| `confidential` | Aggregated failure patterns with env details |
| `npi_prohibited` | Row blocked if detected; should never persist |

---

## Governance hooks

1. **Promotion workflow** — Tier 2 only via git PR approved by QA lead AD group
2. **Right to purge** — `purge_scenario(loan_scenario_id)` even for synthetic IDs
3. **Memory inventory** — Document what MQM stores and explicit non-storage list (security review artifact)
4. **Annual policy review** — LL-2026-04 alignment
5. **Agent skill rules** — Cursor skill forbids asking agent to "remember this snapshot"

---

## Policy statement (for security review)

> **Mortgage QA Memory stores test intelligence, not loan data.**
>
> Long-term retention is limited to human-approved journey definitions and aggregated flake metrics (30 days). Session data expires in 8 hours. Evidence blobs expire in 90 days. Raw snapshots, prompts, network bodies, and borrower-identifiable fields are blocked at write time by policy enforcement pre-save.

---

## User concern → architectural answer

| Concern | Answer |
|---------|--------|
| "Memory MCP stores too much" | Only Tier 1 summaries pass policy; raw blocked |
| "We don't want long-term PII" | PII patterns deny write; synthetic scenarios only |
| "Audit needs history" | Metadata 365d; content derivatives only |
| "Agents remember wrong things" | Agents cannot write Tier 2; session wiped |
| "Compliance needs proof" | Audit log proves policy was enforced at write time |

---

## Testing privacy controls

| Test | Expected |
|------|----------|
| Reporter receives error with SSN | Row dropped; `policy_block` audit |
| Agent calls `record_run_summary` with snapshot field | MCP error deny |
| Session ends | Tier 0 empty |
| Day 31 | Tier 1 rows purged |
| Day 91 | Evidence blob gone; metadata ref remains |
