import { ControlPlaneArchitecture } from '@site/src/components/ControlPlaneArchitecture';

# Global Control Plane

Deploy a single LiteLLM UI that manages multiple independent LiteLLM proxy instances, each with its own database, Redis, and master key.

<EnterpriseFeature />

## When to use this

Pick this over the shared-database [Multi-Region Deployment](./multi_region.md) topology when blast-radius isolation matters more than global consistency. A database outage on one worker cannot affect another, but a key created on one worker will not authenticate on another, because keys, teams, and budgets are local to the worker that owns them. Multi-Region covers the full tradeoff and the licensing table, where this page appears as a row

Do not confuse this with the dedicated admin instance described on that page. That instance is also admin-only and serves no LLM traffic, but it shares one database with the regional proxies it manages, so it administers a single deployment. A global control plane shares nothing with its workers and administers many separate deployments

## Architecture

<ControlPlaneArchitecture />

The **control plane** is a LiteLLM instance that serves the admin UI and knows about all the workers. It exists purely so admins can switch between workers and manage them from a single UI

Each **worker** is a fully independent LiteLLM proxy that handles LLM requests for its region or team. Workers have their own database, Redis, users, keys, teams, and budgets

## Setup

### 1. Control Plane Configuration

The control plane needs a `worker_registry` that lists all worker instances. Each entry requires `worker_id`, `name`, and `url`

```yaml title="cp_config.yaml"
model_list: []

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  database_url: os.environ/DATABASE_URL

worker_registry:
  - worker_id: "worker-a"
    name: "Worker A"
    url: "http://localhost:4001" # must start with http:// or https://
  - worker_id: "worker-b"
    name: "Worker B"
    url: "http://localhost:4002"
```

Start the control plane:

```bash
litellm --config cp_config.yaml --port 4000
```

### 2. Worker Configuration

Each worker needs `control_plane_url` in its `general_settings`. This enables the `/v3/login` and `/v3/login/exchange` endpoints on the worker so the control plane UI can authenticate against it cross-origin. `PROXY_BASE_URL` must also be set for each worker so that SSO callback redirects resolve correctly

```yaml title="worker_a_config.yaml"
model_list: []

general_settings:
  master_key: sk-worker-a-1234 # unique per worker
  database_url: os.environ/WORKER_A_DATABASE_URL # unique per worker
  control_plane_url: "http://localhost:4000"
```

```bash
PROXY_BASE_URL=http://localhost:4001 litellm --config worker_a_config.yaml --port 4001
```

Repeat this for every worker in the registry, changing the master key, the database URL, and the port each time. A worker is an ordinary LiteLLM proxy in every other respect, so the [production deployment guide](./prod.md) applies to it unchanged

:::important
Each worker must have its own `master_key` and `database_url`. The whole point of this architecture is that workers are independent
:::

:::info
If a worker runs more than one instance behind a load balancer, configure Redis on that worker (the `cache` section of its config). The login code issued by `/v3/login` is stored server-side, so without shared Redis the exchange can land on a different instance and fail with a 401
:::

### 3. SSO Configuration (Optional)

SSO is configured on the control plane instance the same way as a standard LiteLLM proxy. See the [SSO setup guide](./admin_ui_sso.md) for full instructions. If you use SSO, register each worker URL and the control plane URL as allowed callback URLs in your SSO provider's dashboard

With the control plane and at least one worker running, open `http://localhost:4000/ui`. You should see the worker selector on the login page

## How It Works

### Login Flow

On load, the UI reads the control plane's `/.well-known/litellm-ui-config` endpoint, which reports `is_control_plane: true` whenever `worker_registry` is set, along with the registered workers (their IDs, names, and URLs). Because it is a control plane, the login page shows a worker selector dropdown

The user picks a worker and logs in with username/password or SSO. The UI authenticates against the selected worker by calling its `/v3/login` endpoint, which returns a single-use code, then redeems that code at the worker's `/v3/login/exchange` for a JWT. From then on it points all subsequent API calls at that worker, so keys, teams, models, and budgets are managed on the selected worker from the control plane UI

Once logged in, users can switch workers from the navbar dropdown without leaving the UI. Switching redirects back to the login page to authenticate against the new worker

## Control Plane API Service

The UI above switches between workers one at a time. The control plane API service is a separate process from the same image that authenticates a caller once, applies role based access control, reaches every worker as that caller, and answers fleet-wide questions such as usage across all workers. It serves no LLM traffic and no UI

<EnterpriseFeature />

### Run it

```bash
litellm --control-plane --port 8100
```

The same flag works through the Docker image's default entrypoint, `docker run ... docker.litellm.ai/berriai/litellm:main-stable --control-plane --port 8100`, or by setting `LITELLM_CONTROL_PLANE=true`. Without a valid `LITELLM_LICENSE` the process exits before it binds a port. `--num_workers` scales the uvicorn workers and `--ssl_keyfile_path` with `--ssl_certfile_path` terminates TLS on the listener. The control plane serves with plain uvicorn, so `--run_gunicorn`, `--run_hypercorn`, `--run_granian` and `--reload` are refused with a usage error. `--skip_server_startup`, `--version`, `--validate_config`, `--health` and `--test` win over the flag, so a migration job or a utility command that inherits `LITELLM_CONTROL_PLANE=true` from the deployment never turns into a server

| Variable | Purpose |
| --- | --- |
| `LITELLM_LICENSE` | Required. The service refuses to start without a valid enterprise license |
| `LITELLM_MASTER_KEY` | Signs control plane session tokens and doubles as an admin bearer token. The master key always holds every scope, even when the default roles are turned off |
| `CONTROL_PLANE_SESSION_AUDIENCE` | `aud` claim written into and required from session tokens, default `litellm-control-plane-api`. A token minted under the same master key for another component is rejected |
| `UI_USERNAME`, `UI_PASSWORD` | Username and password login at `POST /api/v1/auth/login`. Optional when every caller comes from your IdP. An account locks for 300 seconds after 5 failed attempts, answered with a `429` problem that names the wait. The counter lives in each worker process. Per-IP rate limiting and allow lists belong on the load balancer or WAF in front of the service |
| `CONTROL_PLANE_DATAPLANES` | JSON map of worker id to `{url, name, service_token, oidc_exchange}` (see below) |
| `CONTROL_PLANE_DATAPLANES_FILE` | Path to a YAML file with the same `dataplanes:` map. It holds the worker secrets in plain text, so mount it from a Kubernetes secret |
| `CONTROL_PLANE_OIDC_ISSUER`, `CONTROL_PLANE_OIDC_AUDIENCE`, `CONTROL_PLANE_OIDC_JWKS_URL` | Accept JWTs from your IdP. Roles come from the `roles` claim, worker bindings from the `litellm_dataplanes` claim (`*` or no claim is fleet wide, like a ClusterRoleBinding). A `scope` claim, when present, can only narrow the role grant, a claim that names no control plane scope grants none |
| `CONTROL_PLANE_ROLES` | JSON map of custom role name to `{scopes, inherits}`. Defaults can be overridden or turned off with `CONTROL_PLANE_INCLUDE_DEFAULT_ROLES=false` |
| `CONTROL_PLANE_DATAPLANE_TIMEOUT_SECONDS`, `CONTROL_PLANE_DATAPLANE_RETRY_ATTEMPTS`, `CONTROL_PLANE_FANOUT_CONCURRENCY` | Per worker timeout, retries on safe reads only, and how many workers are called at once |

### How the control plane reaches a worker

Every call to a worker is made as the person who called the control plane, never as a shared admin key. Two credential strategies exist and a worker may list both, the first that can serve the caller wins

**OIDC token exchange** is the primary strategy. The control plane exchanges the caller's IdP token for one scoped to the worker (RFC 8693 or the JWT bearer on-behalf-of profile) and the worker verifies it through its own `litellm_jwtauth` config. No worker code change, the identity stays cryptographic

Worker URLs must be `https`. A local or in-cluster worker on plain `http` needs `allow_insecure_http: true` on its entry, because the bearer credential would otherwise travel unencrypted.

```yaml title="dataplanes.yaml"
dataplanes:
  eu:
    url: https://eu.litellm-domain
    oidc_exchange:
      token_endpoint: https://idp.example.com/oauth2/token
      client_id: litellm-control-plane
      client_secret: <client secret from your IdP>
      profile: rfc8693 # or jwt_bearer_obo
      audience: litellm-eu
```

**Service token with impersonation** is the fallback for callers that did not come from an IdP, such as the username and password login. The control plane sends a service key the worker issued plus `X-LiteLLM-Impersonate-User` and `X-LiteLLM-Impersonate-Email`. The worker honours those headers only when the key carries the `impersonate` permission, resolves the user in its own database by id (a mismatching email header is treated as not found), and records the service key as `impersonated_by` in its audit trail. The impersonated request carries the user's own teams, models and budgets, never the service key's. A key without that permission that sends the headers gets a 403

```bash title="on each worker, once"
curl -X POST https://eu.litellm-domain/key/generate \
  -H "Authorization: Bearer $WORKER_MASTER_KEY" \
  -d '{"key_alias": "control-plane", "permissions": {"impersonate": true}}'
```

```yaml title="dataplanes.yaml"
dataplanes:
  us:
    url: https://us.litellm-domain
    service_token:
      token: <the key returned above>
```

The caller must exist on the worker for the fallback to work, and what they can see there is what the worker's own role for them allows. A control plane viewer who is an `internal_user` on a worker sees their own spend and teams on that worker, a `proxy_admin` sees everything

### Roles and scopes

Routes are gated by scopes, roles are named sets of scopes. The defaults follow the Kubernetes and cloud convention of three tiers plus a narrow billing reader

| Role | Scopes |
| --- | --- |
| `admin` | everything, including `dataplanes:write`, `roles:write` and `audit:read` (the only default role that reads the audit log) |
| `editor` | all read scopes plus `proxy:write` |
| `viewer` | `dataplanes:read`, `usage:read`, `fleet:read`, `proxy:read` |
| `usage_viewer` | `usage:read` only |

A role applies to every worker unless the token's `litellm_dataplanes` claim lists specific worker ids, in which case every fleet call is narrowed to those workers and other workers answer 403

### Routes

| Route | Scope | What it does |
| --- | --- | --- |
| `POST /api/v1/auth/login`, `GET /api/v1/auth/me` | none | Session login and the caller's roles and scopes |
| `GET /api/v1/dataplanes`, `/{id}`, `/{id}/health`, `/{id}/whoami` | `dataplanes:read` | The workers the caller is bound to, their health, and who the worker thinks the caller is |
| `GET /api/v1/usage/summary`, `/usage/daily?group_by=dataplane\|model\|provider\|api_key\|team\|endpoint`, `/usage/top` | `usage:read` | Spend and tokens summed across workers, per day and ranked |
| `GET /api/v1/fleet/models`, `/fleet/teams` | `fleet:read` | Every deployment and team across workers, plus which workers serve each model name |
| `ANY /api/v1/dataplanes/{id}/proxy/{path}` | `proxy:read` for GET, `proxy:write` otherwise | One management route on one worker as the caller. Inference, login, config and lifecycle routes such as `/health/drain` are refused, redirects from the worker are never followed and come back as a `502` |
| `GET /api/v1/audit` | `audit:read` | Who called what on which worker through the control plane, narrowed to the workers the caller is bound to. Virtual keys that appear in a path are stored as `sk-[redacted]`. The in-memory history is per process and lost on restart, the `control_plane.audit` log line is the record to ship to your log pipeline |

Fleet-wide answers carry `partial: true` and an `unreachable` list when a worker did not answer, and only when no worker answered is the call a `503` problem. Errors use `application/problem+json`

### Audit log and traces

Every request the control plane answers produces one audit record, including failed logins, rejected tokens and calls a scope refused. Records follow [OCSF 1.5](https://schema.ocsf.io/1.5.0/classes/api_activity) (`API Activity` for routes, `Authentication` for logins), so Security Lake, Microsoft Sentinel and Splunk read them without a custom parser. A record holds the actor, their email when the IdP sent one, the worker, method, path, decision, status and credential kind. It never holds headers, bodies, query strings or tokens, and a virtual key in a path is written as `sk-[redacted]`. Each record carries a `sequence`, its sha256 `hash` and the `prev_hash` of the record before it, so a gap or an edited record shows up as a broken chain. `GET /api/v1/audit/ocsf` (scope `audit:read`) returns the in-memory history in that shape together with `chain_valid` and `sequence_gaps`.

Records are queued in the process and delivered in batches to the sinks named in `CONTROL_PLANE_AUDIT_SINKS`, a JSON list that defaults to `["log"]`. Every sink has its own queue, so a slow Splunk does not hold back S3. A sink that fails is retried with backoff and when its queue is full the oldest records are dropped and counted. Set `CONTROL_PLANE_AUDIT_STRICT=true` to refuse writes (`POST`, `PUT`, `PATCH`, `DELETE`) with a `503` problem instead of dropping, reads keep working.

| Sink | Variables | Notes |
| --- | --- | --- |
| `log` | none | One `control_plane.audit` JSON line per record on the process log. |
| `otlp` | the proxy's `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`, `OTEL_EXPORTER_OTLP_PROTOCOL` | OTel log records with the OCSF object as the body and the request's trace id, for any OTLP collector. |
| `s3` | `CONTROL_PLANE_AUDIT_S3_BUCKET`, `_S3_PREFIX`, `_S3_REGION`, `_S3_ENDPOINT_URL`, `_S3_OBJECT_LOCK_MODE` (`COMPLIANCE` or `GOVERNANCE`), `_S3_RETENTION_DAYS` | One newline delimited JSON object per batch, written with `If-None-Match: *` so a key is never overwritten. With a lock mode set, the retention header makes S3 refuse deletes until the retention passes. Credentials come from the usual AWS chain. The bucket must have Object Lock enabled when a mode is set. |
| `splunk_hec` | `CONTROL_PLANE_AUDIT_SPLUNK_URL`, `_SPLUNK_TOKEN`, `_SPLUNK_INDEX`, `_SPLUNK_SOURCE` | HEC events with `sourcetype` `ocsf:api_activity` or `ocsf:authentication`. A `200` with a non zero HEC code is retried like a failure. |
| `sentinel` | `CONTROL_PLANE_AUDIT_SENTINEL_ENDPOINT` (the data collection endpoint), `_SENTINEL_DCR_IMMUTABLE_ID`, `_SENTINEL_STREAM_NAME`, `_SENTINEL_TENANT_ID`, `_SENTINEL_CLIENT_ID`, `_SENTINEL_CLIENT_SECRET` | Logs Ingestion API with an Entra client credential that holds `Monitoring Metrics Publisher` on the rule. Rows carry flat columns (`TimeGenerated`, `ClassName`, `ActivityName`, `StatusId`, `ActorUid`, `HttpMethod`, `UrlPath`, `ResponseCode`, `Hash`, `Sequence`, `TraceId`) for analytic rules plus the whole record in `Ocsf`. Requests stay under the 1 MB limit. |

Sink URLs must be `https`. A local or in-cluster S3 compatible store or HEC on plain `http` needs `CONTROL_PLANE_AUDIT_S3_ALLOW_INSECURE_HTTP=true` or `CONTROL_PLANE_AUDIT_SPLUNK_ALLOW_INSECURE_HTTP=true`, the Sentinel endpoint has no opt out. `CONTROL_PLANE_AUDIT_QUEUE_SIZE` (default `10000`) and `CONTROL_PLANE_AUDIT_BATCH_SIZE` (default `100`) size the per sink queue and the batches.

Traces use the same `OTEL_*` variables as the proxy's [OpenTelemetry integration](../observability/opentelemetry_integration) and turn on when `OTEL_EXPORTER_OTLP_ENDPOINT` is set, or explicitly with `CONTROL_PLANE_OTEL_ENABLED=true`. The service name defaults to `litellm-control-plane` (`CONTROL_PLANE_OTEL_SERVICE_NAME`). Each request gets a server span with the HTTP semantic convention attributes and `enduser.id`, each worker call a client span named `<METHOD> <path>` carrying `server.address`, `url.path`, `http.response.status_code` and the attempt number. The control plane injects W3C `traceparent` into every worker call, so a worker that also exports OTel shows the control plane request, the worker's own handling and its database spans as one trace. Audit records carry the same trace id in `metadata.correlation_uid`, which is how a SIEM row joins the trace. Set `CONTROL_PLANE_OTEL_IDENTITY_ATTRIBUTES=false` to keep `enduser.*` off spans.

The worker side `LiteLLM_AuditLog` table keeps recording what changed on each worker. The control plane audit is the access log of who asked for it, and the two join on the impersonated user and the trace id.
