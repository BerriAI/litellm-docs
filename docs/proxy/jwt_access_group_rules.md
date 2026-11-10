---
sidebar_label: Map identities to Access Groups
---

# Map identities to Access Groups

<SinceVersion v="1.110.0" />

<EnterpriseFeature feature="JWT authentication" />

Grant [Access Groups](./access_groups.md) based on JWT claims. For example, any token whose `groups` claim contains `Anthropic_Access` gets the models in the `claude-models` Access Group.

Rules are evaluated on each request and never saved onto a key. A token that matches several rules gets all of those groups, added to its existing access. Rules never remove access.

## Setup

Complete [identity provider setup](./token_auth.md), then create the Access Groups in the UI or API and add the models each should grant. Add the rules to `general_settings` next to your JWT settings.

```yaml
general_settings:
  access_group_rules:
    - attribute: jwt_claims.groups
      contains: Anthropic_Access
      access_group: claude-models

    - attribute: jwt_claims.groups
      contains: Gemini_Access
      access_group: gemini-models

    - attribute: jwt_claims.groups
      contains: Codex_Access
      access_group: codex-models
```

Claim values and group names are illustrative.

## Rule fields

| Field | Description |
|-------|-------------|
| `attribute` | Dot path to check. Must start with `jwt_claims`, `user_id`, or `user_role`, e.g. `jwt_claims.realm_access.roles`. |
| `contains` | Matches when the attribute is a list that includes this value. |
| `equals` | Matches when the attribute equals this value. Set exactly one of `contains` or `equals`. |
| `access_group` | Name of an existing Access Group. |

A missing claim or unknown group name grants nothing.
