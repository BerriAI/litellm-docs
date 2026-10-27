# IteraCompute

[IteraCompute](https://iteracompute.com) provides access to open models through an OpenAI-compatible API.

| Property | Value |
| --- | --- |
| LiteLLM provider prefix | `iteracompute/` |
| API base | `https://api.iteracompute.com/v1` |
| API documentation | [IteraCompute quick start](https://iteracompute.com/docs.html) |
| Model IDs | [Live model list](https://api.iteracompute.com/v1/models) |
| Model capabilities and pricing | [Model catalog](https://iteracompute.com/models/) |

## Setup

Create an account and API key using the [quick start](https://iteracompute.com/docs.html), then set your key in the server environment.

```bash
export ITERACOMPUTE_API_KEY="your-api-key"
```

`ITERACOMPUTE_API_BASE` optionally overrides the default API base. Passing `api_key` or `api_base` directly takes precedence over the environment variables.

Keep the complete model ID after the LiteLLM prefix. For example, the API model `qwen/qwen3.8-27b` becomes `iteracompute/qwen/qwen3.8-27b`.

## Python SDK

```python
from litellm import completion

response = completion(
    model="iteracompute/qwen/qwen3.8-27b",
    messages=[{"role": "user", "content": "Explain API gateways in one sentence."}],
    max_tokens=1024,
)

print(response.choices[0].message.content)
```

### Streaming

```python
from litellm import completion

stream = completion(
    model="iteracompute/qwen/qwen3.8-27b",
    messages=[{"role": "user", "content": "Explain API gateways in one sentence."}],
    max_tokens=1024,
    stream=True,
    stream_options={"include_usage": True},
)

for chunk in stream:
    if chunk.choices:
        print(chunk.choices[0].delta.content or "", end="")
    if chunk.usage:
        print(chunk.usage)
```

Some models generate reasoning tokens before the final answer. Allow enough `max_tokens` for both. Tool calling, image input, structured outputs, and reasoning controls vary by model. Check the [API documentation](https://iteracompute.com/docs.html) for the model you use.

## LiteLLM Proxy

```yaml
model_list:
  - model_name: iteracompute-qwen
    litellm_params:
      model: iteracompute/qwen/qwen3.8-27b
      api_key: os.environ/ITERACOMPUTE_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Start the proxy with this configuration.

```bash
export LITELLM_MASTER_KEY="sk-local-example"
litellm --config config.yaml --port 4000
```

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "iteracompute-qwen",
    "messages": [{"role": "user", "content": "Explain API gateways in one sentence."}],
    "max_tokens": 1024
  }'
```

The Admin UI also lists IteraCompute under Models, Add Model. Enter your API key and a model ID prefixed with `iteracompute/`.

## Responses and Messages

This provider uses IteraCompute's Chat Completions endpoint. LiteLLM translates Responses API and Anthropic Messages requests to chat completions. These are LiteLLM bridges, rather than additional native endpoints declared by this integration.

## Model capabilities and cost tracking

This integration does not add static model prices. LiteLLM can record the cost reported by IteraCompute in the `x-litellm-response-cost` response header for non-streaming requests and `usage.cost` in the final usage event for streaming requests. These values are in USD and reflect the accepted account price for that request. Static model prices are not required for this reported-cost path.

Configure per-token input and output costs only when you intentionally want LiteLLM to use local rates; explicit custom pricing takes precedence over the provider-reported cost. LiteLLM's built-in price-map refresh does not discover IteraCompute model prices automatically. Check the [live model list](https://api.iteracompute.com/v1/models) and [model catalog](https://iteracompute.com/models/) for current models, capabilities and public prices. Account-specific prices can differ.

For a model that supports tool calling, enable that capability in `model_info`.

```yaml
model_list:
  - model_name: iteracompute-qwen
    litellm_params:
      model: iteracompute/qwen/qwen3.8-27b
      api_key: os.environ/ITERACOMPUTE_API_KEY
    model_info:
      supports_function_calling: true
```

This example configures capability metadata without overriding cost tracking. Context limits can depend on the account tier.
