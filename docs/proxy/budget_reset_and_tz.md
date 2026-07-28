# Budget Reset Times and Timezones

LiteLLM supports predictable budget reset times that align with natural calendar boundaries.

## How Budget Resets Work

By default all budgets reset at midnight (00:00:00) in the configured timezone, with special handling for common durations. The time of day resets land on is configurable via `budget_reset_time` (see [Configuring the Reset Time of Day](#configuring-the-reset-time-of-day) below); the table shows the default midnight behavior.

| Duration | Reset Behavior |
| --- | --- |
| Daily (24h/1d) | Resets at midnight every day |
| Weekly (7d) | Resets on Monday at midnight |
| Monthly (30d) | Resets on the 1st of each month at midnight |

Sub-day durations (for example `1h`, `30m`, `10s`) roll forward by their interval from the current time, so a time of day does not apply to them.

## Configuring the Timezone

Specify the timezone for all budget resets in your configuration file:

```yaml
litellm_settings:
  max_budget: 100 # (float) sets max budget as $100 USD
  budget_duration: 30d # (number)(s/m/h/d)
  timezone: "US/Eastern" # Any valid timezone string
```

This ensures that all budget resets happen at midnight in your specified timezone rather than in UTC. If no timezone is specified, UTC will be used by default.

## Configuring the Reset Time of Day

:::info

`budget_reset_time` is available starting in the next release (after `v1.94.0`).

:::

By default day, week, and month budgets reset at midnight. Set `budget_reset_time` to pick the wall-clock time (in the configured `timezone`) that resets should land on instead, for example to align budget rollover with the start of your business day or an upstream provider's billing boundary:

```yaml
litellm_settings:
  max_budget: 100 # (float) sets max budget as $100 USD
  budget_duration: 1d # (number)(s/m/h/d)
  timezone: "US/Eastern" # Any valid timezone string
  budget_reset_time: "09:00" # (string) "HH:MM" or "HH:MM:SS", 24-hour clock
```

With the config above, daily budgets reset at 09:00 US/Eastern each day, weekly budgets reset on Monday at 09:00, and monthly budgets reset on the 1st at 09:00. The value accepts a 24-hour `"HH:MM"` or `"HH:MM:SS"` string and must be quoted. If it is omitted, resets stay at midnight. A malformed value fails config load at startup rather than silently falling back to midnight, so a typo surfaces immediately instead of quietly changing when budgets reset. Sub-day durations ignore `budget_reset_time` since a time of day is meaningless for them.

## Supported Timezones

Any valid [IANA timezone string](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) is supported (powered by Python's `zoneinfo` module). DST transitions are handled automatically.

**Common timezone values:**

| Timezone | Description |
| --- | --- |
| `UTC` | Coordinated Universal Time |
| `US/Eastern` | Eastern Time |
| `US/Pacific` | Pacific Time |
| `Europe/London` | UK Time |
| `Asia/Kolkata` | Indian Standard Time (IST) |
| `Asia/Bangkok` | Indochina Time (ICT) |
| `Asia/Tokyo` | Japan Standard Time |
| `Australia/Sydney` | Australian Eastern Time |
