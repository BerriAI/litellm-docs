# LiteLLM Hex templates

Team cost template version: 2.0.0. Default reporting sources: `LiteLLM_DailyTeamSpend` and `LiteLLM_TeamTable`. The query reads metrics and display names; it does not select API-key values or access the credential table.

Use `litellm_team_cost_postgres.hex.yaml` with your read-only Hex connection. Use `litellm_team_cost_demo.hex.yaml` for synthetic data. From Hex Home choose **+ → Upload project → Upload**, select the YAML, choose a connection on Source and run all cells. See `/docs/observability/hex` for column grants and metric limits.

The older `litellm_roi_demo.hex.yaml` and `litellm_roi_postgres.hex.yaml` remain available for project-level ROI analysis. The latter reads `litellm_analytics.spend_daily_v1`, created by `setup-postgres.sql` over request logs. Neither requires the credential-table lookup removed from the earlier daily template.

## Maintenance

Keep each demo/live pair's calculations and layout in sync. Version changes to metrics, inputs or layout. Test the native Hex schema, synthetic calculations, filters, missing data, HTML escaping, ROI scope, SQL and restricted reader permissions. Imported copies remain under the customer's control.

```bash
python -m pip install -r scripts/hex-template-requirements.txt
python scripts/test_hex_templates.py
```

Set `HEX_TEST_DSN` only to a disposable database to include SQL and role checks. The test creates tables and roles; discard the database afterward.

## Changelog

- 2.0.0: adds a team-first cost template over daily team spend and team display names. Removes the credential-table dependency. Team filters and ROI inputs use team IDs.
- 1.1.0: adds a daily aggregate variant, superseded by the team template.
- 1.0.0: project cost, model mix, complete-day comparisons and validated business ROI inputs.
