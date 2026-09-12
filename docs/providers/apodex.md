import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Apodex

## Overview

| Property | Details |
|-------|-------|
| Description | Apodex serves two model families behind one OpenAI-compatible API: core models for direct inference, and Deep Research tiers that run an autonomous research agent. |
| Provider Route on LiteLLM | `apodex/` |
| Link to Provider Doc | [Apodex Documentation](https://platform.apodex.ai/docs) |
| Default Base URL | `https://api.apodex.ai/v1` |
| Supported Operations | `/chat/completions`, `/responses`, `/messages` |

## API Key

```python showLineNumbers title="Environment Variables"
import os

os.environ["APODEX_API_KEY"] = "your-api-key"
os.environ["APODEX_API_BASE"] = "https://api.apodex.ai/v1"  # optional
```

## Models

Apodex exposes two families behind one base URL. The model id selects which contract applies, and the two behave deliberately differently.

### Core models

Direct single-pass inference with native sampling parameters. Both are text-only with a 262,144-token context window.

| Model | Context | Max output | Input / 1M | Cached input / 1M | Output / 1M |
|-------|---------|-----------|-----------|-------------------|-------------|
| `apodex/apodex-1.1` | 262,144 | 65,536 | $0.30 | $0.03 | $3.00 |
| `apodex/apodex-1.1-mini` | 262,144 | 65,536 | $0.10 | $0.01 | $1.00 |

Core-model requests with more than 200K input tokens are billed at 2x, and the multiplier applies to input, cached input and output alike.

### Deep Research tiers

One request launches an agent that plans, searches and iterates, typically for minutes. Tokens cover the whole run, not just the final report.

| Model | Context | Max output | Input / 1M | Output / 1M |
|-------|---------|-----------|-----------|-------------|
| `apodex/apodex-1-1-deep-research` | 131,072 | 65,536 | $5.00 | $20.00 |
| `apodex/apodex-1-1-deep-solve` | 131,072 | 65,536 | $5.00 | $25.00 |
| `apodex/apodex-1-1-deep-discover` | 131,072 | 262,144 | $10.00 | $100.00 |

The Deep Discover tier is in preview and requires access through the Apodex Frontier Program. It is served on `/responses` only; calling it on `/chat/completions` returns a 400. Hosted tool calls on the Deep Research tiers are billed per use on top of tokens.

### Choosing between them

| Aspect | Core models | Deep Research tiers |
|--------|-------------|---------------------|
| Sampling parameters | `max_tokens`, `temperature`, `top_p` passed through natively | Not exposed on Chat Completions; accepted Responses fields do not control the agent's internal budget |
| Tools | Your own function tools | Built-in web search, URL fetch, code sandbox, MCP servers |
| Latency | Single forward pass | Minutes |
| `stream` default | `false`, as on OpenAI | `true` |
| `/chat/completions` | Served | Served, except the Deep Discover tier |
| `/v1/messages` | Served natively | Not served upstream; LiteLLM translates through `/responses` |

## Usage - LiteLLM Python SDK

### Chat Completions

```python showLineNumbers title="Apodex Chat Completion"
import os
from litellm import completion

os.environ["APODEX_API_KEY"] = "your-api-key"

response = completion(
    model="apodex/apodex-1.1",
    messages=[{"role": "user", "content": "Explain prefix caching in one paragraph."}],
    max_tokens=512,
)

print(response.choices[0].message.content)
```

The Deep Research tiers default `stream` to `true`, which differs from OpenAI; the core models default it to `false` as usual. LiteLLM always sends the field explicitly, so a normal non-streaming call returns a single JSON completion on either family.

### Streaming

```python showLineNumbers title="Apodex Streaming Chat Completion"
import os
from litellm import completion

os.environ["APODEX_API_KEY"] = "your-api-key"

response = completion(
    model="apodex/apodex-1-1-deep-research",
    messages=[{"role": "user", "content": "What are the latest trends in AI?"}],
    stream=True,
)

for chunk in response:
    print(chunk)
```

Non-streaming core-model requests are capped at `max_tokens` of 32768 and roughly 600 seconds of wall clock. Stream anything longer.

### Reasoning

Both core models think before answering, and the chain of thought comes back in `reasoning_content`. Its tokens count toward `max_tokens`, so leave headroom: with too small a budget the reasoning consumes it all and `content` comes back empty with `finish_reason: length`.

```python showLineNumbers title="Apodex Reasoning"
import os
from litellm import completion

os.environ["APODEX_API_KEY"] = "your-api-key"

response = completion(
    model="apodex/apodex-1.1",
    messages=[{"role": "user", "content": "If a train travels 60 miles in 1.5 hours, what is its average speed?"}],
    max_tokens=2048,
)

print(response.choices[0].message.reasoning_content)
print(response.choices[0].message.content)
```

### Tool Calling

Function tools work on the core models. The Deep Research tiers do not accept OpenAI-style `tools` or `tool_choice` and LiteLLM rejects them before the request goes out. Those tiers reach external tools through the `mcp_servers` request field, which you pass via `extra_body`:

```python showLineNumbers title="Apodex MCP Servers"
response = completion(
    model="apodex/apodex-1-1-deep-research",
    messages=[{"role": "user", "content": "Summarize our internal docs on retries."}],
    extra_body={"mcp_servers": [{"name": "docs", "url": "https://example.com/mcp"}]},
)
```

```python showLineNumbers title="Apodex Tool Calling"
import os
from litellm import completion

os.environ["APODEX_API_KEY"] = "your-api-key"

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get the current weather for a city",
            "parameters": {
                "type": "object",
                "properties": {"city": {"type": "string", "description": "City name"}},
                "required": ["city"],
            },
        },
    }
]

response = completion(
    model="apodex/apodex-1.1",
    messages=[{"role": "user", "content": "What is the weather in San Francisco?"}],
    tools=tools,
    tool_choice="auto",
)

print(response.choices[0].message.tool_calls)
```

### Prefix caching with X-Session-Id

Sending a stable `X-Session-Id` for one logical conversation routes its turns consistently, which raises the prefix cache hit rate and bills the shared prefix at the cheaper cached-input rate. Use one unique value per conversation, reuse it for every turn including retries, and keep user identifiers out of it.

```python showLineNumbers title="Apodex Session Caching"
import os
from litellm import completion

os.environ["APODEX_API_KEY"] = "your-api-key"

response = completion(
    model="apodex/apodex-1.1",
    messages=[{"role": "user", "content": "Continue our earlier thread."}],
    extra_headers={"X-Session-Id": "conversation-42"},
)

print(response.usage.prompt_tokens_details.cached_tokens)
```

### Responses API

```python showLineNumbers title="Apodex Responses API"
import os
import litellm

os.environ["APODEX_API_KEY"] = "your-api-key"

response = litellm.responses(
    model="apodex/apodex-1-1-deep-research",
    input="Summarize the recent advances in fusion energy.",
)

print(response)
```

The two families support different subsets of `/responses`:

| Parameter | Core models | Deep Research tiers |
|-----------|-------------|---------------------|
| `store` | Forced to `false`; the endpoint is stateless | Supported |
| `previous_response_id` | Rejected with a 400 | Supported |
| `background` | Rejected with a 400 | Supported |
| `max_output_tokens` | Supported, maps to `max_tokens` | Supported |

LiteLLM applies these rules to top-level parameters per model. Asking a core model for `store=True`, `background=True`, or `previous_response_id` raises an `UnsupportedParamsError` locally instead of returning a 400 from Apodex; set `litellm.drop_params = True` to have them stripped instead. Values placed in `extra_body` are forwarded as raw provider parameters and bypass this validation.

### Background responses

Deep Research runs can outlive the client connection. Pass `background=True` and poll or resume later.

```python showLineNumbers title="Apodex Background Response"
import os
import litellm

os.environ["APODEX_API_KEY"] = "your-api-key"

response = litellm.responses(
    model="apodex/apodex-1-1-deep-research",
    input="Compare the leading approaches to grid-scale storage.",
    background=True,
)

print(response.id, response.status)
```

## Usage - LiteLLM Proxy

Add Apodex to your LiteLLM Proxy configuration:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: apodex-core
    litellm_params:
      model: apodex/apodex-1.1
      api_key: os.environ/APODEX_API_KEY
  - model_name: apodex-deep-research
    litellm_params:
      model: apodex/apodex-1-1-deep-research
      api_key: os.environ/APODEX_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Start the proxy:

```bash showLineNumbers title="Start LiteLLM Proxy"
export APODEX_API_KEY="your-api-key"
export LITELLM_MASTER_KEY="sk-local-apodex"
litellm --config config.yaml --port 4000

# RUNNING on http://0.0.0.0:4000
```

Requests to LiteLLM Proxy must use the proxy key in `Authorization: Bearer $LITELLM_MASTER_KEY`. `APODEX_API_KEY` is only used by LiteLLM when it calls Apodex upstream.

<Tabs>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="Apodex via Proxy - OpenAI SDK"
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000",
    api_key="sk-local-apodex",
)

response = client.chat.completions.create(
    model="apodex-core",
    messages=[{"role": "user", "content": "hello from litellm"}],
)

print(response.choices[0].message.content)
```

</TabItem>

<TabItem value="curl" label="cURL">

```bash showLineNumbers title="Apodex via Proxy - cURL"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -d '{
    "model": "apodex-core",
    "messages": [{"role": "user", "content": "hello from litellm"}]
  }'
```

</TabItem>
</Tabs>

## Anthropic Messages Compatibility

Apodex serves `POST /v1/messages` natively for the core models, so LiteLLM forwards the Anthropic payload untranslated and Anthropic-only features such as `thinking` and `cache_control` survive the round trip. Point the Anthropic SDK, or a tool built on it, at the proxy.

```bash showLineNumbers title="Anthropic Messages through LiteLLM Proxy"
curl http://localhost:4000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "apodex-core",
    "max_tokens": 1024,
    "system": "You are a concise assistant.",
    "messages": [{"role": "user", "content": "Explain prefix caching in one paragraph."}]
  }'
```

The Deep Research tiers are not served on the native `/v1/messages` path. LiteLLM still accepts Anthropic-shaped requests for them and translates through the Responses API, so the same route works for every Apodex model in streaming and non-streaming mode.

## Cost Tracking

The Apodex 1.1 models are registered in LiteLLM's model cost map, so LiteLLM computes per-request spend automatically. On the proxy, the cost is returned in the `x-litellm-response-cost` response header and recorded in spend logs. Core-model prompt tokens served from the prefix cache are billed at the lower cached-input rate, and core-model requests over 200K input tokens are billed at 2x.

Two things sit outside that calculation. Apodex bills the Deep Research hosted tool calls per invocation on top of tokens, so a run that searches or fetches heavily reports less than it costs. The 1.0 Deep Research tiers are not in the cost map, so they log as zero.

## Common Parameters

| Endpoint | Common parameters |
|----------|-------------------|
| `/chat/completions` | `messages`, `max_tokens`, `max_completion_tokens`, `temperature`, `top_p`, `stop`, `seed`, `stream`, `stream_options`, `tools`, `tool_choice`, `extra_body`, `extra_headers` |
| `/responses` | `input`, `max_output_tokens`, `temperature`, `metadata`, `stream`, `background`, `extra_headers` |
| `/messages` | `messages`, `system`, `max_tokens`, `stream`, `tools`, `tool_choice`, `thinking`, `extra_headers` |

For chat completions, LiteLLM accepts `max_completion_tokens` and maps it to `max_tokens` for Apodex.

## Notes

- Use `model="apodex/<model-id>"` for direct LiteLLM SDK calls.
- The default base URL is `https://api.apodex.ai/v1`; override it with `APODEX_API_BASE`.
- Only `n=1` is supported on the core models.
- Multimodal input is not supported; send text.
- Deep Research responses carry the agent's intermediate `reasoning_steps`, which LiteLLM passes through untouched.
