# Lyceum

Call [Lyceum's OpenAI-compatible serverless API](https://docs.lyceum.technology/docs/inference/serverless) with the `lyceum/` provider prefix

| Setting | Value |
| --- | --- |
| Default base URL | `https://api.lyceum.technology/openai/v1` |
| Required environment variable | `LYCEUM_API_KEY` |
| Optional base URL override | `LYCEUM_API_BASE` |
| Integrated endpoint | `/chat/completions`, streaming and non-streaming |
| SDK methods | `litellm.completion`, `litellm.acompletion` |

Create an API key in the [Lyceum dashboard](https://dashboard.lyceum.technology). Supply it through your environment or secret manager

```bash
export LYCEUM_API_KEY="<your-lyceum-api-key>"
```

No custom base URL is needed. To use another Lyceum deployment, set `LYCEUM_API_BASE` to its OpenAI-compatible base URL. An explicit `api_base` argument takes precedence over this environment variable

## Python SDK

```python
import litellm

response = litellm.completion(
    model="lyceum/z-ai/glm-5.3-flash",
    messages=[{"role": "user", "content": "Hello"}],
)
print(response.choices[0].message.content)
print(response.usage)
```

### Async

```python
import asyncio
import litellm

async def main():
    response = await litellm.acompletion(
        model="lyceum/z-ai/glm-5.3-flash",
        messages=[{"role": "user", "content": "Hello"}],
    )
    print(response.choices[0].message.content)

asyncio.run(main())
```

### Streaming

```python
import litellm

stream = litellm.completion(
    model="lyceum/z-ai/glm-5.3-flash",
    messages=[{"role": "user", "content": "Hello"}],
    stream=True,
    stream_options={"include_usage": True},
)
for chunk in stream:
    if chunk.choices:
        print(chunk.choices[0].delta.content or "", end="")
    if getattr(chunk, "usage", None):
        print(chunk.usage)
```

For async streaming, await `litellm.acompletion(..., stream=True)` and consume the returned stream with `async for`

### Tools

```python
import litellm

response = litellm.completion(
    model="lyceum/z-ai/glm-5.3-flash",
    messages=[{"role": "user", "content": "What is the weather in Paris?"}],
    tools=[{
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get the weather for a city",
            "parameters": {
                "type": "object",
                "properties": {"city": {"type": "string"}},
                "required": ["city"],
            },
        },
    }],
    tool_choice="auto",
)
print(response.choices[0].message.tool_calls)
```

Your application executes requested tools and sends their results back as `tool` messages. Lyceum documents model-specific limitations on forced tool choice; check `message.tool_calls` before executing a tool

## LiteLLM Proxy

Save this as `config.yaml` and set `LYCEUM_API_KEY` in the proxy process environment

```yaml
model_list:
  - model_name: lyceum-glm-flash
    litellm_params:
      model: lyceum/z-ai/glm-5.3-flash
      api_key: os.environ/LYCEUM_API_KEY
```

```bash
litellm --config config.yaml
```

Call the local proxy using the configured model alias. If proxy authentication is enabled, include your LiteLLM virtual key

```bash
curl http://localhost:4000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"lyceum-glm-flash","messages":[{"role":"user","content":"Hello"}]}'
```

## Model IDs and limitations

Use the exact ID from Lyceum's authenticated model listing, prefixed with `lyceum/`. For example, `z-ai/glm-5.3-flash` becomes `lyceum/z-ai/glm-5.3-flash`. LiteLLM removes only the leading provider prefix

```bash
curl https://api.lyceum.technology/openai/v1/models \
  -H "Authorization: Bearer $LYCEUM_API_KEY"
```

This integration covers chat completions. Lyceum also documents embeddings, but this provider registration does not enable embeddings, Responses, or legacy text completions

The initial model metadata covers GLM-5.3 Flash using Lyceum's [published pricing and specifications](https://lyceum.technology/products/inference/models/z-ai/glm-5.3-flash/). Other model IDs can be routed, but their prices and capabilities need separate registration. The exact input-token limit is not registered because Lyceum publishes a rounded “1M” context window

GLM-5.3 Flash produces reasoning before its visible answer. Leave enough output tokens for both; a small budget may produce no visible content. Lyceum documents that disabling reasoning can move it into answer text instead. Prompt-cache details may be absent on a cache miss

Lyceum returns OpenAI-shaped errors. LiteLLM maps HTTP failures to its standard exceptions, including `AuthenticationError`, `NotFoundError`, and `RateLimitError`. See Lyceum's [serverless API documentation](https://docs.lyceum.technology/docs/inference/serverless) for request limits and model-specific behavior
