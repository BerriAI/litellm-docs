# LiteLLM Hex templates

Template version: 1.0.0. Contract: `litellm_analytics.spend_daily_v1`.

- `litellm_roi_demo.hex.yaml`: synthetic preview, no credentials or data connection.
- `litellm_roi_postgres.hex.yaml`: the same analysis with a native Hex SQL source.
- `setup-postgres.sql`: an aggregate view over LiteLLM's Postgres spend logs.

Import the YAML through Hex Home → + menu → Upload project. For Postgres, ask your database administrator to run the SQL and provision `hex_reader`, connect Hex, and select that connection on the Source cell. Run all cells, review Settings, then publish with your chosen audience. See `/docs/observability/hex` for setup and metric definitions.

## Change policy

Keep both templates' analysis, cells and app layout in sync. Change the source or intro only when the variant needs it. Keep credentials and workspace-specific IDs out of both files.

Bump the template version when changing metrics or layout. Introduce a new view name for a breaking contract change. Record the change below. Existing imported copies do not receive repository updates; import a new copy, reconnect its Source cell, review its results, then publish it in place of the older board.

The Hex templates workflow validates the native Hex schema, executes demo calculations, checks filters and missing-data behavior, and runs the SQL against a disposable Postgres database. It also verifies that the restricted reader can query the aggregate view and cannot query the source table. Run these checks before merging changes:

```bash
python -m pip install -r scripts/hex-template-requirements.txt
python scripts/test_hex_templates.py
```

Set `HEX_TEST_DSN` to a disposable local database to include the Postgres test. The test creates a source table and a database role. It does not clean them up; discard the test database and cluster afterward. Never use a real gateway database for this test.

SQL contract reference: LiteLLM `schema.prisma`, `LiteLLM_SpendLogs`. Source revision checked: `33991b106449089ad10f7e148e8f917a4a124849`. Older deployments may lack `completionStartTime`, `model_group` or `status`; adapt the view to return NULL/unknown for absent metrics. Verify this mapping against the deployment you use.

## Changelog

- 1.0.0: project and entity spend, model mix, complete-day cost comparisons, coverage checks, latency, TTFT, response-cache rate and business-value ROI input.
