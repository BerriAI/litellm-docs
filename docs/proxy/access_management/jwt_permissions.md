---
title: JWT permissions
description: Configure team model access, routes, roles, and scopes for callers authenticated with JWTs.
---

# JWT permissions

{/* keep-version-note */}

Configure what JWT-authenticated users and teams can do in LiteLLM. First [validate the token](../token_auth.md) and [map its identity claims](../jwt_user_team_auth.md). Connect the proxy to its database and configure the models used below; these examples use `my-model` and `my-embedding-model`.

<EnterpriseFeature feature="JWT-based Auth" />

These settings apply to the standard JWT authorization flow. For a JWT linked to a [virtual key](../jwt_key_mapping.md), configure ongoing permissions on the linked key. Standard JWT role and scope checks run on the fallback path or before automatic mapping creation.

## Grant model access through teams {#control-model-access-with-teams}

Create a LiteLLM team whose `team_id` matches a value in the token's `groups` claim. Give the team access to your configured model.

```bash
curl 'http://localhost:4000/team/new' \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "team_id": "engineering",
    "team_alias": "Engineering",
    "models": ["my-model"]
  }'
```

Repeat for each team that your provider can assign. Team IDs in the JWT must match LiteLLM team IDs; displaying the same name in both systems is not sufficient.

Enable team-based model checks alongside your [user and team claim mappings](../jwt_user_team_auth.md):

```yaml title="config.yaml"
general_settings:
  enable_jwt_auth: true
  litellm_jwtauth:
    user_id_jwt_field: "sub"
    team_ids_jwt_field: "groups"
    user_id_upsert: true
    enforce_team_based_model_access: true
```

`enforce_team_based_model_access` requires a resolved team to grant access to the requested model. Without an explicit team selection, LiteLLM selects the first claimed team that can access it. If none grants that model, the request is denied. See [team selection](../jwt_user_team_auth.md#select-team-via-request-header) and [database memberships](../jwt_user_team_auth.md#use-database-team-memberships) for how the caller's teams are resolved.

To manage the same grants in the Admin UI, see [LLM Access](./llm.md#give-a-team-access). Use [MCP Access](./mcp.md) and [Agent Access](./agents.md) for those resources.

## Create users from an email domain {#upsert-users--allowed-email-domains}

To restrict automatic user creation to one email domain, add an email mapping and domain check:

```yaml
general_settings:
  enable_jwt_auth: true
  litellm_jwtauth:
    user_id_jwt_field: "sub"
    user_email_jwt_field: "email"
    user_allowed_email_domain: "example.com"
    user_id_upsert: true
```

Without `user_allowed_email_domain`, this flow does not restrict the user's email domain. Keep your team or virtual-key authorization policy configured alongside user creation.

## Grant administrator access {#set-accepted-jwt-scope-names}

The default administrator scope is `litellm_proxy_admin`. Configure your provider to grant that scope only to proxy administrators, or change the accepted scope:

```yaml
general_settings:
  enable_jwt_auth: true
  litellm_jwtauth:
    admin_jwt_scope: "litellm-proxy-admin"
```

The token's `scope` claim may be a space-separated string or a list. Administrator tokens can access management, spend, and information routes by default. To change those permissions, use [allowed routes](#allowed-routes).

```bash
curl 'http://localhost:4000/key/generate' \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"models": ["my-model"]}'
```

## Block a team {#block-teams}

An administrator can block a team without changing the identity provider:

```bash
curl 'http://localhost:4000/team/block' \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"team_id": "engineering"}'
```

Use `/team/unblock` with the same body to restore access.

## Allowed routes

`admin_allowed_routes` and `team_allowed_routes` accept named route groups, exact paths, or prefixes ending in `*`.

| Setting | Default access |
| --- | --- |
| `admin_allowed_routes` | Management, spend tracking, global spend tracking, and information routes. |
| `team_allowed_routes` | OpenAI-compatible, information, and MCP routes, plus `/v1/messages`, `/v1/messages/count_tokens`, and RAG ingest/query routes. |
| `public_allowed_routes` | The `public_routes` group. |

Setting a route list replaces its defaults. Include every group or path the caller still needs.

```yaml
general_settings:
  enable_jwt_auth: true
  litellm_jwtauth:
    team_id_jwt_field: "team_id"
    team_allowed_routes:
      - "openai_routes"
      - "info_routes"
      - "mcp_routes"
      - "anthropic_routes"
      - "/internal-models/*"
```

Here `anthropic_routes` includes more Anthropic endpoints than the two message routes allowed by default. `/internal-models/*` matches paths beneath that prefix, but not the bare `/internal-models` path. Only a trailing `*` is supported.

Other route groups include `google_routes`, `mapped_pass_through_routes`, `management_routes`, and `spend_tracking_routes`. See [`LiteLLMRoutes` in the source](https://github.com/BerriAI/litellm/blob/main/litellm/proxy/_types.py) for the full, current route lists.

## Map provider roles to permissions (beta) {#beta-control-access-with-oidc-roles}

Map provider roles to LiteLLM roles and use `role_permissions` to restrict their models and endpoints. Set `enforce_rbac: true` to enforce these permissions.

```yaml
general_settings:
  enable_jwt_auth: true
  litellm_jwtauth:
    object_id_jwt_field: "oid"
    roles_jwt_field: "roles"
    role_mappings:
      - role: "litellm.api.consumer"
        internal_role: "team"
    enforce_rbac: true
  role_permissions:
    - role: "team"
      models: ["my-model"]
      routes: ["/v1/chat/completions"]
```

In this example, a token with `roles: ["litellm.api.consumer"]` is treated as a team and `oid` supplies its team ID. Provision that team in LiteLLM, or explicitly enable `team_id_upsert` to create it. Role mapping does not replace token validation or database provisioning.

Supported internal roles are `team`, `internal_user`, and `proxy_admin`. Use `object_id_jwt_field` when the role determines whether the same claim identifies a team or user. Use `user_id_jwt_field` and `team_id_jwt_field` when those identities have separate claims. This feature is in beta.

## Restrict models with scopes (beta) {#beta-control-model-access-with-scopes}

Use `scope_mappings` to give token scopes access to specific configured model names. Set `enforce_scope_based_access: true` to enforce the mapping.

```yaml
general_settings:
  enable_jwt_auth: true
  litellm_jwtauth:
    team_id_jwt_field: "client_id"
    scope_mappings:
      - scope: "litellm.api.consumer"
        models: ["my-model"]
      - scope: "litellm.api.embedding"
        models: ["my-embedding-model"]
    enforce_scope_based_access: true
    enforce_rbac: true
```

Create the team identified by `client_id` before making a request, or configure team upsert. The token's `scope` may be a list or a space-separated string. A token carrying both scopes can call either model, subject to its other access checks. Model names must exactly match `model_list`; this mapping does not expand wildcard model names. This feature is in beta.

## Sync user roles and teams (beta) {#beta-sync-user-roles-and-teams-with-idp}

Enable `sync_user_role_and_teams` to reconcile a user's database role and team memberships during JWT authentication. Create teams before assigning their IDs in tokens.

```yaml
general_settings:
  enable_jwt_auth: true
  litellm_jwtauth:
    user_id_jwt_field: "sub"
    team_ids_jwt_field: "groups"
    roles_jwt_field: "roles"
    user_id_upsert: true
    sync_user_role_and_teams: true
    jwt_litellm_role_map:
      - jwt_role: "AI_ADMIN_*"
        litellm_role: "proxy_admin"
      - jwt_role: "AI_USER"
        litellm_role: "internal_user"
      - jwt_role: "AI_VIEWER"
        litellm_role: "internal_user_viewer"
```

`jwt_litellm_role_map` accepts wildcard patterns for provider role names. It updates the stored user role; [`role_mappings`](#beta-control-access-with-oidc-roles) instead maps roles for request authorization.

Team sync adds memberships from the JWT and removes memberships absent from it. With `fallback_to_db_teams: true`, a token with no team claims preserves database memberships; otherwise an empty team list can remove existing memberships. Sync requires database access and runs during authentication. This feature is in beta.

## Registered agent policies

When a verified JWT [identifies a registered agent](../jwt_auth_reference.md#bind-jwts-to-registered-agents), LiteLLM applies that agent's trace-ID requirement, MCP restrictions, and spend attribution. Configure those policies on the agent. For example:

```yaml
agents:
  - agent_name: research-agent-client-id
    agent_card_params:
      name: research-agent
      url: http://localhost:9999/a2a
      version: "1.0.0"
    litellm_params:
      require_trace_id_on_calls_by_agent: true
```

A JWT whose configured agent claim resolves to `research-agent-client-id` must send `x-litellm-trace-id`; otherwise its call returns `400`. If the JWT resolves to an existing virtual key mapping, the key's `agent_id` determines the caller agent instead.

To control which registered agents a caller can invoke, use [Agent Access](./agents.md).

## Troubleshooting

For a team or model access denial, check the claim mapping, existing team IDs or aliases, the selected team's model grants, and any `x-litellm-team-id` selection. A valid token still needs permission for the requested resource and route.

For signature, issuer, audience, or signing-key errors, see [JWT troubleshooting](../jwt_auth_reference.md#troubleshooting).
