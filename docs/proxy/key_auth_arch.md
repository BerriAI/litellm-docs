# How Key-Based Auth Works

Explanation of how the proxy resolves what a Virtual Key can call. Focus: how the `models` field is evaluated when a key has a `team_id` versus when it does not, and the sentinel values from `SpecialModelNames` that change model matching. For the relationship between organizations, teams, users, and keys, see [Access inheritance](./access_management/inheritance.md). For setup see [Virtual Keys](./virtual_keys.md) and [Model Access Groups](./model_access_groups.md).

## The `models` field

Every virtual key row carries a `models` list. Entries fall into four categories:

| Entry | Meaning |
|---|---|
| Concrete model group | Name from `config.yaml` `model_name` (`gpt-4`, `azure-gpt-3.5`) |
| Wildcard | Provider prefix pattern matched against `model_name` (`openai/*`, `openai/o1-*`) |
| Access group | Label declared under `model_info.access_groups` or `/access_group/new`; expands at request time to the set of models tagged with it |
| Sentinel | One of the reserved strings in `SpecialModelNames` (below) |

The empty list and the literal `*` impose no model restriction at that layer. Other applicable checks still restrict the request.

## Sentinels

These strings are reserved as enum values in `litellm.proxy._types.SpecialModelNames`. They short-circuit normal matching.

| Sentinel | Where it belongs | Effect |
|---|---|---|
| `all-proxy-models` | Key, team, or user `models` list | Imposes no model restriction at that layer, like an empty list. Other applicable checks still apply. |
| `all-team-models` | Key `models` list | Defers to the team's model check. If the key has no `team_id`, it imposes no key-level restriction; the owner's user model restrictions still apply. |
| `no-default-models` | User `models` list only | Hard denial on the user path; forces the user to route requests through a team. Set via `default_internal_user_params.models` so SSO signups cannot mint standalone keys with proxy-wide access. |

Both an empty key `models` list and `all-team-models` let the team check determine access when a team is attached. Neither bypasses per-member restrictions or other applicable checks.

## Resolution: with team_id vs without

A standalone key (no `team_id`) must pass its own model check and its owner's `user.models` check when associated with a user. With `personal_key_model_access_from_teams: true`, it must also fit the model access available through at least one of that user's teams; this setting is off by default.

A team-attached key must pass its key and team model checks, plus any non-empty per-member `allowed_models` restriction for the key's `user_id`. The owner's global `user.models` does not restrict team requests. With direct model lists alone, a key holding `["{{openai_large}}"]` under a team holding `["azure-gpt-3.5"]` cannot call either model. Authorized Access Groups can add grants as described below.

A denied model check rejects the request. Inspect the proxy logs to identify the key, team, user, or membership restriction. See [Restrict models by team_id](./model_access.md#restrict-models-by-team_id) for team configuration.

`all-proxy-models` on a team removes the team's model restriction, but key and per-member checks still apply. `all-team-models` on a key removes the key's own model restriction and leaves the other applicable checks in place.

## Access groups and wildcards

Access groups exist so that adding a model to a group grants every attached key access without mutating any key row. The label is stored on the key or team; the expansion happens at auth-check time by looking up which deployments carry that label in their `model_info.access_groups`. Wildcards resolve the same way but match against `model_name` rather than a tag, and can themselves belong to access groups so a subfamily can be carved out (`openai/*` in `default-models`, `openai/o1-*` in `restricted-models`; a key holding only `default-models` cannot call the `o1` family). See [Model Access Groups](./model_access_groups.md).

[Unified Access Groups](./access_groups.md) assigned through `access_group_ids` can also grant models. A group attached to a key can grant access outside the team's direct model list when the group authorizes that key or its team through `assigned_key_ids` or `assigned_team_ids`. A per-member `allowed_models` restriction still applies.

## What the master key skips

The master key is validated against the configured secret and resolves to a proxy admin identity without a Virtual Key model allowlist. It is an operator credential with broad model access. Common request checks still run, including applicable end-user restrictions and budgets; admin status does not disable every request check. See [Master Key Rotations](./master_key_rotations.md).

## Related

[Model Access](./model_access.md) · [Model Access Groups](./model_access_groups.md) · [Virtual Keys](./virtual_keys.md) · [Multi-Tenant Architecture](./multi_tenant_architecture.md)
