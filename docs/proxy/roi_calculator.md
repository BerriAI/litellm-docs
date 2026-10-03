---
title: ROI Calculator
description: Compare LiteLLM gateway spend with estimated engineering effort for merged GitHub pull requests or GitLab merge requests in the Admin UI.
---

# ROI Calculator

Compare your team's AI spend with estimated engineering effort across merged GitHub pull requests and GitLab merge requests.

Open **Observability > ROI Calculator** in the LiteLLM Admin UI to get started.

## Before you start

You need a gateway with a connected database, recorded user spend, and at least one configured model.

Sign in as a **Proxy Admin** to set up the calculator. **Proxy Admin Viewer** users can read reports and settings.

Public repositories work without a token. For private repositories, use a GitHub token with read access to **Pull requests**, **Contents**, and repository metadata, or a GitLab token with **read_api** scope and project access.

## Set up the calculator

### 1. Connect your source

Choose **GitHub** or **GitLab**, enter an access token if needed, and select **Continue**. For GitHub Enterprise or self-managed GitLab, expand the API settings and enter its HTTPS API URL, such as `https://github.example.com/api/v3` or `https://gitlab.example.com/api/v4`.

Tokens are encrypted when saved. Changing an API URL clears its saved token. Switching source or API host starts a new report and clears manual email matches.

### 2. Choose repositories

Select the repositories to include. Use **Search repositories**, **Load repositories**, and **Load more repositories** to find them. You can also expand **Add a repository by name** and enter an `owner/repository` name for GitHub or a `group/subgroup/project` path for GitLab. Without a GitHub token, add a public repository by name. GitLab also supports browsing public projects without a token.

Reports include pull requests and merge requests merged during the selected period. The sections below use “PR” for both.

### 3. Choose an estimator

Select an **Estimator model** from the models configured on your gateway. Set **Backfill days** to the reporting window and **Update interval (hours)** to the refresh frequency. The defaults are seven days and 24 hours. Set the interval to `0` for manual updates; automatic intervals must be at least five minutes. Scheduled updates run while the gateway is running.

Under **Advanced estimator options**, you can edit the estimation prompt. The default asks the model to estimate engineering effort without AI assistance and briefly explain the estimate.

Under **Advanced settings**, you can provide an **Estimator API key**. Otherwise, estimation uses the gateway admin key. A dedicated inference key owned by a separate service user keeps estimation costs out of engineers' user-level spend. The key must have access to the chosen model.

Select **Start backfill** to generate your first report. After setup, use **Run analysis** to refresh it or **Settings** to change the configuration. **Test connections** checks model and repository access.

Select **Preview sample report** to explore example PR costs, request counts, and tags before connecting your repositories. **Exit demo** returns to your own data. You can also open the sample directly at `/roi-calculator/?demo=1`.

## Read the report

### Overview

The report has three tabs: **Overview**, **People**, and **Branches**. Settings open from the top-right button.

**Overview** shows total gateway AI cost, estimated effort, merged changes, and contributors for the reporting period. The cost-coverage table shows how much spending is matched or unmatched in each view. People use gateway account costs, while branches use tagged requests for the selected repositories, so these rows are different views of spending and should not be added together.

**Highest-cost changes** ranks up to five merged PRs with uniquely matched branch costs. Open a change for its recorded cost, request count, estimate, and matching details, or select **View all branches** for the complete list. Dates and reporting boundaries use UTC, and the window includes the current day.

### People and email matching

The **People** tab shows spend per estimated engineering hour, matched gateway spend, estimated hours, and email coverage. Hours estimate the effort to complete the work without AI assistance. For example, `$120` of matched spend divided by `30` estimated hours gives `$4` per estimated hour. Expand **How this is calculated** for the calculation and excluded spend.

The table shows gateway spend, estimated hours, and spend per estimated hour for each person. It can also export a people CSV.

Automatic matching compares the PR author's public GitHub email and commit emails associated with that author's GitHub account against gateway user emails. GitLab uses the author’s public profile email. It does not assume that commit emails belong to the merge request author. Matching ignores case. GitHub noreply addresses are ignored, and multiple matching emails remain ambiguous.

To correct a match, select the person's source-control username, enter their **Gateway email**, and save. Manual matches take priority. **Use automatic match** removes a manual mapping. Email corrections update the report without rerunning model estimates.

### What enters the calculation

A person enters the main ratio when they have a gateway spend record, at least one estimated PR, and no pending or failed PR estimates in the selected period. A person with an incomplete estimate is excluded together with their spend, so missing effort is not treated as zero hours.

Matched spend includes each eligible person's **full gateway usage for the period, across repositories and tasks**. Selecting repositories changes which PRs are analyzed; it does not filter their gateway spend to those repositories. A PR's author receives the estimate even when several people contributed to it.

Unmatched spend remains visible as excluded spend. PR email coverage measures email matches; it does not indicate how much AI usage has been attributed to individual PRs. The ratio is unavailable when there are no eligible estimated hours, or when any selected repository could not be read.

## Attribute actual request costs to branches

Open the **Branches** tab for matched AI costs, estimated effort, cost per estimated hour, and branch coverage. The **Costs by branch** table shows each merged change, its source branch, and its tagged AI cost. Search by title, repository, PR number, author, or branch name. Open a change to see the exact cost, request count, estimate, and tags to send. **View on GitHub** or **View on GitLab** opens the original change.

Send a repository tag and a branch tag together on each model request through LiteLLM:

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

You can also send the same pair through the `x-litellm-tags` header. Configure your coding tool or wrapper to send both tags on each gateway request. See [Request tags](./request_tags.md) for client setup.

Run analysis after the requests have been recorded. The calculator sums their recorded gateway costs across users and keys, so branch matching does not require an email match. Repeated identical tags count a request once. Missing tags or conflicting repository or branch tags exclude the request from branch attribution. The calculator excludes its own estimation requests.

**Branch spend per estimated hour** divides the cost of uniquely matched branches with successful estimates by those same changes' estimated hours. No tagged requests means unknown cost, displayed as **No tagged requests**. A recorded request costing zero is a real zero. When multiple merged changes in the report share a source branch, the calculator marks the branch ambiguous rather than charging the same spend twice. Unmatched or ambiguous costs remain visible as unallocated spend.

Branch costs cover retained request logs within the report's UTC dates. Use a unique branch for each change so costs can be attributed to one PR.

## Estimation and caching

The estimator uses PR titles and descriptions, file names and change counts, and commit metadata. Source-code patches are not sent to the model.

Estimation requests go through your gateway and incur normal model usage charges. They carry the `litellm-roi-estimator` tag. Branch spend excludes these requests. The calculator's user-spend query does not automatically subtract them, so use a separate service user for the estimator when comparing people.

Successful estimates are cached. Unchanged PRs reuse their estimates while branch costs refresh; changes to the selected model, prompt, or relevant PR metadata invalidate the cache. Incomplete metadata and oversized inputs are marked for review rather than silently truncated and estimated. Failed estimates are retried on later analysis runs.

Settings, reports, and cached estimates are stored in the gateway database. A failed sync keeps the previous report available.

## Troubleshooting

| What you see | What to check |
| --- | --- |
| ROI Calculator is missing | Sign in as a Proxy Admin or Proxy Admin Viewer. |
| Repositories cannot be loaded | Save the token and API URL first. Check repository selection, token permissions, expiry, and any organization approval requirements. |
| The selected model is unavailable | Confirm the model is configured and accessible to the estimator key. Run **Test connections**. |
| A person is unmatched | Check their gateway user email and correct the mapping in **People**. Private, noreply, or ambiguous email data may prevent an automatic match. |
| A PR needs attention | Open its details. Incomplete file or commit metadata, oversized input, or an invalid model response can prevent estimation. Run analysis again after resolving the cause. |
| Spend per estimated hour is unavailable | Check for unavailable repositories, unmatched people or branches, incomplete estimates, or zero estimated hours. |
| No tagged requests | Check that each request sends both exact tags and falls within the report dates and retained spend logs, then run analysis. |
| A branch is ambiguous | Use distinct source branches for changes. The calculator cannot split one branch’s costs between multiple merged changes in the report. |

See [Spend Tracking](./cost_tracking.md) for gateway cost reporting and [Admin UI](./ui.md) for dashboard setup.
