import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Token Counting

## Overview

LiteLLM provides exact token counting by calling provider-specific token counting APIs. This gives you accurate token counts before sending requests, helping with cost estimation and context window management.

| Feature | Details |
|---------|---------|
| SDK Method | `litellm.acount_tokens()` |
| Proxy Endpoints | `/v1/messages/count_tokens` (Anthropic format), `/v1/responses/input_tokens` (OpenAI format) |
| Fallback | Local tiktoken-based counting for unsupported providers |

## Supported Providers

| Provider | Token Counting API | Format |
|----------|-------------------|--------|
| OpenAI | [Responses API `/input_tokens`](https://platform.openai.com/docs/api-reference/responses/input-tokens) | OpenAI Responses |
| Anthropic | [Messages `/count_tokens`](https://docs.anthropic.com/en/docs/build-with-claude/token-counting) | Anthropic Messages |
| Vertex AI (Claude) | Vertex AI Partner Models Token Counter | Anthropic Messages |
| Bedrock (Claude) | AWS Bedrock CountTokens API, then bedrock-mantle for a Claude model it rejects (see [Bedrock Claude models](#bedrock-claude-models)) | Anthropic Messages |
| Gemini | Google AI Studio countTokens API | Anthropic Messages |
| Vertex AI (Gemini) | Vertex AI countTokens API | Anthropic Messages |
| Other providers | Local tiktoken fallback | N/A |

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

### Fallback Behavior

If a provider doesn't support a token counting API, or if the API key is missing, `acount_tokens()` automatically falls back to local tiktoken-based counting:

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

The credentials need the IAM action `bedrock-mantle:CountTokens` next to `bedrock:CountTokens`. Without it Mantle answers 403 and the count falls back to the local tokenizer, with both errors in the proxy log. A Bedrock API key (`AWS_BEARER_TOKEN_BEDROCK`) is sent to Mantle as the bearer token, so the same policy applies to it

Set `BEDROCK_MANTLE_API_BASE` to send the Mantle call to another host, for example a VPC endpoint. The deployment's `api_base` and `aws_bedrock_runtime_endpoint` apply to bedrock-runtime only. A Claude model Mantle does not serve in the region, and any non-Claude model, keeps the local fallback

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
