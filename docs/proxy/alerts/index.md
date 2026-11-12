---
title: Alerting
sidebar_label: Overview
description: Review model deprecations and changes in gateway usage, or configure email and webhook notifications.
slug: /proxy/alerts
---

{/* keep-version-note */}

Open **Alerts** in the Admin UI to review model deprecations and performance findings. Select a finding to see its usage chart and affected resource. Use **Mark resolved** or **Dismiss** to record your decision. You can reopen it later.

Gateway admins can manage alerts. View-only admins can read them.

<figure style={{margin: '24px 0'}}>
  <a href="/img/alerts/inbox.webp">
    <img src="/img/alerts/inbox.webp" alt="The Alerts page in the LiteLLM gateway, with performance monitoring enabled, Open, Resolved, and Dismissed tabs, and findings for model retirement, spend, errors, and response time." width="3456" height="1924" loading="lazy" style={{display: 'block', width: '100%', height: 'auto'}} />
  </a>
  <figcaption style={{fontSize: '0.85em', marginTop: '8px'}}>The Alerts inbox with demo data and an Enterprise license. <a href="/img/alerts/inbox.webp">View full size</a></figcaption>
</figure>

## Alerts in the dashboard

| Alert | What you see | Availability |
| --- | --- | --- |
| [Model deprecations](./model-deprecations.md) | Models in use that have retired or will retire within 30 days, with migration details. | Does not consume the performance alert allowance. |
| [Performance alerts](./performance.md) | Spend spikes, traffic spikes, higher error rates, or slower responses compared with recent Usage. | On by default. Five saved alerts free, then Enterprise. |

The notification bell shows up to five open alerts across both categories. Select one to open its details, or **See all** to open the Alerts page.

<figure style={{maxWidth: '384px', margin: '24px auto'}}>
  <a href="/img/alerts/notifications.webp">
    <img src="/img/alerts/notifications.webp" alt="The notification bell menu with five open alerts and a See all link." width="772" height="1122" loading="lazy" style={{display: 'block', width: '100%', height: 'auto'}} />
  </a>
  <figcaption style={{fontSize: '0.85em', marginTop: '8px'}}>Open an alert from the notification bell. Demo data.</figcaption>
</figure>

## Notifications outside the dashboard

Use [Slack and webhooks](../alerting.md) for request failures, slow requests, budget events, and other supported events. You can also configure [email notifications](../email.md) or [PagerDuty](../pagerduty.md).

Performance findings appear in the dashboard and [Alerts API](./api.md). They do not send email, Slack, or webhook notifications. The **Performance monitoring** switch controls performance detection only. Your existing notification settings and model deprecation alerts keep working.
