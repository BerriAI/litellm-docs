import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Token Counting

## Overview

LiteLLM provides exact token counting by calling provider-specific token counting APIs. This gives you accurate token counts before sending requests, helping with cost estimation and context window management.

| Feature | Details |
|---------|---------|
| SDK Method | `litellm.acount_tokens()` |
| Proxy Endpoints | `/v1/messages/count_tokens` (Anthropic format), `/v1/responses/input_tokens` (OpenAI format) |
| Local count | The SDK and the providers that have no count API use a local count. On the proxy, a failed provider count returns an error. Refer to [Proxy errors](#proxy-errors-instead-of-local-estimates) |

## Supported Providers

| Provider | Token Counting API | Format |
|----------|-------------------|--------|
| OpenAI | [Responses API `/input_tokens`](https://platform.openai.com/docs/api-reference/responses/input-tokens) | OpenAI Responses |
| Anthropic | [Messages `/count_tokens`](https://docs.anthropic.com/en/docs/build-with-claude/token-counting) | Anthropic Messages |
| Vertex AI (Claude) | Vertex AI Partner Models Token Counter | Anthropic Messages |
| Bedrock (Claude) | AWS Bedrock CountTokens API, then bedrock-mantle for a Claude model it rejects (see [Bedrock Claude models](#bedrock-claude-models)) | Anthropic Messages |
| Gemini | Google AI Studio countTokens API | Anthropic Messages |
| Vertex AI (Gemini) | Vertex AI countTokens API | Anthropic Messages |
| Azure AI (Claude) | Azure AI Anthropic Messages `/count_tokens` | Anthropic Messages |
| Providers with no count API (Groq, Together AI, Fireworks AI, OpenRouter, self-hosted vLLM, and other providers) | Local tiktoken count, or the Hugging Face tokenizer of the model if you set one | N/A |

## SDK Usage

### Basic Usage

```python
import asyncio
import litellm

async def main():
    # OpenAI
    result = await litellm.acount_tokens(
        model="openai/{{openai_large}}",
        messages=[{"role": "user", "content": "Hello, how are you?"}],
    )
    print(f"Token count: {result.total_tokens}")
    print(f"Tokenizer: {result.tokenizer_type}")  # "openai_api"

    # Anthropic
    result = await litellm.acount_tokens(
        model="anthropic/{{anthropic}}",
        messages=[{"role": "user", "content": "Hello, how are you?"}],
    )
    print(f"Token count: {result.total_tokens}")
    print(f"Tokenizer: {result.tokenizer_type}")  # "anthropic_api"

asyncio.run(main())
```

### With Tools and System Message

```python
import asyncio
import litellm

async def main():
    result = await litellm.acount_tokens(
        model="openai/{{openai_large}}",
        messages=[{"role": "user", "content": "What's the weather in Paris?"}],
        tools=[{
            "type": "function",
            "function": {
                "name": "get_weather",
                "description": "Get weather for a city",
                "parameters": {
                    "type": "object",
                    "properties": {"city": {"type": "string"}},
                },
            },
        }],
        system="You are a helpful weather assistant.",
    )
    print(f"Token count (with tools): {result.total_tokens}")

asyncio.run(main())
```

### Response Format

`litellm.acount_tokens()` returns a `TokenCountResponse`:

```python
TokenCountResponse(
    total_tokens=15,           # Token count
    request_model="openai/{{openai_large}}",  # Model requested
    model_used="{{openai_large}}",      # Model used for counting
    tokenizer_type="openai_api",    # "openai_api", "anthropic_api", "bedrock_api", "bedrock_mantle_api", "local_tokenizer"
    original_response={"input_tokens": 15},  # Raw API response
    error=False,               # True if counting failed
    error_message=None,        # Error details if failed
)
```

### SDK Fallback Behavior

In the SDK, `acount_tokens()` uses a local tiktoken count if the provider has no count API or if the API key is missing. The proxy count routes do not do this. They return an error. Refer to [Proxy errors instead of local estimates](#proxy-errors-instead-of-local-estimates).

```python
# Unsupported provider → automatic fallback
result = await litellm.acount_tokens(
    model="together_ai/meta-llama/Llama-3-8b-chat-hf",
    messages=[{"role": "user", "content": "Hello"}],
)
print(result.tokenizer_type)  # "local_tokenizer"
```

On the proxy, local counting runs in a worker thread, so a large payload does not hold up other requests. Each worker process counts at most `TOKEN_COUNTER_MAX_CONCURRENT_COUNTS` payloads at a time (default 4) and queues the rest, which bounds the memory a burst of large counts can take. Strings longer than `TOKEN_COUNTER_MAX_EXACT_CHARS` characters (default 4,000,000, roughly a million tokens) are estimated by tokenizing 16 evenly spaced samples that together total that many characters and scaling the result by the string's length, which keeps the cost of the largest payloads bounded.

### Bedrock Claude models

The bedrock-runtime CountTokens API rejects some Claude models with a 400 (Claude Opus 4.8, 5 and 5.5 when this was written). For a Claude model it rejects, LiteLLM sends the same body to bedrock-mantle (`https://bedrock-mantle.<region>.api.aws/anthropic/v1/messages/count_tokens`), signed with the deployment's AWS credentials, and reports `tokenizer_type: "bedrock_mantle_api"`. A model bedrock-runtime counts never reaches Mantle and keeps `tokenizer_type: "bedrock_api"`

The credentials need the IAM action `bedrock-mantle:CountTokens` next to `bedrock:CountTokens`. Without it, Mantle returns a 403. The SDK then uses the local tokenizer. The proxy count routes return the 403. A Bedrock API key (`AWS_BEARER_TOKEN_BEDROCK`) is sent to Mantle as the bearer token, so the same policy applies to it

Set `BEDROCK_MANTLE_API_BASE` to send the Mantle call to another host, for example a VPC endpoint. The deployment's `api_base` and `aws_bedrock_runtime_endpoint` apply to bedrock-runtime only. For a non-Claude model such as Amazon Nova, or a Claude model that Mantle does not serve in the region, the SDK uses a local count. The proxy returns the 400 or 404 from AWS. If the deployment sets [`token_count_framing` or another framing key](#local-estimates-for-models-without-a-count-api), the proxy returns a local estimate. If the region has no Mantle host, the proxy returns a 500

## Proxy Usage

### OpenAI Format: `/v1/responses/input_tokens`

<Tabs>
<TabItem value="curl" label="curl">

```bash
curl -X POST "http://localhost:4000/v1/responses/input_tokens" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{
    "model": "{{openai_large}}",
    "input": "Hello, how are you?"
  }'
```

</TabItem>
<TabItem value="python" label="Python (httpx)">

```python
import httpx

response = httpx.post(
    "http://localhost:4000/v1/responses/input_tokens",
    headers={
        "Content-Type": "application/json",
        "Authorization": "Bearer sk-<your-litellm-api-key>"
    },
    json={
        "model": "{{openai_large}}",
        "input": "Hello, how are you?"
    }
)

print(response.json())
# {"object": "response.input_tokens", "input_tokens": 13}
```

</TabItem>
</Tabs>

**Response:**
```json
{"object": "response.input_tokens", "input_tokens": 13}
```

### Anthropic Format: `/v1/messages/count_tokens`

See [Anthropic Token Counting](./anthropic_count_tokens.md) for full documentation.

```bash
curl -X POST "http://localhost:4000/v1/messages/count_tokens" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{
    "model": "{{anthropic}}",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ]
  }'
```

### Proxy errors instead of local estimates

From v1.108.0, the proxy count routes do not return a local tiktoken estimate when they cannot use the count from the provider. Before v1.108.0, the routes returned a 200 with this estimate. For some models, the estimate was very different from the correct count. The proxy count routes are:

- `/v1/messages/count_tokens`
- `/v1/responses/input_tokens`
- Google `:countTokens`
- `/utils/token_counter?call_endpoint=true`

Each error uses the error format of the API that you used: Anthropic, OpenAI, or Google.

| Condition | Response |
|-----------|----------|
| The count API of the provider fails, for example because of a bad key, an outage, or a 429 | The status and the message from the provider |
| An OpenAI, Anthropic, or Azure AI deployment has no API key | A 401 that names the missing key |
| A Bedrock deployment has no AWS credentials | A 500 with the credential error |
| A Gemini deployment has no API key | The error that Google returns |
| A Vertex AI partner model, such as GLM, has no count API | A 400 that names the model |
| A non-Claude Bedrock model, such as Amazon Nova, has no count API | The 400 or 404 from AWS |
| `litellm.disable_token_counter` is set, and the provider has no count API | A 503 |

If the deployment sets `token_count_framing` or another framing key, the proxy returns a local estimate in place of a 400 or a 404 from the provider. Refer to [Local estimates for models without a count API](#local-estimates-for-models-without-a-count-api). A Vertex AI partner model with `custom_tokenizer` in `model_info` continues to use a local count and does not return the 400.

This change does not apply to providers with no count API, such as Groq. They continue to use a local count. The SDK function `litellm.acount_tokens()` also continues to use a local count.

### Local estimates for models without a count API

To get a local estimate for a model that the provider cannot count, set `token_count_framing` in the `model_info` of the deployment. The value is a number of tokens. The proxy adds this number to the local estimate for the chat template tokens that the local tokenizer does not see. The proxy also adds it to each local estimate for providers that have no count API. For a request that a narrower framing key covers, the proxy adds the value of that key in its place.

A framing key changes only a 400 or a 404 from the provider into a local estimate. The framing keys are `token_count_framing` and the three keys in [Framing for tool requests and the Responses API](#framing-for-tool-requests-and-the-responses-api). Any one of them turns on the local estimate for every request to the deployment, also for a request that the key does not apply to. On v1.107.0 to v1.109.x, only `token_count_framing` turns it on. For example, with only `token_count_tool_framing` set, a request with no function tool gets a local estimate with the `token_count_framing` value of the cost map entry, or with no framing when the entry has none. So set `token_count_framing` too. For a 401, 403, 429, or 5xx error, the proxy returns the error. Set the framing keys on each deployment of the model group. A deployment without them continues to return the 400.

As an alternative, set `token_count_model` to count with a different model that the provider can count. Use the keys `model` and `region`. The key `region` is optional. If you set `token_count_model`, the proxy does not use any framing key. If the count with `token_count_model` fails, the proxy returns the error.

```yaml
model_list:
  - model_name: glm
    litellm_params:
      model: vertex_ai/zai-org/glm-5-maas
    model_info:
      token_count_framing: 8  # tokens added to the local estimate

  - model_name: claude-sonnet
    litellm_params:
      model: bedrock/us.anthropic.claude-sonnet-5-5
    model_info:
      token_count_model:
        model: us.anthropic.claude-opus-5-5
        region: us-west-2  # replaces the built-in us-east-1 value
```

The built-in cost map sets these values for some models. Examples are Kimi K3 on Bedrock and Databricks, and Claude Sonnet 5.5 and Haiku 5.5 on Bedrock. These models can give a count without `model_info`. A value in `model_info` replaces the built-in value.

The `/v1/messages/count_tokens`, `/v1/responses/input_tokens`, and `:countTokens` responses show the source of the count in `litellm_count_source`. On `/utils/token_counter`, the field is `count_source`. The values are:

- `provider`: the count API of the provider for the deployment
- `token_count_model`: the count API for the model in `token_count_model`. The field `litellm_count_model` gives the name of this model.
- `local_estimate`: a local count

### Framing for tool requests and the Responses API

Some hosts add a different hidden prompt when a request has tools, or when it goes to their own Responses API. Three more `model_info` keys set the framing for these requests. <SinceVersion v="1.110.0" />

| Key | Applies to |
|-----|------------|
| `token_count_framing` | Every request that a narrower key does not cover |
| `token_count_tool_framing` | A request with a function tool |
| `token_count_responses_framing` | A native Responses request |
| `token_count_responses_tool_framing` | A native Responses request with a function tool |

The proxy adds one framing value to each local estimate. A count from the count API of the provider gets no framing, and neither does a `/utils/token_counter` request with only a `prompt`. A narrower key replaces `token_count_framing` and is not added to it. For example, with `token_count_framing: 149` and `token_count_tool_framing: 302`, a request with one function tool adds 302 tokens, not 451.

A function tool is a tool with a name, other than the Anthropic `web_search` tool. This includes OpenAI function tools, Anthropic custom tools, and Anthropic built-in tools such as `web_fetch` and `code_execution`. A request whose only tools are the Anthropic `web_search` tool or tools with no name, such as the Responses `web_search` and `file_search` tools, uses the keys for a request with no function tool.

A native Responses request is a `/v1/responses/input_tokens` request to a deployment for which the proxy calls the provider's own Responses API. When the proxy bridges the deployment to chat completions, the host adds its chat prompt, so the count uses the chat keys. For example, an Azure AI deployment uses the bridge when its `api_base` is not on `.services.ai.azure.com` or `.openai.azure.com`, or when the deployment or the request sets `use_chat_completions_api: true`. If `default_litellm_params` in `router_settings` sets `api_base` or `use_chat_completions_api`, the proxy uses that value in place of the value of the deployment. `/v1/messages/count_tokens` and `/utils/token_counter` always use the chat keys.

When a key is not set, the proxy uses the next key in the list for the request. A chat request is every count request that is not a native Responses request:

| Request | Keys, in order |
|---------|----------------|
| Chat, no function tool | `token_count_framing` |
| Chat, function tool | `token_count_tool_framing`, `token_count_framing` |
| Native Responses, no function tool | `token_count_responses_framing`, `token_count_framing` |
| Native Responses, function tool | `token_count_responses_tool_framing`, `token_count_responses_framing`, `token_count_tool_framing`, `token_count_framing` |

If `model_info` sets one or more keys from the list for a request, the proxy uses only the `model_info` keys for that request. If not, it uses the built-in values from the cost map. So `token_count_framing` alone in `model_info` applies to every request and replaces all the built-in values. `token_count_tool_framing` alone applies to tool requests on both APIs, and requests with no function tool keep the built-in values. Each value is a whole number of tokens, zero or more. The proxy ignores any other value.

The local estimate renders tools the way the chat template of the model does, for example for Grok 4.1, Grok 4.3, and DeepSeek V4.1. The proxy finds the model from `base_model` when the deployment sets it in `model_info` or `litellm_params`, and from `litellm_params.model` if not. The built-in framing values come from the cost map entry with the same name, so write `base_model` with its provider prefix, such as `azure_ai/grok-4-1-fast-reasoning`. With `base_model: grok-4-1-fast-reasoning`, the proxy still renders the tools the way Grok 4.1 does, but it finds no cost map entry and adds no framing. So a deployment with a custom name needs `base_model` with the prefix to get the built-in framing values:

```yaml
model_list:
  - model_name: prod-grok
    litellm_params:
      model: azure_ai/prod-grok
      api_base: https://my-resource.services.ai.azure.com
      api_key: os.environ/AZURE_AI_API_KEY
    model_info:
      base_model: azure_ai/grok-4-1-fast-reasoning
```

```bash
curl -X POST "http://localhost:4000/v1/messages/count_tokens" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{
    "model": "prod-grok",
    "messages": [{"role": "user", "content": "What is the weather in Paris?"}],
    "tools": [{
      "name": "get_weather",
      "description": "Get the current weather for a city",
      "input_schema": {"type": "object", "properties": {"city": {"type": "string"}}, "required": ["city"]}
    }]
  }'
# {"input_tokens": 352, "litellm_count_source": "local_estimate"}
```

Without `base_model`, the same request counts 54 tokens, because the proxy uses the generic tool rendering and no framing. An xAI deployment that still uses a deprecated `grok-4-1` name has no cost map entry, because xAI serves Grok 4.3 for these names. To count it like Grok 4.3, set `base_model: xai/grok-4.3`. `base_model` also changes the other values that the proxy reads from the cost map for the deployment, such as the prices that spend tracking uses. Refer to [Custom pricing](./proxy/custom_pricing.md).

The cost map has measured framing values for these entries and for others:

| Cost map entry | Keys set |
|----------------|----------|
| `azure_ai/grok-4-1-fast-reasoning` | All four keys |
| `xai/grok-4.3` | `token_count_framing`, `token_count_tool_framing` |
| `deepseek/deepseek-v4-flash` | `token_count_framing`, `token_count_tool_framing` |
| `deepseek/deepseek-v4-pro` | `token_count_framing`, `token_count_tool_framing` |
| `fireworks_ai/deepseek-v4p1-flash` | `token_count_framing` |
| `fireworks_ai/accounts/fireworks/models/deepseek-v4p1-flash` | `token_count_framing` |

The proxy loads the cost map from GitHub when it starts and on `/reload/model_cost_map`, so these values also reach older proxies. A proxy on v1.107.0 to v1.109.x adds the `token_count_framing` value of the entry to every local estimate, tool requests included, and does not read the three newer keys. To use a different value there, set `token_count_framing` in `model_info`, which replaces the built-in value. A proxy older than v1.107.0 does not read any framing key. [`LITELLM_LOCAL_MODEL_COST_MAP=True`](./proxy/config_settings.md) keeps the cost map of the installed version, but it also keeps the model prices of that version.

## Proxy Configuration

```yaml
model_list:
  - model_name: {{openai_large}}
    litellm_params:
      model: openai/{{openai_large}}
      api_key: os.environ/OPENAI_API_KEY

  - model_name: {{anthropic}}
    litellm_params:
      model: anthropic/{{anthropic}}
      api_key: os.environ/ANTHROPIC_API_KEY
```
