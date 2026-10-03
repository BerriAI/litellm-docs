---
title: ROI Calculator
description: Compare LiteLLM gateway spend with estimated engineering effort for merged GitHub pull requests in the Admin UI.
---

# ROI Calculator

The ROI Calculator compares your team's gateway spend with the estimated engineering effort in their merged GitHub pull requests. Open **Observability > ROI Calculator** in the LiteLLM Admin UI to connect repositories, choose an estimator model, and generate a report.

The main metric is **spend per estimated engineering hour**. Hours are model estimates of the effort required to complete the work without AI assistance. They are not measured working hours, hours saved, or a financial return on investment.

:::info Availability
This page covers the native Admin UI calculator added in [LiteLLM PR #43669](https://github.com/BerriAI/litellm/pull/43669). Use a gateway build that includes that change. The [original launch post](/blog/litellm-roi-calculator) describes the earlier standalone application.
:::

## Before you start

Use a gateway with a connected database, recorded user spend, and at least one configured model. The calculator reads daily user spend from the gateway database; there is no separate gateway connection to configure.

Sign in as a **Proxy Admin** to configure the calculator, run analysis, or change email matches. **Proxy Admin Viewer** users can read reports and settings. Other roles cannot access the calculator.

Have a GitHub token with access to the repositories you want to analyze. For a fine-grained token, grant read access to **Pull requests**, **Contents**, and repository metadata for those repositories. The integration reads pull requests, changed-file metadata, and commit metadata. Organization approval or SSO authorization may also be required by your GitHub organization.

The current integration supports GitHub and a configurable GitHub Enterprise API URL. GitLab is not supported.

## Set up the calculator

### 1. Connect GitHub

Enter your **GitHub token** and select **Continue**. For GitHub Enterprise, expand **GitHub Enterprise settings** and enter your HTTPS API URL, such as `https://github.example.com/api/v3`, before saving the token.

Tokens are encrypted when saved and are not returned to the browser. Changing the API URL clears the saved GitHub token unless you supply a replacement.

### 2. Choose repositories

Select the repositories to include. Use **Search repositories**, **Load repositories**, and **Load more repositories** to find them. You can also expand **Add a repository by name** and enter an `owner/repository` name.

Only pull requests merged during the report period are included. Open PRs and PRs closed without merging are excluded.

### 3. Choose an estimator

Select an **Estimator model** from the models configured on your gateway. Set **Backfill days** to the reporting window and **Update interval (hours)** to the refresh frequency. The defaults are seven days and 24 hours. Set the interval to `0` for manual updates; automatic intervals must be at least five minutes. Scheduled updates run while the gateway is running.

Under **Advanced estimator options**, you can edit the estimation prompt. The default asks the model to estimate engineering effort without AI assistance and briefly explain the estimate.

Under **Advanced settings**, you can provide an **Estimator API key**. Otherwise, estimation uses the gateway admin key. A dedicated inference key owned by a separate service user keeps estimation costs out of engineers' user-level spend. The key must have access to the chosen model.

Select **Start backfill**. The calculator reads spend, imports merged PRs, and estimates up to three PRs at a time. After setup, use **Run analysis** for a manual refresh or **Settings** to change the configuration. **Test connections** checks model access and repository access without running an estimate.

You can select **Preview sample report** before your first report to explore the interface. Sample mode makes no GitHub or model requests.

## Read the report

### Overview

The overview shows spend per estimated engineering hour, matched gateway spend, estimated engineering hours, and PR email coverage. Expand **Calculation details** to see the calculation and excluded spend.

For example, `$120` of matched spend divided by `30` estimated hours gives `$4` per estimated engineering hour. Both numbers come from the same set of eligible people and the same reporting period.

The chart places daily gateway spend alongside estimated effort for PRs merged on each day. A PR's estimated hours appear on its merge date; this does not mean the work or its AI usage happened on that date. Dates and reporting boundaries use UTC, and the window includes the current day.

The **Pull requests** table lists merged work. Select a PR to see its estimated hours, reasoning, model, merge date, and email match. **View on GitHub** opens the original PR.

### People and email matching

The **People** view shows gateway spend, estimated hours, and spend per estimated hour for each person. It can also export a people CSV.

Automatic matching compares the PR author's public GitHub email and commit emails associated with that author's GitHub account against gateway user emails. Matching ignores case. GitHub noreply addresses are ignored, and multiple matching emails remain ambiguous.

To correct a match, select the person's GitHub username, enter their **Gateway email**, and save. Manual matches take priority. **Use automatic match** removes a manual mapping. Email corrections update the report without rerunning model estimates.

### What enters the calculation

A person enters the main ratio when they have a gateway spend record, at least one estimated PR, and no pending or failed PR estimates in the selected period. A person with an incomplete estimate is excluded together with their spend, so missing effort is not treated as zero hours.

Matched spend includes each eligible person's **full gateway usage for the period, across repositories and tasks**. Selecting repositories changes which PRs are analyzed; it does not filter their gateway spend to those repositories. A PR's author receives the estimate even when several people contributed to it.

Unmatched spend remains visible as excluded spend. PR email coverage measures email matches; it does not indicate how much AI usage has been attributed to individual PRs. The ratio is unavailable when there are no eligible estimated hours, or when any selected repository could not be read.

## Estimation, caching, and data handling

The estimator receives PR titles and descriptions, file names and change counts, and commit metadata, including commit messages. Source-code patches are not included in the model request. Descriptions and commit messages can still contain sensitive information, so choose a model appropriate for that data.

Estimation requests go through your gateway and incur normal model usage charges. They carry the `litellm-roi-estimator` tag. The calculator's user-spend query does not automatically subtract requests with this tag.

Successful estimates are cached. Unchanged PRs reuse their estimates; changes to the selected model, prompt, or relevant PR metadata invalidate the cache. Incomplete metadata and oversized inputs are marked for review rather than silently truncated and estimated. Failed estimates are retried on later analysis runs.

Settings, the latest report, and cached estimates are stored in the gateway database. A failed sync leaves the previous report available. Check the last-sync time and any warning before interpreting results.

## Troubleshooting

| What you see | What to check |
| --- | --- |
| ROI Calculator is missing | Use a build containing the native calculator and sign in as a proxy admin or admin viewer. |
| Repositories cannot be loaded | Save the token and API URL first. Check repository selection, token permissions, expiry, and any organization approval requirements. |
| The selected model is unavailable | Confirm the model is configured and accessible to the estimator key. Run **Test connections**. |
| A person is unmatched | Check their gateway user email and correct the mapping in **People**. Private, noreply, or ambiguous email data may prevent an automatic match. |
| A PR needs attention | Open its details. Incomplete file or commit metadata, oversized input, or an invalid model response can prevent estimation. Run analysis again after resolving the cause. |
| Spend per estimated hour is unavailable | Check for unavailable repositories, unmatched people, incomplete estimates, or zero estimated hours. |

## Can I track actual branch or PR costs?

The current ROI Calculator does not attribute spend to a branch or PR. It does not read request tags, and its PR records do not store branch names.

LiteLLM separately supports [request tags for spend tracking](./request_tags.md), including dynamic tags supplied through `x-litellm-tags` or `metadata.tags`. Sending a branch tag records that tag on gateway requests, but does not connect those costs to an ROI report. Branch-level attribution requires additional integration.

See [Spend Tracking](./cost_tracking.md) for gateway cost reporting and [Admin UI](./ui.md) for dashboard setup.
