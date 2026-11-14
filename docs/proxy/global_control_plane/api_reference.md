---
title: API Reference
sidebar_label: API Reference
toc_max_heading_level: 2
description: Control plane endpoints, authentication, scopes, query parameters, responses, and errors.
---

# API Reference

{/* keep-version-note */}

These paths use the default `/api/v1` prefix. Set [`CONTROL_PLANE_API_PREFIX`](./configuration.md#server) to change it. See [Configuration](./configuration.md) for authentication and service settings.

Authenticated requests use HTTP Bearer authentication: `Authorization: Bearer <credential>`. See the header syntax in [RFC 6750, Section 2.1](https://www.rfc-editor.org/rfc/rfc6750.html#section-2.1). The control plane checks scopes and data plane access. Each data plane also applies its own permissions to forwarded requests.

## Scopes

| Scope | Grants | Default roles |
| --- | --- | --- |
| `dataplanes:read` | Read registry entries, check data plane health, and inspect effective identity. | `admin`, `editor`, `viewer` |
| `fleet:read` | List models and teams across data planes. | `admin`, `editor`, `viewer` |
| `usage:read` | Read usage summaries, daily usage, and top spenders. | `admin`, `editor`, `viewer`, `usage_viewer` |
| `proxy:read` | Forward `GET` and `HEAD` requests to supported data plane management routes. | `admin`, `editor`, `viewer` |
| `proxy:write` | Forward `POST`, `PUT`, `PATCH`, and `DELETE` requests to supported data plane management routes. | `admin`, `editor` |
| `audit:read` | Read recent control-plane audit events in native or OCSF format. | `admin` |
| `dataplanes:write` | Defined but unused by the current API. Change the registry through [startup configuration](./configuration.md#data-plane-registry). | `admin` |
| `roles:write` | Defined but unused by the current API. Change role definitions through [startup configuration](./configuration.md#roles). | `admin` |

The control plane combines the scopes granted by the caller's recognized roles. Custom role definitions can change the default grants above. The control plane master key has every scope.

The optional OIDC `scope` claim narrows role grants to the scopes it lists. It cannot add permissions. An absent or `null` claim keeps the full role grants. An empty claim, or one containing only values such as `openid profile`, grants no control-plane scopes.

Data plane access is separate from scopes. The caller's `litellm_dataplanes` claim limits which data planes those scopes apply to. An absent or empty claim, or one containing `"*"`, grants fleet-wide access. Each data plane still checks its own permissions. See [Authentication](./configuration.md#authentication) for role and claim settings.

## Authentication

| Authentication method | Bearer credential |
| --- | --- |
| IdP JWT authentication | A JWT access token from the configured [OpenID Connect (OIDC) provider](https://openid.net/specs/openid-connect-core-1_0.html). |
| Username and password login | A session JWT issued by `POST /api/v1/auth/login`. |
| Master key authentication | The static LiteLLM API key configured in `LITELLM_MASTER_KEY`. |

JWT credentials use the JSON Web Token format defined in [RFC 7519](https://www.rfc-editor.org/rfc/rfc7519.html).

| Method | Path | Required scope | Response |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/login` | None. No bearer token required. | `access_token`, `token_type`, and `expires_in` in seconds. |
| `GET` | `/api/v1/auth/me` | None. Bearer token required. | `subject`, `email`, `roles`, `scopes`, `dataplanes`, and `token_kind`. |

`POST /api/v1/auth/login` accepts:

```json
{
  "username": "operator",
  "password": "REPLACE_WITH_PASSWORD"
}
```

Both fields are required. The username accepts 1 to 256 characters. The password accepts 1 to 1024 characters. Login checks the configured `UI_USERNAME` and `UI_PASSWORD` values. It returns a session JWT in `access_token`, sets `token_type: "bearer"`, and disables caching.

`GET /api/v1/auth/me` returns `token_kind` as `oidc`, `session`, or `master_key`. A `null` value for `dataplanes` means fleet-wide access. Otherwise, it lists the caller's allowed data plane IDs.

## Data planes

| Method | Path | Required scope | Response |
| --- | --- | --- | --- |
| `GET` | `/api/v1/dataplanes` | `dataplanes:read` | `items` containing the registered data planes visible to the caller. |
| `GET` | `/api/v1/dataplanes/{id}` | `dataplanes:read` | One data plane's `id`, `name`, `url`, and configured credential methods. |
| `GET` | `/api/v1/dataplanes/{id}/health` | `dataplanes:read` | `id`, `status`, `http_status`, and `detail`. |
| `GET` | `/api/v1/dataplanes/{id}/whoami` | `dataplanes:read` | `id`, the selected `credential` method, `user_id`, `user_email`, and `user_role`. |

The list uses the same fields as the single-data-plane response. `credentials` lists `oidc_exchange`, `service_token`, or both. It does not contain secrets.

The health endpoint calls the data plane's `/health/liveliness` route. It returns HTTP `200` with `status: "ok"`, `"degraded"`, or `"unreachable"`. Inspect `status` to determine health. `http_status` is the upstream status when available.

The identity endpoint calls `/user/info` with the credential selected for the caller. If that route returns `404`, the identity fields are `null`. Credential failures, invalid responses, and connection failures return `502`.

## Fleet

Add `?dataplane=us-prod` to select one data plane. Without this parameter, the API queries all registered data planes visible to the caller.

| Method | Path | Required scope | Response |
| --- | --- | --- | --- |
| `GET` | `/api/v1/fleet/models` | `fleet:read` | `items` with each model deployment. `groups` maps each public `model_name` to the data planes that serve it. |
| `GET` | `/api/v1/fleet/teams` | `fleet:read` | `items` with the teams the caller can view on each data plane. |

Each model item includes `dataplane_id`, `model_name`, `litellm_model`, `provider`, `model_id`, and `mode`.

Each team item includes `dataplane_id`, `team_id`, `team_alias`, `organization_id`, `spend`, `max_budget`, `members`, `models`, and `blocked`. `members` is a count.

Both responses include `partial` and `unreachable`. See [Partial results](#partial-results).

## Usage

| Method | Path | Required scope | Response |
| --- | --- | --- | --- |
| `GET` | `/api/v1/usage/summary` | `usage:read` | `window`, combined `totals`, and `by_dataplane` entries with `id` and `metrics`. |
| `GET` | `/api/v1/usage/daily` | `usage:read` | `window`, `group_by`, and `rows` with `date`, `group`, and `metrics`. |
| `GET` | `/api/v1/usage/top` | `usage:read` | `window`, `group_by`, `limit`, and `items` with `group` and `metrics`, ranked by spend. |

### Query parameters

| Parameter | Endpoints | Default | Description |
| --- | --- | --- | --- |
| `dataplane` | All | All visible data planes | Select one registered data plane ID. |
| `start_date` | All | 29 days before `end_date` | First day, inclusive, in `YYYY-MM-DD` format. |
| `end_date` | All | Today in UTC | Last day, inclusive, in `YYYY-MM-DD` format. |
| `group_by` | `/daily`, `/top` | `dataplane` for `/daily`, `model` for `/top` | One of `dataplane`, `model`, `model_group`, `provider`, `endpoint`, `api_key`, or `team`. |
| `limit` | `/top` | `10` | Number of groups to return, from `1` to `100`. |

The default window covers 30 days, including the end date. The maximum window is 366 days by default. [`CONTROL_PLANE_USAGE_MAX_WINDOW_DAYS`](./configuration.md#requests-and-usage) changes this limit and caps the default window when set below 30. The API returns `400` if the start date follows the end date or the window exceeds the limit.

Example request:

```http
GET /api/v1/usage/top?start_date=2026-11-01&end_date=2026-11-07&group_by=team&limit=10
Authorization: Bearer <token>
```

`metrics` includes `spend`, `api_requests`, `successful_requests`, `failed_requests`, `prompt_tokens`, `completion_tokens`, and `total_tokens`. OpenAPI lists the full metrics schema.

For dimensions other than `dataplane`, the API combines matching group labels across the selected data planes. API key groups use the key alias when available.

### Partial results

Fleet and usage responses describe missing results with these fields:

| Field | Meaning |
| --- | --- |
| `partial` | `true` when at least one data plane fails. Usage also sets it when a data plane truncates its API key breakdown. |
| `unreachable` | Failed data planes, each with `id` and `reason`. Failures can include credential rejection or an invalid upstream response. |
| `truncated_dataplanes` | Usage only. IDs of data planes whose API key breakdown exceeded their limit. |

The API returns `200` with available results when some data planes succeed. It returns `503` when every selected data plane fails. If no data planes are visible, it returns empty lists and zero totals in the usage summary.

## Management requests

Forward a supported data plane API request through:

```text
/api/v1/dataplanes/{id}/proxy/{path}
```

| Methods | Required scope |
| --- | --- |
| `GET`, `HEAD` | `proxy:read` |
| `POST`, `PUT`, `PATCH`, `DELETE` | `proxy:write` |

Use the data plane route as `{path}`. For example, `/api/v1/dataplanes/us-prod/proxy/model/info` forwards to `/model/info` on `us-prod`. Query parameters pass through to the data plane. A request body must be a JSON object.

Supported route families include keys, users, teams, organizations, end users, budgets, tags, models, credentials, guardrails, MCP servers, vector stores, spend, audit logs, and management settings. The API also allows `/health/readiness`, `/health/liveliness`, `/health/liveness`, and `/health/latest`.

The control plane rejects inference, login, SSO, OAuth, onboarding, session, service-account key generation, guardrail execution, configuration-file, debug, and drain routes with `403`.

The response uses the data plane's status and body and adds `X-LiteLLM-Dataplane: <id>`. Data plane errors retain their upstream response format. Redirects return `502`.

Reads can retry after connection failures or upstream `502`, `503`, and `504` responses. The default is [three attempts](./configuration.md#requests-and-usage). The control plane sends each write once. Request bodies are limited to 1 MB. Data plane responses are limited to 64 MiB.

With [strict audit delivery](./configuration.md#audit-logs), the control plane can reject a write with `503` before forwarding it.

## Audit events

Both endpoints return recent events from the responding control-plane process, newest first.

| Method | Path | Required scope | Response |
| --- | --- | --- | --- |
| `GET` | `/api/v1/audit` | `audit:read` | `items` in the native audit format. |
| `GET` | `/api/v1/audit/ocsf` | `audit:read` | `items` in OCSF 1.5 format, plus `chain_valid` and `sequence_gaps`. |

| Query parameter | Default | Description |
| --- | --- | --- |
| `limit` | `100` | Maximum events to return, from `1` to `1000`. |
| `dataplane` | All visible events | Filter by data plane ID. Use `control-plane` for login and control-plane authentication events. |
| `actor` | All actors | Filter by the control-plane subject. |

Native events include `at`, `actor`, `actor_email`, `dataplane_id`, `method`, `path`, `decision`, `status`, `credential`, and `detail`. `decision` is `allowed`, `denied`, or `unreachable`.

Callers with data plane restrictions can read only events for those data planes. Reading `control-plane` events requires fleet-wide access and `audit:read`.

The OCSF endpoint checks the returned records' integrity. `sequence_gaps` counts nonconsecutive sequence numbers between returned records. A gap can result from filtering or local retention. See [audit settings](./configuration.md#audit-logs) for event coverage, export, and retention.

## Health and API schema

| Method | Path | Required scope | Response |
| --- | --- | --- | --- |
| `GET` | `/healthz` | None. No bearer token required. | `{"status":"ok"}` when the control-plane process responds. |
| `GET` | `/readyz` | None. No bearer token required. | `{"status":"ok"}` when the control-plane process responds. |
| `GET` | `/api/v1/docs` | None. No bearer token required. | Interactive Swagger UI. |
| `GET` | `/api/v1/openapi.json` | None. No bearer token required. | OpenAPI schema for the running service. |

The health paths do not use `CONTROL_PLANE_API_PREFIX`. They do not test data planes or audit delivery. Use `/api/v1/dataplanes/{id}/health` to check a data plane.

## Errors

Control-plane errors use `application/problem+json` with `type`, `title`, `status`, and `detail`:

```json
{
  "type": "urn:litellm:error:forbidden",
  "title": "Forbidden",
  "status": 403,
  "detail": "Missing scope: usage:read."
}
```

| Status | Meaning |
| --- | --- |
| `400` | Invalid query parameter, usage window, or management request body. |
| `401` | Missing or invalid bearer token, or invalid login credentials. |
| `403` | Missing scope, denied data plane access, or a blocked management route. |
| `404` | Unknown data plane ID in a data plane, fleet, or usage request. |
| `413` | Request exceeds the 1 MB limit. |
| `422` | Login body fails validation. |
| `429` | Password login is throttled. `Retry-After` gives the wait in seconds. |
| `502` | A forwarded request or identity lookup fails due to credentials, connectivity, response size, or a rejected upstream response. |
| `503` | All selected data planes fail a fleet or usage query, or strict audit delivery blocks a write. |
