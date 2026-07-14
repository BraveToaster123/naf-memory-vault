# Tier 2 — Curated locators

This is the human-reviewed home for element locators (Tier 2 curated memory).

## Rules

- **Agents never write here.** The `upsert_locator` MCP tool returns
  `require_approval` and points a human to open a PR against this folder.
- Each change is a normal git PR reviewed by a QA lead (this PR review *is* the
  compliance control for curated memory).
- One file per app, e.g. `loan-origination-portal.yaml`.

## Format

```yaml
app: loan-origination-portal
app_version: "2.14.0"
locators:
  - element_key: le_apr_value
    selector: "[data-testid='le-apr']"
    journey_id: le_generation
  - element_key: cd_cash_to_close
    selector: "[data-testid='cd-cash-to-close']"
    journey_id: cd_generation
```

Prefer stable `data-testid` selectors provided by the app team over brittle
CSS/text selectors.
