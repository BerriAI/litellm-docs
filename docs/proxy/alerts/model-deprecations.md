---
title: Model deprecation alerts
description: Find retiring models that still receive traffic, inspect affected keys, and track your migration in the Admin UI.
---

<SinceVersion v="1.110.0" />

Model deprecation alerts show configured models that have retired or will retire within 30 days and still have recorded traffic in the last 30 days. Open **Alerts** and select **Model deprecations** in the type filter.

LiteLLM reads retirement dates from its model catalog and your deployment's `model_info.deprecation_date` override. A model without a known retirement date cannot produce a deprecation alert.

## Review a migration

Select a deprecation alert to see the retirement date and recent request history. If the catalog or deployment configuration names a replacement, you can review that recommendation before changing your routing.

Open **View migration details** to inspect affected keys and their usage. Use the team filter to find an owner, then follow the resource's Activity link to investigate. LiteLLM does not switch models for you.

Select **Mark resolved** after migrating, or **Dismiss** if the finding needs no action. The decision is shared across gateway admins. If LiteLLM records newer traffic for that model, the alert returns to Open. This includes more requests on the same day as your decision.

View-only admins can inspect alerts and migration details, but cannot change their status. Deprecation alerts do not consume the five-alert performance allowance. Turning off **Performance monitoring** does not disable them.

## Email reminders

On **Alerts**, select **Set up email reminders**, then **Open Email Settings**. Add your SMTP settings and public gateway URL, and send a test email. Under **Email events**, turn on **Model Deprecations** and save. This option is off by default.

Affected key owners and team admins receive reminders 30 days and 1 day before retirement, based on their recorded Usage. The dashboard's deprecation feed does not require email setup.

See [Email notifications](../email.md) for SMTP, Resend, and SendGrid configuration. This setup applies to deprecation reminders, not performance findings.

## API

The deprecation feed has its own endpoints. It does not come from `GET /alerts`.

Set `LITELLM_BASE_URL` to your gateway base URL, without `/v1` or a trailing slash. Set `LITELLM_API_KEY` to an existing gateway admin key.

```bash
curl --get "$LITELLM_BASE_URL/model/deprecations" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  --data-urlencode 'warn_within_days=30'
```

The response groups configured models into `deprecated`, `imminent`, and `upcoming`. Each entry includes the model name, retirement date, days remaining, and replacement when known. It also returns `warn_within_days` and `checked_at`.

This endpoint lists the retirement schedule. The dashboard narrows it to models with recent Usage and applies each model's saved status.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/model/deprecations` | Read the retirement schedule. |
| `GET` | `/alerting/model-deprecations/state` | Read shared status for a model and retirement date. |
| `PUT` | `/alerting/model-deprecations/state` | Save status and the traffic observed at that decision. |
| `GET` | `/alerting/model-deprecations/tags` | Read usage tags for a page of affected keys. |

The state and tag endpoints require a database and a gateway admin or view-only admin role. Only gateway admins can write. For a state read, supply `model` and `deprecation_date` as query parameters. For a write, replace the example values with the model and latest Usage you reviewed.

```bash
curl -X PUT "$LITELLM_BASE_URL/alerting/model-deprecations/state" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
  "model": "example-provider/retiring-model",
  "deprecation_date": "2026-12-01",
  "status": "resolved",
  "last_seen_date": "2026-11-09",
  "last_seen_requests": 24000
}'
```

Statuses are `open`, `resolved`, and `dismissed`. The last-seen fields let the dashboard reopen an alert when it finds newer traffic. Saving a status does not change the model's retirement schedule.
