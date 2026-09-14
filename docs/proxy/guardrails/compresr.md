import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Context Compression (Compresr)

[Compresr](https://compresr.ai) compresses LLM context against the question being asked. It keeps the tokens that matter for the answer and drops the rest. As a LiteLLM guardrail, it compresses tool outputs, retrieved documents, database results, and RAG payloads before they reach the model, so you get the same answers at a fraction of the input tokens.

This is available on `/v1/chat/completions`, `/v1/messages` (Anthropic format), and `/v1/responses`.

## Demo

<iframe width="840" height="500" src="https://www.youtube.com/embed/4Ktiwv3ka40" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>

## How it works

The guardrail runs in-process during the `pre_call` step and calls Compresr's hosted API (`https://api.compresr.ai`), so there is no extra service to deploy. Only the proxy talks to Compresr, and it sends only the message text selected for compression; neither the client nor the upstream LLM provider ever connects to it. Request input is the only thing rewritten; responses pass through untouched.

Compression happens per message and is query-aware:

1. **Select targets.** By default only `tool`/`function` outputs of at least 500 characters are compressed. System messages, prior history, and the last user message pass through verbatim unless opted in (`compress_system`, `compress_history`, `compress_last_user`).
2. **Derive a query per target.** A tool output is compressed against the intent of the tool call that produced it: LiteLLM finds the assistant call by `tool_call_id` and renders it as, for example, `web_search: {"query": "2026 EV range"}`. Every other target is compressed against the last user message. A target with no query is left uncompressed.
3. **Compress.** Targets are sent to `{api_base}/api/compress/question-specific/` (`.../batch` when there are several), authenticated via `X-API-Key`.
4. **Rewrite.** The returned `compressed_context` replaces each target's text in place. Unselected messages stay byte-identical, multimodal parts such as images are preserved, and an identical or empty result forwards the request unchanged.

Compression runs on `latte_v2` by default, Compresr's fastest query-specific model. It is extractive: it deletes the spans that do not matter for the query and keeps everything else verbatim.

### Dynamic compression

`dynamic: true` is the default: the service measures how compressible each payload is and picks a ratio for it between `dynamic_min_ratio` (server default 1.5x) and `dynamic_max_ratio` (server default 10.0x), ignoring `target_compression_ratio`. Dense content is compressed lightly, sparse content aggressively.

To pin a fixed ratio instead, set `dynamic: false` and a `target_compression_ratio`: values between 0 and 1 remove that fraction of tokens (0.5 removes about half), values above 1 act as an Nx factor (4 keeps roughly a quarter). Use the `tokens_saved` stats in the spend logs to judge what your workload tolerates.

## Requirements

All you need is a LiteLLM build that includes the `compresr` guardrail and an API key from [compresr.ai](https://compresr.ai). For on-premises deployments, contact [founders@compresr.ai](mailto:founders@compresr.ai).

## Quick Start

### 1. Define the guardrail in your config

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: {{anthropic}}
    litellm_params:
      model: anthropic/{{anthropic}}
      api_key: os.environ/ANTHROPIC_API_KEY

guardrails:
  - guardrail_name: compresr-compression
    litellm_params:
      guardrail: compresr
      mode: pre_call
      api_key: os.environ/COMPRESR_API_KEY
#     api_base: https://api.compresr.ai  [OPTIONAL, change only for on-prem]
#     model: latte_v2                    [OPTIONAL, this is the default]
#     unreachable_fallback: fail_open    [OPTIONAL, defaults to fail_closed]
#     default_on: true                   [OPTIONAL]
```

Use `mode: pre_call`, since the guardrail only transforms request input. The `api_key` is required and can come from the config or the `COMPRESR_API_KEY` env var. Set `default_on: true` to compress every request, or leave it off (recommended) to keep compression opt-in per key or per request.

Everything else is configured through `optional_params`. The full list is in the [configuration reference](#configuration-reference):

```yaml showLineNumbers title="config.yaml"
guardrails:
  - guardrail_name: compresr-compression
    litellm_params:
      guardrail: compresr
      mode: pre_call
      api_key: os.environ/COMPRESR_API_KEY
      optional_params:
        compress_tool_outputs: true   # default; tool/function results
        compress_system: false        # default; opt in to compress system prompts
        min_chars_to_compress: 500    # default; shorter messages skipped
        dynamic: true                 # default; service picks ratio per payload
```

The guardrail can also be created from the Admin UI under Guardrails, with the same fields; the [demo video](#demo) above walks through this flow.

### 2. Start the LiteLLM gateway

```shell
litellm --config config.yaml
```

### 3. Send a request

<Tabs>
<TabItem label="OpenAI format" value="openai">

```shell
curl -i http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "{{anthropic}}",
    "messages": [
      {"role": "user", "content": "Which filing discusses Q3 revenue?"},
      {"role": "assistant", "tool_calls": [{"id": "call_1", "type": "function", "function": {"name": "search_filings", "arguments": "{\"query\": \"Q3 revenue\"}"}}]},
      {"role": "tool", "tool_call_id": "call_1", "content": "<...tens of thousands of tokens of filing text...>"}
    ],
    "guardrails": ["compresr-compression"]
  }'
```

</TabItem>
<TabItem label="Anthropic format" value="anthropic">

```shell
curl -i http://0.0.0.0:4000/v1/messages \
  -H "Content-Type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "{{anthropic}}",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "Which filing discusses Q3 revenue?"}
    ],
    "litellm_metadata": {"guardrails": ["compresr-compression"]}
  }'
```

</TabItem>
</Tabs>

The tool output is compressed against `search_filings: {"query": "Q3 revenue"}` before the payload is forwarded upstream; everything else is left untouched.

## Enabling compression per key

When `default_on` is not set, compression runs only for requests that opt in. The typical pattern is to attach the guardrail to a virtual key, so whoever uses the key gets compression without any client changes.

```shell
curl -X POST 'http://0.0.0.0:4000/key/generate' \
  -H 'Authorization: Bearer sk-1234' \
  -H 'Content-Type: application/json' \
  -d '{
        "guardrails": ["compresr-compression"]
      }'
```

Every request made with the returned key runs through `compresr-compression`; for an existing key, use `/key/update` with the same `guardrails` field. Authenticating with a virtual key also enables [retrieval](#retrieving-compressed-content-compresr_retrieve), since originals are stored per key. Requests made without a virtual key are still compressed, but cannot retrieve.

## Enabling compression per request

Clients can opt in on a single call without admin involvement.

<Tabs>
<TabItem label="OpenAI format" value="openai-perreq">

Pass a `guardrails` array in the request body:

```shell
curl -i http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-..." \
  -d '{
    "model": "{{anthropic}}",
    "messages": [...],
    "guardrails": ["compresr-compression"]
  }'
```

</TabItem>
<TabItem label="Anthropic format" value="anthropic-perreq">

`/v1/messages` has no top-level `guardrails` field, so opt in via `litellm_metadata`:

```shell
curl -i http://0.0.0.0:4000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-..." \
  -d '{
    "model": "{{anthropic}}",
    "max_tokens": 1024,
    "messages": [...],
    "litellm_metadata": {"guardrails": ["compresr-compression"]}
  }'
```

</TabItem>
</Tabs>

The response includes an `x-litellm-applied-guardrails: compresr-compression` header so the caller can confirm that compression actually ran.

## Compression behind an auto router

A request an [auto router](../auto_routing.md) serves makes two calls, one to classify the request and one to the model it routes to. By default both see the same compressed text. From v1.101.0 the router can name a compression guardrail per hop, or `none` for either, with `auto_router_routing_compression` and `auto_router_model_compression`. Setting either field puts the router in charge of compression for its own requests and suppresses the guardrails this page attaches at the key, team, or request level for them. See [Compression](../auto_routing.md#compression).

## Rolling out to a team

A platform admin can turn on compression for a whole team without any client changes. The best fit is agent and RAG workloads whose volume is dominated by non-code tool output, such as search results, retrieved documents, ticket threads, CRM records, and transcripts.

**Admin: register Compresr in `config.yaml`.** Define `compresr-compression` as in the Quick Start. Leave `default_on` off so that only opted-in keys get compression.

**Admin: issue per-developer keys with Compresr attached.**

```shell
curl -X POST 'http://0.0.0.0:4000/key/generate' \
  -H 'Authorization: Bearer sk-1234' \
  -H 'Content-Type: application/json' \
  -d '{
        "key_alias": "support-agent-alice",
        "guardrails": ["compresr-compression"],
        "models": ["{{anthropic}}"],
        "metadata": {"team": "compression-rollout"}
      }'
```

**Developer: point the client at the proxy.** Any OpenAI- or Anthropic-compatible client works, since only the base URL and the key change.

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://your-litellm-proxy.example.com/v1",
    api_key="sk-the-key-the-admin-issued",
)
```

From here, every request made with that key has its tool results compressed before dispatch. To skip compression on a single request (for example to compare an uncompressed baseline), set `allow_bypass_header: true` in `optional_params` and send `x-compresr-bypass: true` on that call; the header is ignored unless the admin enabled it, because any caller can set headers.

## Retrieving compressed content (`compresr_retrieve`)

The original text of every compressed message stays available for the duration of the request. With `enable_retrieval` on (the default), every compression:

1. Stores the original text in memory, keyed by the first 24 hex characters of its SHA-256.
2. Appends a marker to the compressed text: `[compresr hash=<hash>: parts of this content were compressed away. If you need the full original, call the compresr_retrieve tool with this hash.]`
3. Injects a `compresr_retrieve` function tool, with one required `hash` parameter, next to the request's existing tools.

When the model calls `compresr_retrieve`, LiteLLM intercepts the call, restores the original, appends a correctly paired tool round-trip, and re-issues the request, so the client sees one normal completion. This is format-correct on all three surfaces: `tool_use`/`tool_result` blocks for Anthropic, `function_call`/`function_call_output` items for the Responses API, and `role: tool` messages for chat completions. If the model mixes `compresr_retrieve` with real tool calls in one turn, only the retrieve calls are resolved server-side; the model re-plans its real calls in the follow-up, so tool calls and results stay paired.

The retrieval loop is bounded:

- **Tenant isolation.** Original context is stored under the virtual key that made the request, so a hash only resolves for the key it was issued to; other keys get nothing. Requests without a virtual key have no identity to scope the store by, so retrieval is disabled for them and a warning is logged once per process.
- **Amplification.** A single turn resolves at most 8 hashes, and each hash only once. A made-up hash resolves to nothing and triggers no follow-up request.
- **Memory.** The original context is kept in memory for 15 minutes. A single call can store up to 10 MiB of it (`max_bytes_per_call`), and the whole process holds at most 256 calls and 256 MiB, evicting the oldest first. Context too large to store never gets a marker. Context that has expired or been evicted simply fails to resolve.

The store lives in the worker process, so in multi-worker deployments the follow-up may land on a different worker than the one that compressed. Run with `--workers 1` or set `enable_retrieval: false`.

## Why tokens_saved can be 0

- Only `tool`/`function` messages are compressed by default. A request with no tool outputs of at least `min_chars_to_compress` characters passes through unchanged, with no guardrail stats logged.
- A target whose query cannot be derived is left uncompressed.
- Compressed text identical to the input is a no-op.
- On the Responses API, compressed content is only mirrored back when the mapping is unambiguous; ambiguous cases are left alone rather than risking a corrupted payload.
- The bypass header skips compression when `allow_bypass_header` is enabled.

## Failure semantics

The default is `fail_closed`: if the Compresr service is unreachable, times out (60s budget), or returns a bad status or body, the request fails with a `502` and a generic error message; the upstream response body goes to the server logs, never to the client.

Set `unreachable_fallback: fail_open` to forward the request uncompressed instead, with a warning in the proxy logs. Any value other than the exact string `fail_open` is treated as `fail_closed`.

## Security notes

The integration went through several audit passes. Each of the following is enforced in code and covered by regression tests:

- **SSRF-validated `api_base`.** Only `http`/`https` schemes are accepted, and cloud metadata endpoints (e.g. `169.254.169.254`) are rejected at init, including their decimal, hex, and IPv4-mapped encodings.
- **Cross-tenant isolation** of the retrieval store, with forged `user_api_key` strings explicitly untrusted.
- **Injection-safe passthrough.** `compression_params` is forwarded verbatim, but the reserved keys `context`, `query`, and `inputs` are stripped with a warning, and named config fields win on collision.
- **Log-injection defense.** Model-supplied hashes are stripped of non-printable characters and truncated before being echoed into logs.
- **Error redaction.** Upstream error bodies stay in the server logs, while clients get a generic 502.

## Validate Compresr ran

1. The `x-litellm-applied-guardrails: compresr-compression` response header.
2. `guardrail_information` on the spend log row: `messages_compressed`, `tokens_before`, `tokens_after`, `tokens_saved`, `compression_model`. These are recorded only when at least one message was actually compressed.
3. The Admin UI: open any request in **Logs**, scroll to **Guardrails & Policy Compliance**, and `compresr-compression` appears under **Request Lifecycle** as a `pre-call` step with its latency, plus an entry under **Evaluation Details**.

## What to expect

Typical workloads compress 2x to 10x without quality loss. Sparse content compresses the most, often well beyond that range: transcripts, reports, filings, ticket threads, logs, and search results are mostly tokens irrelevant to any given question. Structured data (JSON, XML, HTML) compresses well too. Code is not compressed for now.

## Configuration reference

Top-level `litellm_params`:

| Param                  | Type | Description                                                                                                                    |
| ---------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------ |
| `guardrail`            | str  | Must be `compresr`.                                                                                                            |
| `mode`                 | str  | Use `pre_call`. The guardrail only transforms request input; responses pass through untouched.                                 |
| `api_key`              | str  | Compresr API key, sent as `X-API-Key`. Falls back to `COMPRESR_API_KEY`. Required; init fails without it.                      |
| `api_base`             | str  | Compresr API base URL. Falls back to `COMPRESR_API_BASE`, then `https://api.compresr.ai`. Change only for on-prem deployments. |
| `model`                | str  | Compression model (not the LLM). Defaults to `latte_v2`.                                                                       |
| `unreachable_fallback` | str  | `fail_closed` (default) returns 502 on service failure; `fail_open` forwards the request uncompressed.                         |
| `default_on`           | bool | Run on every request without per-call opt-in. Defaults to `false`.                                                             |

Nested `optional_params` (each also accepted directly under `litellm_params`; the nested value wins):

| Param                      | Type  | Default | Description                                                                                                    |
| -------------------------- | ----- | ------- | -------------------------------------------------------------------------------------------------------------- |
| `target_compression_ratio` | float | `0.5`   | Between 0 and 1: fraction of tokens removed. Above 1: Nx compression factor. Ignored while `dynamic` is on.     |
| `coarse`                   | bool  | `true`  | Paragraph-level scoring (faster). Set `false` for token-level.                                                  |
| `min_chars_to_compress`    | int   | `500`   | Messages shorter than this are skipped.                                                                         |
| `compress_tool_outputs`    | bool  | `true`  | Compress `tool`/`function` results.                                                                             |
| `compress_system`          | bool  | `false` | Compress system messages.                                                                                       |
| `compress_history`         | bool  | `false` | Compress user messages before the last one.                                                                     |
| `compress_last_user`       | bool  | `false` | Compress the last user message, using its own text as the query.                                                |
| `enable_retrieval`         | bool  | `true`  | Store originals, append markers, inject the `compresr_retrieve` tool.                                           |
| `max_bytes_per_call`       | int   | `10485760` | Per-call cap on stored originals (10 MiB). `0` disables the cap; negative values are rejected.               |
| `allow_bypass_header`      | bool  | `false` | Honor `x-compresr-bypass: true`. Off by default because callers control headers.                                |
| `dynamic`                  | bool  | `true`  | Let the service pick the ratio per payload (`latte_v2`).                                                        |
| `dynamic_min_ratio`        | float | unset   | Lower bound for dynamic mode; server default 1.5.                                                               |
| `dynamic_max_ratio`        | float | unset   | Upper bound for dynamic mode; server default 10.0.                                                              |
| `compression_params`       | dict  | unset   | Extra fields forwarded verbatim to the compression API. `context`, `query`, `inputs` are reserved and stripped.  |

## Environment variables

| Variable            | Description                                                   |
| ------------------- | ------------------------------------------------------------- |
| `COMPRESR_API_KEY`  | Fallback for `api_key` when not set in the guardrail config.  |
| `COMPRESR_API_BASE` | Fallback for `api_base` when not set in the guardrail config. |

## About Compresr

Compresr is a YC-backed company (W26) built by four EPFL researchers with backgrounds at Microsoft, Bell Labs, and UBS. Find us at [compresr.ai](https://compresr.ai), on the [YC page](https://www.ycombinator.com/companies/compresr), or on [LinkedIn](https://www.linkedin.com/company/compresr).
