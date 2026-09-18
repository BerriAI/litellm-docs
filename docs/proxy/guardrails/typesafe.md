# Relevance-Based Compaction (TypeSafe / Jev)

[TypeSafe](https://typesafe.ai)'s Jev model judges whether each completed tool exchange is still relevant to the current task. As a LiteLLM guardrail, it blanks out tool results Jev scores below a relevance threshold before the request reaches the model, so dead context stops consuming input tokens. Unlike summarizing compressors, this is all-or-nothing per exchange: a result is either kept verbatim or replaced with a removal notice.

This is available on `/v1/chat/completions`, `/v1/messages` (Anthropic format), and `/v1/responses`.

## How it works

The guardrail runs in-process during the `pre_call` step and calls TypeSafe's hosted API (`https://api.typesafe.ai`), so there is no extra service to deploy. Only the proxy talks to TypeSafe. Request input is the only thing rewritten; responses pass through untouched.

Compaction happens per completed tool exchange:

1. **Select candidates.** A candidate is an assistant message that made tool calls plus the `tool`/`function` messages answering it, whose combined result text is at least `min_chars_to_evaluate` characters. System messages, the last user message, and the most recent exchange (via the last-assistant rule) are never evaluated or rewritten, matching litellm's shared compression protection policy. At most the 200 most recent eligible exchanges are evaluated per request.
2. **Evaluate.** One `POST {api_base}/v1/systemone` call sends the last user message as `task`, the joined system text, and each candidate's tool calls and (truncated) result in `state`, with one `noul` yes/no question per exchange: is this exchange still needed to complete the task?
3. **Compact.** Every exchange whose `noul` score falls below `relevance_threshold` has its tool results replaced with `[Tool result removed by TypeSafe compaction: judged no longer relevant to the current task]`. Assistant tool-call rows stay intact, so the conversation remains well-formed. If nothing is dropped, the request is forwarded byte-identical.

## Requirements

A LiteLLM build that includes the `typesafe` guardrail and a TypeSafe API key from [typesafe.ai](https://typesafe.ai).

## Quick Start

### 1. Define the guardrail in your config

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: {{anthropic}}
    litellm_params:
      model: anthropic/{{anthropic}}
      api_key: os.environ/ANTHROPIC_API_KEY

guardrails:
  - guardrail_name: jev-compaction
    litellm_params:
      guardrail: typesafe
      mode: pre_call
      api_key: os.environ/TYPESAFE_API_KEY
      optional_params:
        relevance_threshold: 0.2
```

Use `mode: pre_call`, since the guardrail only transforms request input. The `api_key` is required and can come from the config or the `TYPESAFE_API_KEY` env var. Set `default_on: true` to compact every request, or leave it off to keep compaction opt-in per key or per request.

### 2. Start the LiteLLM gateway

```shell
litellm --config config.yaml
```

### 3. Send a request

```shell
curl -i http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "{{anthropic}}",
    "messages": [
      {"role": "user", "content": "Which filing discusses Q3 revenue?"},
      {"role": "assistant", "tool_calls": [{"id": "call_1", "type": "function", "function": {"name": "search_filings", "arguments": "{\"query\": \"Q1 revenue\"}"}}]},
      {"role": "tool", "tool_call_id": "call_1", "content": "<...tens of thousands of tokens of Q1 filing text...>"},
      {"role": "assistant", "tool_calls": [{"id": "call_2", "type": "function", "function": {"name": "search_filings", "arguments": "{\"query\": \"Q3 revenue\"}"}}]},
      {"role": "tool", "tool_call_id": "call_2", "content": "<...tens of thousands of tokens of Q3 filing text...>"}
    ],
    "guardrails": ["jev-compaction"]
  }'
```

The off-topic Q1 result is blanked out while the Q3 result the task needs passes through verbatim.

## Enabling compaction per key

When `default_on` is not set, compaction runs only for requests that opt in. The typical pattern is to attach the guardrail to a virtual key.

```shell
curl -X POST 'http://0.0.0.0:4000/key/generate' \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
        "guardrails": ["jev-compaction"]
      }'
```

## Enabling compaction per request

Clients can opt in on a single call by passing a `guardrails` array in the request body, or `litellm_metadata.guardrails` for `/v1/messages`, which has no top-level `guardrails` field. The response includes an `x-litellm-applied-guardrails: jev-compaction` header when compaction ran.

## Failure semantics

The default is `fail_open`: if the TypeSafe service is unreachable, times out (30s budget), or returns a bad status or body, the request is forwarded uncompacted with a warning in the proxy logs. Compaction is an optimization, so a down evaluator never blocks traffic.

Set `unreachable_fallback: fail_closed` to fail the request with a `500` and a generic error message instead; upstream response bodies stay in the server logs, never the client.

## Validate TypeSafe ran

1. The `x-litellm-applied-guardrails: jev-compaction` response header.
2. `guardrail_information` on the spend log row: `exchanges_evaluated`, `exchanges_dropped`, `chars_removed`, `model`.
3. The Admin UI: open any request in **Logs**, scroll to **Guardrails & Policy Compliance**, and `jev-compaction` appears under **Request Lifecycle** as a `pre-call` step.

## Configuration reference

Top-level `litellm_params`:

| Param                  | Type | Description                                                                                              |
| ---------------------- | ---- | -------------------------------------------------------------------------------------------------------- |
| `guardrail`            | str  | Must be `typesafe`.                                                                                      |
| `mode`                 | str  | Use `pre_call`. The guardrail only transforms request input; responses pass through untouched.           |
| `api_key`              | str  | TypeSafe API key, sent as `Authorization: Bearer`. Falls back to `TYPESAFE_API_KEY`. Required.           |
| `api_base`             | str  | TypeSafe API base URL. Falls back to `TYPESAFE_API_BASE`, then `https://api.typesafe.ai`.                |
| `model`                | str  | TypeSafe evaluation model (not the LLM). Defaults to `jev-latest`.                                       |
| `unreachable_fallback` | str  | `fail_open` (default) forwards uncompacted on service failure; `fail_closed` returns 500.                |
| `default_on`           | bool | Run on every request without per-call opt-in. Defaults to `false`.                                       |

Nested `optional_params` (each also accepted directly under `litellm_params`; the nested value wins):

| Param                      | Type  | Default | Description                                                                                  |
| -------------------------- | ----- | ------- | -------------------------------------------------------------------------------------------- |
| `relevance_threshold`      | float | `0.2`   | Exchanges scoring below this `noul` probability are dropped.                                 |
| `min_chars_to_evaluate`    | int   | `200`   | Exchanges whose combined tool-result text is shorter are never sent to Jev or dropped.       |
| `max_result_chars_in_state`| int   | `4000`  | Tool result text is truncated to this many characters in the state sent to Jev.              |

## Environment variables

| Variable            | Description                                    |
| ------------------- | ---------------------------------------------- |
| `TYPESAFE_API_KEY`  | Fallback API key when `api_key` is not set.    |
| `TYPESAFE_API_BASE` | Fallback API base when `api_base` is not set.  |
