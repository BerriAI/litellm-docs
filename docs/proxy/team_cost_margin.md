---
title: Team cost margin
sidebar_label: Team cost margin
description: Add a percentage surcharge to every request a team makes, so tracked spend covers chargeback to that team.
---

# Team cost margin

<SinceVersion v="1.112.0" />

To charge a team more than the provider cost, set `cost_margin_percent` on the team. Every request the team makes is then tracked at cost plus that percentage. Only a proxy admin can set or change it, and the value must be between 0 and 1000.

```bash
curl -X POST http://localhost:4000/team/update \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"team_id": "my-team", "cost_margin_percent": 2}'
```

`/team/new` accepts the same field. In the UI, open the team's settings and fill in **Cost margin (%)**.

## What gets tracked

The surcharged cost is what LiteLLM adds to key, team and customer spend, and what counts against budgets. The team margin applies on top of any [provider or global margin](./provider_margins.md). With a 10% provider margin and a 2% team margin, a request with a provider cost of `0.000004` is tracked as `0.000004 * 1.10 * 1.02 = 0.000004488`.

The spend log keeps the pre-surcharge amount under `metadata.cost_breakdown`.

```json
{
  "team_cost_before_margin": 0.0000044,
  "team_cost_margin_percent": 2.0,
  "total_cost": 0.000004488
}
```

A team without `cost_margin_percent` is tracked at the unchanged cost.
