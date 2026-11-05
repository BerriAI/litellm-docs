# JWT configuration reference

{/* keep-version-note */}

Use this reference after [setting up JWT validation](./token_auth.md). Map the verified claims to [users and teams](./jwt_user_team_auth.md) or an [existing virtual key](./jwt_key_mapping.md). Configure resource and route permissions in [Access Management](./access_management/jwt_permissions.md).

<EnterpriseFeature feature="JWT-based Auth" />

## Multiple identity providers {#multiple-oidc-providers}

### Per-issuer configuration {#per-issuer-claim-mapping}

Configure `litellm_jwtauth.issuers` when you trust multiple providers or need different claim mappings for each provider. LiteLLM matches the token's `iss` to an entry, then validates its signature, issuer, and audience using that entry.

```yaml title="config.yaml"
general_settings:
  enable_jwt_auth: true
  litellm_jwtauth:
    user_id_upsert: true
    issuers:
      - issuer: "https://keycloak.example.com/realms/my-realm"
        audience: "litellm-proxy"
        user_id_jwt_field: "sub"
        user_email_jwt_field: "email"
        team_ids_jwt_field: "groups"
      - issuer: "https://workloads.example.com"
        jwks_url: "https://workloads.example.com/.well-known/jwks.json"
        audience: "litellm-proxy"
        team_id_jwt_field: "sub"
```

The first provider's `sub` identifies a user; the second provider's `sub` identifies a team. Configure [permissions for the resolved identity](./access_management/jwt_permissions.md) alongside these mappings.

| Field | Behavior |
| --- | --- |
| `issuer` | Required. Exact expected `iss` value, including its scheme and trailing slash. |
| `audience` | Expected audience. Required unless `disable_audience_validation: true` is set. |
| `disable_audience_validation` | Explicitly skip the audience check. Cannot be combined with `audience`. |
| `jwks_url` | Optional JWKS URL. Otherwise LiteLLM reads the issuer's OIDC discovery document and follows `jwks_uri`. |
| Claim mappings | `user_id_jwt_field`, `user_email_jwt_field`, `team_id_jwt_field`, `team_ids_jwt_field`, `org_id_jwt_field`, and `end_user_id_jwt_field` override their global counterparts for this issuer. |

Mappings omitted from an issuer entry fall back to global `litellm_jwtauth` settings. Move mappings into the issuer entries when a claim has different meanings across providers.

:::important

`issuers` is routing configuration, not an allowlist. An unmatched `iss` falls back to the global `JWT_PUBLIC_KEY_URL`, `JWT_ISSUER`, and `JWT_AUDIENCE` path. Leave `JWT_PUBLIC_KEY_URL` unset if only the configured issuers should authenticate.

:::

### Shared JWKS list

`JWT_PUBLIC_KEY_URL` also accepts comma-separated JWKS or discovery URLs:

```bash
export JWT_PUBLIC_KEY_URL="https://provider-a.example.com/.well-known/openid-configuration,https://provider-b.example.com/.well-known/jwks.json"
```

This path searches URLs in order and uses the first key matching the token header's `kid`. The `iss` claim does not select the provider. All providers share the same claim mappings and the single global `JWT_ISSUER` and `JWT_AUDIENCE` values. If two providers publish the same `kid`, the first matching key wins, even when it belongs to the wrong provider.

Prefer per-issuer configuration when you need to verify different issuers or audiences.

### Supported tokens {#provider-compatibility}

LiteLLM accepts asymmetric signatures using RS256/384/512, PS256/384/512, ES256/384/512, and EdDSA. HMAC algorithms (`HS*`) are rejected. Providers must publish their keys as JWKS, either directly or through OIDC discovery.

A token's `kid` selects a key in the JWKS. A token without `kid` can match a key set containing exactly one key. LiteLLM validates the signature and expiry, plus `nbf` and `iat` when present. Global issuer and audience checks are enabled only when their environment variables are set; per-issuer entries require an audience or an explicit opt-out.

## Key caching and provider outages {#caching-public-keys}

```yaml
general_settings:
  enable_jwt_auth: true
  litellm_jwtauth:
    public_key_ttl: 600
    public_key_stale_ttl: 3600
```

JWKS and discovery responses are cached for `public_key_ttl` seconds, using Redis when configured or the in-process cache otherwise. A missing `kid` does not refresh the keys before that TTL expires.

For transport failures such as DNS, TLS, or timeouts, LiteLLM retries up to three times, then caches the outage for 30 seconds. It can use a previously successful response until its age exceeds `public_key_ttl + public_key_stale_ttl`. Otherwise authentication fails with `503`. Set `public_key_stale_ttl: 0` to reject requests as soon as the normal cache expires during an outage.

Non-200 responses and invalid response bodies do not use retries or stale keys and result in `401`. A provider failure also stops a shared-JWKS-list search; LiteLLM does not continue to later URLs after that error.

## Claim mappings {#tracking-end-users--internal-users--team--org}

All settings below go under `general_settings.litellm_jwtauth`. Identity claim fields default to unset. Paths support nested claims with dot notation, such as `user.email`. Escape literal dots in a claim name, such as `'kubernetes\.io.namespace'`.

| Setting | Maps a claim to |
| --- | --- |
| `user_id_jwt_field` | A LiteLLM user ID, for example `sub`. |
| `user_email_jwt_field` | A user's email, for example `email`. |
| `team_id_jwt_field` | One LiteLLM team ID. There is no implicit `client_id` mapping. |
| `team_ids_jwt_field` | A list of LiteLLM team IDs, for example `groups`. |
| `team_alias_jwt_field` | An existing team's unique `team_alias`. |
| `org_id_jwt_field` | A LiteLLM organization ID. |
| `org_alias_jwt_field` | An existing organization's unique `organization_alias`. |
| `end_user_id_jwt_field` | An end-user ID for customer spend attribution. The verified claim takes precedence over a customer ID supplied in request headers or body. |
| `agent_id_jwt_field` | A registered agent's ID or name. See [registered agents](#bind-jwts-to-registered-agents). |

```yaml
general_settings:
  enable_jwt_auth: true
  litellm_jwtauth:
    user_id_jwt_field: "user.id"
    user_email_jwt_field: "user.email"
    team_id_jwt_field: "tenant.team_id"
    org_id_jwt_field: "organization.id"
    end_user_id_jwt_field: "customer.id"
```

Use [user and team provisioning settings](./jwt_user_team_auth.md#2-map-the-claims) to control whether missing user records are created. `team_id_upsert: true` can create a missing team; leave it disabled when administrators must define team policies before access is granted. See [customer ID precedence](./customers.md#1-make-llm-api-call-w-customer-id) for end-user tracking.

## Add custom validation {#custom-jwt-validate}

`custom_validate` receives the verified claims. Raise an exception to reject the token and return `True` to accept it.

```python title="custom_validate.py"
from typing import Any, Literal


def validate_tenant(token: dict[str, Any]) -> Literal[True]:
    if token.get("tenant_id") != "my-tenant":
        raise ValueError("Invalid JWT tenant")
    return True
```

```yaml
general_settings:
  enable_jwt_auth: true
  litellm_jwtauth:
    user_id_jwt_field: "sub"
    custom_validate: custom_validate.validate_tenant
```

Keep the module available to the proxy alongside your configuration. Custom validation is an additional check; signature, issuer, and audience validation still belong in the shared setup.

## Authenticate Kubernetes workloads {#kubernetes-serviceaccount-authentication}

Use a projected Kubernetes ServiceAccount token as the bearer token. Your proxy must be able to fetch the cluster issuer's OIDC discovery document and JWKS.

### 1. Trust the cluster issuer

Get the issuer URL from your cluster configuration, then configure LiteLLM with that exact issuer and a dedicated audience:

```bash
export JWT_PUBLIC_KEY_URL="https://your-cluster-issuer/.well-known/openid-configuration"
export JWT_ISSUER="https://your-cluster-issuer"
export JWT_AUDIENCE="litellm-proxy"
```

Map the token's namespace to a LiteLLM team alias:

```yaml
general_settings:
  enable_jwt_auth: true
  litellm_jwtauth:
    team_alias_jwt_field: 'kubernetes\.io.namespace'
```

### 2. Resolve the namespace's team

The `my-app` namespace must match an existing LiteLLM team's `team_alias`. [Create the team and assign its model access](./access_management/llm.md#give-a-team-access) before testing. Use `my-app` as its alias and include the configured `my-model` model. For API setup and team enforcement settings, see [JWT team permissions](./access_management/jwt_permissions.md#control-model-access-with-teams).

### 3. Mount a token with the matching audience

Create the ServiceAccount and Pod in an existing `my-app` namespace. Replace `your-application-image` with your workload image.

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: llm-client
  namespace: my-app
---
apiVersion: v1
kind: Pod
metadata:
  name: llm-client
  namespace: my-app
spec:
  serviceAccountName: llm-client
  containers:
    - name: app
      image: your-application-image
      volumeMounts:
        - name: litellm-token
          mountPath: /var/run/secrets/litellm
          readOnly: true
  volumes:
    - name: litellm-token
      projected:
        sources:
          - serviceAccountToken:
              path: token
              audience: litellm-proxy
              expirationSeconds: 3600
```

Kubernetes rotates the projected token. Read the mounted file when sending requests so the application uses the current token. See [Kubernetes ServiceAccount token projection](https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/#serviceaccount-token-volume-projection) for cluster requirements and rotation behavior.

### 4. Call LiteLLM from the pod

Replace the proxy hostname with your deployment's address:

```bash
curl 'http://litellm:4000/v1/chat/completions' \
  -H "Authorization: Bearer $(cat /var/run/secrets/litellm/token)" \
  -H 'Content-Type: application/json' \
  -d '{"model":"my-model","messages":[{"role":"user","content":"Hello"}]}'
```

To track individual ServiceAccounts as users as well, add `user_id_jwt_field: "sub"` and `user_id_upsert: true`. The ServiceAccount subject has the form `system:serviceaccount:my-app:llm-client`.

## Bind JWTs to registered agents

Set `agent_id_jwt_field` to identify a [registered agent](../a2a.md#adding-your-agent) from a verified claim. LiteLLM looks up the value first as `agent_id`, then as `agent_name`.

```yaml
general_settings:
  enable_jwt_auth: true
  litellm_jwtauth:
    agent_id_jwt_field: "agent_client_id"
    team_id_jwt_field: "team"
```

A present claim that matches no registered agent is rejected with `403`, including on administrator tokens. A missing claim leaves the normal authentication flow unchanged. Once resolved, the caller uses that agent's [policies and spend attribution](./access_management/jwt_permissions.md#registered-agent-policies).

Choose a claim carried only by callers that should be treated as agents. For example, Microsoft Entra ID's `azp` claim can also appear on delegated user tokens; mapping it would bind or reject those users too.

When a JWT resolves to an existing [virtual key mapping](./jwt_key_mapping.md), the mapped key's `agent_id` applies and `agent_id_jwt_field` is not consulted.

## Troubleshooting

Use `--detailed_debug` to inspect `JWT Auth:` log entries while diagnosing a rejected request.

| Error or symptom | Check |
| --- | --- |
| `No matching public key found` | Confirm the token's `kid` appears in the provider's JWKS. After key rotation, the cached key set may remain until `public_key_ttl` expires. Tokens without `kid` need a single-key JWKS. |
| `Signature verification failed` with multiple providers | Check for duplicate `kid` values across providers. Use per-issuer configuration to scope key lookup. |
| `Invalid issuer` | Compare the exact `iss` value with `JWT_ISSUER` or the matching issuer entry. |
| `Audience doesn't match` or missing `aud` | Have the provider issue the configured audience and verify the matching `JWT_AUDIENCE` or per-issuer `audience`. |
| Algorithm is not allowed | Use one of the supported asymmetric algorithms, such as RS256. |
| Discovery document has no `jwks_uri` | Supply a real discovery URL, or a JWKS URL whose path does not contain `/.well-known/openid-configuration`. |
| `Missing JWT Public Key URL` | The token matched no issuer entry and no global JWKS URL is configured. Add the intended issuer. |
| `503` for an unreachable JWKS endpoint | Check proxy egress to the provider and the configured cache/stale-key windows. |
| Team or model access denied | See [JWT permissions troubleshooting](./access_management/jwt_permissions.md#troubleshooting). |

<a id="all-jwt-params"></a>

For the complete configuration schema, see [`LiteLLM_JWTAuth` in the source](https://github.com/BerriAI/litellm/blob/main/litellm/proxy/_types.py).
