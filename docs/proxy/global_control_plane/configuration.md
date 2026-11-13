---
title: Global Control Plane Configuration
sidebar_label: Configuration
toc_max_heading_level: 2
description: Configure data planes, authentication, permissions, and a private Kubernetes deployment for the LiteLLM Global Control Plane.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Configuration

{/* keep-version-note */}

## Prerequisites

Use a LiteLLM image that includes the [new control plane](../global_control_plane.md) and a valid Enterprise license. Deploy each data plane with its own PostgreSQL, Redis, and master key. The control plane needs private HTTPS access to each data plane's management API.

## Data plane credentials

Choose how the control plane authenticates to each data plane.

<Tabs>
<TabItem value="service-token" label="Service token" default>

Create a virtual key on each data plane with the `impersonate` permission. Call the data plane directly with its master key:

```bash
curl --request POST "$DATAPLANE_URL/key/generate" \
  --header "Authorization: Bearer $DATAPLANE_MASTER_KEY" \
  --header 'Content-Type: application/json' \
  --data '{"key_alias":"global-control-plane","permissions":{"impersonate":true}}'
```

Store the returned key in that data plane's `service_token.token` entry:

```yaml title="dataplanes.yaml"
dataplanes:
  us-prod:
    name: US production
    url: https://litellm-us.internal.example.com
    service_token:
      token: REPLACE_WITH_US_SERVICE_TOKEN
  eu-prod:
    name: EU production
    url: https://litellm-eu.internal.example.com
    service_token:
      token: REPLACE_WITH_EU_SERVICE_TOKEN
```

Provision each operator on the data planes they can manage through [user management](../users.md). Set the local `user_id` to the operator's OIDC `sub` or password-login username. Assign the local LiteLLM role and permissions. If both identities have an email, the addresses must match.

The control plane forwards the caller's identity with the service key. Each data plane loads that user's local permissions. A missing or SCIM-deactivated user cannot access the data plane. Requests authenticated with the control plane's master key use the service key's own identity instead.

</TabItem>
<TabItem value="token-exchange" label="OIDC token exchange">

Configure your IdP to exchange the caller's access token for a token that the target data plane accepts. Configure [JWT authentication](../token_auth.md) on that data plane with the matching issuer, audience, and user mappings.

```yaml title="dataplanes.yaml"
dataplanes:
  us-prod:
    name: US production
    url: https://litellm-us.internal.example.com
    oidc_exchange:
      token_endpoint: https://idp.example.com/oauth2/token
      client_id: litellm-control-plane
      client_secret: REPLACE_WITH_CLIENT_SECRET
      profile: rfc8693
      audience: litellm-us-production
```

For Microsoft Entra on-behalf-of exchange, use `profile: jwt_bearer_obo` and set `scope` to the data plane API's delegated scope. This profile requires `scope` and does not use `audience`.

Token exchange requires an OIDC caller token. Password sessions and the control plane master key cannot use it. You can add `service_token` to the same entry as a fallback if the exchange cannot produce a token.

</TabItem>
</Tabs>

Mount `dataplanes.yaml` as a Secret. Replace the placeholders with actual credentials through your secret manager. The registry reads literal YAML values and does not expand `os.environ/` references. Restart the control plane after a registry change.

## Authentication and permissions

### OIDC

Set these environment variables on the control plane:

```bash
export CONTROL_PLANE_OIDC_ISSUER=https://idp.example.com
export CONTROL_PLANE_OIDC_AUDIENCE=litellm-control-plane
```

LiteLLM discovers the JWKS URL from the issuer. Set `CONTROL_PLANE_OIDC_JWKS_URL` if your provider needs an explicit URL. Clients send the access token in `Authorization: Bearer`.

Configure your IdP to issue claims such as:

```json title="Example access-token claims"
{
  "iss": "https://idp.example.com",
  "aud": "litellm-control-plane",
  "sub": "operator-123",
  "email": "operator@example.com",
  "roles": ["editor"],
  "litellm_dataplanes": ["us-prod", "eu-prod"]
}
```

The signed token must also include a valid `exp`. Use explicit data plane IDs to limit access. An absent or empty `litellm_dataplanes` claim, or `"*"`, grants access across the fleet.

| Role | Permissions |
| --- | --- |
| `admin` | All control plane scopes |
| `editor` | Read data planes, fleet, and usage. Read and change supported management resources. |
| `viewer` | Read data planes, fleet, usage, and supported management resources. |
| `usage_viewer` | Read usage only. |

Define custom roles with `CONTROL_PLANE_ROLES`. This example lets FinOps read usage and audit records:

```bash
export CONTROL_PLANE_ROLES='{"finops":{"scopes":["usage:read","audit:read"]}}'
```

An IdP role must match a built-in or custom role. If the token includes `scope`, LiteLLM intersects it with the role's grants. A scope claim containing only `openid profile` grants no control plane scopes. Omit that claim or include the control plane scopes the caller needs.

### Password login

Set `UI_USERNAME` and `UI_PASSWORD` to enable one local administrator. The username must match a user on each data plane when you use service-token impersonation.

```bash
curl --request POST https://control-plane.internal.example.com/api/v1/auth/login \
  --header 'Content-Type: application/json' \
  --data '{"username":"platform-admin","password":"REPLACE_WITH_PASSWORD"}'
```

Use the returned `access_token` as a bearer token. Sessions expire after 12 hours by default.

## Kubernetes deployment

Create these Secrets in the `litellm` namespace through your secret manager:

| Secret | Keys |
| --- | --- |
| `control-plane-env` | `LITELLM_LICENSE`, `LITELLM_MASTER_KEY`, and optional `UI_USERNAME` and `UI_PASSWORD` |
| `control-plane-registry` | `dataplanes.yaml` from the credential example |

Use a control plane master key of at least 32 bytes. Keep it separate from each data plane's master key.

Replace `CONTROL_PLANE_TAG` with an image tag that includes the new control plane. Add your OIDC settings to `env` if you use OIDC.

```yaml title="control-plane.yaml"
apiVersion: apps/v1
kind: Deployment
metadata:
  name: litellm-control-plane
  namespace: litellm
spec:
  replicas: 1
  selector:
    matchLabels:
      app: litellm-control-plane
  template:
    metadata:
      labels:
        app: litellm-control-plane
    spec:
      terminationGracePeriodSeconds: 30
      containers:
        - name: control-plane
          image: ghcr.io/berriai/litellm:CONTROL_PLANE_TAG
          command: ["litellm"]
          args: ["--control-plane", "--host", "0.0.0.0", "--port", "4000", "--num_workers", "1"]
          ports:
            - name: http
              containerPort: 4000
          envFrom:
            - secretRef:
                name: control-plane-env
          env:
            - name: CONTROL_PLANE_DATAPLANES_FILE
              value: /etc/litellm-control-plane/dataplanes.yaml
          volumeMounts:
            - name: registry
              mountPath: /etc/litellm-control-plane
              readOnly: true
          readinessProbe:
            httpGet:
              path: /readyz
              port: http
          livenessProbe:
            httpGet:
              path: /healthz
              port: http
      volumes:
        - name: registry
          secret:
            secretName: control-plane-registry
---
apiVersion: v1
kind: Service
metadata:
  name: litellm-control-plane
  namespace: litellm
spec:
  type: ClusterIP
  selector:
    app: litellm-control-plane
  ports:
    - name: http
      port: 4000
      targetPort: http
```

Route a private HTTPS ingress to this Service. Restrict ingress to the corporate network. Set container resources from your management request load. See the [cloud architectures](./architecture.md) for network boundaries.

For private CA certificates, mount a CA bundle and set `SSL_CERT_FILE` to its path. Include the roots needed for your data planes, IdP, and audit destinations.

The equivalent process command is:

```bash
litellm --control-plane --host 0.0.0.0 --port 4000 --num_workers 1
```

This mode reads environment variables and the registry file. It does not use the proxy's `--config` YAML. For TLS on the process itself, pass both `--ssl_certfile_path` and `--ssl_keyfile_path`.

## Use the API

Set `CONTROL_PLANE_TOKEN` to your IdP access token or password-session token. Inspect the control plane identity and the identity used on a data plane:

```bash
curl https://control-plane.internal.example.com/api/v1/auth/me \
  --header "Authorization: Bearer $CONTROL_PLANE_TOKEN"

curl https://control-plane.internal.example.com/api/v1/dataplanes/us-prod/whoami \
  --header "Authorization: Bearer $CONTROL_PLANE_TOKEN"
```

Read a data plane's model configuration through the management API:

```bash
curl https://control-plane.internal.example.com/api/v1/dataplanes/us-prod/proxy/model/info \
  --header "Authorization: Bearer $CONTROL_PLANE_TOKEN"
```

Read combined usage for the caller's allowed data planes:

```bash
curl https://control-plane.internal.example.com/api/v1/usage/summary \
  --header "Authorization: Bearer $CONTROL_PLANE_TOKEN"
```

Open `/api/v1/docs` for the API reference. Data plane permissions still apply to forwarded requests.

## Replicas and health

Run one worker process per replica. The control plane rejects `--num_workers` above `1`. To add replicas, use the same registry, role configuration, and master key on each replica.

Login throttling, recent audit records, and audit delivery queues are local to each replica. Use your ingress to enforce a shared login rate limit, and export [audit records](./audit.md) to a shared destination. A restart clears the local state.

`/healthz` and `/readyz` report control plane process health. They do not test data planes or audit delivery. Use `/api/v1/dataplanes/{id}/health` for a data plane's status.

## Configuration reference

### Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `LITELLM_LICENSE` | Required | Enterprise license. |
| `LITELLM_MASTER_KEY` | Required | Control plane administrator credential and session signing key. Minimum 32 bytes. |
| `UI_USERNAME`, `UI_PASSWORD` | Unset | Enable password login when both are set. |
| `CONTROL_PLANE_DATAPLANES_FILE` | Unset | Path to the YAML registry. |
| `CONTROL_PLANE_DATAPLANES` | `{}` | JSON registry map. Cannot be combined with `CONTROL_PLANE_DATAPLANES_FILE`. |
| `CONTROL_PLANE_API_PREFIX` | `/api/v1` | Prefix for management API routes and OpenAPI docs. |
| `CONTROL_PLANE_SESSION_TTL_SECONDS` | `43200` | Password-session lifetime. |
| `CONTROL_PLANE_SESSION_ISSUER` | `litellm-control-plane` | Issuer for password-session JWTs. |
| `CONTROL_PLANE_SESSION_AUDIENCE` | `litellm-control-plane-api` | Audience for password-session JWTs. |
| `CONTROL_PLANE_OIDC_ISSUER`, `CONTROL_PLANE_OIDC_AUDIENCE` | Unset | Enable IdP JWT verification when both are set. |
| `CONTROL_PLANE_OIDC_JWKS_URL` | Discovered | IdP signing-key endpoint. |
| `CONTROL_PLANE_OIDC_ROLES_CLAIM` | `roles` | Claim containing control plane roles. |
| `CONTROL_PLANE_OIDC_SCOPE_CLAIM` | `scope` | Claim that limits the role's scopes. |
| `CONTROL_PLANE_OIDC_DATAPLANES_CLAIM` | `litellm_dataplanes` | Claim containing allowed data plane IDs. |
| `CONTROL_PLANE_OIDC_EMAIL_CLAIM` | `email` | Claim containing the caller's email. |
| `CONTROL_PLANE_OIDC_LEEWAY_SECONDS` | `30` | Clock tolerance for IdP JWT validation. |
| `CONTROL_PLANE_ROLES` | `{}` | JSON role definitions with `scopes` and optional `inherits`. Custom roles replace built-in roles with the same name. |
| `CONTROL_PLANE_INCLUDE_DEFAULT_ROLES` | `true` | Include the built-in roles. |
| `CONTROL_PLANE_DATAPLANE_TIMEOUT_SECONDS` | `10` | Timeout for data plane requests and token exchanges. |
| `CONTROL_PLANE_DATAPLANE_RETRY_ATTEMPTS` | `3` | Maximum attempts for retryable data plane reads. |
| `CONTROL_PLANE_FANOUT_CONCURRENCY` | `16` | Maximum concurrent data plane calls for fleet and usage queries per replica. |
| `CONTROL_PLANE_USAGE_MAX_WINDOW_DAYS` | `366` | Largest usage query window. |

See [audit and telemetry settings](./audit.md#configuration-reference) for audit destinations and tracing.

### Data plane entries

| Field | Default | Purpose |
| --- | --- | --- |
| Registry map key | Required | Stable data plane ID used in API paths and access claims. `control-plane` is reserved. |
| `url` | Required | Data plane base URL. Use HTTPS. |
| `name` | Registry ID | Display name. |
| `service_token.token` | Unset | Data plane virtual key with impersonation permission. |
| `oidc_exchange.token_endpoint` | Required for exchange | IdP HTTPS token endpoint. |
| `oidc_exchange.client_id`, `oidc_exchange.client_secret` | Required for exchange | Token-exchange application credentials. |
| `oidc_exchange.profile` | `rfc8693` | `rfc8693` or `jwt_bearer_obo`. |
| `oidc_exchange.audience` | Unset | Target audience for RFC 8693 exchange. |
| `oidc_exchange.scope` | Unset | Requested scopes. Required for `jwt_bearer_obo`. |
| `allow_insecure_http` | `false` | Permit plain HTTP for a local or in-cluster data plane. |

Each entry needs `service_token`, `oidc_exchange`, or both.
