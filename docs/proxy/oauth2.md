# OAuth 2.0 Authentication

Use this if you want to use an OAuth 2.0 token to make `/chat`, `/embeddings` requests to the LiteLLM Proxy.

:::info

This is an Enterprise Feature - [get in touch with us if you want a free trial to test if this feature meets your needs](https://enterprise.litellm.ai/demo)

:::

## Usage

1. Configure the token validation endpoint and the fields returned by your identity provider:

```bash
export OAUTH_TOKEN_INFO_ENDPOINT="https://your-provider.com/token/info"
export OAUTH_USER_ID_FIELD_NAME="sub"
export OAUTH_USER_ROLE_FIELD_NAME="role"
export OAUTH_USER_TEAM_ID_FIELD_NAME="team_id"
# Only required for RFC 7662 introspection endpoints:
export OAUTH_CLIENT_ID="your-client-id"
export OAUTH_CLIENT_SECRET="your-client-secret"
```

`OAUTH_TOKEN_INFO_ENDPOINT` is read from the environment. The `enable_oauth2_auth` switch is configured in `config.yaml` below; the endpoint and field settings are not currently read from `general_settings` in `config.yaml`.

### Endpoint contract

LiteLLM supports two response patterns:

- **Token info endpoint (GET):** used for endpoints whose URL does not contain `introspect`. LiteLLM sends `Authorization: Bearer <token>` and expects a successful JSON response containing the configured user fields.
- **RFC 7662 introspection endpoint (POST):** used when the URL contains `introspect` and client credentials are configured. LiteLLM sends a form-encoded `token` value, uses HTTP Basic authentication when both client credentials are present, and expects a JSON response with `active: true` (or no `active` field) plus the configured user fields.

The default response field names are `sub`, `role`, and `team_id`. Override them with the corresponding `OAUTH_USER_*_FIELD_NAME` variables when your provider uses different names.

Microsoft Entra ID does not provide a standard RFC 7662 token-introspection endpoint. For Entra, use a provider-specific token-info endpoint that accepts the bearer token, or use LiteLLM's JWT routing configuration instead of setting `OAUTH_TOKEN_INFO_ENDPOINT` to an unsupported introspection URL.

2. Enable OAuth 2.0 authentication in `config.yaml`:

```yaml title="config.yaml"
model_list:
  - model_name: gpt-4
    litellm_params:
      model: openai/fake
      api_key: fake-key
      api_base: https://exampleopenaiendpoint-production.up.railway.app/

general_settings:
  master_key: sk-1234
  enable_oauth2_auth: true
```

3. Use the token in requests to LiteLLM:

```shell
curl --location 'http://0.0.0.0:4000/chat/completions' \
    --header 'Authorization: Bearer <oauth-access-token>' \
    --header 'Content-Type: application/json' \
    --data '{
    "model": "gpt-3.5-turbo",
    "messages": [
        {
        "role": "user",
        "content": "what llm are you"
        }
    ]
}'
```

## Debugging

Start the LiteLLM Proxy with [`--detailed_debug` mode](cli.md#detailed_debug) to see more verbose logs.

## Using OAuth 2.0 + JWT Together

LiteLLM supports two OAuth 2.0 + JWT modes:

1. **Global OAuth 2.0 mode** (`enable_oauth2_auth: true`)  
   OAuth 2.0 auth is enabled on LLM + info routes.
2. **Selective JWT override mode** (`enable_oauth2_auth: false`)  
   Only JWT-shaped tokens that match `litellm_jwtauth.routing_overrides` are routed to OAuth 2.0 on LLM + info routes.

For selective routing (OAuth 2.0 only for specific JWTs), configure:

```yaml title="config.yaml"
general_settings:
  enable_jwt_auth: true
  enable_oauth2_auth: false
  litellm_jwtauth:
    routing_overrides:
      - iss: "machine-issuer.example.com"
        client_id: "MID_LITELLM"
        path: "oauth2"
```

Selectors support shell-style wildcards (`*`, `?`, case-sensitive) and accept either a single string or a list of strings.

For full `routing_overrides` behavior — supported selectors, wildcard and list semantics, and matching rules — see [`/proxy/token_auth`](./token_auth.md#route-jwt-shaped-machine-tokens-to-oauth2).