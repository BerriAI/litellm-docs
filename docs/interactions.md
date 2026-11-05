import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# /interactions

| Feature | Supported | Notes |
|---------|-----------|-------|
| Logging | ✅ | Works across all integrations |
| Streaming | ✅ | |
| Loadbalancing | ✅ | Between supported models |
| Supported LLM providers | **All LiteLLM supported CHAT COMPLETION providers** | `openai`, `anthropic`, `bedrock`, `vertex_ai`, `gemini`, `azure`, `azure_ai` etc. |

## **LiteLLM Python SDK Usage**

### Quick Start

```python showLineNumbers title="Create Interaction"
import litellm
import os

os.environ["GEMINI_API_KEY"] = "your-api-key"

response = litellm.interactions.create(
    model="gemini/{{gemini_flash}}",
    input="Tell me a short joke about programming."
)

print(response.outputs[-1].text)
```

### Async Usage

```python showLineNumbers title="Async Create Interaction"
import litellm
import os
import asyncio

os.environ["GEMINI_API_KEY"] = "your-api-key"

async def main():
    response = await litellm.interactions.acreate(
        model="gemini/{{gemini_flash}}",
        input="Tell me a short joke about programming."
    )
    print(response.outputs[-1].text)

asyncio.run(main())
```

### Streaming

```python showLineNumbers title="Streaming Interaction"
import litellm
import os

os.environ["GEMINI_API_KEY"] = "your-api-key"

response = litellm.interactions.create(
    model="gemini/{{gemini_flash}}",
    input="Write a 3 paragraph story about a robot.",
    stream=True
)

for chunk in response:
    print(chunk)
```

## **LiteLLM AI Gateway (Proxy) Usage**

### Setup

Add this to your litellm proxy config.yaml:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: gemini-flash
    litellm_params:
      model: gemini/{{gemini_flash}}
      api_key: os.environ/GEMINI_API_KEY
```

Start litellm:

```bash
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

### Test Request

<Tabs>
<TabItem value="curl" label="curl">

```bash showLineNumbers title="Create Interaction"
curl -X POST "http://localhost:4000/v1beta/interactions" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini/{{gemini_flash}}",
    "input": "Tell me a short joke about programming."
  }'
```

**Streaming:**

```bash showLineNumbers title="Streaming Interaction"
curl -N -X POST "http://localhost:4000/v1beta/interactions" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini/{{gemini_flash}}",
    "input": "Write a 3 paragraph story about a robot.",
    "stream": true
  }'
```

**Get Interaction:**

```bash showLineNumbers title="Get Interaction by ID"
curl "http://localhost:4000/v1beta/interactions/{interaction_id}" \
  -H "Authorization: Bearer $LITELLM_API_KEY"
```

</TabItem>

<TabItem value="google-sdk" label="Google GenAI SDK">

Point the Google GenAI SDK to LiteLLM Proxy:

```python showLineNumbers title="Google GenAI SDK with LiteLLM Proxy"
from google import genai

# Point SDK to LiteLLM Proxy
client = genai.Client(
    api_key="sk-<your-litellm-api-key>",  # Your LiteLLM API key
    http_options={"base_url": "http://localhost:4000"},
)

# Create an interaction
interaction = client.interactions.create(
    model="gemini/{{gemini_flash}}",
    input="Tell me a short joke about programming."
)

print(interaction.outputs[-1].text)
```

**Streaming:**

```python showLineNumbers title="Google GenAI SDK Streaming"
from google import genai

client = genai.Client(
    api_key="sk-<your-litellm-api-key>",  # Your LiteLLM API key
    http_options={"base_url": "http://localhost:4000"},
)

for chunk in client.interactions.create_stream(
    model="gemini/{{gemini_flash}}",
    input="Write a story about space exploration.",
):
    print(chunk)
```

</TabItem>
</Tabs>

## **Request/Response Format**

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | Yes | Model to use (e.g., `gemini/gemini-2.5-flash`) |
| `input` | string | Yes | The input text for the interaction |
| `stream` | boolean | No | Enable streaming responses |
| `tools` | array | No | Tools available to the model |
| `system_instruction` | string | No | System instructions for the model |
| `generation_config` | object | No | Generation configuration |
| `previous_interaction_id` | string | No | ID of previous interaction for context |
| `continuation_token` | string | No | Token from an interaction that ended with `status: "requires_continuation"`, to resume that long decode yourself |

### Response Format

```json
{
  "id": "interaction_abc123",
  "object": "interaction",
  "model": "{{gemini_flash}}",
  "status": "completed",
  "created": "2025-01-15T10:30:00Z",
  "updated": "2025-01-15T10:30:05Z",
  "role": "model",
  "outputs": [
    {
      "type": "text",
      "text": "Why do programmers prefer dark mode? Because light attracts bugs!"
    }
  ],
  "usage": {
    "total_input_tokens": 10,
    "total_output_tokens": 15,
    "total_tokens": 25
  }
}
```

## **Long decode (answers past Google's per-request output cap)**

A foreground Interactions request to a model that supports long decode (for example `gemini/gemini-4-argon`) stops at Google's per-request cap, 32,768 output tokens when not streaming and 65,536 when streaming, with `status: "requires_continuation"` and a `continuation_token`. LiteLLM continues the decode for you: it re-sends the request with `previous_interaction_id` and `continuation_token` until the status leaves `requires_continuation` or `generation_config.max_output_tokens` is spent, and returns one interaction.

```python
import litellm

response = litellm.interactions.create(
    model="gemini/gemini-4-argon",
    input="Write a complete, rigorous proof of the prime number theorem.",
    generation_config={"max_output_tokens": 262144, "thinking_level": "high"},
)
print(response.status)  # "completed", not "requires_continuation"
print("".join(c["text"] for step in response.steps for c in step.get("content", []) if c.get("type") == "text"))
```

The merged interaction carries the last hop's `id` (pass it as `previous_interaction_id` on the next turn), the `steps` of every hop in order, and a `usage` summed over the hops. Every hop re-sends the answer so far as input, so `usage.total_input_tokens` is the sum of each hop's input; `usage.initial_input_tokens` is the size of your prompt. In streaming mode the hops arrive as one stream: the `interaction.completed` event is sent once, for the last hop, with the summed `usage`. With `store: false` the hops resend `input` instead of `previous_interaction_id`.

If a continuation request fails, LiteLLM returns the answer so far with `status: "requires_continuation"` and its `continuation_token`. Resume it yourself by sending the same request again with `previous_interaction_id` set to that interaction's `id` and `continuation_token` set to that token.

Background requests (`background: true`) are continued by Google on its side and need no client hops.

## **Calling non-Interactions API endpoints (`/interactions` to `/responses` Bridge)**

LiteLLM allows you to call non-Interactions API models via a bridge to LiteLLM's `/responses` endpoint. This is useful for calling OpenAI, Anthropic, and other providers that don't natively support the Interactions API.

#### Python SDK Usage

```python showLineNumbers title="SDK Usage"
import litellm
import os

# Set API key
os.environ["OPENAI_API_KEY"] = "your-openai-api-key"

# Non-streaming interaction
response = litellm.interactions.create(
    model="{{openai_large}}",
    input="Tell me a short joke about programming."
)

print(response.outputs[-1].text)
```

#### LiteLLM Proxy Usage

**Setup Config:**

```yaml showLineNumbers title="Example Configuration"
model_list:
- model_name: openai-model
  litellm_params:
    model: {{openai_large}}
    api_key: os.environ/OPENAI_API_KEY
```

**Start Proxy:**

```bash showLineNumbers title="Start LiteLLM Proxy"
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

**Make Request:**

```bash showLineNumbers title="non-Interactions API Model Request"
curl http://localhost:4000/v1beta/interactions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{
    "model": "openai-model",
    "input": "Tell me a short joke about programming."
  }'
```

## **Supported Providers**

| Provider | Link to Usage |
|----------|---------------|
| Google AI Studio | [Usage](#quick-start) |
| All other LiteLLM providers | [Bridge Usage](#calling-non-interactions-api-endpoints-interactions-to-responses-bridge) |
