import Image from '@theme/IdealImage';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Relevance-Based Compaction (TypeSafe Jev)

[TypeSafe](https://typesafe.ai) Jev is an evaluation model that answers yes/no questions about a body of text. As a LiteLLM guardrail it looks at every completed tool exchange in a chat request and asks one question per exchange: is this result still needed for the current task? Tool results that Jev scores as no longer relevant are replaced with a short marker before the request reaches the model, so long agent loops stop paying for stale weather lookups, search results, and file reads on every turn. Nothing is summarized or rewritten; a tool result is either kept verbatim or removed.

This is available on `/v1/chat/completions` for OpenAI-format `role: tool` messages.

## How it works

The guardrail runs in-process during the `pre_call` step and calls TypeSafe's hosted API (`https://api.typesafe.ai`), so there is no extra service to deploy. Only the proxy talks to TypeSafe, and it sends only the system prompt, the latest user message, and the tool exchanges under evaluation; neither the client nor the upstream LLM provider ever connects to it. Request input is the only thing rewritten; responses and streaming pass through untouched.

Compaction works on completed tool exchanges, meaning an assistant message with `tool_calls` followed by the `role: tool` messages that answer it. System messages, the latest user message, and the most recent tool exchange are always protected, since the model usually still needs the result it just received. Exchanges whose combined tool text is shorter than `min_chars_to_evaluate` (200 characters by default) are skipped because the round trip would cost more than it saves. The remaining exchanges, up to 200 of them, are sent in one `POST {api_base}/v1/systemone` call, with each result truncated to `max_result_chars_in_state` characters (head and tail kept) so Jev sees both ends of a long result. Jev returns a probability that each exchange is still needed. Any exchange below `relevance_threshold` (0.2 by default) has its tool result replaced with `[Tool result removed by TypeSafe compaction: judged no longer relevant to the current task]`; the assistant `tool_calls` row stays so the transcript remains well formed. Everything else is left byte-identical, and a request with no eligible exchange never contacts TypeSafe.

## Requirements

All you need is a LiteLLM build that includes the `typesafe` guardrail and an API key from [typesafe.ai](https://typesafe.ai).

## Quick Start

### 1. Define the guardrail in your config

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: {{openai_small}}
    litellm_params:
      model: openai/{{openai_small}}
      api_key: os.environ/OPENAI_API_KEY

guardrails:
  - guardrail_name: typesafe-compaction
    litellm_params:
      guardrail: typesafe
      mode: pre_call
      api_key: os.environ/TYPESAFE_API_KEY
#     api_base: https://api.typesafe.ai    [OPTIONAL, this is the default]
#     model: jev-latest                    [OPTIONAL, this is the default]
#     unreachable_fallback: fail_open      [OPTIONAL, this is the default]
#     default_on: true                     [OPTIONAL]
```

Use `mode: pre_call`, since the guardrail only transforms request input. The `api_key` is required and can come from the config or the `TYPESAFE_API_KEY` env var. Set `default_on: true` to compact every request, or leave it off (recommended) to keep compaction opt-in per key or per request.

The tuning knobs live under `optional_params`. The full list is in the [configuration reference](#configuration-reference):

```yaml showLineNumbers title="config.yaml"
guardrails:
  - guardrail_name: typesafe-compaction
    litellm_params:
      guardrail: typesafe
      mode: pre_call
      api_key: os.environ/TYPESAFE_API_KEY
      optional_params:
        relevance_threshold: 0.2          # default; drop below this probability
        min_chars_to_evaluate: 200        # default; shorter exchanges skipped
        max_result_chars_in_state: 4000   # default; per-result cap sent to Jev
```

### 2. Start the LiteLLM gateway

```shell
litellm --config config.yaml
```

### 3. Send a request with completed tool exchanges

The request below carries three finished tool exchanges (a weather report, a stock quote, and a deployment runbook) and a final question that only the runbook can answer. Save it as `payload.json` and send it with the guardrail attached:

<details>
<summary>payload.json</summary>

```json
{
  "model": "{{openai_small}}",
  "guardrails": ["typesafe-compaction"],
  "tool_choice": "none",
  "messages": [
    {"role": "system", "content": "You are a helpful operations assistant. Answer the latest user question using the relevant tool result. Be concise and do not invent values."},
    {"role": "user", "content": "First check the weather in Lisbon and a stock quote, then read the deployment runbook. I will ask a follow-up about the runbook."},
    {"role": "assistant", "content": null, "tool_calls": [{"id": "call_weather", "type": "function", "function": {"name": "get_weather", "arguments": "{\"city\":\"Lisbon\"}"}}]},
    {"role": "tool", "tool_call_id": "call_weather", "content": "Lisbon weather station report: temperature 23 C, feels like 24 C, humidity 61 percent, wind from the northwest at 14 km/h. Skies are mostly clear with scattered coastal clouds. The afternoon forecast expects a high of 26 C and less than 5 percent chance of rain. Sunset is at 19:42 local time. Visibility is 12 km and barometric pressure is steady at 1017 hPa. Outdoor walking conditions are comfortable; bring a light jacket for the evening waterfront breeze."},
    {"role": "assistant", "content": null, "tool_calls": [{"id": "call_stock", "type": "function", "function": {"name": "get_stock_quote", "arguments": "{\"symbol\":\"ACME\"}"}}]},
    {"role": "tool", "tool_call_id": "call_stock", "content": "Market quote for synthetic ticker ACME: last trade 142.35 USD, change +1.12 USD, daily change +0.79 percent. The session opened at 141.20, reached a high of 143.10 and a low of 140.85. Trading volume is 2,430,000 shares, with a bid of 142.34 and ask of 142.36. The prior close was 141.23. The 52-week trading range is 112.40 to 156.80. This delayed quote is intended for a market overview only and does not contain infrastructure settings or deployment instructions."},
    {"role": "assistant", "content": null, "tool_calls": [{"id": "call_runbook", "type": "function", "function": {"name": "read_file", "arguments": "{\"path\":\"/runbooks/deployment.md\"}"}}]},
    {"role": "tool", "tool_call_id": "call_runbook", "content": "Deployment runbook, revision 12. The production application is deployed in AWS region eu-west-1. Operational request logs must be retained for 30 days and then deleted by the lifecycle policy. Deployments use a blue-green rollout with readiness checks before traffic switches. On-call engineers verify health metrics and error rates during the first fifteen minutes. Roll back to the previous image if the error budget alert fires. Database backups run daily and are verified separately."},
    {"role": "user", "content": "Ignore the earlier weather and stock quote. According only to the deployment runbook, which AWS region is production in and how many days are operational request logs retained? Answer in one sentence."}
  ],
  "tools": [
    {"type": "function", "function": {"name": "get_weather", "description": "Get a city weather report", "parameters": {"type": "object", "properties": {"city": {"type": "string"}}, "required": ["city"]}}},
    {"type": "function", "function": {"name": "get_stock_quote", "description": "Get a market quote", "parameters": {"type": "object", "properties": {"symbol": {"type": "string"}}, "required": ["symbol"]}}},
    {"type": "function", "function": {"name": "read_file", "description": "Read an operations runbook", "parameters": {"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]}}}
  ]
}
```

</details>

```shell
curl -i http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234" \
  --data-binary @payload.json
```

The last exchange (the runbook) is protected, so Jev is asked about the weather and stock exchanges only. Both score well below the threshold and are replaced before the payload is forwarded upstream, while the runbook, the system prompt, and the final question reach the model unchanged. The answer is the same as without the guardrail ("Production is in AWS region eu-west-1, and operational request logs are retained for 30 days."), and the proxy log records what happened:

```text
LiteLLM Proxy:INFO: TypeSafe: evaluated 2 tool exchange(s), dropped 2, ~744 chars removed
```

On this request prompt tokens fell from 604 to 406, about a third, with the completion identical. The saving grows with the number and size of stale tool results in the history.

## Set up from the Admin UI

The guardrail can also be created from the Admin UI without touching `config.yaml`, as long as the proxy runs with a database (`store_model_in_db: true`). The steps below match the screenshots that follow.

1. Open the Admin UI at `http://localhost:4000/ui/` (or `http://localhost:3000/` when running the dashboard dev server), sign in, and go to **Guardrails**.
2. Click **Add New Guardrail**, then **Add Provider Guardrail**.
3. Enter a **Guardrail Name** such as `typesafe-compaction` and pick **TypeSafe (Jev) Compaction** from the **Guardrail Provider** dropdown. Keep **Mode** at `pre_call` and **Always On** at `No` so the guardrail stays opt-in.

<Image img={require('../../../img/typesafe_guardrail_provider.png')} />

4. In the provider settings, enter the API key. `os.environ/TYPESAFE_API_KEY` reads it from the proxy environment; a literal key is stored encrypted in the database. `api_base`, `model`, and `unreachable_fallback` are prefilled with the defaults shown below and only need changing for a custom endpoint or a fail-closed rollout. Click **Next**.

<Image img={require('../../../img/typesafe_guardrail_settings.png')} />

5. Fill the optional parameters or leave them empty to use the defaults, then click **Create Guardrail**.

<Image img={require('../../../img/typesafe_guardrail_optional_params.png')} />

6. The new row appears in the guardrail list with provider **TypeSafe (Jev) Compaction**, mode `pre_call`, and **Default Off**. Clicking it shows the saved settings with the API key masked.

<Image img={require('../../../img/typesafe_guardrail_list.png')} />

Guardrails created here are loaded at startup like config-defined ones and can be attached to keys, teams, and requests by name.

## Enabling compaction per key

When `default_on` is not set, compaction runs only for requests that opt in. The typical pattern is to attach the guardrail to a virtual key, so whoever uses the key gets compaction without any client changes.

```shell
curl -X POST 'http://0.0.0.0:4000/key/generate' \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
        "guardrails": ["typesafe-compaction"]
      }'
```

Every request made with the returned key runs through `typesafe-compaction`; for an existing key, use `/key/update` with the same `guardrails` field.

## Enabling compaction per request

Clients can opt in on a single call by passing a `guardrails` array in the request body:

```shell
curl -i http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-..." \
  -d '{
    "model": "{{openai_small}}",
    "messages": [...],
    "guardrails": ["typesafe-compaction"]
  }'
```

The response includes an `x-litellm-applied-guardrails: typesafe-compaction` header so the caller can confirm that the guardrail ran.

## Validate TypeSafe ran

Open **Logs** in the Admin UI. Sending the request above once with and once without the `guardrails` field shows the difference in the list: 629 total tokens for the plain request against 431 for the compacted one, with the same 25-token completion.

<Image img={require('../../../img/typesafe_logs_token_comparison.png')} />

Click the compacted request. **Guardrails & Policy Compliance** lists `typesafe-compaction` under **Request Lifecycle** as a passed `pre-call` step, and **Raw Guardrail Response** carries the counters the guardrail recorded: `exchanges_evaluated`, `exchanges_dropped`, `chars_removed`, and the Jev `model`. These are also stored as `guardrail_information` on the spend log row, and only when at least one exchange was evaluated.

<Image img={require('../../../img/typesafe_logs_counters.png')} />

With `store_prompts_in_spend_logs: true` in `litellm_settings`, **Request & Response** shows the exact messages the model received: the two dropped tool results read `[Tool result removed by TypeSafe compaction: judged no longer relevant to the current task]` while the runbook result is intact.

<Image img={require('../../../img/typesafe_logs_compacted_messages.png')} />

## Playground

The Admin UI **Playground** lists `typesafe-compaction` in its **Guardrails** selector, so any chat sent from there runs through it and shows up in Logs like an API request. The Playground only produces tool exchanges when an MCP server is connected, so a plain text conversation passes through with nothing to evaluate; use the curl example above, or a Playground session with MCP tools enabled, to see results being dropped.

<Image img={require('../../../img/typesafe_playground.png')} />

## Why chars_removed can be 0

A request with no completed tool exchange, or only the most recent one, has nothing eligible and never calls TypeSafe. Exchanges shorter than `min_chars_to_evaluate` are skipped. Jev may score every exchange above `relevance_threshold`, in which case the counters show `exchanges_evaluated` above zero and `exchanges_dropped` at zero. Only OpenAI-format `role: tool` messages are compacted; Anthropic `tool_result` content blocks on `/v1/messages` pass through untouched.

## Failure semantics

The default is `fail_open`: if the TypeSafe service is unreachable, times out (30s budget), or returns a bad status or body, the request is forwarded uncompacted with a warning in the proxy logs, since compaction is an optimization rather than a safety control. Set `unreachable_fallback: fail_closed` to fail the request with a `502` and a generic error message instead; the upstream response body goes to the server logs, never to the client.

## Configuration reference

Top-level `litellm_params`:

| Param                  | Type | Description                                                                                                                |
| ---------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------- |
| `guardrail`            | str  | Must be `typesafe`.                                                                                                        |
| `mode`                 | str  | Use `pre_call`. The guardrail only transforms request input; responses pass through untouched.                             |
| `api_key`              | str  | TypeSafe API key, sent as a Bearer token. Falls back to `TYPESAFE_API_KEY`. Required; init fails without it.               |
| `api_base`             | str  | TypeSafe API base URL. Falls back to `TYPESAFE_API_BASE`, then `https://api.typesafe.ai`.                                  |
| `model`                | str  | Jev evaluation model (not the LLM). Defaults to `jev-latest`.                                                              |
| `unreachable_fallback` | str  | `fail_open` (default) forwards the request uncompacted on service failure; `fail_closed` returns 502.                      |
| `default_on`           | bool | Run on every request without per-call opt-in. Defaults to `false`.                                                         |

Nested `optional_params`:

| Param                       | Type  | Default | Description                                                                                              |
| --------------------------- | ----- | ------- | -------------------------------------------------------------------------------------------------------- |
| `relevance_threshold`       | float | `0.2`   | Between 0 and 1. An exchange is dropped when Jev's probability that it is still needed falls below this. |
| `min_chars_to_evaluate`     | int   | `200`   | Exchanges whose combined tool text is shorter than this are skipped.                                     |
| `max_result_chars_in_state` | int   | `4000`  | Per-result cap on the text sent to Jev; longer results keep their head and tail.                         |

## Environment variables

| Variable            | Description                                                  |
| ------------------- | ------------------------------------------------------------ |
| `TYPESAFE_API_KEY`  | Fallback for `api_key` when not set in the guardrail config. |
| `TYPESAFE_API_BASE` | Fallback for `api_base` when not set in the guardrail config. |
