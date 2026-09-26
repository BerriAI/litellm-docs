# NanoGPT

## Overview

| Property | Details |
|----------|---------|
| Description | NanoGPT provides an OpenAI-compatible API for models from multiple providers, with pay-per-use and subscription options |
| Provider route on LiteLLM | `nano-gpt/` |
| Website | [nano-gpt.com](https://nano-gpt.com) |
| Default base URL | `https://nano-gpt.com/api/v1` |
| Supported operations | Chat completions, text completions, embeddings |

Streaming, tool calling, structured output, and other parameters depend on the selected model. A model appearing in the catalog does not guarantee that it supports every operation

## API key and model names

Create an API key at [nano-gpt.com](https://nano-gpt.com) and make it available to the process running LiteLLM

```bash
export NANOGPT_API_KEY="your-nanogpt-api-key"
```

Prefix the exact model ID returned by NanoGPT with `nano-gpt/`. Keep any publisher prefix: an ID such as `publisher/model-name` becomes `nano-gpt/publisher/model-name`

To inspect the current catalog directly:

```bash
curl https://nano-gpt.com/api/v1/models \
  -H "Authorization: Bearer $NANOGPT_API_KEY"
```

Use the same base URL and credentials for discovery and requests. A custom or subscription endpoint can expose a different catalog

## LiteLLM Python SDK {#usage---litellm-python-sdk}

### Non-streaming

```python
from litellm import completion

response = completion(
    model="nano-gpt/publisher/model-name",  # Replace with an ID from the catalog
    messages=[{"role": "user", "content": "What is the capital of France?"}],
)
print(response.choices[0].message.content)
```

### Streaming

```python
from litellm import completion

response = completion(
    model="nano-gpt/publisher/model-name",  # Replace with an ID from the catalog
    messages=[{"role": "user", "content": "Write a short poem."}],
    stream=True,
)
for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")
```

For a custom NanoGPT endpoint, pass `api_base` explicitly. The default is `https://nano-gpt.com/api/v1`

## LiteLLM Proxy: all models with one deployment {#usage---litellm-proxy-server}

A wildcard routes requests for NanoGPT models without adding each model individually

```yaml title="config.yaml"
model_list:
  - model_name: nano-gpt/*
    litellm_params:
      model: nano-gpt/*
      api_key: os.environ/NANOGPT_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

```bash
export LITELLM_MASTER_KEY="your-proxy-master-key"
litellm --config config.yaml
```

Call a model using its full LiteLLM ID. Replace the example ID with one from NanoGPT's catalog

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nano-gpt/publisher/model-name",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

To expose only one model, replace both wildcards with the desired name and ID. For example, use `model_name: my-nanogpt-model` and `model: nano-gpt/publisher/model-name`

### Automatic model discovery and Admin UI

:::info Availability

The UI provider entry, automatic catalog discovery, and `NANOGPT_API_BASE` environment variable require the changes proposed in the [NanoGPT integration pull request](https://github.com/BerriAI/litellm/pull/42800). Until those changes are included in your installed version, use the YAML configuration above and send the model ID explicitly. Existing SDK support alone does not mean NanoGPT appears in the UI provider dropdown

:::

With catalog discovery available, `GET /v1/models` expands the configured `nano-gpt/*` deployment into the models returned by NanoGPT. Newly available models appear after the catalog cache expires, normally five minutes

```bash
curl http://localhost:4000/v1/models \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY"
```

Discovery uses the deployment's API key and base URL, falling back to `NANOGPT_API_KEY` and `NANOGPT_API_BASE`. If no base URL is set, it uses `https://nano-gpt.com/api/v1`. A catalog request failure returns no discovered models for that deployment; explicit wildcard requests can still route

To configure the wildcard through the Admin UI:

1. Open **Models + Endpoints**, then **Add Model**
2. Select **NanoGPT** from **Provider**
3. Select **All NanoGPT Models (Wildcard)** under **LiteLLM Model Name(s)**
4. Enter your NanoGPT API key, or leave it blank to use the proxy's `NANOGPT_API_KEY`. Set **API Base** only when using a custom endpoint
5. Click **Add Model**. LiteLLM creates the `nano-gpt/*` public model mapping automatically

The proxy must be configured to store models in its database to save deployments from the UI

Catalog discovery returns model IDs. It does not populate LiteLLM's static pricing, context limits, or capability metadata. Configure model costs separately if you need LiteLLM spend tracking for models without pricing entries

## Tool calling

Choose a model that supports tools

```python
from litellm import completion

response = completion(
    model="nano-gpt/publisher/model-name",
    messages=[{"role": "user", "content": "What's the weather in Paris?"}],
    tools=[{
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get current weather",
            "parameters": {
                "type": "object",
                "properties": {"location": {"type": "string"}},
                "required": ["location"],
            },
        },
    }],
)
```

## Further information

See [NanoGPT's API documentation](https://docs.nano-gpt.com) for model-specific features, endpoint availability, and current pricing
