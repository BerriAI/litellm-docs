# OpenAI Passthrough

Pass-through endpoints for direct OpenAI API access

## Overview

| Feature | Supported | Notes | 
|-------|-------|-------|
| Cost Tracking | ✅ | Chat completions, embeddings, image generations, image edits, and the Responses API. Other endpoints, including the Agents API, are logged without cost |
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
- Use `/openai_passthrough` to call less popular or newer OpenAI endpoints that LiteLLM doesn't fully support yet, such as `/assistants`, `/threads`, `/vector_stores`, `/responses`, and the [Agents API](#agents-api)

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


### Agents API

The [OpenAI Agents API](https://developers.openai.com/api/docs/guides/agents-api/overview) works through both `/openai` and `/openai_passthrough`. Point the OpenAI SDK at `<your-proxy-url>/openai/v1` and call `client.beta.agents` as you would against OpenAI, with no extra headers. The proxy calls OpenAI with its own `OPENAI_API_KEY`, so that key needs access to the Agents API. <SinceVersion v="1.109.0" />

#### Create a Session

```python
import openai

client = openai.OpenAI(
    base_url="http://0.0.0.0:4000/openai/v1",  # <your-proxy-url>/openai/v1
    api_key="sk-anything",  # <your-proxy-api-key>
)

session = client.beta.agents.sessions.create(
    environment={"type": "none"},
    agent={"model": "{{openai_small}}"},
    input="Reply with the word hi",
)
print(session.id, session.status)
```

#### Stream a Follow-up Turn

A session takes new input once its current turn ends.

```python
import time

while client.beta.agents.sessions.retrieve(session.id).status == "in_progress":
    time.sleep(2)

with client.beta.agents.sessions.stream(session.id, input="Now reply with the word bye") as stream:
    for event in stream:
        print(event.type)

items = client.beta.agents.sessions.items.list(session.id)
```

#### Supported Routes

Every path under `/v1/agents` and `/v1/vaults` works with either prefix. That covers saved agents (`/v1/agents`), sessions with their events, items, turns, artifacts, subagents, and traces (`/v1/agents/sessions/...`), environments (`/v1/agents/environments/...`), automations (`/v1/agents/automations/...`), and vaults with their credentials (`/v1/vaults/...`).

#### How the `OpenAI-Beta` Header Is Handled

OpenAI rejects an Agents API call that does not send `OpenAI-Beta: agents=v1`. On `/v1/agents/...` and `/v1/vaults/...` paths, an `x-pass-openai-beta` header from the client wins, and the proxy sends its value to OpenAI as `OpenAI-Beta`. Without one, the proxy forwards the client's own `OpenAI-Beta` header, which the OpenAI SDK sets to `agents=v1` on every Agents API call. When the client sends neither, the proxy sends `agents=v1`, so a plain curl works too:

```bash
curl http://0.0.0.0:4000/openai/v1/agents/sessions \
  -H "Authorization: Bearer sk-anything" \
  -H "Content-Type: application/json" \
  -d '{
    "environment": {"type": "none"},
    "agent": {"model": "{{openai_small}}"},
    "input": "Reply with the word hi"
  }'
```

The proxy also forwards the client's `OpenAI-Beta` header on `/v1/chatkit/...` paths, so `client.beta.chatkit` calls work with the `chatkit_beta=v1` value the SDK sends. On every other path the proxy does not forward the client's `OpenAI-Beta` header, and it sends `assistants=v2` on assistants and threads paths. Use `x-pass-openai-beta` to send a different value there.

#### Logging and Spend

Creating or retrieving a session, creating a saved agent, and streaming a turn show up in the spend logs with the agent's model. Other Agents API calls, such as sending a turn's input or listing items or vaults, are logged with the model `unknown`. Spend for every Agents API call is $0 for now, because the responses the proxy relays carry no token usage.
