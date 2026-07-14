# 04 — Mortgage Compliance & Audit

## Scope

MQM is **quality control / software verification AI**, not loan underwriting AI. It still requires governance because:

- It validates **TRID disclosure UIs** and origination flows
- It may process **synthetic** loan scenarios that mirror production field structure
- [Fannie Mae LL-2026-04](https://singlefamily.fanniemae.com/news-events/lender-letter-ll-2026-04-governance-framework-use-artificial-intelligence-and-machine-learning) applies to AI/ML in **origination and servicing** practices (effective **August 6, 2026**)
- Freddie Mac **Section 1302.8** imposes parallel requirements (effective March 3, 2026)

**Framing for counsel:** MQM supports QC of software that displays compliance-sensitive surfaces. Audit proves **controls were active**, not that AI made credit decisions.

---

## LL-2026-04 requirements (operational translation)

| GSE expectation | MQM implementation |
|-----------------|-------------------|
| Documented AI governance program | [examples/ai-inventory.yaml](./examples/ai-inventory.yaml) + policy owner |
| AI inventory (including vendor tools) | Inventory lists Playwright MCP, Gemini, Cursor, MQM server |
| Third-party AI governed same as internal | Gateway logs Gemini; vendor docs retained |
| Records for QC and GSE audit | Append-only audit store |
| Disclose tools, purpose, safeguards on request | `get_ai_inventory` MCP tool + export bundle |
| Monitoring for degradation/errors | Flake trend metrics, eval golden set |
| Human oversight | Tier 2 PR approval; release gate on blocking checkpoints |
| Segregation of duties | QA runs tests; leads approve policy/journey changes |

---

## Thin audit model (privacy-compatible)

Resolve the tension between **audit** and **don't store what we don't want**:

### Two audit layers

| Layer | Retention | Contents |
|-------|-----------|----------|
| **Audit metadata** | 365 days | Who, when, tool, journey, outcome, policy version, model ID |
| **Audit evidence** | 90 days | Trace file, screenshot blob — then **delete blob**, keep ref tombstone |

### Audit event schema

```json
{
  "audit_id": "uuid",
  "timestamp_utc": "ISO-8601",
  "principal": {
    "user_id": "sso-subject",
    "role": "qa_engineer",
    "display_name": "Jane Doe"
  },
  "agent": {
    "client": "cursor",
    "session_id": "uuid",
    "skill": "mortgage-qa-triage"
  },
  "action_class": "memory_read | memory_write | browser_action | policy_block",
  "tool": {
    "server": "mortgage-qa-memory | playwright",
    "name": "get_flaky_tests",
    "args_summary": "limit=20"
  },
  "model": {
    "provider": "google",
    "model": "gemini-2.x",
    "gateway_request_id": "req_abc"
  },
  "context": {
    "loan_scenario_id": "synthetic-retail-01",
    "journey_id": "le_generation",
    "environment": "staging",
    "app_version": "2.14.0",
    "contains_npi": false
  },
  "policy": {
    "version": "mqm-policy-1",
    "decision": "allow | deny | require_approval"
  },
  "outcome": {
    "status": "success | failure | blocked",
    "summary": "checkpoint TRID-LE-APR-VISIBLE failed"
  },
  "evidence": {
    "trace_ref": "blob://traces/abc.zip",
    "snapshot_hash": "sha256:...",
    "evidence_expires_at": "ISO-8601"
  },
  "integrity": {
    "prev_hash": "sha256:...",
    "record_hash": "sha256:..."
  }
}
```

### Fields we never persist in audit

- Raw prompt text
- Raw LLM response text
- Full `browser_snapshot` content
- SSN, account numbers, income values

Store `prompt_template_id: "triage_v1"` instead of prompt body.

---

## QC query surface

Compliance / QC team must query:

```sql
-- By loan scenario (synthetic in QA)
SELECT * FROM audit_events
WHERE context->>'loan_scenario_id' = 'synthetic-retail-01'
  AND timestamp_utc BETWEEN '2026-07-01' AND '2026-07-31';

-- By journey
SELECT * FROM audit_events
WHERE context->>'journey_id' = 'le_generation';

-- By principal
SELECT * FROM audit_events
WHERE principal->>'user_id' = 'user@company.com';

-- By model
SELECT * FROM audit_events
WHERE model->>'model' LIKE 'gemini%';
```

MCP tool: `export_qc_sample(start_date, end_date, journey_id?)` → JSON bundle for examiners.

---

## AI inventory (LL-2026-04)

Maintain [examples/ai-inventory.yaml](./examples/ai-inventory.yaml):

| Tool | Purpose | Data sources | Human oversight | Vendor |
|------|---------|--------------|-----------------|--------|
| mortgage-qa-memory MCP | QA flake/history recall | CI reporter DB | Tier 2 PR approval | Internal |
| Playwright MCP | Browser repro | Staging UI only | QA engineer on loop | Microsoft |
| Gemini (gateway) | Agent reasoning | Redacted context | Human triage | Google |
| Cursor | Agent IDE | Repo + MCP tools | Engineer review | Anysphere |

Review inventory **at least annually** per LL-2026-04.

---

## Credit-adjacent vs build-time AI

| Class | Examples | Controls |
|-------|----------|----------|
| **Credit-adjacent** | Income calc UI, AUS display, disclosure content | Heavy audit, legal review, no agent auto-write |
| **Build-time / QC** | MQM, Playwright smoke, PR assistant on test code | SDLC controls, synthetic data only |

MQM is **build-time / QC**. Keep it out of live underwriting decision paths.

---

## Gateway integration

Route all Cursor → Gemini calls through existing gateway:

```
Request  → attach principal (SSO)
         → classify sensitivity (NPI patterns in user message)
         → log metadata (not body) to audit store
         → forward to Gemini
Response → log outcome summary
```

Optional: block requests containing SSN patterns in user paste.

---

## Release compliance record

Each release candidate produces:

| Artifact | Source |
|----------|--------|
| Compliance smoke results | CI reporter |
| Blocking checkpoint status | `get_compliance_checkpoint` aggregation |
| AI tools used in validation | Audit export for date range |
| Failed checkpoints | Journey YAML IDs + build number |

Stored in release ticket / Azure DevOps work item — not a separate compliance DB for v1.

---

## Examiner narrative (template)

> For release `2026.07.14`, QA validation of disclosure surfaces used internal tool **Mortgage QA Memory** and deterministic Playwright smoke tests on staging. Synthetic loan scenario `synthetic-retail-01` was used; no production borrower data was processed. AI-assisted triage (Cursor + Gemini) accessed staging UI under URL allowlist policy `mqm-policy-1`. Audit records `audit_id` … through … are available. Blocking checkpoint `TRID-LE-APR-VISIBLE` passed on build `18442`. Evidence traces expired per 90-day retention policy; metadata retained 365 days.

---

## Compliance checklist (pre-production)

- [ ] `ai-inventory.yaml` complete and approved
- [ ] Policy owner designated (named role)
- [ ] Tier 2 journey changes require PR from QA lead
- [ ] PII deny patterns tested with injected SSN in test error
- [ ] Audit hash chain verified (tamper detection)
- [ ] Evidence purge job running daily
- [ ] QC can run sample query without engineering
- [ ] Third-party AI (Gemini) documented in inventory
- [ ] Annual policy review scheduled
