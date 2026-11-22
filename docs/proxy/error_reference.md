# Error Reference

Every failed request through the LiteLLM AI Gateway returns a JSON error body and an HTTP status code. The OpenAI-shaped routes return an OpenAI-compatible body, and the Anthropic Messages routes return Anthropic's error body, described in [Errors on the Anthropic Messages routes](#errors-on-the-anthropic-messages-routes), with the streaming exceptions covered in [Streaming errors](#streaming-errors). This page is the reference for reading them: what the payload contains, which errors come from the gateway versus the upstream provider, what each status code and error type means, and what the gateway returns when a fallback chain runs out of targets

If you only need the quick provider-versus-gateway rule, see [Diagnosing Errors](/docs/proxy/error_diagnosis). For the Python SDK exception classes and the per-provider mapping table, see [Exception Mapping](/docs/exception_mapping)

## The error payload

Failed requests to the LLM API routes (`/chat/completions`, `/completions`, `/embeddings`, `/responses`, and the other OpenAI-shaped endpoints) return a single top-level `error` object:

```json
{
  "error": {
    "message": "litellm.RateLimitError: RateLimitError: OpenAIException - Rate limit reached for {{openai_small}} in organization org-abc on requests per min (RPM): Limit 3, Used 3.",
    "type": "throttling_error",
    "param": null,
    "code": "429"
  }
}
```

| Field | Type | Description |
|---|---|---|
| `error.message` | string | Human-readable description. For provider failures this is the full LiteLLM exception string, which embeds both the LiteLLM exception name and the provider exception name. This is the field you parse to attribute the error |
| `error.type` | string or null | A coarse category. Gateway-originated errors carry a LiteLLM-specific value such as `budget_exceeded` or `key_model_access_denied`; provider-originated errors carry an OpenAI-style value such as `throttling_error` or `invalid_request_error`, and are frequently `null`. Treat this as a hint, not as the primary signal |
| `error.param` | string or null | The request parameter at fault, when the gateway can identify one. Set to `messages` for a missing required field, `model` for a model-access rejection, `key` for a virtual-key problem |
| `error.code` | string | Almost always the HTTP status code as a string (`"429"`, not `429`). For some provider errors it is the provider's own error code string instead, for example `"invalid_api_key"` or `"context_length_exceeded"` |
| `error.provider_specific_fields` | object | Optional. Present only when the provider returned structured detail worth preserving, most notably Azure OpenAI's `innererror` content-filter breakdown. See [Exception Mapping](/docs/exception_mapping#accessing-provider-specific-error-details) |

Three shapes differ from the above and are worth knowing about

An unhandled exception inside the gateway returns a deliberately minimal body with no `param` or `code`, so that internal detail is never leaked to callers:

```json
{"error": {"message": "Internal server error", "type": "internal_server_error"}}
```

A request to a route that does not exist is rejected by the web framework before LiteLLM sees it, and returns the framework's own shape rather than the `error` envelope. Getting this back usually means a wrong path or a wrong base URL, not a gateway fault:

```json
{"detail": "Not Found"}
```

The `/v1/management/*` endpoints are a separate API surface and return [RFC 9457 Problem Details](https://www.rfc-editor.org/rfc/rfc9457) with a `application/problem+json` content type and `type`, `title`, `status`, and `detail` members, rather than the `error` envelope. The LLM API routes documented here are unaffected

A malformed body, by contrast, is normalized into the standard envelope. Unparseable JSON returns 400 with `error.param` set to `request_body`, and a well-formed body with a wrongly typed field returns 400 with `type` set to `invalid_request_error`

:::note

`error.code` is a string, not an integer. This matches the [OpenAI Python library's error object](https://github.com/openai/openai-python/blob/main/src/openai/types/shared/error_object.py), so clients written against the OpenAI SDK deserialize LiteLLM errors without changes. Compare against `"429"`, or read the HTTP status line instead

:::

## Errors on the Anthropic Messages routes

<SinceVersion v="1.110.0" />

The routes that serve the Anthropic Messages API answer the gateway's own errors in [Anthropic's error shape](https://docs.claude.com/en/api/errors), so the Anthropic SDK and Claude Code read them the same way they read an error from Anthropic. These routes are `/v1/messages`, `/v1/messages/count_tokens`, the same two under `/claude_code_gateway`, and every route under `/anthropic/`. The model list routes (`/v1/models`, `/models`, and `/claude_code_gateway/v1/models`) use this shape only when the request sends an `anthropic-version` header, and without one they keep the OpenAI body. Every other route keeps the OpenAI body described above. [Streaming errors](#streaming-errors) covers how a streamed request on these routes fails

A key with a zero budget that calls `/v1/messages` with an `x-request-id: req-docs-check-1` header gets this body, with the same 422 status it gets on `/v1/chat/completions`:

```json
{
  "type": "error",
  "error": {
    "type": "invalid_request_error",
    "message": "Budget has been exceeded! Key=zero-budget (sk-...PO3g) Current cost: 0.0, Max budget: 0.0",
    "litellm_error_type": "budget_exceeded"
  },
  "request_id": "req-docs-check-1"
}
```

| Field | Type | Description |
|---|---|---|
| `type` | string | Always `"error"` |
| `error.type` | string | Anthropic's error type for the HTTP status, from the table below |
| `error.message` | string | The same message the OpenAI-shaped routes return for this error |
| `error.litellm_error_type` | string | Optional. Set only on errors raised before the Messages handler, to the LiteLLM error type that the OpenAI-shaped routes put in `error.type`, such as `budget_exceeded`, `team_model_access_denied`, or `token_not_found_in_db`. Left out when it would only repeat `error.type` or the default type for the status |
| `request_id` | string | Optional. The value of the request's `x-request-id` header, present only when the client sent one. It is missing when a streamed request fails after the gateway has called the provider. A provider error on an `/anthropic/` route carries Anthropic's own `request_id` instead, as described below |
| `error.provider_specific_fields` | object | Optional. The same provider detail the OpenAI-shaped body carries |
| `error.litellm_call_id` | string | Optional. Set when `general_settings.include_call_id_in_error_body` is on. See [Reporting a problem](#reporting-a-problem) |
| `error.details` | object | Optional, from v1.111.0. A machine-readable code for [message thread](/docs/anthropic_unified#message-threads-beta) errors, such as `{"error_code": "thread_not_found"}` |

There is no `error.code` or `error.param` on these routes, so read the status from the HTTP status line

:::tip

Code that matches a gateway error type such as `budget_exceeded` in `error.type` must read `error.litellm_error_type` on these routes instead, since `error.type` holds Anthropic's type for the status. The [Gateway error types](#gateway-error-types) table lists the values

One budget refusal has no `error.litellm_error_type`. A budget on a tag that a guardrail adds to the request is checked inside the Messages handler, so it returns 422 with `error.type` set to `api_error`, and its message starts with `Budget has been exceeded! Tag=`

:::

Errors the gateway raises before the request reaches the Messages handler (authentication, model access, budgets, a malformed body, the request size limit, and [admission control](/docs/proxy/server_tuning#per-worker-admission-control)) map their status to `error.type` like this:

| Status | `error.type` |
|---|---|
| 400 | `invalid_request_error` |
| 401 | `authentication_error` |
| 402 | `billing_error` |
| 403 | `permission_error` |
| 404 | `not_found_error` |
| 409 | `conflict_error` |
| 413 | `request_too_large` |
| 429 | `rate_limit_error` |
| 500 | `api_error` |
| 503 from admission control | `overloaded_error` |
| 504 | `timeout_error` |
| 529 | `overloaded_error` |
| 408, and any other 5xx | `api_error` |
| Any other 4xx, such as a 422 budget refusal | `invalid_request_error` |

The `/anthropic/` routes have no Messages handler, so the gateway's own errors there, a rate limit included, use this table and carry `error.litellm_error_type`

On `/v1/messages`, count_tokens, and the `/claude_code_gateway` routes, errors raised while the handler serves the request, such as a gateway rate limit, a provider rejection, a timeout, or an unknown model name, carry Anthropic's type for 400, 401, 403, 404, 413, 429, 500, and 529, and `api_error` for any other status, 402, 409, and 504 included. They carry no `error.litellm_error_type`. A provider error still names the provider in `error.message`, the same way it does on the OpenAI-shaped routes, except on a streamed request whose provider times out or drops the connection, described in [Streaming errors](#streaming-errors):

```json
{
  "type": "error",
  "error": {
    "type": "invalid_request_error",
    "message": "litellm.BadRequestError: AnthropicException - {\"type\":\"error\",\"error\":{\"type\":\"invalid_request_error\",\"message\":\"max_tokens: 100000000 > 128000, which is the maximum allowed number of output tokens for claude-haiku-5-5\"},\"request_id\":\"req_...\"} ..."
  }
}
```

The `/anthropic/` routes are a pass-through, so a provider error there is Anthropic's own response, passed back unchanged. The gateway's own errors on these routes have no `request-id` response header. A provider error's `error.message` names no provider, and its `request_id` is Anthropic's, the same value as the `request-id` response header, even when the client sent `x-request-id`:

```json
{"type":"error","error":{"type":"invalid_request_error","message":"max_tokens: 100000000 > 128000, which is the maximum allowed number of output tokens for claude-haiku-5-5"},"request_id":"req_011Ch9u1XnKBcB7mazDjbXH1"}
```

So a gateway rate limit returns 429 with `error.type` set to `rate_limit_error`. On `/v1/messages` and the `/claude_code_gateway` routes it has no `error.litellm_error_type`, and its message starts with `Rate limit exceeded for`. On the `/anthropic/` routes it has `error.litellm_error_type` set to `throttling_error`, and its message starts with `litellm.RateLimitError:`. The 429 header rules under [Response headers](#response-headers) and [Is it the gateway or the provider?](#is-it-the-gateway-or-the-provider) do not apply here, so tell the two apart the way this section does for any error. A provider's 429 names the provider in `error.message`, or on the `/anthropic/` routes comes with a `request-id` header, and a gateway 429 has neither

An unexpected exception raised outside the Messages handler returns 500 with `{"type": "error", "error": {"type": "api_error", "message": "Internal server error"}}` on these routes, plus `request_id` when the client sent `x-request-id`. One raised inside the handler on `/v1/messages`, count_tokens, and the `/claude_code_gateway` routes carries its own message instead, as described above. Unparseable JSON returns 400 with `error.type` set to `invalid_request_error` and no `error.litellm_error_type`

## Response headers

The headers on a failed response carry the diagnostic context that the JSON body does not

| Header | When present | Description |
|---|---|---|
| `x-litellm-call-id` | Any failure after authentication succeeds | The request's correlation id. This is the value to quote in a support ticket and to search for in your logs; it ties the HTTP response to the gateway's log line, the spend-log row, and the OpenTelemetry trace. Absent on authentication failures, which are rejected before a call id is assigned |
| `retry-after` | Gateway rate limits and router cooldowns | Seconds to wait. See the note below about what its presence implies |
| `rate_limit_type` | Gateway rate limits | Which dimension was exceeded: `requests`, `tokens`, or `concurrent_requests` |
| `rate_limited_by` | Gateway rate limits | Which limit was exceeded, as the limiter names it: `api_key`, `team`, `end_user`, `model_per_key`, `model_per_team`, `model_per_end_user`, `model_per_project`, and so on. Read with `rate_limit_type`: `model_per_end_user` plus `tokens` is the customer's `model_tpm_limit` |
| `reset_at` | Gateway rate limits | UTC timestamp at which the exceeded window resets |
| `x-litellm-key-rpm-limit`, `x-litellm-key-max-budget`, `x-litellm-key-spend` | Most failures after authentication | The calling key's configured ceilings and current spend, so you can confirm whether the key itself is the constraint |
| `x-litellm-timeout` | Failures on a request that reached a deployment | The timeout that was in force for the call, in seconds |

Three families of header appear on successful responses only, so do not build failure handling around them: `llm_provider-*` (the upstream's own response headers, forwarded verbatim with a prefix), `x-ratelimit-*` (the upstream's rate-limit counters), and `x-litellm-attempted-retries` / `x-litellm-attempted-fallbacks` (how many retries and fallback hops it took to succeed)

:::tip

`retry-after` is a strong disambiguation signal. The gateway sets it on its own rate limits and cooldowns, and on the OpenAI-shaped routes it does not forward the provider's `retry-after` onto an error response. So on those routes a 429 that carries `retry-after` is the gateway's limit, and a 429 without it is the provider's. The `/anthropic/` routes do pass the provider's `retry-after` back, so on the Anthropic Messages routes, use the checks in [Errors on the Anthropic Messages routes](#errors-on-the-anthropic-messages-routes) instead

:::

## Is it the gateway or the provider?

The gateway wraps every upstream failure and names both layers in `error.message`. Read it from the outside in:

```
litellm.RateLimitError: RateLimitError: OpenAIException - Rate limit reached ...
^^^^^^^^^^^^^^^^^^^^^^                  ^^^^^^^^^^^^^^^
LiteLLM's normalized class              the provider that actually failed
```

The presence of a `<Provider>Exception` token means the request left the gateway, reached the provider, and the provider rejected it. Its absence means the gateway rejected the request itself, before or instead of calling a provider

| Signal in the response | Origin |
|---|---|
| `message` contains `OpenAIException`, `AnthropicException`, `AzureException`, `BedrockException`, `VertexAIException`, or any other `<Provider>Exception` | Upstream provider |
| `message` contains no provider name, and `type` (`litellm_error_type` on the Anthropic Messages routes) is a LiteLLM value such as `budget_exceeded`, `expired_key`, `token_not_found_in_db`, `key_model_access_denied` | LiteLLM gateway |
| `message` starts with `No deployments available for selected model` or `There are no healthy deployments for this model` | LiteLLM gateway (routing) |
| 429 with a `retry-after`, `rate_limit_type`, `rate_limited_by`, or `reset_at` header, on the OpenAI-shaped routes | LiteLLM gateway (rate limiting) |
| 429 with no such headers, on the OpenAI-shaped routes | Upstream provider |

Worked example, gateway origin. The virtual key is capped below its accrued spend, so the request is rejected with HTTP 422 before any provider is contacted:

```json
{
  "error": {
    "message": "Budget has been exceeded! Key=analytics-team (sk-...W8TA) Current cost: 0.06, Max budget: 0.05",
    "type": "budget_exceeded",
    "param": null,
    "code": "422"
  }
}
```

Worked example, provider origin. A 429 whose message names the provider and whose payload carries none of the gateway's rate-limit headers:

```json
{
  "error": {
    "message": "litellm.RateLimitError: RateLimitError: OpenAIException - Rate limit reached for {{openai_small}} in organization org-abc on requests per min (RPM): Limit 3, Used 3.",
    "type": "throttling_error",
    "param": null,
    "code": "429"
  }
}
```

## HTTP status codes

The gateway returns the status code of the underlying failure rather than collapsing everything to 500. For a provider failure this is the provider's own status; for a gateway failure it is the status the gateway chose

| Status | Typical origin | Meaning | Retry? |
|---|---|---|---|
| 400 | Either | Malformed request, unknown model name, context window exceeded, or content policy violation. A gateway-side 400 names the missing parameter in `error.param` | No, fix the request |
| 401 | Either | Gateway: the virtual key is unknown or expired. Provider: the credential configured for the deployment was rejected | No |
| 403 | Gateway | The key, team, user, or organization is not permitted to use the requested model, tool, or vector store | No |
| 404 | Either | The requested model or route does not exist | No |
| 408 | Either | The call exceeded the timeout in force. The message reports both the configured timeout and the elapsed time | Yes, with backoff |
| 422 | Either | Gateway: a key, team, user, or tag spend cap was reached (`budget_exceeded`). Provider: the provider accepted the shape of the request but could not process its contents | No |
| 429 | Either | A rate limit was exceeded. See [Which 429 is this?](#which-429-is-this) below | Yes, honoring `retry-after` |
| 499 | Client | The client disconnected and the upstream call was cancelled | N/A |
| 500 | Either | Gateway: an unhandled internal error. Provider: a provider-side error, including a network failure reaching the provider, which surfaces as `InternalServerError ... Connection error.` | Yes, with backoff |
| 503 | Provider | The provider reported itself unavailable or overloaded | Yes, with backoff |

A note on 500 versus 503. A connection that never reaches the provider (DNS failure, refused connection, wrong `api_base`) is reported as 500 with `Connection error.` in the message, not as 502 or 503. A 503 means the provider answered and told you it was unavailable

## Gateway error types

These `error.type` values are produced by the gateway itself. Seeing one of them means no provider was involved in the failure. On the [Anthropic Messages routes](#errors-on-the-anthropic-messages-routes), errors raised before the Messages handler carry the same values in `error.litellm_error_type`, except a value that is only its status's default type, such as `invalid_request_error` on a 4xx

| `error.type` | Status | Cause | What to do |
|---|---|---|---|
| `token_not_found_in_db` | 401 | The virtual key does not exist | Issue a key with `/key/generate` |
| `expired_key` | 401 | The key's `expires` timestamp has passed | Issue a new key, or extend this one with `/key/update` |
| `auth_error` | 401 | Generic authentication failure, including JWT validation failures | Check the credential and, for JWT auth, the issuer configuration |
| `auth_provider_unavailable` | 503 | The identity provider needed to validate the request, for example its JWKS endpoint, is unreachable | Check network reachability to the identity provider |
| `key_model_access_denied` | 403 | The key's `models` list does not include the requested model | Add the model to the key, or call `/v1/models` to see what the key may use |
| `team_model_access_denied`, `user_model_access_denied`, `org_model_access_denied`, `project_model_access_denied` | 403 | The same restriction applied at the team, user, organization, or project level | Grant access on the object named by the type |
| `tool_access_denied` | 403 | The requested tool is not in the key's or team's allowed-tools list | Add the tool to the allowed list |
| `key_vector_store_access_denied`, `team_vector_store_access_denied`, `user_vector_store_access_denied`, `org_vector_store_access_denied` | 401 | The caller may not use the requested vector store | Add the store to `object_permission.vector_stores` on the object named by the type |
| `team_member_permission_error` | 401 | The caller lacks the team-member permission for this management action | Ask a team admin to perform it or to grant the permission |
| `key_search_tool_access_denied`, `team_search_tool_access_denied`, `user_search_tool_access_denied` | 403 | `search_tool_deny_by_default` is on and the key, team, or user named by the type does not grant the requested search tool | Add the tool to `object_permission.search_tools` on the object named by the type |
| `budget_exceeded` | 422 | A key, team, user, or per-session spend cap was reached. The message reports current cost and max budget. Set `litellm_settings.budget_exceeded_status_code: 429` to return 429 instead | Raise the budget, or wait for the budget window to reset |
| `throttling_error` | 429 | An RPM, TPM, or max-parallel-requests ceiling was exceeded. Also used for provider 429s, so check the headers to tell them apart | Back off using `retry-after` |
| `invalid_request_error` | 400 | A required parameter is missing or malformed. `error.param` names it | Fix the request body |
| `bad_request_error` | 400 | Generic gateway-side request rejection | Read the message |
| `not_found_error` | 404 | The referenced object does not exist | Check the id |
| `no_db_connection` | 400 or 503 | The endpoint needs the database. It is 400 when no database is configured and the caller does not use the master key, and 503 when the configured database is unreachable | Set `DATABASE_URL`, or check database health |
| `internal_server_error` | 500 | Unhandled gateway exception | Check the gateway logs for the matching `x-litellm-call-id` |

Routing failures do not currently set a distinctive `error.type`; identify them by the message prefix instead

| Message prefix | Status | Cause |
|---|---|---|
| `No deployments available for selected model` | 429 | Every deployment in the model group is in cooldown after repeated failures. The message lists the cooling deployment ids and the seconds remaining. The failure log lists the ones this request could have used, with their `api_base`, in [`error_information.error_cooldown_deployments`](/docs/proxy/logging_spec#standardloggingpayloaderrorinformation) |
| `There are no healthy deployments for this model` | 400 | The model group has no deployment that can serve the request |
| `Not allowed to access model due to tags configuration` | 401 | Tag-based routing excluded every deployment for this caller |
| `No deployments available - crossed budget` | 429 | Provider-budget routing has exhausted the budget for every candidate deployment |

## Which 429 is this?

429 is the one status the gateway and the providers both use heavily, so it deserves a dedicated check. On the OpenAI-shaped routes, work through the response in this order. On the Anthropic Messages routes, use the checks in [Errors on the Anthropic Messages routes](#errors-on-the-anthropic-messages-routes) instead

A gateway rate limit sets `retry-after`, `rate_limit_type`, `rate_limited_by`, and `reset_at`. `rate_limited_by` names the limit that was hit (`api_key` below) so you do not have to parse the message, which repeats it in words:

```json
{
  "error": {
    "message": "Rate limit exceeded for api_key: b2f139a7... Limit type: requests. Current limit: 1, Remaining: 0. Limit resets at: 2026-08-27 00:15:18 UTC",
    "type": "throttling_error",
    "param": null,
    "code": "429"
  }
}
```

A gateway budget cap is not a 429 by default: it returns 422 with `type` set to `budget_exceeded`, unless `litellm_settings.budget_exceeded_status_code` is set to 429. A routing cooldown sets `retry-after` and opens with `No deployments available for selected model`. Anything else with a `<Provider>Exception` in the message is the provider's own throttle, and the gateway has already exhausted its configured retries and fallbacks before returning it

From the Python SDK, this classification is available without parsing strings. Every `litellm.RateLimitError` carries a `category` attribute drawn from `RateLimitErrorCategory` and a `rate_limit_type` attribute drawn from `RateLimitType`:

```python showLineNumbers
import litellm
from litellm.exceptions import RateLimitErrorCategory

try:
    response = litellm.completion(model="{{openai_small}}", messages=[{"role": "user", "content": "hi"}])
except litellm.RateLimitError as e:
    if e.category == RateLimitErrorCategory.LITELLM_RATE_LIMIT:
        print(f"LiteLLM's own limiter: {e.rate_limit_type}")
    elif e.category == RateLimitErrorCategory.VENDOR_RATE_LIMIT:
        print("the upstream provider throttled us")
```

`category` is one of `litellm_rate_limit`, `vendor_rate_limit`, `litellm_batch_rate_limit`, or `vendor_batch_rate_limit`. `rate_limit_type` is one of `requests`, `tokens`, `concurrent_requests`, `budget`, or `max_iterations`. Both are also written to `StandardLoggingPayload.error_information`, so custom callbacks and metrics pipelines can split 429s by cause without parsing free text

## Retries and fallbacks

Before the gateway returns an error it works through the retry and fallback policy configured for the model group. Retries re-attempt the same model group; fallbacks move to a different one. See [Fallbacks (Provider Failover)](/docs/proxy/reliability) for configuration

**When the whole chain fails, the gateway re-raises the original exception.** The status code, `error.type`, and `error.code` you receive are those of the *first* model group's failure, not the last fallback's. A group whose primary fails with 500 and whose fallback fails with 503 returns 500.

The message is then extended with the fallback attempt history. Reading the example below: the primary `mock-500` failed with an `InternalServerError`, `Available Model Group Fallbacks` shows the chain that was tried, and `Error doing the fallback` reports what the last hop returned

```json
{
  "error": {
    "message": "litellm.InternalServerError: InternalServerError: OpenAIException - The server had an error while processing your request. Sorry about that!. Received Model Group=mock-500\nAvailable Model Group Fallbacks=['mock-503']\nError doing the fallback: litellm.ServiceUnavailableError: ServiceUnavailableError: OpenAIException - The engine is currently overloaded, please try again later.No fallback model group found for original model_group=mock-503. Fallbacks=[{'mock-500': ['mock-503']}]",
    "type": null,
    "param": null,
    "code": "500"
  }
}
```

Three details follow from this design

`No fallback model group found for original model_group=<name>` means no fallback was configured for that group, so the primary error was returned unchanged. It is not itself a failure; it is the gateway explaining why it did not fail over

The fallback detail is appended by `litellm.expose_router_debug_in_errors`, which is on by default. Set it to `False` to strip the routing detail, including configured fallback target names, from messages returned to callers. Retry counts are appended separately and read `LiteLLM Retried: 2 times, LiteLLM Max Retries: 2`

A fallback that *succeeds* is invisible in the response body, which is a normal 200. Detect it from the `x-litellm-attempted-fallbacks` header, and read `x-litellm-model-group` for the group that actually served the request. Those headers exist only on success, so a failed chain must be reconstructed from `error.message` or the gateway logs

## Streaming errors

A streaming request fails in one of two ways depending on when the failure occurs, and your client must handle both

Failing before the first chunk is indistinguishable from a non-streaming failure. The response is an HTTP error status with the usual JSON `error` body, and no stream is opened:

```
HTTP/1.1 500 Internal Server Error
content-type: application/json

{"error":{"message":"litellm.InternalServerError: InternalServerError: OpenAIException - ...","type":null,"param":null,"code":"500"}}
```

Failing after streaming has begun cannot change the status code, which is already 200. The gateway emits the error as a final SSE event carrying the same `error` object:

```
HTTP/1.1 200 OK
content-type: text/event-stream

data: {"id":"chatcmpl-...","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant","content":"Hel"}}]}

data: {"id":"chatcmpl-...","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"lo"}}]}

data: {"error": {"message": "litellm.APIConnectionError: APIConnectionError: OpenAIException - The server had an error while processing your request. Sorry about that!", "type": null, "param": null, "code": "500"}}
```

On `/v1/messages`, count_tokens, and the `/claude_code_gateway` routes, a streamed request that fails before the response opens gets an HTTP error status and the [Anthropic error body](#errors-on-the-anthropic-messages-routes), but not always the status and message that the same request gets without streaming. When the provider times out or drops the connection before its first chunk, the status is 500, `error.type` is `api_error`, and the message names no provider. The same request without streaming gets 408 and a message that names `AnthropicException`:

```
HTTP/1.1 500 Internal Server Error
content-type: application/json

{"type":"error","error":{"type":"api_error","message":"Timeout on reading data from socket"}}
```

Once the response has opened, the status is already 200 and the error arrives as SSE frames. [Keepalive pings](/docs/proxy/timeout#keepalive-pings-for-idle-streaming-connections) can open it before the first chunk, since the gateway sends `: ping` comments while the provider is quiet. When the call to the provider fails, for example because the provider cannot be reached, the stream ends with one Anthropic `error` event and no `data: [DONE]`, which the Anthropic SDK raises as an error:

```
HTTP/1.1 200 OK
content-type: text/event-stream; charset=utf-8

: ping

: ping

event: error
data: {"type": "error", "error": {"type": "api_error", "message": "litellm.Timeout: AnthropicException - litellm.Timeout: Connection timed out. Timeout passed=4.0, time taken=4.003 seconds\n\nLiteLLM: model group 'claude-unreachable' failed with the error above. No fallback was attempted."}}
```

When the provider opens its own stream and then fails before its first event, the same error body arrives as a `data:` line with no `event:` name, followed by `data: [DONE]`. The Anthropic SDK reads only frames that carry an event name, so it ends the stream with no error and no events:

```
HTTP/1.1 200 OK
content-type: text/event-stream; charset=utf-8

: ping

: ping

data: {"type":"error","error":{"type":"api_error","message":"Timeout on reading data from socket"}}

data: [DONE]
```

A `post_call` guardrail that blocks a streamed response sends an OpenAI `data: {"error": ...}` frame and `data: [DONE]` on these routes too. The status is 400, or 200 when keepalive pings have already opened the response

On the `/anthropic/` routes, a failure after the stream has started sends no error event. The gateway closes the connection, so the stream stops early, and curl reports `transfer closed with outstanding read data remaining`

The 500 with no provider name, the `data:` line with no event name, and the OpenAI frame for a guardrail block are known gaps in the gateway, so a later release can change them. Build on the checks below, which work both now and after a fix, and not on the exact frames

Check every SSE payload for an `error` key before treating it as a chunk, which catches the OpenAI frame, the Anthropic `error` event, and the `data:` line with no event name. On the Anthropic Messages routes, also treat a stream that ends without a `message_stop` event as a failure. A client that only inspects the HTTP status will record a mid-stream failure as a success with a truncated completion

## Exception reference

The Python SDK raises typed exceptions that inherit from the corresponding OpenAI exception classes, so existing OpenAI error handling works unchanged. The full table, including which exception each provider can raise, is in [Exception Mapping](/docs/exception_mapping). The summary:

| Status | Exception | Notes |
|---|---|---|
| 400 | `BadRequestError` | |
| 400 | `ContextWindowExceededError` | Subclass of `BadRequestError`; enables context-window fallbacks |
| 400 | `ContentPolicyViolationError` | Subclass of `BadRequestError`; enables content-policy fallbacks |
| 400 | `UnsupportedParamsError` | Subclass of `BadRequestError` |
| 401 | `AuthenticationError` | |
| 403 | `PermissionDeniedError` | |
| 404 | `NotFoundError` | Raised for unknown model names |
| 408 | `Timeout` | |
| 422 | `UnprocessableEntityError` | |
| 422 | `BudgetExceededError` | Proxy budget caps; carries `current_cost` and `max_budget`. The status comes from `litellm.budget_exceeded_status_code` (default 422) |
| 429 | `RateLimitError` | Carries `category` and `rate_limit_type` |
| 500 | `APIConnectionError` | The base case for any unmapped error |
| 500 | `APIError` | |
| 503 | `ServiceUnavailableError` | |
| >=500 | `InternalServerError` | Any unmapped 500-class provider response |

Every LiteLLM exception carries `status_code`, `message`, and `llm_provider`, plus `provider_specific_fields` where the provider supplied structured detail

## Reproducing these errors

You do not need a failing provider to test your error handling. Point a deployment at a local HTTP server that returns the status you want to exercise, then call it through the gateway

```yaml title="config.yaml" showLineNumbers
model_list:
  - model_name: always-429
    litellm_params:
      model: openai/fail-429
      api_base: http://127.0.0.1:8199/v1
      api_key: sk-mock
  - model_name: unreachable
    litellm_params:
      model: openai/anything
      api_base: http://127.0.0.1:9/v1
      api_key: sk-mock
```

The `unreachable` deployment above needs no mock server at all; port 9 refuses connections, which reproduces the 500 `Connection error.` path directly. For gateway-side errors, generate a key with the constraint you want to trip and call through it:

```bash showLineNumbers
# 403 key_model_access_denied
curl -X POST 'http://localhost:4000/key/generate' \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"key_alias": "restricted", "models": ["{{openai_small}}"]}'

# 429 throttling_error, on the second call within the same minute
curl -X POST 'http://localhost:4000/key/generate' \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"key_alias": "capped", "rpm_limit": 1}'

# 422 budget_exceeded, once accrued spend passes the cap
curl -X POST 'http://localhost:4000/key/generate' \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"key_alias": "tiny-budget", "max_budget": 0.05}'
```

To exercise fallback exhaustion, configure a fallback from one always-failing model group to another and call the primary. See [Fallbacks (Provider Failover)](/docs/proxy/reliability)

## Reporting a problem

Include the `x-litellm-call-id` from the failed response. It is the join key across the gateway logs, the spend-log row, the request's OpenTelemetry trace, and the Logs page of the Admin UI, and it is the fastest way to get an answer

Alongside it, include the full `error` object, the HTTP status, the response headers, and the `model` you requested. If the message contains a `<Provider>Exception`, check the provider's own status page first; the gateway reported the failure but did not cause it

Clients that only print `str(e)` (`Error code: 400 - {...}`) drop the headers, so the id can also be written into the error body. Set `general_settings.include_call_id_in_error_body: true` and every JSON error the gateway writes carries the same value as the header. It is off by default, so error bodies stay byte-identical to today's until you turn it on

```yaml
general_settings:
  include_call_id_in_error_body: true
```

On the OpenAI-shaped routes (`/v1/chat/completions`, `/v1/responses`, streaming first-chunk errors included) and on `/v1/messages`, the id sits inside the `error` object, which is the part the OpenAI SDK keeps as `e.body`:

```json
{"error": {"message": "Invalid model name passed in model=gpt-nope", "type": "invalid_request_error", "param": "model", "code": "400", "litellm_call_id": "019b2c4d-e5f6-7890-abcd-ef1234567890"}}
```

```json
{"type": "error", "error": {"type": "invalid_request_error", "message": "Invalid model name passed in model=gpt-nope", "litellm_call_id": "019b2c4d-e5f6-7890-abcd-ef1234567890"}}
```

Pass-through routes relay the provider's own error body, so the id is added at the top level and the provider's `error` object is left as it was:

```json
{"type": "error", "error": {"type": "not_found_error", "message": "model: claude-nope"}, "litellm_call_id": "019b2c4d-e5f6-7890-abcd-ef1234567890"}
```

The setting only adds the id where the gateway already set the `x-litellm-call-id` header on a JSON body, so 422 request-validation errors, authentication failures rejected before an id exists, errors that arrive mid-stream, and non-JSON pass-through bodies are unchanged

To see the exact request the gateway sent upstream, restart with `--detailed_debug` or set `LITELLM_LOG=DEBUG`, or add `"litellm_request_debug": true` to a single request body. See [Debugging](/docs/proxy/debugging)
