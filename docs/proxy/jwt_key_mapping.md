---
sidebar_label: Map identities to Virtual Keys
---

# Map identities to Virtual Keys

<EnterpriseFeature feature="JWT authentication" />

Let a client authenticate with an identity-provider JWT in place of a static LiteLLM credential. Map a stable JWT claim to an existing [virtual key](./virtual_keys.md), then send the JWT as the bearer token.

## How it works

LiteLLM validates the JWT using your configured signing keys, issuer, and audience, then looks up the configured claim. A matching mapping identifies the virtual key used for authorization and usage tracking. Configure that key's permissions through [Access Management](./access_management/overview.md).

If no mapping exists, `unregistered_jwt_client_behavior` determines whether to reject the request, use standard JWT authorization, create a key, or link an existing one.

## Prerequisites

Complete [identity provider setup](./token_auth.md) and connect your proxy to a database. Have an existing virtual key ready with the caller's required [LLM](./access_management/llm.md), [MCP](./access_management/mcp.md), or [agent](./access_management/agents.md) access. See [Virtual Keys](./virtual_keys.md) for key creation and settings.

The test request below uses a configured model named `my-model` that the key can access.

Choose a stable claim that identifies the caller. Use `sub` for a person or a provider's application identifier for a workload. A shared application `client_id` does not distinguish individual users.

Mapping administration requires a [proxy admin or admin viewer, depending on the operation](./access_management/jwt_permissions.md#virtual-key-mappings).

## Setup

<a id="step-1-configure-the-jwt-claim-to-map-on"></a>

### 1. Configure the mapping claim {#step-1-configure-the-claim-and-unmapped-client-policy}

Add these settings to your existing proxy configuration. This example requires an administrator to register each mapping.

```yaml
general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  database_url: os.environ/DATABASE_URL
  enable_jwt_auth: true
  litellm_jwtauth:
    user_id_jwt_field: sub
    virtual_key_claim_field: sub
    unregistered_jwt_client_behavior: reject
```

### 2. Register a mapping {#step-2-register-a-mapping}

Register the existing key against the caller's claim value. The claim name must match `virtual_key_claim_field`, and the value must match the caller's JWT.

```bash
curl -X POST 'http://localhost:4000/jwt/key/mapping/new' \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "jwt_claim_name": "sub",
    "jwt_claim_value": "user-123",
    "key": "<existing-virtual-key>",
    "description": "user-123"
  }'
```

Pass either the plaintext `key` or its SHA-256 hash as `token`, never both. Creating a mapping does not create or change the key.

## Test authentication

<a id="step-3-test-it"></a>

Obtain a JWT from your identity provider with `sub: user-123`, and send it as the bearer token.

```bash
export JWT_TOKEN="<identity-provider-jwt>"

curl 'http://localhost:4000/v1/chat/completions' \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "my-model",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

The request uses the linked key's existing permissions. View its usage in the dashboard or through `/key/info`.

## Configuration reference

### Mapping claim and cache

`virtual_key_claim_field` supports nested claims such as `user.sub`. Its previous name, `jwt_client_id_field`, remains an alias. `virtual_key_mapping_cache_ttl` sets the mapping cache lifetime in seconds and defaults to `300`.

| `unregistered_jwt_client_behavior` | When no mapping exists |
| --- | --- |
| `fallback_team_mapping` | Use standard JWT authorization. This is the default. |
| `reject` | Return 403. |
| `auto_register` | Create a virtual key and mapping after JWT authorization. Optionally try an existing key first. |
| `link_only` | Link an eligible existing user key, or return 403. Never create a key. |

A missing claim also returns 403 in `reject`, `auto_register`, and `link_only` modes.

### Create mappings automatically {#create-mappings-automatically}

Set `unregistered_jwt_client_behavior: auto_register` to create a key and mapping on the first request from an unmapped identity. Configure the user, team, and organization claims you want the new key to inherit using the [identity claim settings](./jwt_auth_reference.md#tracking-end-users--internal-users--team--org).

Before creating anything, LiteLLM runs JWT authorization, including configured role and scope checks, `custom_validate`, and email-domain restrictions. The new key inherits the resolved identity. Use manual mapping when administrators must configure the key before its first request; see [Access Management](./access_management/overview.md).

Set `auto_register_map_existing_key: true` to reuse an eligible user key first and create a new one only if none exists. For reuse, `virtual_key_claim_field` must match `user_id_jwt_field` or `user_email_jwt_field`. A database connection is required. Unmapped proxy-admin JWTs authenticate directly without creating a mapping.

### Link to existing keys {#link-to-existing-keys}

<SinceVersion v="1.109.0" />

Use `link_only` when administrators provision keys ahead of time. The first authorized request links the identity to its newest eligible key. If no key qualifies, LiteLLM returns 403 with `JWT Key Mapping: No eligible existing virtual key for this identity. Access denied.`

```yaml
general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  database_url: os.environ/DATABASE_URL
  enable_jwt_auth: true
  litellm_jwtauth:
    user_id_jwt_field: sub
    virtual_key_claim_field: sub
    user_id_upsert: false
    unregistered_jwt_client_behavior: link_only
```

The mapping claim must match `user_id_jwt_field` or `user_email_jwt_field`, and the database must be connected. This mode never creates keys. `user_id_upsert: true` can still create users, so keep it `false` if users must already exist. Unmapped proxy-admin JWTs authenticate directly without linking a key.

#### Which existing key is selected {#which-existing-key-is-selected}

For `link_only` and `auto_register_map_existing_key`, the key must belong to the resolved user and team, or have no team when the JWT resolves none. It must never expire, must not be blocked, and must not be an Admin UI session key or an auto-registered key. The newest eligible key wins. Later requests keep that mapping even if a newer key is created.

`allowed_routes` does not affect selection. Review the existing key's permissions before enabling automatic linking, including any management-route permissions it grants.

### Multiple identity providers {#multiple-identity-providers}

Configure issuer-bound validation with `litellm_jwtauth.issuers` in the [per-issuer configuration](./jwt_auth_reference.md#per-issuer-claim-mapping), then set `jwt_issuer` on each mapping to the corresponding configured issuer. Issuer-specific `virtual_key_claim_field` and `unregistered_jwt_client_behavior` settings can override the global values.

```json
{
  "jwt_issuer": "https://idp.example.com",
  "jwt_claim_name": "sub",
  "jwt_claim_value": "user-123",
  "key": "<existing-virtual-key>"
}
```

LiteLLM first looks for an issuer-scoped mapping, then falls back to a global mapping without `jwt_issuer`. Global mappings share the same claim namespace across providers. Use issuer-scoped mappings to distinguish identical claim values from different providers.

### Manage mappings {#managing-mappings}

Mapping responses include an `id`, claim name and value, issuer, description, active flag, and audit metadata. They never return the linked key or its hash. Manage the key itself through [Virtual Keys](./virtual_keys.md).

| Operation | Endpoint | Input |
| --- | --- | --- |
| List | `GET /jwt/key/mapping/list` | `page` and `size` query parameters |
| Inspect | `GET /jwt/key/mapping/info` | `id` query parameter |
| Update | `POST /jwt/key/mapping/update` | JSON `id` plus `key` or `token`, `description`, `is_active`, or `jwt_issuer` |
| Delete | `POST /jwt/key/mapping/delete` | JSON `id` |

For example, list mappings to find an ID, then point that mapping to a replacement key.

```bash
curl 'http://localhost:4000/jwt/key/mapping/list?page=1&size=50' \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY"

curl -X POST 'http://localhost:4000/jwt/key/mapping/update' \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"id": "<mapping-id>", "key": "<replacement-key>"}'
```

See [mapping-management permissions](./access_management/jwt_permissions.md#virtual-key-mappings) for the roles allowed to perform each operation.

## Troubleshooting

<a id="error-codes"></a>

| Code | Meaning |
| --- | --- |
| 400 | Invalid key identifier or key not found. |
| 403 | Unmapped identity denied by policy, no eligible existing key, or insufficient mapping-management permissions. |
| 404 | Mapping not found. |
| 409 | A mapping already exists for that issuer, claim name, and claim value. |

For signature, issuer, audience, or signing-key errors, see [JWT troubleshooting](./jwt_auth_reference.md#troubleshooting). If a mapped credential is accepted but its resource request is denied, check the linked key's permissions in [Access Management](./access_management/overview.md).

## Related guides

Use [identity provider setup](./token_auth.md) to configure token verification, or [map identities to users and teams](./jwt_user_team_auth.md) to resolve the caller directly. See [Virtual Keys](./virtual_keys.md) to manage the linked credential and [JWT permissions](./access_management/jwt_permissions.md#virtual-key-mappings) for mapping-management roles and policy behavior.

For Claude Code client configuration, see [Use an identity-provider token](./client_setup/claude_code.md#use-an-identity-provider-token).
