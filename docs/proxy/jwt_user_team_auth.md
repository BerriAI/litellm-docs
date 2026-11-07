# Map identities to users and teams

{/* keep-version-note */}

Use verified JWT claims to identify a user and their LiteLLM teams. LiteLLM attributes requests to the resolved user and team.

<EnterpriseFeature feature="JWT-based Auth" />

## How it works

LiteLLM verifies the JWT, reads the configured identity claims, and resolves them to LiteLLM user and team records. The claim value must match the record's ID unless you configure alias mapping. LiteLLM uses the resolved identities for usage attribution and permission checks.

## Prerequisites

Before you start, [connect your identity provider](./token_auth.md#usage) and connect the proxy to its database. [Provision the teams and their model access](./access_management/llm.md#give-a-team-access), then configure [JWT team permissions](./access_management/jwt_permissions.md#control-model-access-with-teams) before testing. The request below uses a configured model named `my-model`.

## Setup

### 1. Match the team identities {#control-model-access-with-teams}

The example expects your identity provider to issue these claims:

```json
{
  "iss": "https://keycloak.example.com/realms/my-realm",
  "aud": "litellm-proxy",
  "sub": "user-123",
  "email": "user@example.com",
  "groups": ["engineering"]
}
```

This is an example payload, not a signed token. Obtain the actual access token from your provider.

The `engineering` value in the token's `groups` claim must match an existing LiteLLM `team_id`. Check each team that your provider can assign; displaying the same name in both systems is not sufficient. If your provider emits team names, use [alias mapping](#resolve-by-name-alias-instead-of-id).

### 2. Map the claims {#2-map-the-claims}

Merge these settings into your existing proxy configuration:

```yaml title="config.yaml"
general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  enable_jwt_auth: true
  litellm_jwtauth:
    user_id_jwt_field: "sub"
    user_email_jwt_field: "email"
    team_ids_jwt_field: "groups"
    user_id_upsert: true
```

`user_id_upsert` creates a user record on first use. Leave it disabled if administrators provision every user in advance. Merge these identity fields with the [team enforcement settings](./access_management/jwt_permissions.md#control-model-access-with-teams) from your prerequisites.

For a token containing one team ID, use `team_id_jwt_field: "team_id"` instead of `team_ids_jwt_field`. There is no default team claim; configure the field your provider actually emits.

## Test authentication

<a id="3-make-a-request"></a>

Obtain an access token with the claims shown above and send it to the gateway:

```bash
export ACCESS_TOKEN="<identity-provider-access-token>"

curl 'http://localhost:4000/v1/chat/completions' \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "my-model",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

LiteLLM verifies the token and resolves the user and teams. With the [team permissions](./access_management/jwt_permissions.md#control-model-access-with-teams) configured above, it selects a team for `my-model` and checks that team's access.

## Configuration reference

### Select a team for a request {#select-team-via-request-header}

When a user belongs to several teams, send `x-litellm-team-id` to choose which team's permissions and usage attribution apply:

```bash
curl 'http://localhost:4000/v1/chat/completions' \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'x-litellm-team-id: engineering' \
  -H 'Content-Type: application/json' \
  -d '{"model":"my-model","messages":[{"role":"user","content":"Hello"}]}'
```

The header accepts a team ID or a unique `team_alias`. By default, it must identify a team granted by the JWT; otherwise LiteLLM returns `403`. Usage and policy checks use the resolved team ID. Without the header, LiteLLM selects the first claimed team with access to the requested model.

With `fallback_to_db_teams: true`, the header can also select any team the user belongs to in the database, even when the JWT carries team claims. See [database team fallback](#use-database-team-memberships) before enabling this behavior.

### Use team or organization names {#resolve-by-name-alias-instead-of-id}

If your provider emits names instead of database IDs, map an alias claim:

```yaml
general_settings:
  enable_jwt_auth: true
  litellm_jwtauth:
    user_id_jwt_field: "sub"
    team_alias_jwt_field: "team_name"
    org_alias_jwt_field: "organization.name"
    user_id_upsert: true
```

LiteLLM looks up `team_name` against the team's `team_alias` and `organization.name` against the organization's `organization_alias`. These records must already exist and their aliases must be unique. If an ID claim and an alias claim both contain a value, the ID takes precedence.

All claim paths support dot notation for nested objects. Escape a literal dot in a claim name with `\.`; for example, `'kubernetes\.io.namespace'` reads `namespace` inside the `kubernetes.io` claim.

### Use database team memberships {#use-database-team-memberships}

Choose the setting that matches the source of your team assignments:

| Setting | When it applies | Result |
| --- | --- | --- |
| `fallback_to_db_teams: true` | The JWT contains no team claims | Resolve the user's existing database teams. The request header may also select a database team membership, including when the JWT has team claims. Requires `user_id_upsert: true`. |
| `team_claim_fallback: true` | A configured team claim is present, but none of its values resolves to a LiteLLM team | Fall back only when the user has exactly one team in the database. |

Both settings default to `false`. A team that resolves but lacks model access still causes a denial; `team_claim_fallback` does not bypass that check. If no team claim is supplied, the existing single-team fallback can use a user's sole database team without enabling `team_claim_fallback`.

```yaml
general_settings:
  enable_jwt_auth: true
  litellm_jwtauth:
    user_id_jwt_field: "sub"
    user_id_upsert: true
    fallback_to_db_teams: true
```

<a id="fall-back-to-db-team-when-jwt-claims-dont-resolve"></a>

Use `team_claim_fallback` only when identity-provider team claims are advisory. Keep it disabled when those claims are the authority for team access.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| Signature, issuer, audience, or signing-key error | Check [JWT token validation](./jwt_auth_reference.md#troubleshooting). |
| The user or team does not resolve | Match the configured claim paths and values to the database records. Use the alias settings only when the provider emits names instead of IDs. |
| The team-selection header returns `403` | Select a team granted by the token, or an existing database membership when database fallback is enabled. |
| The token is accepted but the model request is denied | Check the resolved team's grants and route policy in [JWT permissions](./access_management/jwt_permissions.md#troubleshooting). |

## Related guides

The [JWT configuration reference](./jwt_auth_reference.md) covers [end-user and organization tracking](./jwt_auth_reference.md#tracking-end-users--internal-users--team--org) and [registered agent identities](./jwt_auth_reference.md#bind-jwts-to-registered-agents). To authenticate as an existing virtual key, [map a JWT claim to the key](./jwt_key_mapping.md).

Configure [email-domain restrictions](./access_management/jwt_permissions.md#upsert-users--allowed-email-domains), administrator access, roles, scopes, routes, membership synchronization, and team blocking in [JWT permissions](./access_management/jwt_permissions.md).
