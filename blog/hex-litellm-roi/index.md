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

import { HexPage, TemplateDownloads, SpendDataFlow, SetupSteps } from './diagrams';

<HexPage>

LiteLLM records request costs across providers, with model, token usage and ownership in one spend log. Use our Hex template to compare project costs, investigate model changes and share a report with Finance.

## From a spend log to your Hex board

LiteLLM already maintains `LiteLLM_DailyTeamSpend`. The quick-setup template reads those daily totals, then looks up each key's current project in `LiteLLM_VerificationToken`. Hex receives project, team and model aggregates.

<SpendDataFlow />

The query returns recorded cost, requests, tokens and success/failure counts. It returns no key values. Deleted keys stay in the totals under `(unassigned)`; reassigned keys use their current project. Review that mapping before using historical project or ROI reports.

## Connect once. Run your report.

If Hex already has a read-only connection to your LiteLLM Postgres database, use it. Select the daily-aggregate template. You do not need to install a database view or create a replica.

<SetupSteps />

<div id="get-the-template" />

<TemplateDownloads />

Your connection needs the daily team spend table and the key table's `token` and `project_id` columns. Database connectivity and permissions still need configuration in Hex. The [setup guide](/docs/observability/hex) covers access, retention and an optional request-log source for latency, TTFT and response-cache metrics.

## Report costs by project, team and model

Use **Overview** to rank project spend and compare request volume, unit cost and daily trends. Open **Models and cost changes** to review model mix alongside increases across two complete seven-day windows.

In the synthetic demo, document-review's unit cost rises 80% after a model change. Use the same comparison to investigate your own traffic before changing routes.

## Add business value when you need ROI

The **Business ROI** tab combines LLM spend with business value and other project costs you supply. It leaves ROI unknown until the inputs match the project and reporting period. Token counts alone do not establish business returns.

Publish the board to your team and configure a Hex scheduled run to refresh it. We version the templates and test their metrics, SQL and access rules. Imported copies stay under your control.

Read the [setup guide and metric definitions](/docs/observability/hex), or [share feedback on the integration](https://docs.google.com/forms/d/e/1FAIpQLSdySd34qAyNpGU3bzeYS-BSSkyIspDcXaLVsVqyWJPSdE4LfQ/viewform).

</HexPage>

{/* truncate */}
