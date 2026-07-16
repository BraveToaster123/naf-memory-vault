# 09 — Multi-Domain Memory (Namespaces)

How to extend the DoorDash/Salesforce memory platform pattern across departments using **namespaced facts** on one MCP server.

See [10-doordash-salesforce-memory-deep-dive.md](./10-doordash-salesforce-memory-deep-dive.md) for source architecture details.

---

## One platform, many namespaces

```
mortgage-qa-memory MCP
├── namespace: qa        ← Playwright, flake, journeys (Phase 1)
├── namespace: pr        ← PR assistant, repo patterns (Phase 2)
├── namespace: ops       ← Incidents, deploy correlation (Phase 3)
├── namespace: compliance← RFP answers, audit refs (Phase 4)
└── namespace: product   ← Gateway session prefs, 7d TTL (Phase 5)
```

Each namespace has its own retention, write permissions, and RBAC — same save pipeline and audit layer.

---

## Namespace policy template

```yaml
namespaces:
  qa:
    retention_days: 30
    writers: [qa_engineer, reporter]
    readers: [qa_engineer, qc_analyst, platform]
    deny_patterns: inherit_global

  pr:
    retention_days: 30
    writers: [engineer, reporter]
    readers: [engineer, qa_lead]
    fact_categories: [review_pattern, ci_flake_on_path, ownership]

  ops:
    retention_days: 30
    writers: [sre, agent]
    readers: [sre, engineer]
    fact_categories: [incident_signature, runbook_ref, deploy_correlation]

  compliance:
    retention_days: 365
    writers: [compliance_analyst]  # human only
    readers: [compliance, qc_analyst]
    fact_categories: [rfp_answer_ref, policy_version]
    tier2_approval: required

  product:
    retention_days: 7
    writers: [product_manager]
    readers: [product_manager]
    fact_categories: [session_pref, frequent_kb_article]
    max_facts_per_user: 20
```

---

## Department benefit matrix

| Department | Namespace | Payback speed | Memory value |
|------------|-----------|---------------|--------------|
| Loan ops | (vendor AI) | Fast | Doc/condition memory — buy don't build |
| Customer support | `support` | ~4 months | Ticket deflection, runbook refs |
| QA / engineering | `qa` | ~9 months | Flake, journeys, checkpoints |
| SRE / platform | `ops` | ~8 months | Incident signatures |
| Compliance | `compliance` | Slow but mandatory | Cited RFP answers, audit |
| Product | `product` | Medium | Session prefs only |

---

## Cross-namespace rules (from DoorDash)

| Rule | Implementation |
|------|----------------|
| **Isolate by default** | QA namespace cannot read compliance RFP drafts |
| **Share deliberately** | `app_id`, `overlay_key` in shared read-only registry |
| **No cross-namespace writes** | Agent in `qa` cannot write to `compliance` |
| **Unified audit** | All namespaces log to same audit store with `namespace` tag |

---

## Rollout sequence

1. `qa` — current MQM build
2. `pr` — extend PR assistant with `get_repo_flake_patterns`
3. `ops` — incident signature after Azure MCP integration
4. `compliance` — KB-linked `rfp_answer_ref` facts only
5. `product` — 7-day session prefs on gateway

---

## Fact key convention

```
{namespace}/{category}/{identifier}

Examples:
qa/failure_signature/le_generation_apr
qa/env_fact/staging-eu/mfa_bypass
pr/review_pattern/loan-api/missing_tests
ops/incident_signature/deploy_timeout_pipeline_x
compliance/rfp_answer_ref/soc2-q14/2026.1
```

---

## When to split MCP servers vs namespaces

| Stay one server | Split servers |
|-----------------|---------------|
| Same team owns policy | Different security zones |
| Shared audit + pipeline | Compliance requires air-gapped store |
| &lt; 5 namespaces | Regulatory mandate for physical separation |

**Recommendation:** One `mortgage-qa-memory` server with namespaces until compliance mandates split.
