# How Key-Based Auth Works

This page explains what happens when a request hits the LiteLLM Proxy carrying an API key. For the step-by-step "how do I create and use keys" walkthrough, see [Virtual Keys](./virtual_keys.md). For OIDC/JWT auth, see [OIDC JWT Auth](./token_auth.md) and [OIDC Architecture](./jwt_auth_arch.md).

## The two kinds of keys

LiteLLM has exactly one authentication surface (the `Authorization` / `x-litellm-api-key` header), but two conceptually distinct credentials flow through it. The master key is a single admin credential set at boot via `general_settings.master_key` or the `LITELLM_MASTER_KEY` env variable; it is not stored in the database and it always starts with `sk-`. Virtual keys are per-team, per-user, or per-application credentials minted at runtime via `/key/generate` and persisted in the `LiteLLM_VerificationToken` table. Both arrive at the proxy the same way, and the proxy decides which one is which by hashing the presented value and looking it up.

The master key exists so the proxy can bootstrap before any database is available. Virtual keys exist so admins can hand out scoped credentials without exposing the master key itself.

## Where the key lives on the request

By default the proxy accepts three header shapes: `Authorization: Bearer <key>`, `x-litellm-api-key: Bearer <key>`, and, on the MCP REST and A2A surfaces, a handful of vendor-specific aliases (`API-Key`, `x-api-key`, `x-goog-api-key`, `Ocp-Apim-Subscription-Key`). The `Bearer ` prefix is stripped before lookup. If clients need to pass a different upstream token in `Authorization` (for example, when LiteLLM sits behind an API gateway that also uses `Authorization`), admins can move LiteLLM's key onto a custom header by setting `general_settings.litellm_key_header_name`; the proxy then reads only that header. See [auth_overview](../auth_overview.md) for the full header reference across gateway surfaces.

## Why virtual keys are hashed at rest

Virtual keys are never stored as plaintext. When `/key/generate` returns a key to the caller, the proxy simultaneously writes a hashed form of that key into `LiteLLM_VerificationToken`, and only the hash. This has three consequences worth internalizing.

An admin looking at the database cannot recover a leaked key, and neither can an attacker who dumps the table. The plaintext is available exactly once, in the response body of the `/key/generate` call that created it. If the caller loses the plaintext, the only remedy is to regenerate.

Every request-time lookup is a hash of the presented key compared against the hash column. This is why the format of the key is fixed (LiteLLM controls the entropy and the prefix) and why arbitrary user-supplied strings cannot function as keys.

Spend, rate-limit counters, and metadata attach to the row keyed by the hash. When you see `/key/info?key=sk-...` return spend, the proxy is hashing the argument, looking up the row, and reading the counters off it. The plaintext never touches the row's spend column.

## The request path

When a request arrives, the proxy walks a fixed sequence. First it parses the key out of whichever header the deployment configured. Then it checks whether the plaintext matches the master key directly; the master key comparison is a straight string compare because the master key is held in memory at startup and never written to the database. If it is not the master key, the proxy hashes the presented value and looks the hash up in `LiteLLM_VerificationToken`. A miss returns 401. A hit produces a `UserAPIKeyAuth` object holding the key row plus, if attached, the joined team and user rows.

From there authorization runs. The proxy evaluates budget (per-key `max_budget`, per-user, per-team, per-organization), rate limits (`tpm_limit`, `rpm_limit`, and their tiered equivalents), model access lists, and any custom rules or guardrails registered for the deployment. Each of these can short-circuit the request with a 429 or 403 before the LLM call goes out. If everything passes, the call is dispatched, and on the way back the proxy records the spend against the key's row, and by inheritance against the attached user, team, and organization rows. See [Virtual Keys – Spend Tracking](./virtual_keys.md#spend-tracking) for the tracking mechanics and [User Management Hierarchy](./user_management_heirarchy.md) for how spend rolls up.

## Why lookups are fast

Every request needs to authenticate, which naively would mean a database round trip per call. LiteLLM avoids this by holding a short-TTL in-memory cache of `hash -> UserAPIKeyAuth` on each proxy worker. A cache hit resolves without touching the database; a miss falls through to Postgres and populates the cache. Spend updates and rate-limit counters are written asynchronously (via the batch writer that drains into `LiteLLM_SpendLogs` on an interval), so authenticated requests are not blocked on write commits either. The trade-off is that a very recently blocked key may serve a small number of requests until the cache entry expires; deployments that need immediate revocation should keep the cache TTL small or invalidate on `/key/block`.

## Key lifecycle

A virtual key goes through four state transitions, each of which is expressed on the same row.

Creation happens through `/key/generate`, which mints the plaintext, hashes it, writes the row (with the configured models, budget, rate limits, team/user attachment, and expiry), and returns the plaintext to the caller once.

Suspension is `/key/block` and `/key/unblock`. These flip the `blocked` field on the row without changing the hash, which means callers can re-enable a key without redistributing it. Blocked keys fail authentication with 401 even though the hash lookup succeeds.

Rotation is `/key/{key}/regenerate`. It mints a new plaintext, writes a new hash onto the same logical key (preserving spend history, attached team/user, and metadata), and returns the new plaintext. If the caller passes a `grace_period`, the old hash is kept valid alongside the new one for the specified duration, so services can migrate over without a hard cutover. LiteLLM also has a scheduled auto-rotation worker that runs regenerate on a configured interval; see [Virtual Keys – Scheduled Key Rotations](./virtual_keys.md#scheduled-key-rotations).

Expiry is set at creation time via `duration` and enforced at authentication time by comparing `expires` against the current clock. An expired key returns 401; the row is not deleted, so spend history remains queryable.

## Composition with teams, users, and organizations

A virtual key is rarely evaluated in isolation. When `/key/generate` is called with `team_id` or `user_id`, the resulting row carries a foreign-key reference and the auth flow joins in the corresponding `LiteLLM_TeamTable` or `LiteLLM_UserTable` row. Budgets and rate limits are then evaluated at every level that applies, with the strictest bound winning. A key with a $50 budget attached to a team with a $10 budget will fail once the team hits $10, even though the key itself has $40 of headroom.

This is why the `LiteLLM_VerificationToken` row is not the whole authorization picture: it is the entry point into a hierarchy. The [Multi-Tenant Architecture](./multi_tenant_architecture.md) doc walks through how organizations, teams, users, and keys nest.

## Why the master key is different

The master key never lives in `LiteLLM_VerificationToken` and never runs through the hash-lookup path. It is compared directly in memory, which is what lets the proxy come up and accept admin traffic before Postgres is reachable. As a consequence, it is not subject to budgets, rate limits, or model allowlists, and it cannot be blocked or expired from the running proxy. Rotating it means restarting with a new `LITELLM_MASTER_KEY` value; see [Master Key Rotations](./master_key_rotations.md) for the operational procedure that keeps encrypted secrets readable across the rotation.

The practical rule is that the master key is an operator credential and should not be handed out to application traffic. Route application traffic through virtual keys, keep the master key confined to key-management calls, and treat any exposure of it as a full-proxy compromise.

## Custom auth and other credential flows

Key-based auth is the default but not the only option. Deployments that need to accept credentials issued elsewhere (a signed request format, an internal SSO token, a service-mesh identity) can register a `user_custom_auth` function that receives the raw request and returns a `UserAPIKeyAuth` or raises. When set, the custom function runs before the built-in hash lookup, so it can either authenticate the request on its own or fall through to the built-in path by returning `None`. See [Custom Auth](./custom_auth.md) for the interface.

JWT and OIDC auth run on a separate branch keyed off `enable_jwt_auth`, described in [OIDC JWT Auth](./token_auth.md) and [OIDC Architecture](./jwt_auth_arch.md); it does not touch `LiteLLM_VerificationToken` at all unless you also opt into [JWT to Virtual Key Mapping](./jwt_key_mapping.md), which resolves an authenticated JWT subject to an existing virtual key row so that downstream spend and rate-limiting behave identically to the pure-key path.

## Related reading

The reference documentation for the mechanics touched on above lives in [Virtual Keys](./virtual_keys.md) (endpoints, request/response shapes, all configuration flags), [Auth Overview](../auth_overview.md) (headers across MCP and A2A gateways), [Access Control](./access_control.md) (model access lists and role-based rules), and [DB Info](./db_info.md) (schema for `LiteLLM_VerificationToken` and adjacent tables).
