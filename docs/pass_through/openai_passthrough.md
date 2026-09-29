# OpenAI Passthrough

Pass-through endpoints for direct OpenAI API access

## Overview

| Feature | Supported | Notes | 
|-------|-------|-------|
| Cost Tracking | ✅ | Chat completions, embeddings, image generations, image edits, and the Responses API. Other endpoints are logged without cost |
| Logging | ✅ | Works across all integrations |
| Streaming | ✅ | Fully supported |

## Available Endpoints

### `/openai_passthrough` - Recommended
Dedicated passthrough endpoint that guarantees direct routing to OpenAI without conflicts.

**Use this for:**
- OpenAI Responses API (`/v1/responses`)
- Any endpoint where you need guaranteed passthrough
- When `/openai` routes are conflicting with LiteLLM's native implementations

### `/openai` - Legacy
Standard passthrough endpoint that may conflict with LiteLLM's native implementations.

**Note:** Some endpoints like `/openai/v1/responses` will be routed to LiteLLM's native implementation instead of OpenAI.

## WebSocket endpoints are off by default

Both prefixes can also relay WebSocket connections (for example `/openai_passthrough/v1/realtime` and `/openai/v1/responses`) to OpenAI. The relay forwards frames without reading them, so it cannot check which model a session asks for, and it is served under the proxy's own OpenAI credential. Because of that it is disabled unless a proxy admin opts in:

```yaml
general_settings:
  enable_openai_websocket_passthrough: true
```

While it is off, a WebSocket client receives one `error` event that names this setting and the connection closes with code `1008`. Even when it is on, a request is refused the same way if any model restriction applies to it, whether that restriction sits on the key, its team, the caller's team membership, the internal user, or the project. The setting can also be stored in the database with `store_model_in_db: true`, through `POST /config/field/update`, and each proxy instance picks it up on its next config reload; a value set in the YAML wins over the stored one. If you only need the Realtime API for models in your `model_list`, use the proxy's own `/v1/realtime` route instead, which needs no opt-in and enforces the key's model access

## When to use this?

- For 90% of your use cases, you should use the [native LiteLLM OpenAI Integration](https://docs.litellm.ai/docs/providers/openai) (`/chat/completions`, `/embeddings`, `/completions`, `/images`, `/batches`, etc.)
- Use `/openai_passthrough` to call less popular or newer OpenAI endpoints that LiteLLM doesn't fully support yet, such as `/assistants`, `/threads`, `/vector_stores`, `/responses`

Simply replace `https://api.openai.com` with `LITELLM_PROXY_BASE_URL/openai_passthrough`

## Usage Examples

Requirements:
Set `OPENAI_API_KEY` in your environment variables.

### Embeddings

Spend from passthrough embeddings calls is tracked and attributed to the calling key, just like the native `/embeddings` route

```bash
curl http://0.0.0.0:4000/openai_passthrough/v1/embeddings \
  -H "Authorization: Bearer sk-anything" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "text-embedding-3-small",
    "input": "hello world"
  }'
```

### Assistants API

#### Create OpenAI Client

Make sure you do the following:
- Point `base_url` to your `LITELLM_PROXY_BASE_URL/openai_passthrough`
- Use your `LITELLM_API_KEY` as the `api_key`

```python
import openai

client = openai.OpenAI(
    base_url="http://0.0.0.0:4000/openai_passthrough",  # <your-proxy-url>/openai_passthrough
    api_key="sk-anything"  # <your-proxy-api-key>
)
```

#### Create an Assistant

```python
# Create an assistant
assistant = client.beta.assistants.create(
    name="Math Tutor",
    instructions="You are a math tutor. Help solve equations.",
    model="{{openai_large}}",
)
```

#### Create a Thread
```python
# Create a thread
thread = client.beta.threads.create()
```

#### Add a Message to the Thread
```python
# Add a message
message = client.beta.threads.messages.create(
    thread_id=thread.id,
    role="user",
    content="Solve 3x + 11 = 14",
)
```

#### Run the Assistant
```python
# Create a run to get the assistant's response
run = client.beta.threads.runs.create(
    thread_id=thread.id,
    assistant_id=assistant.id,
)

# Check run status
run_status = client.beta.threads.runs.retrieve(
    thread_id=thread.id,
    run_id=run.id
)
```

#### Retrieve Messages
```python
# List messages after the run completes
messages = client.beta.threads.messages.list(
    thread_id=thread.id
)
```

#### Delete the Assistant

```python
# Delete the assistant when done
client.beta.assistants.delete(assistant.id)
```

