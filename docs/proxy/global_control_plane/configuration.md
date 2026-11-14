---
title: Configuration
sidebar_label: Configuration
toc_max_heading_level: 2
description: Environment variables, data plane registry fields, and JWT settings for the LiteLLM Global Control Plane.
---

# Configuration

{/* keep-version-note */}

The control plane reads environment variables and its configured data plane registry at startup. Restart it after changing startup settings. With [runtime configuration](#runtime-configuration) enabled, API changes to runtime registry entries and roles propagate without a restart. See [API Reference](./api_reference.md) for endpoints and permissions.

## Server

```bash
litellm --control-plane --host 0.0.0.0 --port 4000 --num_workers 1
```

Run one worker per replica and scale with replicas. The control-plane server rejects `--num_workers` values above `1`, `--reload`, `--run_gunicorn`, `--run_hypercorn`, and `--run_granian`. For server-side TLS, set both `--ssl_keyfile_path` and `--ssl_certfile_path`.

| Environment variable | Default | Purpose |
| --- | --- | --- |
| `LITELLM_LICENSE` | Required | Enterprise license. |
| `LITELLM_MASTER_KEY` | Required | Static administrator API key sent as a bearer credential. Also signs session JWTs. Minimum 32 bytes. |
| `CONTROL_PLANE_API_PREFIX` | `/api/v1` | Prefix for management API routes and OpenAPI docs. |

## Authentication

Send API credentials in `Authorization: Bearer <credential>` using the header syntax in [RFC 6750, Section 2.1](https://www.rfc-editor.org/rfc/rfc6750.html#section-2.1).

### Username and password login {#password-sessions}

`POST /api/v1/auth/login` checks the configured username and password. It returns a session [JWT (RFC 7519)](https://www.rfc-editor.org/rfc/rfc7519.html) in `access_token`. Send that token as the bearer credential on later requests.

| Environment variable | Default | Purpose |
| --- | --- | --- |
| `UI_USERNAME`, `UI_PASSWORD` | Unset | Enable password login when both are set. |
| `CONTROL_PLANE_SESSION_TTL_SECONDS` | `43200` | Password-session lifetime in seconds. |
| `CONTROL_PLANE_SESSION_ISSUER` | `litellm-control-plane` | Issuer for password-session JWTs. |
| `CONTROL_PLANE_SESSION_AUDIENCE` | `litellm-control-plane-api` | Audience for password-session JWTs. |

### OIDC provider JWT authentication {#oidc}

The control plane validates JWT access tokens from an [OpenID Connect (OIDC) provider](https://openid.net/specs/openid-connect-core-1_0.html). It checks the signature, issuer, audience, and expiry.

Allow HTTPS access to the IdP's [OpenID Connect Discovery](https://openid.net/specs/openid-connect-discovery-1_0.html) and JWKS endpoints. An explicit `CONTROL_PLANE_OIDC_JWKS_URL` skips discovery. Token exchange also requires HTTPS access to the IdP's token endpoint.

| Environment variable | Default | Purpose |
| --- | --- | --- |
| `CONTROL_PLANE_OIDC_ISSUER`, `CONTROL_PLANE_OIDC_AUDIENCE` | Unset | Enable IdP JWT verification when both are set. |
| `CONTROL_PLANE_OIDC_JWKS_URL` | Discovered | IdP signing-key endpoint. |
| `CONTROL_PLANE_OIDC_ROLES_CLAIM` | `roles` | Claim containing control plane roles. |
| `CONTROL_PLANE_OIDC_SCOPE_CLAIM` | `scope` | Claim that limits the role's scopes. |
| `CONTROL_PLANE_OIDC_DATAPLANES_CLAIM` | `litellm_dataplanes` | Claim containing allowed data plane IDs. |
| `CONTROL_PLANE_OIDC_EMAIL_CLAIM` | `email` | Claim containing the caller's email. |
| `CONTROL_PLANE_OIDC_LEEWAY_SECONDS` | `30` | Clock tolerance in seconds for IdP JWT validation. |

### Roles

| Environment variable | Default | Purpose |
| --- | --- | --- |
| `CONTROL_PLANE_ROLES` | `{}` | JSON map of role names to `scopes` and optional `inherits`. Custom roles replace built-in roles with the same name. |
| `CONTROL_PLANE_INCLUDE_DEFAULT_ROLES` | `true` | Include the built-in roles. |

Config-defined roles and included default roles cannot be changed through the runtime API. Runtime role changes affect later JWT verification without rebuilding the service. JWT role names still come from the caller's claims, and a scope claim can still narrow the resolved grants.

## Data plane registry

| Environment variable | Default | Purpose |
| --- | --- | --- |
| `CONTROL_PLANE_DATAPLANES_FILE` | Unset | Path to the YAML registry. |
| `CONTROL_PLANE_DATAPLANES` | `{}` | JSON registry map. Cannot be combined with `CONTROL_PLANE_DATAPLANES_FILE`. |

```yaml title="dataplanes.yaml"
dataplanes:
  us-prod:
    url: https://litellm-us.internal.example.com
    oidc_exchange:
      token_endpoint: https://idp.example.com/oauth2/token
      client_id: litellm-control-plane
      client_secret: REPLACE_WITH_CLIENT_SECRET
      profile: rfc8693
      audience: litellm-us-production
  eu-prod:
    url: https://litellm-eu.internal.example.com
    service_token:
      token: REPLACE_WITH_SERVICE_TOKEN
```

### Registry entries

Each entry needs `service_token`, `oidc_exchange`, or both. Store the YAML registry in a Secret and set `CONTROL_PLANE_DATAPLANES_FILE` to its mounted path. Registry values are literal and do not expand `os.environ/` references.

| Field | Default | Purpose |
| --- | --- | --- |
| Registry map key | Required | Stable data plane ID used in API paths and access claims. `control-plane` is reserved. |
| `url` | Required | Data plane base URL without userinfo. Use HTTPS. |
| `name` | Registry ID | Display name. |
| `service_token.token` | Unset | Data plane virtual key with impersonation permission. |
| `oidc_exchange.token_endpoint` | Required for exchange | IdP HTTPS token endpoint. |
| `oidc_exchange.client_id`, `oidc_exchange.client_secret` | Required for exchange | Token-exchange application credentials. |
| `oidc_exchange.profile` | `rfc8693` | `rfc8693` or `jwt_bearer_obo`. |
| `oidc_exchange.audience` | Unset | Target audience for RFC 8693 exchange. |
| `oidc_exchange.scope` | Unset | Requested scopes. Required for `jwt_bearer_obo`. |
| `allow_insecure_http` | `false` | Permit plain HTTP for a local or in-cluster data plane. |

With `profile: rfc8693`, the control plane uses [OAuth 2.0 Token Exchange (RFC 8693)](https://www.rfc-editor.org/rfc/rfc8693.html). It submits the caller's access token as `subject_token` with type `urn:ietf:params:oauth:token-type:access_token`. It includes `audience` and `scope` when configured.

With `profile: jwt_bearer_obo`, it uses the [Microsoft Entra on-behalf-of flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-on-behalf-of-flow). Set `scope` to the data plane API's delegated scope. This profile does not send `audience`.

Both profiles require an IdP JWT access token authenticated by the control plane. The IdP must return a signed JWT for the data plane. If both credential methods are configured, the control plane falls back to the service token when exchange cannot produce a token.

Service tokens are LiteLLM virtual API keys sent as bearer credentials. They need `permissions: {impersonate: true}`. Match each operator's local data plane `user_id` to their control plane OIDC `sub` or password-login username. The data plane applies that user's local permissions. This method does not require JWT authentication on the data plane. Calls with the control plane master key use the service token's own identity.

## Runtime configuration

Runtime storage is optional. With neither database nor Redis configured, the service uses startup registry entries and roles as before. Reads remain available, including `GET /api/v1/roles`, but runtime PUT and DELETE routes return `503` after authorization.

| Environment variable | Default | Purpose |
| --- | --- | --- |
| `CONTROL_PLANE_DATABASE_URL` | Unset | Dedicated control-plane PostgreSQL database for runtime data planes and roles. |
| `CONTROL_PLANE_REDIS_URL` | Unset | Shared Redis connection URL for runtime configuration events. |
| `CONTROL_PLANE_CONFIG_STREAM` | `litellm:control_plane:config` | Redis stream name shared by replicas of this control plane. |
| `CONTROL_PLANE_CONFIG_STREAM_MAXLEN` | `10000` | Approximate maximum stream length. Minimum `1`. PostgreSQL remains authoritative when older events are trimmed. |
| `CONTROL_PLANE_SALT_KEY` | Falls back to `LITELLM_SALT_KEY` | Encryption key for persisted data plane client secrets and service tokens. Required and nonempty when runtime storage is enabled. |

Set both storage URLs or neither. Setting only one is a startup error. Every replica must use the same dedicated database, Redis stream, and stable salt key. Keep the salt key available across restarts and protect it separately from database backups. Changing or losing it without re-encrypting stored secrets prevents those secrets from being loaded.

Use a separate PostgreSQL database owned by the control plane, not a data plane's database. The runtime store uses SQLAlchemy Core with the async psycopg driver and its own Alembic migrations. It does not use Prisma, `DATABASE_URL`, or the data plane's migration files. Both `postgresql://` and `postgresql+psycopg://` URLs are accepted. Runtime connections disable prepared statements with `prepare_threshold=None`.

For example, load these values from your secret manager before starting the replicas:

```bash
export CONTROL_PLANE_DATABASE_URL='postgresql://control_plane:REPLACE_WITH_PASSWORD@postgres.internal.example.com:5432/control_plane'
export CONTROL_PLANE_REDIS_URL='redis://redis.internal.example.com:6379/0'
export CONTROL_PLANE_CONFIG_STREAM='litellm:control_plane:config'
export CONTROL_PLANE_SALT_KEY='REPLACE_WITH_SHARED_ENCRYPTION_KEY'
```

Use a TLS-enabled Redis connection with `rediss://` when required by your Redis deployment.

### Migration job

Run this one-shot job before deploying a new control-plane version or starting replicas against a new database:

```bash
litellm --control-plane --skip_server_startup
```

The job requires `CONTROL_PLANE_DATABASE_URL`. It applies pending packaged Alembic revisions through `upgrade head`, records the version in `control_plane_alembic_version`, and exits without starting a server or invoking Prisma. Running it again with a current database is a no-op. A missing database URL or migration failure exits nonzero with a clear error.

Use a direct PostgreSQL connection for this job rather than a transaction pooler. The migrator holds an advisory lock on one backend while Alembic runs migrations on a second connection, committing each revision separately. It needs at least two available backend connections. If serving uses a pooled URL, override `CONTROL_PLANE_DATABASE_URL` with the direct URL for the migration job.

Server startup only checks the schema version and loads the snapshot. It does not create or upgrade tables. A missing or outdated schema is logged with the migration command. Reads use config-only state and runtime writes return `503`. If a replica started before migrations completed, restart it after the job succeeds to enable runtime storage.

### Effective state and secrets

Runtime entries merge into the configured registry and role policy. Config-defined entries and included default roles remain authoritative and read-only through the API. Runtime entries extend that base but cannot shadow or replace protected names. Use the [write APIs](./api_reference.md#runtime-data-plane-writes) for runtime entries and startup settings for protected entries.

The service encrypts `oidc_exchange.client_secret` and `service_token.token` before publishing to Redis or writing PostgreSQL. API responses expose credential method names, not secrets. Runtime deletes remove the database row. Replicas load persisted state after restart, so changes do not depend on retaining every stream event. Audit queues and recent audit records remain process-local and are not stored in the runtime configuration database or stream.

## Requests and usage

| Environment variable | Default | Purpose |
| --- | --- | --- |
| `CONTROL_PLANE_DATAPLANE_TIMEOUT_SECONDS` | `10` | Timeout in seconds for data plane requests and token exchanges. |
| `CONTROL_PLANE_DATAPLANE_RETRY_ATTEMPTS` | `3` | Maximum attempts for retryable data plane reads. |
| `CONTROL_PLANE_FANOUT_CONCURRENCY` | `16` | Maximum concurrent data plane calls for fleet and usage queries per replica. |
| `CONTROL_PLANE_USAGE_MAX_WINDOW_DAYS` | `366` | Largest usage query window in days. |

## Audit logs

Audit events cover password login attempts, authentication and scope failures, management proxy calls, and authenticated runtime configuration write attempts. Runtime writes record events under `control-plane`, including allowed, denied, and failed attempts. Enable [tracing](#tracing) for successful fleet and usage queries.

### Delivery

| Environment variable | Default | Purpose |
| --- | --- | --- |
| `CONTROL_PLANE_AUDIT_SINKS` | `["log"]` | JSON array of enabled destinations. Accepts `log`, `otlp`, `s3`, `splunk_hec`, and `sentinel`. |
| `CONTROL_PLANE_AUDIT_CAPACITY` | `10000` | Capacity of each recent-event buffer. |
| `CONTROL_PLANE_AUDIT_QUEUE_SIZE` | `10000` | Queue capacity per destination. Minimum `2`. |
| `CONTROL_PLANE_AUDIT_BATCH_SIZE` | `100` | Maximum records in a delivery batch. |
| `CONTROL_PLANE_AUDIT_DRAIN_SECONDS` | `5` | Queue drain time in seconds at shutdown. |
| `CONTROL_PLANE_AUDIT_STRICT` | `false` | Refuse management proxy and runtime configuration writes when audit capacity is unavailable. |

S3, Splunk, and Sentinel URL settings require HTTPS. Only S3-compatible and Splunk destinations have an insecure HTTP opt-out. OTLP transport follows the exporter settings below. LiteLLM rejects startup if an enabled sink lacks required settings.

Delivery queues and recent records are local to each process. A full queue drops its oldest record by default. Strict mode returns HTTP `503` before management proxy or runtime configuration writes when any sink has no capacity or has permanently rejected records. Runtime writes reserve audit capacity before checking write scopes and data plane bindings. Restarts can lose queued records. Export records to a shared destination for retention across replicas and restarts.

Delivery workers retry transient failures. Permanent rejections count as lost records and release the batch instead of blocking later delivery. For OTLP/HTTP, client errors other than `408` and `429` are permanent. For OTLP/gRPC, the retryable error codes are `CANCELLED`, `DEADLINE_EXCEEDED`, `RESOURCE_EXHAUSTED`, `ABORTED`, `OUT_OF_RANGE`, `UNAVAILABLE`, and `DATA_LOSS`. Other non-OK codes, such as `INVALID_ARGUMENT`, are permanent. Collector partial rejections are also counted.

### Amazon S3

Grant the control plane's IAM role `s3:PutObject` on the audit prefix. Object retention also requires `s3:PutObjectRetention`, bucket versioning, and [S3 Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html).

| Environment variable | Default | Purpose |
| --- | --- | --- |
| `CONTROL_PLANE_AUDIT_S3_BUCKET` | Unset | Required destination bucket. |
| `CONTROL_PLANE_AUDIT_S3_PREFIX` | `control-plane-audit` | Object key prefix. |
| `CONTROL_PLANE_AUDIT_S3_REGION` | AWS region configuration | Bucket region. |
| `CONTROL_PLANE_AUDIT_S3_ENDPOINT_URL` | AWS S3 endpoint | Override for an S3-compatible service. |
| `CONTROL_PLANE_AUDIT_S3_OBJECT_LOCK_MODE` | Unset | `COMPLIANCE` or `GOVERNANCE` retention. |
| `CONTROL_PLANE_AUDIT_S3_RETENTION_DAYS` | `365` | Retention period when a lock mode is set. |
| `CONTROL_PLANE_AUDIT_S3_TIMEOUT_SECONDS` | `30` | Object upload timeout in seconds. |
| `CONTROL_PLANE_AUDIT_S3_ALLOW_INSECURE_HTTP` | `false` | Allow HTTP for an in-cluster destination. |

S3 uploads use SigV4 and conditional writes. An existing object response (`412`) is treated as delivered. Redirects and most client errors are permanent rejections. `408`, `429`, server errors, and transport failures remain retryable. Retryable S3 error codes also include `RequestTimeout`, `RequestTimeoutException`, `SlowDown`, `ConditionalRequestConflict`, `OperationAborted`, `ExpiredToken`, `ExpiredTokenException`, `RequestExpired`, and `TokenRefreshRequired`. Retried uploads are signed again so refreshed credentials can deliver pending records.

### Splunk HEC

Use the base HEC URL. LiteLLM appends `/services/collector/event`. The [HEC token](https://help.splunk.com/en/splunk-enterprise/get-data-in/collect-http-event-data/http-event-collector-rest-api-endpoints) must allow writes to the audit index.

| Environment variable | Default | Purpose |
| --- | --- | --- |
| `CONTROL_PLANE_AUDIT_SPLUNK_URL`, `CONTROL_PLANE_AUDIT_SPLUNK_TOKEN` | Unset | Required base HEC URL and token. |
| `CONTROL_PLANE_AUDIT_SPLUNK_INDEX` | Token default | Destination index. |
| `CONTROL_PLANE_AUDIT_SPLUNK_SOURCE` | `litellm-control-plane` | HEC source. |
| `CONTROL_PLANE_AUDIT_SPLUNK_TIMEOUT_SECONDS` | `30` | HEC request timeout in seconds. |
| `CONTROL_PLANE_AUDIT_SPLUNK_ALLOW_INSECURE_HTTP` | `false` | Allow HTTP for an in-cluster destination. |

### Microsoft Sentinel

Create a Log Analytics custom table and a data collection rule (DCR). Grant the Entra application **Monitoring Metrics Publisher** on the DCR. Use its immutable ID and input stream name. Follow the [Azure Monitor setup guide](https://learn.microsoft.com/en-us/azure/azure-monitor/logs/tutorial-logs-ingestion-portal/).

| Environment variable | Default | Purpose |
| --- | --- | --- |
| `CONTROL_PLANE_AUDIT_SENTINEL_ENDPOINT` | Unset | Required Logs Ingestion base endpoint. |
| `CONTROL_PLANE_AUDIT_SENTINEL_DCR_IMMUTABLE_ID` | Unset | Required DCR immutable ID. |
| `CONTROL_PLANE_AUDIT_SENTINEL_STREAM_NAME` | `Custom-LiteLLMControlPlaneAudit_CL` | DCR input stream. |
| `CONTROL_PLANE_AUDIT_SENTINEL_TENANT_ID`, `CONTROL_PLANE_AUDIT_SENTINEL_CLIENT_ID`, `CONTROL_PLANE_AUDIT_SENTINEL_CLIENT_SECRET` | Unset | Required Entra application credentials. |
| `CONTROL_PLANE_AUDIT_SENTINEL_AUTHORITY_HOST` | `https://login.microsoftonline.com` | Entra token authority. |
| `CONTROL_PLANE_AUDIT_SENTINEL_TOKEN_SCOPE` | Derived from authority | Azure Monitor scope. Public Azure uses `https://monitor.azure.com/.default`. |
| `CONTROL_PLANE_AUDIT_SENTINEL_TIMEOUT_SECONDS` | `30` | Token and ingestion request timeout in seconds. |

Use this schema for the DCR input stream and destination table. Set the DCR transformation to `source`.

| Type | Columns |
| --- | --- |
| `datetime` | `TimeGenerated` |
| `int` | `ClassUid`, `ActivityId`, `StatusId`, `SeverityId`, `ResponseCode` |
| `long` | `Sequence` |
| `string` | `ClassName`, `ActivityName`, `ActorUid`, `ActorEmail`, `DataplaneId`, `HttpMethod`, `UrlPath`, `Decision`, `Detail`, `TraceId`, `Hash`, `PrevHash`, `Ocsf` |
| `boolean` | `Truncated` |

## Tracing

| Environment variable | Default | Purpose |
| --- | --- | --- |
| `CONTROL_PLANE_OTEL_ENABLED` | Automatic | Enable traces. Automatically enabled when an OTLP base or trace endpoint is set. |
| `CONTROL_PLANE_OTEL_SERVICE_NAME` | `litellm-control-plane` | OpenTelemetry service name. |
| `CONTROL_PLANE_OTEL_IDENTITY_ATTRIBUTES` | `true` | Include caller ID and roles in trace attributes. |

The OTLP settings below configure audit-log and trace exporters.

| Environment variable | Default | Purpose |
| --- | --- | --- |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `console` | Exporter protocol. Set `http/protobuf` for OTLP/HTTP or `grpc` for OTLP/gRPC. An endpoint selects OTLP/HTTP by default. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Unset | Base collector endpoint. |
| `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` | Unset | Complete log endpoint, such as `https://otel.internal.example.com/v1/logs`. Requires the `otlp` audit sink. |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | Unset | Complete trace endpoint, such as `https://otel.internal.example.com/v1/traces`. |
| `OTEL_EXPORTER_OTLP_HEADERS` | Unset | Comma-separated `key=value` headers for collector authentication. |

## Data plane JWT authentication

Set these values on each data plane that accepts an exchanged JWT. Each data plane must reach the IdP's discovery and JWKS endpoints over HTTPS. It fetches signing keys independently of the control plane.

For the `us-prod` registry entry above, set these data plane environment variables:

```bash
export JWT_PUBLIC_KEY_URL=https://idp.example.com/.well-known/openid-configuration
export JWT_ISSUER=https://idp.example.com
export JWT_AUDIENCE=litellm-us-production
```

Match the issuer and audience to the exchanged token's `iss` and `aud`. Merge these fields into the data plane's configuration:

```yaml title="Data plane config.yaml"
general_settings:
  enable_jwt_auth: true
  litellm_jwtauth:
    user_id_jwt_field: sub
    user_email_jwt_field: email
    user_id_upsert: false
```

Provision each operator through [user management](../users.md). Match the local `user_id` to the exchanged token's `sub` and assign the local role needed for the management APIs. Control plane roles do not grant data plane permissions.

| Data plane environment variable | Default | Purpose |
| --- | --- | --- |
| `JWT_PUBLIC_KEY_URL` | Unset | Required JWKS or OIDC discovery URL for the exchanged token's issuer. |
| `JWT_ISSUER` | Unset | Expected `iss` claim. Issuer validation is disabled when unset. |
| `JWT_AUDIENCE` | Unset | Expected `aud` claim. Audience validation is disabled when unset. |

Configure these fields in the data plane's `config.yaml`:

| YAML field | Default | Purpose |
| --- | --- | --- |
| `general_settings.enable_jwt_auth` | `false` | Enable JWT authentication. |
| `general_settings.litellm_jwtauth.user_id_jwt_field` | Unset | Claim containing the local LiteLLM user ID. Use `sub` for the token exchange example. |
| `general_settings.litellm_jwtauth.user_email_jwt_field` | Unset | Claim containing the user's email. |
| `general_settings.litellm_jwtauth.user_id_upsert` | `false` | Create a user record if it does not exist. |

See the [JWT configuration reference](../jwt_auth_reference.md) for additional data plane settings.
