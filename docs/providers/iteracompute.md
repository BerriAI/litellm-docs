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

LiteLLM includes public model prices for the `iteracompute/` model IDs, checked against the [live model list](https://api.iteracompute.com/v1/models) on October 29, 2026. Token rates are stored in USD per token. These entries are a snapshot, and LiteLLM's price-map refresh does not query IteraCompute for new prices.

For billing, LiteLLM can record the cost reported by IteraCompute in the `x-litellm-response-cost` response header for non-streaming requests and `usage.cost` in the final usage event for streaming requests. These values are in USD and reflect the accepted account price for that request, including any account-specific or time-dependent rates. Provider-reported cost takes precedence over the built-in price map. Explicit custom pricing takes precedence over the provider-reported cost.

Check the [live model list](https://api.iteracompute.com/v1/models) and [model catalog](https://iteracompute.com/models/) for current public prices. Image-generation charges, pricing tiers and optional features can require additional usage fields. Configure local price overrides only when you intentionally want LiteLLM to use those rates.

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
