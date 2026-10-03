---
title: ROI Calculator
description: Compare shipping velocity, issue trends, and recorded AI spend per engineer across GitHub and GitLab repositories
---

# ROI Calculator

Compare your team's merged changes, time to merge, bug reports, and recorded AI spend across GitHub and GitLab repositories

The ROI Calculator combines repository activity with spend recorded by your LiteLLM gateway. Link repository accounts to internal users to see shipping velocity and spend per merged change for each engineer. Open **Observability > ROI Calculator** in the Admin UI

## Connect repositories

Use a gateway with a connected database. **Proxy Admin** users can configure connections, link accounts, and sync. **Proxy Admin Viewer** users can read reports

Open **Connections**, then connect **GitHub** or **GitLab** using an app or an access token. Select repositories and choose **Save and sync**. You can select several repositories, including nested GitLab projects. **Add connection** lets you keep GitHub and GitLab connected together, including self-hosted instances. Each connection keeps its own credentials, repositories, and account matches

GitHub tokens need read access to repository metadata, pull requests, and issues. GitLab tokens need `read_api` and access to the projects. Public repositories accept an empty token, subject to the provider's anonymous API limits. Without a GitHub token, add public repositories by name

For GitHub Enterprise or self-managed GitLab, expand **Self-hosted instance** and enter its HTTPS API URL, such as `https://github.example.com/api/v3` or `https://gitlab.example.com/api/v4`. A different host is a separate connection, so tokens and usernames are never reused across hosts

The first sync reads the current period, the preceding period, and the same period last year. Choose **Last 7 days**, **Last 28 days**, or **Last 90 days**. Every window covers the selected number of complete UTC days and excludes today. **Previous period** is the immediately preceding window of the same length. **Same period last year** has the same length and ends on the equivalent date last year, clamping February 29 to February 28. The dashboard shows both date ranges. Changing the range starts a sync, and later refreshes retain the last successfully loaded range. **Sync now** refreshes all selected repositories. Automatic sync defaults to daily and runs while the gateway is running. The settings API accepts `update_interval_minutes: 0` for manual refreshes, or at least `5` for automatic refreshes

An empty repository is a valid report with zero merged changes. Merge time and spend per merged change have no value until there are matching observations. Failed or cancelled syncs keep the last complete report

## Configure app connections

Gateway operators configure each provider app once. Users can then connect from the dashboard without pasting an access token

Set `PROXY_BASE_URL` to the gateway's public URL. Register a GitHub App with read-only **Metadata**, **Pull requests**, and **Issues** permissions. Enable expiring user access tokens. Set its callback URL to:

```text
<PROXY_BASE_URL>/roi-calculator/observed/oauth/github/callback
```

Set its setup URL to `<PROXY_BASE_URL>/roi-calculator/observed/oauth/github/installed`, enable **Redirect on update**, and leave authorization during installation disabled. The gateway starts authorization after installation. Configure:

```bash
LITELLM_ROI_GITHUB_CLIENT_ID=<app-client-id>
LITELLM_ROI_GITHUB_CLIENT_SECRET=<app-client-secret>
LITELLM_ROI_GITHUB_APP_SLUG=<app-url-slug>
```

For GitLab, register a confidential OAuth application with `read_api` and `read_user` scopes and this callback URL:

```text
<PROXY_BASE_URL>/roi-calculator/observed/oauth/gitlab/callback
```

Configure `LITELLM_ROI_GITLAB_CLIENT_ID` and `LITELLM_ROI_GITLAB_CLIENT_SECRET`. Self-hosted apps also use `LITELLM_ROI_GITHUB_URL` or `LITELLM_ROI_GITLAB_URL`, set to the provider's base URL without the API suffix. App credentials and `PROXY_BASE_URL` must be consistent across gateway workers

Access and refresh tokens are encrypted using the gateway's configured encryption key. Authorization uses PKCE and a single-use state tied to an HTTP-only browser cookie. The gateway refreshes expiring credentials automatically

## Read the report

| Metric | Calculation |
| --- | --- |
| Merged changes | PRs or MRs merged in the period across all selected repositories |
| Shipping velocity | A person's matched merged changes, with changes per week and previous-period or year-over-year comparisons |
| Median time to merge | Median elapsed time from opening to merge, including nights and weekends |
| New bugs | Issues opened in the period with `bug`, `kind:bug`, or `type::bug` labels when collected |
| New regressions | Issues opened in the period with `regression`, `kind:regression`, or `type::regression` labels when collected |
| Revert-titled changes | Merged PRs or MRs whose titles start with `revert` |
| Recorded spend per merged change | A matched person's recorded gateway spend for the period divided by their matched merged changes |

Use **Engineers** for per-person results, **Pull requests**, **Merge requests**, or **Merged changes** for the underlying changes, **Quality** for issue and revert signals, and **Branch spend** for tagged request costs. Open an engineer to compare their periods and inspect their merged changes

Merge time is elapsed time, not hours worked. A 30-second merge displays `<1m`. Bug labels and revert titles are repository signals, not a measured failure rate or an individual defect score. These comparisons show changes in recorded activity; they do not establish that AI caused those changes

### Link accounts

Open **Link accounts**, choose an internal gateway email, and enter the person's current and historical usernames, separated by commas. GitHub and GitLab have separate fields for each connected host. One email can own multiple accounts on both providers. Identical usernames on different hosts remain separate identities

Public profile emails match automatically when they unambiguously match a gateway user. Manual matches take priority, and removing a match prevents the same public email from immediately linking it again. Saving updates the report without fetching repository activity again

Agent-authored changes count toward a person only when supported agent metadata explicitly names a requester. Unassigned agent changes still count in repository totals

### Understand spend

Each person's gateway spend is counted once across selected repositories and providers. Selecting repositories changes the merged-change denominator; it does not filter that person's gateway usage to those repositories. The summary divides recorded spend for linked people by matched merged changes

For example, a person with `$120` in recorded gateway spend and six matched merged changes has `$20` recorded spend per merged change. This is an account-level ratio. It is different from a PR's directly tagged cost

Usage that bypasses the gateway is outside the calculation. No spend records means unknown cost, while a recorded zero-cost request is a real zero. No merged changes means the spend-per-change ratio has no denominator

## Attribute actual request costs to branches

To track a branch's AI cost, send a repository tag and a branch tag together on each model request:

```json
{
  "model": "your-gateway-model",
  "messages": [{"role": "user", "content": "Help implement this change"}],
  "metadata": {
    "tags": [
      "repo:gitlab.com/example/platform/api",
      "branch:feature/search"
    ]
  }
}
```

For GitHub, use a repository tag such as `repo:github.com/example/api`. For self-hosted instances, include the host and repository path without the API suffix. Use the PR or MR's **source** repository and branch, including the fork's repository when applicable. GitHub repository names are case-insensitive. GitLab project paths and branch names must match exactly

The same tags can be sent through a comma-separated header:

```text
x-litellm-tags: repo:github.com/example/api,branch:feature/search
```

Configure the coding tool or wrapper to send both tags on every request. See [Request tags](./request_tags.md) for client examples. Tags are stored in the spend log's `request_tags` field; plain branch metadata or a Git release tag does not replace this pair

After sync, **Branch spend** shows recorded spend and request counts for each tagged branch. The merged-change list shows **Tagged spend** when exactly one merged change uses that source repository and branch during the period. Branch costs include requests across users and keys and do not require an email match

Repeated identical tags count a request once. Missing or conflicting repository or branch tags exclude a request from attribution. When several merged changes share a branch in the period, its cost remains visible in **Branch spend** without being charged to several PRs. Use a unique branch per change for unambiguous matching

Branch costs cover retained request logs within the same UTC reporting window, not necessarily the entire lifetime of a PR. Costs incurred before the window are outside that report

## Troubleshooting

| What you see | What to check |
| --- | --- |
| No app connection button available | Configure the provider app on the gateway, or use a token |
| Repositories cannot be loaded | Check token permissions, expiry, organization approval, and the API URL |
| No activity | Check selected repositories and the reporting dates; today is excluded |
| An engineer is missing | Link their usernames to an existing internal gateway email |
| No tagged branch spend | Send both exact tags on each request, retain spend logs, and sync after the reporting day has ended |
| Branch cost is shared by several changes | Use distinct source branches for each change |
| A sync fails | Retry after fixing provider access or rate limits; the previous complete report remains available |

See [Spend Tracking](./cost_tracking.md) for gateway accounting and [Admin UI](./ui.md) for dashboard setup
