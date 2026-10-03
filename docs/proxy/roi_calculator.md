---
title: ROI Calculator
description: Compare LiteLLM gateway spend with estimated engineering effort for merged GitHub pull requests or GitLab merge requests in the Admin UI.
---

# ROI Calculator

The ROI Calculator compares your team's gateway spend with the estimated engineering effort in their merged GitHub pull requests or GitLab merge requests. Open **Observability > ROI Calculator** in the LiteLLM Admin UI to connect repositories, choose an estimator model, and generate a report.

The main metric is **spend per estimated engineering hour**. Hours are model estimates of the effort required to complete the work without AI assistance. They are not measured working hours, hours saved, or a financial return on investment.

:::info Availability
This page covers the native Admin UI calculator added in [LiteLLM PR #43669](https://github.com/BerriAI/litellm/pull/43669), plus GitLab sources and branch cost attribution in [LiteLLM PR #44324](https://github.com/BerriAI/litellm/pull/44324). Use a gateway build that includes the features you need. The [original launch post](/blog/litellm-roi-calculator) describes the earlier standalone application.
:::

## Before you start

Use a gateway with a connected database, recorded user spend, and at least one configured model. The calculator reads daily user spend from the gateway database; there is no separate gateway connection to configure.

Sign in as a **Proxy Admin** to configure the calculator, run analysis, or change email matches. **Proxy Admin Viewer** users can read reports and settings. Other roles cannot access the calculator.

Choose GitHub or GitLab. Public repositories can be read without a token, subject to the provider's unauthenticated rate limits. For private GitHub repositories, use a token with read access to **Pull requests**, **Contents**, and repository metadata. Organization approval or SSO authorization may also be required. For private GitLab projects, use a personal access token with **read_api** scope and membership that allows access to those projects.

The integrations support configurable HTTPS API URLs for GitHub Enterprise and self-managed GitLab. One source and API host are active at a time.

## Set up the calculator

### 1. Connect your source

Choose **GitHub** or **GitLab**, enter an access token if needed, and select **Continue**. For a self-managed installation, expand the API settings and enter its HTTPS API URL, such as `https://github.example.com/api/v3` or `https://gitlab.example.com/api/v4`.

Tokens are encrypted when saved and are not returned to the browser. Changing an API URL clears that source's saved token unless you supply a replacement. Switching source or API host starts a new report and clears manual email matches.

### 2. Choose repositories

Select the repositories to include. Use **Search repositories**, **Load repositories**, and **Load more repositories** to find them. You can also expand **Add a repository by name** and enter an `owner/repository` name for GitHub or a `group/subgroup/project` path for GitLab. Without a token, add a public repository by name.

Only pull requests or merge requests merged during the report period are included. Open changes and changes closed without merging are excluded. The following sections use “PR” for either type unless they name a provider.

### 3. Choose an estimator

Select an **Estimator model** from the models configured on your gateway. Set **Backfill days** to the reporting window and **Update interval (hours)** to the refresh frequency. The defaults are seven days and 24 hours. Set the interval to `0` for manual updates; automatic intervals must be at least five minutes. Scheduled updates run while the gateway is running.

Under **Advanced estimator options**, you can edit the estimation prompt. The default asks the model to estimate engineering effort without AI assistance and briefly explain the estimate.

Under **Advanced settings**, you can provide an **Estimator API key**. Otherwise, estimation uses the gateway admin key. A dedicated inference key owned by a separate service user keeps estimation costs out of engineers' user-level spend. The key must have access to the chosen model.

Select **Start backfill**. The calculator reads spend, imports merged PRs, and estimates up to three PRs at a time. After setup, use **Run analysis** for a manual refresh or **Settings** to change the configuration. **Test connections** checks model access and repository access without running an estimate.

Select **Preview sample report** to explore the calculator before or after setup. The demo opens in **By branch** with fictional PR costs, including a PR whose author has no email match and spending on an unmerged branch. Open a PR to see its cost, request count, and example tags. **Exit demo** returns to your live report or setup without changing saved data. Sample mode makes no source-provider or model requests.

## Read the report

### Overview

The overview has **By person** and **By branch** controls. **By person** compares gateway usage with work by matched people. **By branch** compares tagged request costs with individual merged changes. Settings open from the top-right button; **Overview** and **People** remain the two report views. The cost view stays selected when you switch between them.

The default **By person** view shows spend per estimated engineering hour, matched gateway spend, estimated engineering hours, and email coverage. Expand **How this is calculated** to see the calculation and excluded spend.

For example, `$120` of matched spend divided by `30` estimated hours gives `$4` per estimated engineering hour. Both numbers come from the same set of eligible people and the same reporting period.

The chart places daily gateway spend alongside estimated effort for PRs merged on each day. A PR's estimated hours appear on its merge date; this does not mean the work or its AI usage happened on that date. Dates and reporting boundaries use UTC, and the window includes the current day.

The **Merged work** table lists merged pull requests or merge requests. In the **By branch** view, it is titled **Costs by branch**. Select a PR to see its estimated hours, reasoning, model, merge date, and email match. **View on GitHub** or **View on GitLab** opens the original change. In branch mode, the table also shows tagged spend. Open a change to see its exact cost, request count, and the tags to send.

### People and email matching

The **People** view shows gateway spend, estimated hours, and spend per estimated hour for each person. It can also export a people CSV.

Automatic matching compares the PR author's public GitHub email and commit emails associated with that author's GitHub account against gateway user emails. GitLab uses the author’s public profile email. It does not assume that commit emails belong to the merge request author. Matching ignores case. GitHub noreply addresses are ignored, and multiple matching emails remain ambiguous.

To correct a match, select the person's source-control username, enter their **Gateway email**, and save. Manual matches take priority. **Use automatic match** removes a manual mapping. Email corrections update the report without rerunning model estimates.

### What enters the calculation

A person enters the main ratio when they have a gateway spend record, at least one estimated PR, and no pending or failed PR estimates in the selected period. A person with an incomplete estimate is excluded together with their spend, so missing effort is not treated as zero hours.

Matched spend includes each eligible person's **full gateway usage for the period, across repositories and tasks**. Selecting repositories changes which PRs are analyzed; it does not filter their gateway spend to those repositories. A PR's author receives the estimate even when several people contributed to it.

Unmatched spend remains visible as excluded spend. PR email coverage measures email matches; it does not indicate how much AI usage has been attributed to individual PRs. The ratio is unavailable when there are no eligible estimated hours, or when any selected repository could not be read.

## Attribute actual request costs to branches

In **Overview**, choose **By branch**. Send a repository tag and a branch tag together on each model request through LiteLLM:

```json
{
  "model": "your-gateway-model",
  "messages": [{"role": "user", "content": "Help implement this change"}],
  "metadata": {
    "tags": [
      "repo:gitlab.com/acme/platform/api",
      "branch:feature/search"
    ]
  }
}
```

For GitHub, the repository tag looks like `repo:github.com/acme/api`. Use the source repository and source branch from the PR or MR, including the fork when the change comes from a fork. The change's details show the exact tags to use. For self-managed hosts, include the host and repository path, without the API suffix. Branch names are case-sensitive. GitHub repository names are matched without case sensitivity; GitLab project paths must match the displayed path.

You can also send the same pair through the `x-litellm-tags` header. See [Request tags](./request_tags.md) for client setup. The calculator does not automatically detect your Git branch or configure your coding tool: the tool or wrapper making each gateway request must send both tags.

Run analysis after the requests have been recorded. The calculator sums their recorded gateway costs across users and keys, so branch matching does not require an email match. Repeated identical tags count a request once. Missing tags or conflicting repository or branch tags exclude the request from branch attribution. Requests tagged `litellm-roi-estimator` are excluded.

**Branch spend per estimated hour** divides the cost of uniquely matched branches with successful estimates by those same changes' estimated hours. No tagged requests means unknown cost, displayed as **No tagged requests**. A recorded request costing zero is a real zero. When multiple merged changes in the report share a source branch, the calculator marks the branch ambiguous rather than charging the same spend twice. Unmatched or ambiguous costs remain visible as unallocated spend.

Branch costs cover retained request logs within the report's UTC dates. They are not lifetime branch costs. Requests outside the window, before tagging began, omitted from gateway logs, or removed by spend-log retention cannot be recovered. Reusing branch names outside the report window cannot be distinguished by these tags; use a unique branch for each change. This is recorded model usage cost, not a provider invoice or a measure of time saved.

## Estimation, caching, and data handling

The estimator receives PR titles and descriptions, file names and change counts, and commit metadata, including commit messages. Source-code patches are not included in the model request. Descriptions and commit messages can still contain sensitive information, so choose a model appropriate for that data.

Estimation requests go through your gateway and incur normal model usage charges. They carry the `litellm-roi-estimator` tag. Branch spend excludes these requests. The calculator's user-spend query does not automatically subtract them, so use a separate service user for the estimator when comparing people.

Successful estimates are cached. Unchanged PRs reuse their estimates while branch costs refresh; changes to the selected model, prompt, or relevant PR metadata invalidate the cache. Incomplete metadata and oversized inputs are marked for review rather than silently truncated and estimated. Failed estimates are retried on later analysis runs.

Settings, the latest report, and cached estimates are stored in the gateway database. A failed sync leaves the previous report available. Check the last-sync time and any warning before interpreting results.

## Troubleshooting

| What you see | What to check |
| --- | --- |
| ROI Calculator is missing | Use a build containing the native calculator and sign in as a proxy admin or admin viewer. |
| Repositories cannot be loaded | Save the token and API URL first. Check repository selection, token permissions, expiry, and any organization approval requirements. |
| The selected model is unavailable | Confirm the model is configured and accessible to the estimator key. Run **Test connections**. |
| A person is unmatched | Check their gateway user email and correct the mapping in **People**. Private, noreply, or ambiguous email data may prevent an automatic match. |
| A PR needs attention | Open its details. Incomplete file or commit metadata, oversized input, or an invalid model response can prevent estimation. Run analysis again after resolving the cause. |
| Spend per estimated hour is unavailable | Check for unavailable repositories, unmatched people or branches, incomplete estimates, or zero estimated hours. |
| No tagged requests | Check that each request sends both exact tags and falls within the report dates and retained spend logs, then run analysis. |
| A branch is ambiguous | Use distinct source branches for changes. The calculator cannot split one branch’s costs between multiple merged changes in the report. |

See [Spend Tracking](./cost_tracking.md) for gateway cost reporting and [Admin UI](./ui.md) for dashboard setup.
