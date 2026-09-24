---
title: Spend Capture Rate
description: Compare the spend LiteLLM tracked for OpenAI against what OpenAI billed for the same days, on a schedule with Slack alerts and a Prometheus gauge, or on demand through an admin endpoint.
---

# Spend Capture Rate

:::info
The spend capture-rate check ships in an upcoming release, so it is not in the current stable version yet
:::

The capture-rate check compares the spend LiteLLM tracked for a provider against what that provider billed for the
same UTC days, and tells you what share of the bill went through LiteLLM:

```
capture_rate = captured_spend / provider_spend
```

A rate of 1.0 means every dollar the provider billed went through LiteLLM and was priced. A rate under 1.0 means
requests are reaching the provider outside LiteLLM (direct API keys, another gateway) or LiteLLM's cost tracking is
dropping spend. A rate over 1.0 means LiteLLM is pricing above the bill

Only OpenAI is wired in this release. LiteLLM's side is the `LiteLLM_DailyUserSpend` table, summed over the
`custom_llm_provider` values `openai` and `text-completion-openai`. OpenAI's side is the
[Organization Costs API](https://platform.openai.com/docs/api-reference/usage/costs)
(`GET https://api.openai.com/v1/organization/costs` with `bucket_width=1d`), read with an OpenAI Admin API key.
For every other provider the manual comparison in [Debugging a cost discrepancy](../troubleshoot/cost_discrepancy)
is still the recipe

## Setup

Create an Admin API key at
[platform.openai.com/settings/organization/admin-keys](https://platform.openai.com/settings/organization/admin-keys).
A read-only admin key is enough. Set it on the proxy as `OPENAI_ADMIN_KEY`:

```bash
export OPENAI_ADMIN_KEY="sk-admin-..."
```

This key is separate from the `OPENAI_API_KEY` your deployments use. It only reads billing data and never serves a
request. The check also needs the proxy database, since captured spend comes from `LiteLLM_DailyUserSpend`

## Scheduled check

Enable the daily check under `general_settings`:

```yaml
general_settings:
  spend_capture_rate_check:
    providers: ["openai"]        # default ["openai"], the only value today
    threshold: 0.9               # default 0.9, alert when the rate over the window is under it
    lookback_days: 7             # default 7, window is the closed UTC days before today (yesterday back), 1 to 180
    openai_project_ids: []       # optional, scope the OpenAI bill to these project ids; default is the whole organization
```

| Key | Default | What it does |
| --- | --- | --- |
| `providers` | `["openai"]` | Providers to check. `openai` is the only value today |
| `threshold` | `0.9` | Alert when the rate over the window is under this. Over 0 and at most 1 |
| `lookback_days` | `7` | Closed UTC days to compare, from yesterday back. 1 to 180 |
| `openai_project_ids` | `[]` | OpenAI project ids to scope the bill to. Empty means the whole organization |

An unknown key or an out-of-range value fails proxy boot with a validation error, so a typo never runs as a silent
default

The job runs every day at 01:15 UTC, and once about two minutes after the proxy boots so that enabling it gives you a
first reading right away. When several replicas are deployed it takes a cross-pod Redis lock and one replica runs it

The check publishes the rate to Prometheus and alerts through the proxy's configured [alerting](./alerting) (alert
type `failed_tracking_spend`, level High) when the rate over the window is under the threshold, when
`OPENAI_ADMIN_KEY` is not set on the proxy, or when the OpenAI costs API cannot be read. The alert names the rate, the
threshold, the captured and billed dollars, and the date range, and links back to this page

A window where OpenAI billed nothing has no rate: nothing is published and nothing alerts. A rate above 1.0 is
published but never alerts

## Prometheus gauge

With `litellm_settings.callbacks: ["prometheus"]` set (see [Prometheus metrics](./prometheus)), the scheduled check
publishes one gauge:

| Metric | Labels | Value |
| --- | --- | --- |
| `litellm_spend_capture_rate` | `api_provider` | The rate over the check's window |

Only the scheduled check sets the gauge. The on-demand endpoint below never touches it, and a window with no bill
leaves it as it was

A Prometheus alerting rule that fires when the rate stays under 0.9 for an hour:

```yaml
groups:
  - name: litellm-spend-capture-rate
    rules:
      - alert: LiteLLMSpendCaptureRateLow
        expr: litellm_spend_capture_rate < 0.9
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "LiteLLM is capturing under 90% of the OpenAI bill"
          description: "Spend is reaching OpenAI outside LiteLLM, or cost tracking is dropping it. See https://docs.litellm.ai/docs/proxy/spend_capture_rate"
```

## Check on demand

`GET /spend/capture_rate` runs the same comparison for any date range and returns the per-day breakdown. It needs a
proxy admin key (`PROXY_ADMIN` or `PROXY_ADMIN_VIEW_ONLY`, see [Role-based access](./access_control)) and reads the
OpenAI bill live, so `OPENAI_ADMIN_KEY` must be set on the proxy

```bash
curl "http://localhost:4000/spend/capture_rate?provider=openai&start_date=2026-09-17&end_date=2026-09-23&threshold=0.9&project_ids=proj_a&project_ids=proj_b" \
  -H "Authorization: Bearer sk-1234"
```

| Query parameter | Required | Default | Meaning |
| --- | --- | --- | --- |
| `start_date` | yes | | First UTC day, `YYYY-MM-DD`, inclusive |
| `end_date` | yes | | Last UTC day, `YYYY-MM-DD`, inclusive |
| `provider` | no | `openai` | Provider to compare. `openai` is the only value today |
| `threshold` | no | `0.9` | Ratio under which `below_threshold` is true. Over 0 and at most 1 |
| `project_ids` | no | | OpenAI project ids to scope the bill to. Repeat it for several |

Response:

```json
{
  "provider": "openai",
  "start_date": "2026-09-17",
  "end_date": "2026-09-23",
  "captured_spend": 812.4,
  "provider_spend": 903.1,
  "capture_rate": 0.8996,
  "threshold": 0.9,
  "below_threshold": true,
  "days": [
    {"date": "2026-09-17", "captured_spend": 120.1, "provider_spend": 130.0, "capture_rate": 0.9238},
    {"date": "2026-09-18", "captured_spend": 0.0, "provider_spend": 0.0, "capture_rate": null}
  ]
}
```

`capture_rate` is `null` for a day with no bill, and for the whole range when OpenAI billed nothing across it, in which
case `below_threshold` is `false`. Values are returned as computed, without rounding

| Status | When |
| --- | --- |
| `400` | `end_date` is before `start_date` |
| `403` | The key is not a proxy admin |
| `500` | The proxy has no database |
| `502` | The OpenAI costs API could not be read. The detail carries OpenAI's status and message |
| `503` | `OPENAI_ADMIN_KEY` is not set on the proxy |

## Reading the number

The comparison is per closed UTC day. The scheduled check never includes today, and an endpoint range that includes
today is partial on both sides, so read today's row as in progress rather than as a gap

The OpenAI bill is organization-wide unless `openai_project_ids` (or `project_ids` on the endpoint) scopes it. An
organization with any traffic outside LiteLLM reads under 1.0 for that reason alone. Scope the check to the project
or projects LiteLLM's keys belong to, or treat the gap as a measure of the direct traffic and raise it with the teams
sending it

Every deployment configured with `custom_llm_provider: openai` counts as captured spend, including one whose
`api_base` points at an OpenAI-compatible server such as a vLLM box or another gateway. That spend never shows up on
the OpenAI bill, so it inflates the rate. If you want the rate to mean OpenAI only, give those deployments a provider
of their own, such as `hosted_vllm`

LiteLLM prices from its own
[cost map](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json), so a price change on
either side moves the rate until the map catches up. A rate above 1.0 with no direct traffic usually means a cost map
entry is higher than what OpenAI now charges

OpenAI's costs API can lag a few hours behind usage, so the most recent day can read low until it settles. That is one
more reason the scheduled window stops at yesterday

Other providers (Anthropic, Azure, Bedrock, Vertex AI) are not wired yet. For those, follow
[Debugging a cost discrepancy](../troubleshoot/cost_discrepancy)

## See also

- [Spend tracking](./cost_tracking)
- [Alerting / Webhooks](./alerting)
- [Prometheus metrics](./prometheus)
- [Debugging a cost discrepancy](../troubleshoot/cost_discrepancy)
