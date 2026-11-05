---
sidebar_label: OAuth 2.0 provider setup
---

# OAuth 2.0 provider setup

<EnterpriseFeature feature="OAuth 2.0 authentication" />

Connect your identity provider's token-info or introspection endpoint to LiteLLM, then map its response to a LiteLLM user and team. Clients send the provider's access token as a bearer token; LiteLLM calls the configured endpoint to check it and identify the caller.

The token can be JWT or opaque and can represent a user or an application. For providers that expose signing keys, see [Identity provider setup](./token_auth.md). For Admin UI sign-in, see [OpenID Connect (OIDC) SSO](./admin_ui_sso.md) or [SAML SSO](./saml_sso.md).

## Usage

### Step 1. Configure the validation endpoint

For a token-info endpoint that accepts GET requests with bearer authorization, set its URL.

```bash
export OAUTH_TOKEN_INFO_ENDPOINT="https://idp.example.com/token/info"
```

For an introspection endpoint, also configure the client credentials LiteLLM uses to authenticate to it.

```bash
export OAUTH_TOKEN_INFO_ENDPOINT="https://idp.example.com/oauth2/introspect"
export OAUTH_CLIENT_ID="<introspection-client-id>"
export OAUTH_CLIENT_SECRET="<introspection-client-secret>"
```

LiteLLM sends a form-encoded POST containing `token`, with HTTP Basic client authentication, when the endpoint URL contains `introspect` and both client credentials are set. Otherwise, it sends GET with `Authorization: Bearer <access-token>`. Use an endpoint compatible with the selected request format.

### Step 2. Map the provider's response

LiteLLM reads these top-level response fields. Change the environment variables if your provider uses different names.

| Environment variable | Default response field | Meaning |
| --- | --- | --- |
| `OAUTH_USER_ID_FIELD_NAME` | `sub` | LiteLLM user ID. |
| `OAUTH_USER_ROLE_FIELD_NAME` | `role` | LiteLLM role, such as `internal_user`. |
| `OAUTH_USER_TEAM_ID_FIELD_NAME` | `team_id` | LiteLLM team ID. |

For example, a successful response can contain the following fields. Introspection responses should also report whether the token is active.

```json
{
  "active": true,
  "sub": "user-123",
  "role": "internal_user",
  "team_id": "engineering"
}
```

These fields are read directly, without nested-claim or role-name conversion. Configure the provider to return the LiteLLM IDs and roles you intend to use.

### Step 3. Enable OAuth2 and make a request

Add OAuth2 authentication to your existing proxy configuration. Keep your configured `model_list`.

```yaml
general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  enable_oauth2_auth: true
```

Obtain an access token from your provider, then call a model configured on your proxy. Replace `my-model` with its `model_name`.

```bash
export ACCESS_TOKEN="<provider-access-token>"

curl 'http://localhost:4000/v1/chat/completions' \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "my-model",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

OAuth2 validation applies to LLM API, info, and Lens routes. It does not replace administrative authentication on management routes.

## Using OAuth2 + JWT Together

| Configuration | Tokens sent to provider validation |
| --- | --- |
| OAuth2 enabled, JWT auth disabled | All bearer tokens on the covered routes. |
| OAuth2 and JWT auth enabled | Non-JWT tokens, plus JWTs matching a routing override. Other JWTs use JWT authentication. |
| JWT auth enabled, OAuth2 disabled | Only JWTs matching a routing override. Other JWTs use JWT authentication. |

### Route JWT-Shaped Machine Tokens to OAuth2

Use `routing_overrides` to send selected JWT-shaped tokens to the OAuth2 endpoint. Configure the endpoint and response fields from the steps above, alongside your [JWT provider settings](./token_auth.md).

```yaml
general_settings:
  enable_jwt_auth: true
  enable_oauth2_auth: false
  litellm_jwtauth:
    routing_overrides:
      - iss: "https://machine-idp.example.com"
        client_id: "*LITELLM"
        scope: "App:LiteLLM"
        path: oauth2
```

This rule routes tokens from the specified issuer with a client ID ending in `LITELLM` and the `App:LiteLLM` scope to OAuth2. Set `enable_oauth2_auth: true` as well if non-JWT tokens should also use provider validation.

### Matching behavior

| Rule | Behavior |
| --- | --- |
| Supported selectors | `iss` is required. `client_id`, `scope`, and `aud` are optional. `path` is `oauth2`. |
| Multiple selectors | Every configured selector must match. An absent required claim fails the match. |
| Multiple rules | Any matching rule selects OAuth2. |
| String or list | Each selector accepts a string or a list. Any selector value may match any value in a list-valued claim. |
| Wildcards | `*` and `?` use case-sensitive matching. Non-scope wildcard matches reject claim strings containing whitespace. |
| Scope strings | A space-delimited `scope` is split into individual scopes before matching. `iss`, `aud`, and `client_id` strings are never split. |
| No matching rule | Continue with standard JWT validation. |

For example, this rule accepts either issuer, either client ID, and either audience.

```yaml
routing_overrides:
  - iss: ["https://machine-idp.example.com", "https://backup-idp.example.com"]
    client_id: ["LITELLM", "LITELLM_BACKUP"]
    aud: ["api://litellm", "api://fallback"]
    path: oauth2
```

Place `routing_overrides` under `general_settings.litellm_jwtauth`. Routing reads unverified claims only to choose a validator. A matching rule does not authenticate the caller. The configured provider must still validate the token.

## Debugging

Check the endpoint URL, its required HTTP method, client credentials, and the configured response-field names. Provider HTTP errors and inactive introspection responses reject the request. With both authentication methods enabled, also check whether the JWT matches a routing override.

For additional diagnostics, start the proxy with [`--detailed_debug`](./cli.md#--detailed_debug).
