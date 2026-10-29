import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Context Selection (Needlepath)

<SinceVersion v="1.109.0" />

[Needlepath](https://nextmoca.com) performs query-conditioned extractive selection over LLM context. Given a block of text and a query, it returns the spans of that text which carry the answer, verbatim. As a LiteLLM guardrail it runs over tool outputs before they reach the model, so the model receives the selected text of a search result, retrieved document, or API dump instead of the whole of it.

Selection is extractive, not generative. The returned block is made of extracts of the text that was submitted. Nothing is paraphrased or summarised. The one addition is the marker that [security screening](#security-screening) puts in place of a flagged span.

This runs on `/v1/chat/completions`, `/v1/messages` (Anthropic format), and `/v1/responses`.

## How it works

The guardrail runs in-process during the `pre_call` step and calls the Needlepath API (`https://api.nextmoca.com`), so there is no extra service to deploy. Only the proxy talks to Needlepath. For each message chosen for selection it sends the message text, the query it is selected against, the record kind, the tool name and `tool_call_id` when there is one, and the token budget and operating point. Neither the client nor the upstream LLM provider connects to it. Request input is the only thing rewritten; responses pass through untouched.

Selection happens per message and is query-conditioned:

1. **Pick targets.** By default only `tool` and `function` outputs of at least 500 characters are considered. System messages and prior user turns pass through verbatim unless you opt in with `select_system` or `select_history`. The message carrying the query is never rewritten.
2. **Derive a query per target.** A tool output is selected against the intent of the tool call that produced it. LiteLLM finds the assistant call by `tool_call_id` and renders it as, for example, `edgar_search: {"cik": "0000320193"}`. Every other target uses the last user message. A target with no derivable query is left alone.
3. **Select.** Each target is sent to `{api_base}/v1/context/select` as a single record, authenticated with `Authorization: Bearer <api_key>`. Requests for different messages run concurrently, at most four at a time. At most 16 messages are selected per request, the largest first; any further eligible messages are forwarded unchanged.
4. **Rewrite.** The `rendered_context` returned for a target replaces that message's text in place. Every other message stays byte-identical, and multimodal parts such as images are preserved.

On the default operating point, the service also screens what it returns for instruction-like text. See [Security screening](#security-screening).

Each message is selected independently, so the outcome for one never changes the outcome for another.

## Fail-open by design

This guardrail is unconditionally fail-open. There is no configuration in which a Needlepath failure becomes a request failure. Whenever a call does not produce a usable selection, that message is forwarded exactly as it arrived. When no message is rewritten, the request is forwarded unchanged.

The reasoning is that a proxy which silently blanks a tool output is far worse than a proxy that does nothing. Selection sits on the request path of every call behind the gateway, so its worst case has to be a no-op.

The guardrail forwards a message's original content when any of these hold for its selection call:

| Condition | What is forwarded for that message |
| --- | --- |
| The service is unreachable, times out, or the call is refused | the original content, unchanged |
| The service answers a non-2xx status, including `402`, `403`, and `429` | the original content, unchanged |
| The body is not JSON, or is not a JSON object | the original content, unchanged |
| `outcome` is `blocked`: security screening left nothing deliverable | the original content, unchanged |
| `gate.reason` reports a stand-down (any value prefixed `standdown:`) | the original content, unchanged |
| `records_selected` is `0`, `tokens_after` is `0`, or `rendered_context` is missing or blank | the original content, unchanged |
| The selected block is not shorter than the text it would replace | the original content, unchanged |

A stand-down is the service reporting that it declined to select for this input. It is a normal outcome, not an error, and it means the full content is what the caller should send.

Because a decline is per message, a stand-down on one tool output does not prevent selection on another in the same request.

The stand-down and size conditions do not apply to a block that security screening has cleaned, described below. Forwarding the original in that case would send the flagged text on to the model.

## Security screening

`np-2026-10-r8` selects as `np-2026-10-r6` does and also screens the context it returns for instruction-like text, such as an instruction planted in a tool output. Each flagged span is replaced in place by the marker `[QUARANTINED: instruction-like candidate text removed]`. The guardrail handles the outcomes as the published Needlepath clients do:

| `outcome` | What the guardrail does |
| --- | --- |
| `engaged` | Applies `rendered_context`, subject to the fail-open conditions above. When screening removed a span (`format_metrics.security_action` is `quarantine`), the block is applied even if it is not shorter than the original. |
| `sanitized_fallback` | The service declined to select, and returned your full content with the flagged spans removed. The guardrail applies that `rendered_context` instead of forwarding the original. |
| `blocked` | Nothing deliverable remained after screening. The guardrail forwards the original message unchanged, the same as any other decline. |

Screening runs on the service and needs no configuration in the proxy. To run selection without screening, pin `operating_point: np-2026-10-r6`. The [Needlepath error reference](https://docs.nextmoca.com/errors#security-screening-outcomes) documents both outcomes and the `format_metrics` keys that report them.

## Requirements

A LiteLLM build that includes the `needlepath` guardrail, and a Needlepath API key.

## Quick Start

### 1. Define the guardrail in your config

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY

guardrails:
  - guardrail_name: needlepath-selection
    litellm_params:
      guardrail: needlepath
      mode: pre_call
      api_key: os.environ/NEEDLEPATH_API_KEY
#     api_base: https://api.nextmoca.com  [OPTIONAL, change only for on-prem]
#     default_on: true                    [OPTIONAL]
```

Use `mode: pre_call`, since the guardrail only transforms request input. The `api_key` is required and can come from the config or the `NEEDLEPATH_API_KEY` env var. Set `default_on: true` to run selection on every request, or leave it off to keep it opt-in per key or per request.

Everything else is configured through `optional_params`:

```yaml showLineNumbers title="config.yaml"
guardrails:
  - guardrail_name: needlepath-selection
    litellm_params:
      guardrail: needlepath
      mode: pre_call
      api_key: os.environ/NEEDLEPATH_API_KEY
      optional_params:
        select_tool_outputs: true      # default; tool/function results
        select_history: false          # default; opt in for prior user turns
        select_system: false           # default; opt in for system prompts
        min_chars_to_select: 500       # default; shorter messages skipped
        max_context_tokens: 4000       # default; budget per message
        operating_point: np-2026-10-r8 # default; pinned, see below
```

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
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "What was Q3 revenue?"},
      {"role": "assistant", "tool_calls": [{"id": "call_1", "type": "function", "function": {"name": "edgar_search", "arguments": "{\"cik\": \"0000320193\"}"}}]},
      {"role": "tool", "tool_call_id": "call_1", "content": "<...tens of thousands of tokens of filing text...>"}
    ],
    "guardrails": ["needlepath-selection"]
  }'
```

</TabItem>
<TabItem label="Anthropic format" value="anthropic">

```shell
curl -i http://0.0.0.0:4000/v1/messages \
  -H "Content-Type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "gpt-4o",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "What was Q3 revenue?"}
    ],
    "litellm_metadata": {"guardrails": ["needlepath-selection"]}
  }'
```

</TabItem>
</Tabs>

In the OpenAI example, the tool output is selected against `edgar_search: {"cik": "0000320193"}` before the payload is forwarded upstream, and everything else is left untouched. The Anthropic example has no tool output, so it passes through unchanged under the default settings.

## Enabling selection per key

When `default_on` is not set, selection runs only for requests that opt in. The usual pattern is to attach the guardrail to a virtual key, so whoever uses that key gets selection with no client changes.

```shell
curl -X POST 'http://0.0.0.0:4000/key/generate' \
  -H 'Authorization: Bearer sk-master-key' \
  -H 'Content-Type: application/json' \
  -d '{
        "guardrails": ["needlepath-selection"]
      }'
```

Every request made with the returned key runs through `needlepath-selection`. For an existing key, use `/key/update` with the same `guardrails` field.

## Enabling selection per request

Clients can opt in on a single call.

<Tabs>
<TabItem label="OpenAI format" value="openai-perreq">

Pass a `guardrails` array in the request body:

```shell
curl -i http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-..." \
  -d '{
    "model": "gpt-4o",
    "messages": [...],
    "guardrails": ["needlepath-selection"]
  }'
```

</TabItem>
<TabItem label="Anthropic format" value="anthropic-perreq">

`/v1/messages` has no top-level `guardrails` field, so opt in through `litellm_metadata`:

```shell
curl -i http://0.0.0.0:4000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-..." \
  -d '{
    "model": "gpt-4o",
    "max_tokens": 1024,
    "messages": [...],
    "litellm_metadata": {"guardrails": ["needlepath-selection"]}
  }'
```

</TabItem>
</Tabs>

The response carries an `x-litellm-applied-guardrails: needlepath-selection` header so the caller can confirm the guardrail ran.

## The pinned operating point

`operating_point` is an immutable engine label, sent as `budget.operating_point` on every selection request. The guardrail pins `np-2026-10-r8` by default instead of inheriting whatever the service currently treats as its default, so the behaviour of a given proxy build does not change underneath a deployment. Change it only deliberately, and change it in config rather than relying on a service-side default.

## Why nothing was selected

- Only `tool` and `function` messages are considered by default. A request with no tool output of at least `min_chars_to_select` characters passes through unchanged, and no guardrail stats are logged.
- A target whose query cannot be derived is left alone.
- Any of the fail-open conditions above applies. The proxy logs the reason at debug level.
- A message whose `content` is a part list containing a non-text part is skipped, because a single selected block cannot be written back across a non-text part without moving text past it.

## Validate that Needlepath ran

1. The `x-litellm-applied-guardrails: needlepath-selection` response header. It confirms the guardrail ran for the request, not that a message was rewritten.
2. `guardrail_information[].guardrail_response` in the standard logging payload sent to logging callbacks: `messages_selected`, `messages_considered`, `chars_before`, `chars_after`, and `operating_point`. These are recorded only when at least one message was actually rewritten. The spend log row keeps them only when `store_prompts_in_spend_logs` is enabled; otherwise the field is redacted there.
3. The Admin UI: open any request in **Logs**, scroll to **Guardrails & Policy Compliance**, and `needlepath-selection` appears under **Request Lifecycle** as a `pre-call` step with its latency.

## Security notes

- **Validated `api_base`.** Only `http` and `https` schemes are accepted, and cloud metadata endpoints such as `169.254.169.254` are rejected at init, including their decimal, hex, and IPv4-mapped encodings. The check does not resolve DNS or follow redirects, so it is not a complete SSRF control; `api_base` is operator configuration.
- **Error redaction.** Upstream status codes and response bodies are written to the proxy logs only. Nothing from an upstream error reaches the client, because an upstream error is a decline rather than a raised exception.
- **Bounded call time.** The selection call uses its own 30 second HTTP timeout rather than the shared client's much longer read timeout, so a stalled service becomes a decline instead of holding the request.

## Configuration reference

Top-level `litellm_params`:

| Param | Type | Description |
| --- | --- | --- |
| `guardrail` | str | Must be `needlepath`. |
| `mode` | str | Use `pre_call`. The guardrail only transforms request input. |
| `api_key` | str | Needlepath API key, sent as `Authorization: Bearer`. Falls back to `NEEDLEPATH_API_KEY`. Required; init fails without it. |
| `api_base` | str | Needlepath API base URL. Falls back to `NEEDLEPATH_API_BASE`, then `https://api.nextmoca.com`. |
| `default_on` | bool | Run on every request without per-call opt-in. Defaults to `false`. |

Nested `optional_params` (each is also accepted directly under `litellm_params`; the nested value wins):

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| `select_tool_outputs` | bool | `true` | Select over `tool` and `function` results. |
| `select_history` | bool | `false` | Select over user messages before the last one. |
| `select_system` | bool | `false` | Select over system messages. |
| `min_chars_to_select` | int | `500` | Messages shorter than this are skipped. |
| `max_context_tokens` | int | `4000` | Token budget requested for the selected block of a single message. |
| `operating_point` | str | `np-2026-10-r8` | Immutable engine label sent with every request. |

## Environment variables

| Variable | Description |
| --- | --- |
| `NEEDLEPATH_API_KEY` | Fallback for `api_key` when not set in the guardrail config. |
| `NEEDLEPATH_API_BASE` | Fallback for `api_base` when not set in the guardrail config. |
