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

Set `BEDROCK_MANTLE_API_BASE` to send the Mantle call to another host, for example a VPC endpoint. The deployment's `api_base` and `aws_bedrock_runtime_endpoint` apply to bedrock-runtime only. For a non-Claude model such as Amazon Nova, or a Claude model that Mantle does not serve in the region, the SDK uses a local count. The proxy returns the 400 or 404 from AWS. If the deployment sets [`token_count_framing`](#local-estimates-for-models-without-a-count-api), the proxy returns a local estimate. If the region has no Mantle host, the proxy returns a 500

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

If the deployment sets `token_count_framing`, the proxy returns a local estimate in place of a 400 or a 404 from the provider. Refer to [Local estimates for models without a count API](#local-estimates-for-models-without-a-count-api). A Vertex AI partner model with `custom_tokenizer` in `model_info` continues to use a local count and does not return the 400.

This change does not apply to providers with no count API, such as Groq. They continue to use a local count. The SDK function `litellm.acount_tokens()` also continues to use a local count.

### Local estimates for models without a count API

To get a local estimate for a model that the provider cannot count, set `token_count_framing` in the `model_info` of the deployment. The value is a number of tokens. The proxy adds this number to the local estimate for the chat template tokens that the local tokenizer does not see. The proxy also adds it to each local estimate for providers that have no count API.

`token_count_framing` changes only a 400 or a 404 from the provider into a local estimate. For a 401, 403, 429, or 5xx error, the proxy returns the error. Set `token_count_framing` on each deployment of the model group. A deployment without it continues to return the 400.

As an alternative, set `token_count_model` to count with a different model that the provider can count. Use the keys `model` and `region`. The key `region` is optional. If you set `token_count_model`, the proxy does not use `token_count_framing`. If the count with `token_count_model` fails, the proxy returns the error.

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
