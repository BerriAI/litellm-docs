---
title: Performance alerts
description: Find changes in spend, traffic, response time, and error rate from your gateway's recorded daily Usage.
---

<SinceVersion v="1.110.0" />

Performance alerts flag changes in your gateway's recorded Usage. Open **Alerts** in the Admin UI to see what changed, compare daily values, and open the affected resource.

Monitoring is on by default for gateways with a connected PostgreSQL database. Keep daily Usage recording enabled and retain at least eight days of aggregates. You do not need to create rules or configure a notification destination.

## Review an alert

1. Open **Alerts** in the sidebar. Select **Open**, **Resolved**, or **Dismissed**, and use the type filter to narrow the list.
2. Select a finding. The detail page shows the observed value, its baseline, and a daily chart.
3. Follow **View key activity**, **View team activity**, or **View user activity** to inspect that resource over the alert's date range. Model alerts link to model routing.
4. Select **Mark resolved** after addressing the finding, or **Dismiss** if it needs no action. Both preserve the alert. Select **Reopen** to return it to Open.

<figure style={{margin: '24px 0'}}>
  <a href="/img/alerts/spend-detail.webp">
    <img src="/img/alerts/spend-detail.webp" alt="A spend alert shows $1,200 against a $200 daily baseline, the daily chart, observed and detection dates, and a View user activity link for Research owner." width="2882" height="1335" loading="lazy" style={{display: 'block', width: '100%', height: 'auto'}} />
  </a>
  <figcaption style={{fontSize: '0.85em', marginTop: '8px'}}>A spend increase to six times the baseline. Demo data. <a href="/img/alerts/spend-detail.webp">View full size</a></figcaption>
</figure>

The bell shows at most five open alerts, including model deprecations. Select **See all** for the full inbox. Performance alerts do not send email or webhook notifications.

## What LiteLLM checks

LiteLLM compares the last complete UTC day with the seven days before it. The evaluated day advances at 01:00 UTC to allow an hour for accounting to arrive. Checks cover the gateway, model groups, teams, users, and virtual keys that have recorded Usage.

Spend and traffic baselines are seven-day totals divided by seven. Response time and error rate use request-weighted averages over the baseline period.

| Finding | Condition |
| --- | --- |
| Spend increase | At least 3 times the daily baseline and at least $50 more. |
| Traffic increase | At least 10 times the daily baseline and at least 1,000 more requests. |
| Traffic drop | Below 20% of the daily baseline, with a baseline of at least 500 requests per day. |
| Slower responses | At least 3 times the baseline mean response time and at least 500 ms slower. |
| Higher error rate | At least 3 times the baseline error rate and an increase of at least 2 percentage points. |

These are four alert types. Traffic increases and drops share the `traffic` type. Response time means recorded total response time, not time to first token. Spend and response-time checks require a baseline above zero.

Spend increases, traffic increases, and error-rate findings require traffic on at least four baseline days. Traffic drops require traffic on all seven baseline days. Response-time findings require timed requests on at least four baseline days and at least 100 timed requests on the evaluated day. Error-rate findings require at least 500 requests on the evaluated day.

For traffic drops, LiteLLM excludes deleted users, deleted or blocked teams, and deleted, blocked, or expired virtual keys. Requests authenticated without a virtual key can contribute to gateway, model, user, or team checks when Usage records those identities.

## Five free alerts, then Enterprise

Each gateway database has a lifetime allowance of five saved performance alerts. An alert for a key and an alert for its team count separately. Rechecking the same type, resource, and day does not consume another alert.

After the fifth alert, LiteLLM stops reading Usage for performance detection. You can still read and manage saved alerts. Resolving or dismissing them does not reset the allowance. Model deprecations do not count toward it.

With an [Enterprise license](/docs/enterprise), performance monitoring continues without the five-alert limit. It resumes when you add the license, provided monitoring is enabled.

## Turn monitoring off

Turn off **Performance monitoring** at the top of **Alerts**. This setting applies to the workers and pods that share your database. Saved alerts remain available.

To disable it through configuration, add this to your existing `general_settings` and restart the proxy.

```yaml title="config.yaml"
general_settings:
  performance_alerts_enabled: false
```

With this setting, the UI and API cannot turn monitoring back on. Remove the override or set it to `true`, restart, then check the **Performance monitoring** switch. You can also [read or change monitoring through the API](./api.md#monitoring).

## Timing and coverage

LiteLLM starts a bounded background run about every five minutes and resumes from its saved position. Each page covers up to 25 resources. A page can read many aggregate rows, depending on each resource's usage. LiteLLM uses database query timeouts and pauses between pages to limit the work.

Detection is best effort. On a large or busy database, a sweep can leave resources unchecked. A new day starts a new comparison, and an unfinished scope resumes from its previous position before wrapping around. These are daily findings, not real-time outage alerts.

Alerts describe recorded Usage. Missing or delayed accounting can resemble a traffic drop. The one-hour delay does not prove that all requests have arrived. Check **Usage** before treating a drop as an outage.

The saved comparison stays fixed. The chart reads current Usage and can change if accounting arrives later. Missing chart data appears as a gap. Resolving an alert records your decision; it does not change traffic or stop a new alert for a later day.

## If no alerts appear

Check that **Performance monitoring** is on and the free allowance is not exhausted. Confirm that **Usage** contains the required days and request counts. A new gateway needs enough baseline history before most checks can produce a finding.

If detection has stopped progressing, check proxy logs for `Performance alerts` messages. They report completed sweeps, skipped resources, early exits, or a pending key index. An empty inbox alone does not prove that LiteLLM checked every resource.

Use the [Alerts API](./api.md) to list findings, change their status, or read the monitoring setting.
