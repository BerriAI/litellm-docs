---
slug: hex-litellm-roi
title: "LiteLLM cost reporting, now in Hex"
date: 2026-10-30T09:00:00
authors:
  - ishaan
description: "Report AI spend by project, team and model with LiteLLM. Use our Hex template to explore unit costs, investigate increases and add business ROI."
tags: [observability, cost tracking, ai-gateway]
hide_table_of_contents: true
custom_hero: true
---

import { HexPage, TemplateDownloads } from './diagrams';

<HexPage>

LiteLLM tracks the cost of requests through your AI Gateway, with model, token usage and ownership in the same spend log. Use those records to report costs across providers and charge spend back to the teams that own it.

With our Hex template, you can take that reporting into your own analytics workspace. Compare project costs, investigate a model change and share a board with Finance. Connect Hex to the Postgres logs you already store with LiteLLM.

<div id="get-the-template" />

<TemplateDownloads />

## Cost reporting starts at the request

You need more than a monthly provider bill to explain an increase in AI spend. In LiteLLM, you can trace recorded cost to the model and request, then group usage by key, user or team. Track token usage alongside cost and set budgets in your gateway.

The Hex template builds on that foundation. It groups your stored spend logs by project, team and model, with request volume and timing aggregates. You can compare cost per thousand requests alongside total spend, so a busier project does not look like a more expensive route by default.

## Start with the projects behind your AI Gateway spend

Open the board to see a ranked table of projects and their teams. Each row includes spend, request volume, cost per thousand requests and share of the selected spend. Use the Project and Entity inputs to inspect one scope, then review its daily trend.

![LiteLLM project cost template running in Hex with synthetic demo data](/img/hex/roi-overview.png)

*Hex preview with synthetic records. The amounts do not represent customer traffic.*

The template has three tabs:

| Tab | Review |
| --- | --- |
| Overview | Project and entity spend, usage, cache hits, latency and daily trends. |
| Models and cost changes | Model mix and increases across two seven-day windows. |
| Business ROI | Validated business value against LLM and other project costs. |

## Connect the data you store in Postgres

If you store spend logs in Postgres, your AI Gateway records requests in `LiteLLM_SpendLogs`. Connect Hex to a daily aggregate view of that table through a read-only database account.

Ask your database administrator to run our [setup SQL](/hex/setup-postgres.sql) and provision a reader for `litellm_analytics.spend_daily_v1`. The view includes identifiers, models, cost, token counts and timing aggregates. Your administrator grants the reader access to that view, keeping request content, responses and key hashes outside the board.

For a large deployment, query a read replica. Confirm your log retention and project mapping before comparing periods. The template reads project IDs from spend-log metadata and keeps team IDs in a separate Entity column.

In Hex, open **Settings → Data sources → + Connection → Postgres**. Enter the reader's connection details and refresh its schema.

![Hex Postgres connection setup with blank authentication fields](/img/hex/postgres-connection.png)

Follow [Hex's Postgres connection instructions](https://learn.hex.tech/docs/connect-to-data/data-connections/setup-guides/connect-to-postgres) for network access and authentication. Keep credentials in the connection settings.

## Import the template and select your source

Download the [Postgres template](/hex/litellm_roi_postgres.hex.yaml). On Hex Home, open the **+ menu → Upload project** and choose the `.hex.yaml` file. Select your Postgres connection on the **Source** SQL cell, then run all cells.

The board defaults to the last 30 complete UTC days. It excludes today so a partial day does not distort a comparison. In the Settings cell, change `report_start` and `report_end` for another window within your retained history. The end date is exclusive.

To explore the board before connecting your database, import the [demo template](/hex/litellm_roi_demo.hex.yaml). It uses synthetic records and includes one example of a project switching to a more expensive model.

## Review a cost increase alongside model usage

The cost-change table compares seven complete days with the preceding seven. It flags a project when recorded cost increases by more than 25% and at least $10, with records on each day of both windows. The table includes unit-cost change so you can check whether higher traffic explains the increase.

![Hex model mix and cost-change table with synthetic records](/img/hex/roi-cost-changes.png)

A flagged row starts a review. Inspect model mix, request volume and workload changes before changing a route. Test candidate models on your own evaluation set before moving production traffic.

The cache metric measures LiteLLM response-cache hits. Provider prompt caching needs provider cache-token usage and a pricing baseline. The template leaves cache savings out of the calculation.

## Add business value before calling it ROI

Spend logs give you LLM costs and usage. Finance or the project owner must supply business value and costs outside the AI Gateway.

In Settings, add one `value_data` row per project for the report window. Use realized revenue or a Finance-approved avoided-cost estimate. Include infrastructure, automation, licenses and labor in `other_cost_usd`.

```python
value_data = pd.DataFrame([{
    "project_id": "support-assistant",
    "value_usd": 5000,
    "other_cost_usd": 1000,
    "coverage_start": report_start,
    "coverage_end": report_end,
}])
```

Replace these example amounts with validated inputs. The board computes:

```text
ROI = (business value - LLM spend - other costs)
      / (LLM spend + other costs)
```

You will see “Needs validated business value” until you provide a matching project and report window with recorded spend on each day and no flagged unknown costs. An Entity filter leaves ROI unknown because the business-value input covers a full project. Check logging completeness and currency before using the result for financial reporting.

## Publish a board your team can keep using

Publish the App and choose its audience. Set a Hex scheduled run to refresh results, then assign an owner to check failed runs and data coverage. Configure Hex notifications if you want messages about cost changes; the template does not send alerts.

Use database permissions and Hex sharing for department access. Project and Entity inputs filter the report, so viewers can change those inputs within the data their connection exposes.

We keep the YAML, SQL contract and tests in the [template source directory](https://github.com/BerriAI/litellm-docs/tree/main/static/hex). Each release has a version and changelog. Imported copies stay under your control: review a newer version in a separate project before replacing a published board.

## FAQ

### Does this require S3 or a new Hex callback?

You can use the Postgres template with existing LiteLLM spend logs. The [integration guide](/docs/observability/hex) also covers an optional S3 and Athena route for deployments that need a separate export.

### Does the board update after import?

Configure a Hex scheduled run to refresh its data. Template updates follow a separate process: import the newer version, reconnect the Source cell, review the results and publish it.

### Can Hex calculate revenue or time saved from token counts?

Token counts do not establish business returns. Supply validated project outcomes and account for costs outside LiteLLM.

### Can I use this with LiteLLM OSS?

You can use the template with an OSS deployment that stores compatible spend logs in Postgres. Your Hex workspace must support the connection and publishing features you choose; Hex manages its own plan requirements.

## Build your cost report in Hex

Import the demo to explore the board. When you are ready, connect the Postgres template to your spend logs using the [Hex setup guide](/docs/observability/hex). Review project mapping and metric definitions with your platform and finance teams before publishing.

<TemplateDownloads />

## Further reading

- [Hex and LiteLLM setup](/docs/observability/hex)
- [LiteLLM spend tracking](/docs/proxy/cost_tracking)
- [Hex Postgres connection](https://learn.hex.tech/docs/connect-to-data/data-connections/setup-guides/connect-to-postgres)

</HexPage>

{/* truncate */}
