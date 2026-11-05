---
title: Custom auth permissions
sidebar_label: Custom auth permissions
description: Configure the authorization checks applied after custom authentication.
---

# Custom auth permissions

{/* keep-version-note */}

Use this reference after [configuring a custom authentication handler](../custom_auth.md). The handler identifies the caller with a `UserAPIKeyAuth` object; the fields and flags below determine which permissions and limits LiteLLM enforces.

## What gets enforced {#what-gets-enforced}

| Goal | Set it on | Flags required |
| --- | --- | --- |
| Key / user / team / end-user rate limits | returned object (`rpm_limit`, `team_tpm_limit`, …) | none |
| Per-model rate limits, key / team scoped | `metadata` / `team_metadata` on the returned object | none |
| Per-model rate limits, project scoped | the project record (`model_tpm_limit` / `model_rpm_limit`) | `custom_auth_run_common_checks` |
| Team / user / project budget | the team / user / project record | `custom_auth_run_common_checks` |
| Team / user / project model allowlist | the team / user / project record | `custom_auth_run_common_checks` |
| End-user budget | the end-user record | `custom_auth_run_common_checks` or `enable_post_custom_auth_checks` |
| Key model allowlist (`models`) | returned object | both flags |
| Key per-model budget (`model_max_budget`) | returned object | `enable_post_custom_auth_checks` |
| Key expiry (`expires`) | returned object | `enable_post_custom_auth_checks` |
| Key scalar budget (`max_budget` / `soft_budget`) | not supported; use a per-scope budget | n/a |

**Note:** Project per-model limits go on the object's `project_metadata` with the flag off, but the DB project record overrides it once the flag is on, so set them there. (Team per-model via `team_metadata` always stays on the object.)

See [Enforce budgets and model access](#enforce-budgets-and-model-access) and [Key-level enforcement](#key-level-enforcement) for examples.

## Returned-object controls

### Rate limits {#rate-limits}

All scopes below are enforced directly off the returned object, with no flag.

```python
def UserAPIKeyAuth(
    # Key
    tpm_limit: Optional[int] = None,
    rpm_limit: Optional[int] = None,
    # User
    user_tpm_limit: Optional[int] = None,
    user_rpm_limit: Optional[int] = None,
    # Team
    team_tpm_limit: Optional[int] = None,
    team_rpm_limit: Optional[int] = None,
    # Per team-member
    team_member_tpm_limit: Optional[int] = None,
    team_member_rpm_limit: Optional[int] = None,
    # Per end-user
    end_user_tpm_limit: Optional[int] = None,
    end_user_rpm_limit: Optional[int] = None,
    # Per-model (key / team scoped)
    metadata: Dict = {},          # e.g. {"model_tpm_limit": {...}, "model_rpm_limit": {...}}
    team_metadata: Optional[Dict] = None,  # same keys, team scoped
): ...
```

:::note

Per-model rate limits are read from `metadata` (key) and `team_metadata` (team), keyed by model name. The model key must equal the request's `model` string exactly, or the limit is skipped silently.

`rpm_limit_per_model` / `tpm_limit_per_model` exist on the object but are inert; use `metadata` / `team_metadata` instead, or the project record (see below).

:::

### Additional controls {#advanced}

```python
def UserAPIKeyAuth(
    max_parallel_requests: Optional[int] = None,      # Concurrent request limit
    allowed_model_region: Optional[AllowedModelRegion] = None,  # Geographic restrictions
    blocked: Optional[bool] = None,                   # Whether the key is blocked
    config: Dict = {},                                # Configuration settings
): ...
```

### Object permissions {#object-permission-mcp-agents-etc}

```python
from litellm.proxy._types import LiteLLM_ObjectPermissionTable, UserAPIKeyAuth
from litellm.proxy.mcp_server.mcp_server_manager import (
    global_mcp_server_manager,
)

def _server_id(name: str) -> str:
    server = global_mcp_server_manager.get_mcp_server_by_name(name)
    if not server:
        raise ValueError(f"Unknown MCP server '{name}'")
    return server.server_id

object_permission = LiteLLM_ObjectPermissionTable(
    mcp_servers=[_server_id("deepwiki"), _server_id("everything")], # MCP servers this key is allowed to use
    mcp_tool_permissions={"deepwiki": ["search", "read_doc"]},      # optional per-server tool allow-list
)

UserAPIKeyAuth(
    object_permission=object_permission,
)
```

## Enforce budgets and model access {#enforce-budgets-and-model-access}

Set `custom_auth_run_common_checks: true` to enforce budgets and model-access alongside custom auth:

```yaml
general_settings:
  custom_auth: custom_auth.user_api_key_auth
  custom_auth_run_common_checks: true
```

Your handler returns the IDs; the budgets and allowlists live on the matching DB records (`/team/new`, `/user/new`, `/project/new`, `/customer/new`, or the UI), which LiteLLM loads and enforces.

For example, a team with a budget and model allowlist:

```bash
curl -X POST 'http://localhost:4000/team/new' \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "team_id": "eng-team",
    "max_budget": 100,
    "models": ["{{openai_small}}", "{{anthropic}}"]
  }'
```

```python
# ...then return that team_id from custom auth:
return UserAPIKeyAuth(api_key=api_key, team_id="eng-team")
```

For project per-model rate limits, set `model_tpm_limit` / `model_rpm_limit` on the project record (keyed by model name) and return that `project_id`:

```python
# On the project record (via /project/new or the UI):
#   model_tpm_limit = {"{{openai_large}}": 100000, "{{anthropic}}": 50000}
#   model_rpm_limit = {"{{openai_large}}": 100,    "{{anthropic}}": 200}
```

:::note

- The project record's metadata replaces any `project_metadata` you set on the returned object, so configure project per-model limits on the project record, not on the object.
- For per-model rate limits, the model key must equal the request's `model` string exactly, or the limit is skipped silently.

:::

### Key `models` vs project `models` {#key-models-vs-project-models}

These are separate controls:

| Field | Where it is enforced | Source of truth |
| --- | --- | --- |
| `models` on `UserAPIKeyAuth` | Key-level allowlist | Value you return from custom auth |
| `project_id` on `UserAPIKeyAuth` | Project-level allowlist | `models` on the **project record in LiteLLM's DB** |

An empty `models` list (`[]`) means no restriction. Names must match the model group in your config (wildcards supported). See [Project Management](../project_management.md) and [Config Settings](/docs/proxy/config_settings#litellm_settings---reference).

## Key-level enforcement {#key-level-enforcement}

The following are enforced from the returned object, but only when `litellm.enable_post_custom_auth_checks: true` is also set:

```yaml
general_settings:
  custom_auth: custom_auth.user_api_key_auth
  custom_auth_run_common_checks: true   # required for the key models allowlist

litellm_settings:
  enable_post_custom_auth_checks: true
```

```python
return UserAPIKeyAuth(
    api_key=api_key,
    models=["{{openai_small}}"],                                   # key model allowlist (needs both flags)
    model_max_budget={"{{openai_large}}": {"budget_limit": 100, "time_period": "30d"}},  # key per-model budget
)
```

This path also enforces end-user budgets and per-model end-user budgets when `end_user_id` is set. To reject expired credentials, return their original expiration time as described in [token expiration](../custom_auth.md#token-expiration).
