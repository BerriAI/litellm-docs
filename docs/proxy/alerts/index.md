---
title: Alerting
sidebar_label: Overview
description: Review model deprecations, performance findings, and prompt cache advisories, or configure email and webhook notifications.
slug: /proxy/alerts
---

{/* keep-version-note */}

Open **Alerts** in the Admin UI to review model deprecations, performance findings, and prompt cache advisories. Select a finding to see its evidence and affected resource. Use **Mark resolved** or **Dismiss** to record your decision. You can reopen it later.

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
| [Prompt cache advisories](#prompt-cache-advisories) | Repeated observed misses after a confirmed Anthropic cache write. | Off by default. Requires PostgreSQL and shared Redis. |

The notification bell shows up to five open alerts across these categories. Select one to open its details, or **See all** to open the Alerts page.

<figure style={{maxWidth: '384px', margin: '24px auto'}}>
  <a href="/img/alerts/notifications.webp">
    <img src="/img/alerts/notifications.webp" alt="The notification bell menu with five open alerts and a See all link." width="772" height="1122" loading="lazy" style={{display: 'block', width: '100%', height: 'auto'}} />
  </a>
  <figcaption style={{fontSize: '0.85em', marginTop: '8px'}}>Open an alert from the notification bell. Demo data.</figcaption>
</figure>

## Prompt cache advisories

Prompt cache advisories flag three distinct observed requests with zero cache reads and zero cache writes after Anthropic has confirmed a cache write for the same prefix. They appear in **Alerts** and the [Alerts API](./api.md#prompt-cache-advisories). They do not send Slack, email, or webhook notifications.

This first pass supports native Anthropic models through nonstreaming `/v1/chat/completions` requests, with exactly one explicit `cache_control` breakpoint using the default five-minute TTL or `ttl: "5m"`. Streaming, `/v1/messages`, `/v1/responses`, other providers, multiple breakpoints, and one-hour TTLs are not assessed.

### Enable detection

Use a proxy build containing [the prompt cache detector](https://github.com/BerriAI/litellm/pull/51973) and [its alert reader and UI support](https://github.com/BerriAI/litellm/pull/51943). Detection is disabled by default. Merge these settings into your existing proxy configuration and restart all workers.

```yaml title="config.yaml"
general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  database_url: os.environ/DATABASE_URL
  prompt_cache_alerts: true
  coordination_redis:
    host: os.environ/REDIS_HOST
    port: os.environ/REDIS_PORT
    password: os.environ/REDIS_PASSWORD
```

Set `DATABASE_URL` to your PostgreSQL connection and the Redis variables to a shared instance reachable by every worker and pod. Keep your existing Redis configuration if coordination Redis is already configured. Use the same `LITELLM_SALT_KEY` across workers, or the same master key when no salt is set. These keys produce fingerprints that let workers compare observations without storing prompt contents in alert evidence.

The **Performance monitoring** switch does not control prompt cache detection. Set `prompt_cache_alerts: false` and restart to stop new observations. Saved advisories remain available.

### Review the evidence

Open **Alerts**, filter for prompt cache advisories, and select a finding. Review the deployment, provider model, observed miss count, proven cache-write token count, and observation window. Check the application's cache breakpoint and prefix stability before deciding whether action is needed.

Select **Mark resolved** or **Dismiss** to record your decision. Repeated observations for the same deployment and configuration do not duplicate the saved advisory or automatically reopen it. After saving an advisory, detection also applies a 24-hour quiet period for that configuration.

### Interpretation and limits

An advisory describes observed evidence. It does not guarantee consecutive failed requests or prove a provider caching outage. Delayed or missing callbacks, disabled logging, and Redis failures can hide an intervening healthy request. Logging opt-outs remain respected.

Observed cache reads or writes reset the miss sequence. Failed requests, missing or invalid provider usage, and unsupported caching attempts reset it on a best-effort basis rather than counting as misses. Once the cached proof expires, a new confirmed cache write is required before misses can count again.

If no advisory appears, check that detection is enabled, PostgreSQL and shared Redis are available, and the request is supported. A valid cache breakpoint alone is insufficient: Anthropic must first report a positive cache write, and subsequent callbacks must include authoritative read and write counters. An empty inbox does not prove that every request was assessed.

## Notifications outside the dashboard

Use [Slack and webhooks](../alerting.md) for request failures, slow requests, budget events, and other supported events. You can also configure [email notifications](../email.md) or [PagerDuty](../pagerduty.md). Email also covers [key expiry alerts](../email.md#4-configure-key-expiry-alerts-optional), which warn a key's owner before the key expires.

Performance findings appear in the dashboard and [Alerts API](./api.md). They do not send email, Slack, or webhook notifications. The **Performance monitoring** switch controls performance detection only. Your existing notification settings and model deprecation alerts keep working.
