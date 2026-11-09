---
sidebar_label: "Teams and access"
description: "How the LiteLLM Router applies team deployments, access groups, access windows and PTU shares to each request."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Teams and access

{/* keep-version-note */}

The proxy serves many teams from one router, and not every deployment is for
everyone. Four rules decide which of a model group's deployments a caller may
use. They all run during resolution and right after it, before any health or
load filter, so a deployment the caller may not use never shows up in the
caller's candidates, errors or fallbacks.

![Resolved deployments pass access windows, access groups, team deployments and
PTU shares in order before the health and load
filters](../img/teams-and-access-1.svg)

The caller facts come in on the request: `team_id`, whether the caller is a
proxy admin, and the models the key and team may use. The proxy fills them in
from the key that made the request.

## Team deployments

A deployment with `model_info.team_id` belongs to one team. Only requests
carrying that team id can use it, and everyone else's picks skip it. A team
deployment can also carry `model_info.team_public_model_name`, the name the
team's members call it by. A request for that name from a member of the team
resolves to the team's deployment, even though no model group has that name.

<Tabs groupId="router-config">
<TabItem value="sdk" label="SDK">

```python
from litellm import Router

router = Router(
    model_list=[
        {
            "model_name": "team-a-gpt-4o-ft",  # the internal group name
            "litellm_params": {"model": "azure/ft-gpt-4o-team-a"},
            "model_info": {
                "team_id": "team-a",
                "team_public_model_name": "gpt-4o",  # what the team asks for
            },
        }
    ]
)

# The SDK has no keys, so the caller states its team on each request.
await router.acompletion(
    model="gpt-4o",
    messages=[{"role": "user", "content": "hi"}],
    metadata={"user_api_key_team_id": "team-a"},
)
```

</TabItem>
<TabItem value="proxy" label="PROXY">

```yaml
- model_name: team-a-gpt-4o-ft          # the internal group name
  litellm_params: {model: azure/ft-gpt-4o-team-a, ...}
  model_info:
    team_id: team-a
    team_public_model_name: gpt-4o      # what team-a's members ask for
```

The proxy takes the team from the caller's virtual key.

</TabItem>
</Tabs>

When the requested model group has both team deployments and shared ones, the
caller's own team deployments come first. A proxy admin without a team may reach
team deployments by name, as long as they all belong to one team. If they belong
to several teams, the pick fails, since there is no way to tell which team was
meant.

## Access groups

`model_info.access_groups` lists the access groups a deployment belongs to. A
key or team can be given access to an access group instead of to model names.
When a caller reaches the requested model only through access groups, the router
limits the caller to the deployments in those groups. Two keys that both "have
gpt-4o" can therefore be sent to different deployments of it.

## Access windows

`model_info.access_windows` reserves a deployment for some teams during a daily
wall-clock window, for example a provisioned deployment that one team owns
during its business hours.

<Tabs groupId="router-config">
<TabItem value="sdk" label="SDK">

```python
deployment = {
    "model_name": "gpt-4o",
    "litellm_params": {"model": "azure/gpt-4o-reserved"},
    "model_info": {
        "access_windows": [
            {
                "start": "09:00",
                "end": "17:00",
                "timezone": "America/New_York",
                "team_ids": ["team-a"],
            }
        ]
    },
}
```

</TabItem>
<TabItem value="proxy" label="PROXY">

```yaml
model_info:
  access_windows:
    - start: "09:00"
      end: "17:00"
      timezone: America/New_York
      team_ids: [team-a]
```

</TabItem>
</Tabs>

While a window is active, callers outside its `team_ids` do not see the
deployment. Outside the window, everyone does. When all of a group's deployments
are reserved for someone else right now, the pick fails with an error that names
the window instead of a generic "no deployments".

## PTU shares

`model_info.ptu_shares` splits one provisioned deployment across teams, as a map
from team id to a whole number of PTUs. It also needs `ptu_count`, `cost_per_ptu_per_hour` and
`ptu_effective_from`, or the deployment fails validation. A deployment with shares serves only the
teams that hold one. A team that holds a share on any deployment of the group is
limited to those deployments, and a team without a share sees only the
deployments that are not split.

<Tabs groupId="router-config">
<TabItem value="sdk" label="SDK">

```python
deployment = {
    "model_name": "gpt-4o",
    "litellm_params": {"model": "azure/gpt-4o-ptu"},
    "model_info": {
        "ptu_count": 150,
        "cost_per_ptu_per_hour": 1.0,
        "ptu_effective_from": "2026-01-01T00:00:00Z",
        "ptu_shares": {"team-a": 100, "team-b": 50},
    },
}
```

</TabItem>
<TabItem value="proxy" label="PROXY">

```yaml
model_list:
  - model_name: gpt-4o
    litellm_params: {model: azure/gpt-4o-ptu, ...}
    model_info:
      ptu_count: 150
      cost_per_ptu_per_hour: 1.0
      ptu_effective_from: "2026-01-01T00:00:00Z"
      ptu_shares:
        team-a: 100
        team-b: 50
```

</TabItem>
</Tabs>

## Fallbacks respect the same rules

A fallback to another model group resolves the target name for the same caller,
so the same rules apply to the target. Before a cross-group fallback, the router
also checks whether this caller may use the target group at all and whether the
caller's budget allows it (`fallback_access_check` and `fallback_budget_check`).
A target the caller may not use is skipped, see [Retries, fallbacks and
cooldowns](reliability.md).
