---
slug: hex-litellm-roi
title: "Use Hex to analyze LiteLLM costs, then set budgets and routing"
date: 2026-10-30T09:00:00
authors:
  - ishaan
description: "Connect Hex to LiteLLM’s Postgres data, import a cost dashboard, then use the LiteLLM UI to set a budget or change model routing."
tags: [observability, cost tracking, ai-gateway]
hide_table_of_contents: true
custom_hero: true
---

import { HexPage, TemplateDownloads, SpendDataFlow } from './diagrams';

<HexPage>

LiteLLM records AI costs in Postgres and maintains daily spend totals. Hex connects to that database and reads the totals. Use the dashboard to find a cost increase, then open LiteLLM to change routing or set a budget.

## 1. Connect Hex to your LiteLLM Postgres database

In Hex, open **Settings → Data sources → + Connection → Postgres**. Add a read-only connection to the database your LiteLLM gateway uses.

<SpendDataFlow />

The template reads two existing tables: **LiteLLM_DailyTeamSpend** for costs and usage, and **LiteLLM_TeamTable** for team display names. It groups the results by day, team and model. Give the reader access to those reporting fields. It does not need your key table, prompts or responses.

[Connection details and SQL permissions](/docs/observability/hex#connect-postgres).

## 2. Add the template and inspect your costs

Open the [live Hex demo](https://app.hex.tech/01a18e4b-6e94-7328-831c-e5ab0e2e00e7/app/LiteLLM-AI-cost-and-ROI-demo-034p688gOAllaldLw72Oat/latest) first. You can filter it without signing in. Its records are synthetic.

To use your own data, download the Postgres template below. In **Hex Home**, click **+ → Upload project**, then click **Upload** in the dialog and choose the `.hex.yaml` file. Select your Postgres connection on the **Source** SQL cell and **Run all**.

![Hex dialog for uploading a YAML project](/img/hex/import-project.png)

<div id="get-the-template" />

<TemplateDownloads />

Filter by team. Compare recorded spend, request volume and cost per thousand requests, then open **Models and cost changes**. In the demo, the Legal team's document-review workload switches models and unit cost rises 80%.

## 3. Take an action in LiteLLM

Use Hex to investigate the increase. Apply the change through your LiteLLM gateway.

| Your decision | In the LiteLLM UI |
| --- | --- |
| Try a cheaper model | Open **Teams → your team → Settings → Edit Settings → Model Aliases**. Change the model behind an alias your application already calls, then save. Evaluate the candidate on your workload first. |
| Route by request complexity | Open **Models + Endpoints → Auto Router → Add Auto Router**. Choose the models for each tier, test routing and connections, then save. Configure your application or team alias to call that router. |
| Set a spending limit | Open **Teams → your team → Settings → Edit Settings**. Set **Max Budget (USD)** and **Reset Budget**, then save. |

For example, select **Legal** in LiteLLM and set **Max Budget (USD)** to **1000** and **Reset Budget** to **monthly** (30 days). This limits new spend; it does not change recorded costs.

![Set Legal’s budget in the LiteLLM team settings](/img/hex/litellm-budget-edit.png)

*Current LiteLLM UI with synthetic local gateway data.*

After saving, check the team's budget status. Then refresh Hex after LiteLLM updates its daily totals to compare the next complete period. Set a Hex scheduled run if you want the report to refresh on a schedule.

![Legal’s budget status after saving](/img/hex/litellm-budget-saved.png)

[Auto Router setup](/docs/auto_router/setup) · [Team budgets](/docs/proxy/team_budgets)

</HexPage>

{/* truncate */}
