# BigModel (Zhipu AI)

<SinceVersion v="1.109.0" />

Use `bigmodel/` for the domestic BigModel platform and `zai/` for international Z.AI. Each platform uses its own credentials and default URL

## API Key

Create an API key in your [BigModel account](https://bigmodel.cn/) and set it in the environment where you run LiteLLM

```bash
export BIGMODEL_API_KEY="YOUR_BIGMODEL_API_KEY"
pip install litellm
```

## Sample Usage

```python
from litellm import completion

response = completion(
    model="bigmodel/glm-5.3",
    messages=[{"role": "user", "content": "Hello"}],
    thinking={"type": "enabled"},
    reasoning_effort="low",
)
print(response.choices[0].message.content)
print(response.usage)
```

You do not need to set `api_base`. A successful call returns an assistant reply and token usage

## Sample Usage - Streaming

```python
from litellm import completion

stream = completion(
    model="bigmodel/glm-5.3",
    messages=[{"role": "user", "content": "Hello"}],
    reasoning_effort="low",
    stream=True,
    stream_options={"include_usage": True},
)
for chunk in stream:
    if chunk.choices:
        print(chunk.choices[0].delta.content or "", end="")
    if getattr(chunk, "usage", None):
        print(chunk.usage)
```

## Responses API

```python
from litellm import responses

response = responses(
    model="bigmodel/glm-5.3",
    input="Hello",
    reasoning={"effort": "low"},
    store=True,
)
print(response.output)
print(response.usage)
```

Set `store=True` if you need continuation, retrieval, or deletion, and use the response ID returned by LiteLLM. BigModel documents a seven-day retention period and does not support cancel, compact, native WebSocket, or `file_search`

## Anthropic Messages API

Use the asynchronous Messages SDK entry point

```python
import asyncio
import litellm

async def main() -> None:
    response = await litellm.anthropic.messages.acreate(
        model="bigmodel/glm-5.3",
        max_tokens=1024,
        messages=[{"role": "user", "content": "Hello"}],
        thinking={"type": "adaptive"},
        output_config={"effort": "low"},
    )
    print(response.content)
    print(response.usage)

asyncio.run(main())
```

Each API retains its native response format and streaming events. Messages preserves native `thinking`, `output_config`, and `reasoning_effort` parameters

## Models and pricing

Prefix the model ID with `bigmodel/`. These three catalog models support all three APIs and use always-on thinking. GLM-5.3 accepts `low`, `high`, and `max` reasoning effort

The following prices are CNY per million tokens, checked against [official pricing](https://docs.bigmodel.cn/cn/guide/start/pricing) on 2026-10-27

| Model ID | Input | Cached input | Output |
| --- | ---: | ---: | ---: |
| `glm-5.3` | 8 | 2 | 28 |
| `glm-5.3-flash` | 0.8 | 0.23 | 2.8 |
| `glm-5.3-flashx` | 2 | 0.57 | 7 |

LiteLLM stores USD/token prices using a static 7.0 CNY/USD conversion, with the source and verification date in the catalog metadata. Use existing `litellm_params` cost fields for deployment-specific contract prices

## Using with LiteLLM Proxy

Install the proxy with `pip install 'litellm[proxy]'`. Set `BIGMODEL_API_KEY` and a strong `LITELLM_MASTER_KEY` in the gateway environment, then save this as `config.yaml`

```yaml
model_list:
  - model_name: glm
    litellm_params:
      model: bigmodel/glm-5.3
      api_key: os.environ/BIGMODEL_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

```bash
litellm --config config.yaml --host 127.0.0.1 --port 4000
```

In a second terminal with the gateway key set, send a request

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"model":"glm","messages":[{"role":"user","content":"Hello"}],"reasoning_effort":"low"}'

curl http://localhost:4000/v1/responses \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"model":"glm","input":"Hello","reasoning":{"effort":"low"}}'

curl http://localhost:4000/v1/messages \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"model":"glm","messages":[{"role":"user","content":"Hello"}],"max_tokens":1024,"thinking":{"type":"adaptive"},"output_config":{"effort":"low"}}'
```

The same deployment name serves all three routes. Each response contains the reply and native token usage. Keep the BigModel key on the gateway; clients use the LiteLLM key

Codex works through `/v1/responses` with no extra settings, since LiteLLM forwards the `include` and `parallel_tool_calls` fields it sends

## API Base

`api_base` is optional and defaults to `https://open.bigmodel.cn`. Set `BIGMODEL_API_BASE` to override the default, or pass an explicit `api_base` to override the environment value. API-specific bases and complete endpoint URLs are normalized, preserving a custom proxy's path prefix

A GLM Coding Plan key uses `https://open.bigmodel.cn/api/coding/paas/v4` as its `api_base`. Chat Completions then calls the Coding Plan endpoint, and Responses and Messages keep the endpoints in the table below

| Proxy endpoint | BigModel endpoint |
| --- | --- |
| `/v1/chat/completions` | `/api/paas/v4/chat/completions` |
| `/v1/responses` | `/api/v1/responses` |
| `/v1/messages` | `/api/anthropic/v1/messages` |

In the Admin UI, select BigModel (Zhipu AI). Its credential form requires an API Key and provides the default API Base

See the official [Chat Completions](https://docs.bigmodel.cn/cn/guide/develop/openai/introduction), [Responses](https://docs.bigmodel.cn/cn/guide/develop/responses/introduction), and [Messages](https://docs.bigmodel.cn/cn/guide/develop/claude/introduction) guides for provider API details
