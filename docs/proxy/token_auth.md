# Identity provider setup

Connect your identity provider so clients can call LiteLLM with its JWT access tokens.

<EnterpriseFeature feature="JWT-based Auth" />

## How it works

LiteLLM verifies the token's signature, issuer, and audience with the provider's signing keys, then maps its claims to a user, team, or Virtual Key. The token can identify a user, an application, or a workload such as a Kubernetes pod.

If your provider requires a token-info or introspection endpoint, use [OAuth 2.0 provider setup](./oauth2.md). For Admin UI sign-in, use [OpenID Connect (OIDC) SSO](./admin_ui_sso.md) or [SAML SSO](./saml_sso.md).

## Prerequisites

Use a working proxy with its models and database configured. Obtain the provider's JWKS or OIDC discovery URL and configure it to issue tokens for LiteLLM's audience. The test below uses a configured model named `my-model`.

<a id="choose-a-flow"></a>

Choose how the token identifies the caller:

| What you want to do | Guide |
| --- | --- |
| Identify users and teams from token claims | [Map identities to users and teams](./jwt_user_team_auth.md) |
| Resolve a JWT caller to a Virtual Key | [Map identities to Virtual Keys](./jwt_key_mapping.md) |
| Authenticate pods with Kubernetes ServiceAccount tokens | [Authenticate Kubernetes workloads](./jwt_auth_reference.md#kubernetes-serviceaccount-authentication) |

Complete the provider setup below before following a claim-mapping flow. Configure the mapped identity's permissions in [Access Management](./access_management/overview.md).

<a id="connect-your-identity-provider"></a>

## Setup {#usage}

### 1. Set the provider, issuer, and audience

Use the provider's JWKS endpoint or its OIDC discovery URL. A discovery URL ends in `/.well-known/openid-configuration`; LiteLLM follows its `jwks_uri` to fetch signing keys.

```bash
export JWT_PUBLIC_KEY_URL="https://keycloak.example.com/realms/my-realm/.well-known/openid-configuration"
export JWT_ISSUER="https://keycloak.example.com/realms/my-realm"
export JWT_AUDIENCE="litellm-proxy"
```

`JWT_ISSUER` must exactly match the token's `iss` claim. `JWT_AUDIENCE` must match the token's `aud` claim, or one of its values when `aud` is a list. Configure your identity provider to issue access tokens for that audience.

:::important

Issuer and audience validation are disabled individually when `JWT_ISSUER` or `JWT_AUDIENCE` is unset. Set both so a valid signature alone is not enough to authenticate a token issued for another application.

:::

For multiple identity providers, use [per-issuer configuration](./jwt_auth_reference.md#per-issuer-claim-mapping) to give each provider its own signing keys, audience, and claim mappings.

### 2. Enable JWT authentication

Add `enable_jwt_auth` to your proxy configuration. Keep your existing models and database configuration.

```yaml title="config.yaml"
general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  enable_jwt_auth: true
```

### 3. Map the identity

Configure [user and team claims](./jwt_user_team_auth.md) or a [Virtual Key mapping](./jwt_key_mapping.md). Complete the mapped identity's [access setup](./access_management/overview.md) before testing.

<a id="3-send-the-access-token"></a>

## Test authentication

After completing your chosen flow, obtain a token from your identity provider or workload platform and send it as a bearer token. OAuth applications use the provider's supported grant: a user sign-in flow for delegated access, or client credentials for machine-to-machine access. Kubernetes workloads use their projected ServiceAccount token.

```bash
curl 'http://localhost:4000/v1/chat/completions' \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "my-model",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

Replace `my-model` with a model name from your proxy configuration that the caller can access.

<a id="configuration-and-troubleshooting"></a>

## Configuration reference

| Setting | Purpose |
| --- | --- |
| `JWT_PUBLIC_KEY_URL` | Provider JWKS endpoint or OIDC discovery URL. |
| `JWT_ISSUER` | Expected `iss` claim. Leaving it unset disables the issuer check. |
| `JWT_AUDIENCE` | Expected `aud` claim or one of its values. Leaving it unset disables the audience check. |
| `general_settings.enable_jwt_auth` | Enables JWT authentication. |

See the [JWT configuration reference](./jwt_auth_reference.md) for multiple providers, supported tokens, identity claim mappings, and key caching.

## Troubleshooting

For signature, issuer, audience, or signing-key errors, use [JWT troubleshooting](./jwt_auth_reference.md#troubleshooting). Confirm the provider issued the intended token and that the proxy can fetch its signing keys.

If the token resolves to the expected identity but the resource request is denied, check [JWT permissions](./access_management/jwt_permissions.md#troubleshooting).

## Related guides

<a id="jwt-to-virtual-key-mapping"></a>
<a id="beta-jwt-to-virtual-key-mapping"></a>

JWT-to-virtual-key setup and management now live in [Map identities to Virtual Keys](./jwt_key_mapping.md).

<a id="oidc-userinfo-endpoint"></a>
<a id="route-jwt-shaped-machine-tokens-to-oauth2"></a>

Token-info endpoints, introspection, and routing machine tokens are covered in [OAuth 2.0 provider setup](./oauth2.md).
