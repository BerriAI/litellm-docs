# Error Reference

Every failed request through the LiteLLM AI Gateway returns an OpenAI-compatible JSON error body and an HTTP status code. This page is the reference for reading them: what the payload contains, which errors come from the gateway versus the upstream provider, what each status code and error type means, and what the gateway returns when a fallback chain runs out of targets

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

## Response headers

The headers on a failed response carry the diagnostic context that the JSON body does not

| Header | When present | Description |
|---|---|---|
| `x-litellm-call-id` | Any failure after authentication succeeds | The request's correlation id. This is the value to quote in a support ticket and to search for in your logs; it ties the HTTP response to the gateway's log line, the spend-log row, and the OpenTelemetry trace. Absent on authentication failures, which are rejected before a call id is assigned |
| `retry-after` | Gateway rate limits and router cooldowns | Seconds to wait. See the note below about what its presence implies |
| `rate_limit_type` | Gateway rate limits | Which dimension was exceeded: `requests`, `tokens`, or `concurrent_requests` |
| `reset_at` | Gateway rate limits | UTC timestamp at which the exceeded window resets |
| `x-litellm-key-rpm-limit`, `x-litellm-key-max-budget`, `x-litellm-key-spend` | Most failures after authentication | The calling key's configured ceilings and current spend, so you can confirm whether the key itself is the constraint |
| `x-litellm-timeout` | Failures on a request that reached a deployment | The timeout that was in force for the call, in seconds |

Three families of header appear on successful responses only, so do not build failure handling around them: `llm_provider-*` (the upstream's own response headers, forwarded verbatim with a prefix), `x-ratelimit-*` (the upstream's rate-limit counters), and `x-litellm-attempted-retries` / `x-litellm-attempted-fallbacks` (how many retries and fallback hops it took to succeed)

:::tip

`retry-after` is a strong disambiguation signal. The gateway sets it on its own rate limits and cooldowns, and it does not forward the provider's `retry-after` onto an error response. So a 429 that carries `retry-after` is the gateway's limit, and a 429 without it is the provider's

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
| `message` contains no provider name, and `type` is a LiteLLM value such as `budget_exceeded`, `expired_key`, `token_not_found_in_db`, `key_model_access_denied` | LiteLLM gateway |
| `message` starts with `No deployments available for selected model` or `There are no healthy deployments for this model` | LiteLLM gateway (routing) |
| 429 with a `retry-after`, `rate_limit_type`, or `reset_at` header | LiteLLM gateway (rate limiting) |
| 429 with no such headers | Upstream provider |

Worked example, gateway origin. The virtual key is capped below its accrued spend, so the request is rejected before any provider is contacted:

```json
{
  "error": {
    "message": "Budget has been exceeded! Key=analytics-team (sk-...W8TA) Current cost: 0.06, Max budget: 0.05",
    "type": "budget_exceeded",
    "param": null,
    "code": "429"
  }
}
```

Worked example, provider origin. The same 429 status, but the message names the provider and the payload carries none of the gateway's rate-limit headers:

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
| 422 | Provider | The provider accepted the shape of the request but could not process its contents | No |
| 429 | Either | A rate limit or budget was exceeded. See [Which 429 is this?](#which-429-is-this) below | Yes, honoring `retry-after` |
| 499 | Client | The client disconnected and the upstream call was cancelled | N/A |
| 500 | Either | Gateway: an unhandled internal error. Provider: a provider-side error, including a network failure reaching the provider, which surfaces as `InternalServerError ... Connection error.` | Yes, with backoff |
| 503 | Provider | The provider reported itself unavailable or overloaded | Yes, with backoff |

A note on 500 versus 503. A connection that never reaches the provider (DNS failure, refused connection, wrong `api_base`) is reported as 500 with `Connection error.` in the message, not as 502 or 503. A 503 means the provider answered and told you it was unavailable

## Gateway error types

These `error.type` values are produced by the gateway itself. Seeing one of them means no provider was involved in the failure

| `error.type` | Status | Cause | What to do |
|---|---|---|---|
| `token_not_found_in_db` | 401 | The virtual key does not exist | Issue a key with `/key/generate` |
| `expired_key` | 401 | The key's `expires` timestamp has passed | Issue a new key, or extend this one with `/key/update` |
| `auth_error` | 401 | Generic authentication failure, including JWT validation failures | Check the credential and, for JWT auth, the issuer configuration |
| `auth_provider_unavailable` | 503 | The identity provider needed to validate the request, for example its JWKS endpoint, is unreachable | Check network reachability to the identity provider |
| `key_model_access_denied` | 403 | The key's `models` list does not include the requested model | Add the model to the key, or call `/v1/models` to see what the key may use |
| `team_model_access_denied`, `user_model_access_denied`, `org_model_access_denied`, `project_model_access_denied` | 403 | The same restriction applied at the team, user, organization, or project level | Grant access on the object named by the type |
| `tool_access_denied` | 403 | The requested tool is not in the key's or team's allowed-tools list | Add the tool to the allowed list |
| `key_vector_store_access_denied`, `team_vector_store_access_denied`, `org_vector_store_access_denied` | 403 | The caller may not use the requested vector store | Grant access on the object named by the type |
| `team_member_permission_error` | 401 | The caller lacks the team-member permission for this management action | Ask a team admin to perform it or to grant the permission |
| `budget_exceeded` | 429 | A key, team, user, or per-session spend cap was reached. The message reports current cost and max budget | Raise the budget, or wait for the budget window to reset |
| `throttling_error` | 429 | An RPM, TPM, or max-parallel-requests ceiling was exceeded. Also used for provider 429s, so check the headers to tell them apart | Back off using `retry-after` |
| `invalid_request_error` | 400 | A required parameter is missing or malformed. `error.param` names it | Fix the request body |
| `bad_request_error` | 400 | Generic gateway-side request rejection | Read the message |
| `not_found_error` | 404 | The referenced object does not exist | Check the id |
| `no_db_connection` | 503 | The endpoint needs the database and the gateway cannot reach it | Check `DATABASE_URL` and database health |
| `internal_server_error` | 500 | Unhandled gateway exception | Check the gateway logs for the matching `x-litellm-call-id` |

Routing failures do not currently set a distinctive `error.type`; identify them by the message prefix instead

| Message prefix | Status | Cause |
|---|---|---|
| `No deployments available for selected model` | 429 | Every deployment in the model group is in cooldown after repeated failures. The message lists the cooling deployment ids and the seconds remaining |
| `There are no healthy deployments for this model` | 400 | The model group has no deployment that can serve the request |
| `Not allowed to access model due to tags configuration` | 401 | Tag-based routing excluded every deployment for this caller |
| `No deployments available - crossed budget` | 429 | Provider-budget routing has exhausted the budget for every candidate deployment |

## Which 429 is this?

429 is the one status the gateway and the providers both use heavily, so it deserves a dedicated check. Work through the response in this order

A gateway rate limit sets `retry-after`, `rate_limit_type`, and `reset_at`, and its message names the limit that was hit:

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

A gateway budget cap sets `type` to `budget_exceeded` and reports the spend against the cap. A routing cooldown sets `retry-after` and opens with `No deployments available for selected model`. Anything else with a `<Provider>Exception` in the message is the provider's own throttle, and the gateway has already exhausted its configured retries and fallbacks before returning it

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

Check every SSE payload for an `error` key before treating it as a chunk. A client that only inspects the HTTP status will record a mid-stream failure as a success with a truncated completion

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
| 429 | `RateLimitError` | Carries `category` and `rate_limit_type` |
| 429 | `BudgetExceededError` | Proxy budget caps; carries `current_cost` and `max_budget` |
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
  -H 'Authorization: Bearer sk-1234' \
  -H 'Content-Type: application/json' \
  -d '{"key_alias": "restricted", "models": ["{{openai_small}}"]}'

# 429 throttling_error, on the second call within the same minute
curl -X POST 'http://localhost:4000/key/generate' \
  -H 'Authorization: Bearer sk-1234' \
  -H 'Content-Type: application/json' \
  -d '{"key_alias": "capped", "rpm_limit": 1}'

# 429 budget_exceeded, once accrued spend passes the cap
curl -X POST 'http://localhost:4000/key/generate' \
  -H 'Authorization: Bearer sk-1234' \
  -H 'Content-Type: application/json' \
  -d '{"key_alias": "tiny-budget", "max_budget": 0.05}'
```

To exercise fallback exhaustion, configure a fallback from one always-failing model group to another and call the primary. See [Fallbacks (Provider Failover)](/docs/proxy/reliability)

## Reporting a problem

Include the `x-litellm-call-id` from the failed response. It is the join key across the gateway logs, the spend-log row, the request's OpenTelemetry trace, and the Logs page of the Admin UI, and it is the fastest way to get an answer

Alongside it, include the full `error` object, the HTTP status, the response headers, and the `model` you requested. If the message contains a `<Provider>Exception`, check the provider's own status page first; the gateway reported the failure but did not cause it

To see the exact request the gateway sent upstream, restart with `--detailed_debug` or set `LITELLM_LOG=DEBUG`, or add `"litellm_request_debug": true` to a single request body. See [Debugging](/docs/proxy/debugging)
