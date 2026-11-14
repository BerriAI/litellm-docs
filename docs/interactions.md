import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# /interactions

| Feature | Supported | Notes |
|---------|-----------|-------|
| Logging | ✅ | Works across all integrations |
| Streaming | ✅ | |
| Loadbalancing | ✅ | Between supported models |
| Supported LLM providers | **All LiteLLM supported CHAT COMPLETION providers** | `gemini` and `vertex_ai` natively, every other provider through the [bridge](#calling-non-interactions-api-endpoints-interactions-to-responses-bridge). See [Supported Providers](#supported-providers) |

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

**Get, cancel or delete an interaction:**

```bash showLineNumbers title="Get, cancel and delete by ID"
curl "http://localhost:4000/v1beta/interactions/{interaction_id}" \
  -H "Authorization: Bearer $LITELLM_API_KEY"

curl -X POST "http://localhost:4000/v1beta/interactions/{interaction_id}/cancel" \
  -H "Authorization: Bearer $LITELLM_API_KEY"

curl -X DELETE "http://localhost:4000/v1beta/interactions/{interaction_id}" \
  -H "Authorization: Bearer $LITELLM_API_KEY"
```

These calls go to Google AI Studio unless you name the model group the interaction was created on, as shown in [Get, cancel and delete on Vertex AI](#get-cancel-and-delete-on-vertex-ai).

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
| `model` | string | One of `model` or `agent` | Model to use (e.g., `gemini/{{gemini_flash}}`) |
| `agent` | string | One of `model` or `agent` | Google agent to run, such as `deep-research-preview-04-2026`. `gemini` and `vertex_ai` only |
| `input` | string | Yes | The input text for the interaction |
| `background` | boolean | No | Run the interaction as a long-running job. The response comes back `in_progress` and you read the result with a GET by ID. `gemini` and `vertex_ai` only |
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

A foreground Interactions request to a model that supports long decode (for example `gemini/gemini-4-argon`) stops at Google's per-request cap, 32,768 output tokens when not streaming and 65,536 when streaming, with `status: "requires_continuation"` and a `continuation_token`. LiteLLM passes both through unchanged, exactly as Google returns them, and does not continue the decode for you. To get the rest of the answer, send the request again with `previous_interaction_id` set to that interaction's `id` and `continuation_token` set to that token, and repeat until the status is no longer `requires_continuation`. Each hop is its own request, with its own spend log, budget check and rate limit.

```python
import litellm

request = {
    "model": "gemini/gemini-4-argon",
    "generation_config": {"max_output_tokens": 262144, "thinking_level": "high"},
}
response = litellm.interactions.create(input="Write a complete, rigorous proof of the prime number theorem.", **request)
steps = list(response.steps or [])
while response.status == "requires_continuation":
    response = litellm.interactions.create(
        previous_interaction_id=response.id,
        continuation_token=response.continuation_token,
        **request,
    )
    steps.extend(response.steps or [])
print(response.status)  # "completed"
print("".join(c["text"] for step in steps for c in step.get("content", []) if c.get("type") == "text"))
```

Every hop re-reads the answer so far as input, so each hop's `usage.total_input_tokens` grows while `usage.initial_input_tokens` stays the size of your prompt. With `store: false` nothing is stored on Google's side, so resend `input` instead of `previous_interaction_id`. In streaming mode the `interaction.completed` event carries the same `status` and `continuation_token`.

Background requests (`background: true`) are continued by Google on its side and need no client hops.

## **Vertex AI**

`vertex_ai` deployments call Vertex AI's own Interactions API with the deployment's `vertex_project`, `vertex_location` and `vertex_credentials`. The location defaults to `global`.

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: vertex-gemini
    litellm_params:
      model: vertex_ai/{{gemini_flash}}
      vertex_project: os.environ/VERTEXAI_PROJECT
      vertex_location: global
      vertex_credentials: os.environ/VERTEX_CREDENTIALS_PATH
```

```bash showLineNumbers title="Create an interaction on Vertex AI"
curl -X POST "http://localhost:4000/v1beta/interactions" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "vertex-gemini",
    "input": "Tell me a short joke about programming."
  }'
```

From the Python SDK, pass the Vertex settings directly:

```python showLineNumbers title="Vertex AI from the SDK"
import litellm

response = litellm.interactions.create(
    model="vertex_ai/{{gemini_flash}}",
    input="Tell me a short joke about programming.",
    vertex_project="my-project",
    vertex_location="global",
)
```

### Deep Research on Vertex AI

Google's Deep Research agent, `deep-research-preview-04-2026`, runs on Vertex AI as a background interaction. Send `agent` with `background: true`, then read the result by ID. Google lets one run take up to 120 minutes ([Use Deep Research](https://docs.cloud.google.com/gemini-enterprise-agent-platform/agents/use-deep-research#hard-failures), checked 2026-11-12).

Through the proxy, give the agent its own Vertex deployment whose `model` is the agent, then send that deployment's model group as `model` and the agent's name as `agent`. The deployment supplies the project and credentials, and Google receives only the agent. A request that sends both `model` and `agent` is refused with a 400 before anything reaches Google unless the agent is the model of the deployment it names, so the agent runs on its own deployment and the key needs access to that deployment's model group. Give the model group a name that differs from the agent's name, because a request whose `model` equals its `agent` is treated as agent only and goes to Google AI Studio.

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: vertex-deep-research
    litellm_params:
      model: vertex_ai/deep-research-preview-04-2026
      vertex_project: os.environ/VERTEXAI_PROJECT
      vertex_location: global
      vertex_credentials: os.environ/VERTEX_CREDENTIALS_PATH
```

```bash showLineNumbers title="Start a Deep Research job on Vertex AI"
curl -X POST "http://localhost:4000/v1beta/interactions" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "vertex-deep-research",
    "agent": "deep-research-preview-04-2026",
    "background": true,
    "input": "Compare the main approaches to grid-scale energy storage."
  }'
```

```python showLineNumbers title="Deep Research on Vertex AI from the SDK"
import litellm

job = litellm.interactions.create(
    agent="deep-research-preview-04-2026",
    custom_llm_provider="vertex_ai",
    vertex_project="my-project",
    vertex_location="global",
    background=True,
    input="Compare the main approaches to grid-scale energy storage.",
)
print(job.id, job.status)
```

LiteLLM prices an agent interaction from that agent's row in the [model cost map](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json). The `vertex_ai/deep-research-preview-04-2026` row carries Google's Standard rates of $2 input, $0.20 cached input and $12 output per 1M tokens, with thinking tokens billed as output, and $14 per 1,000 grounding search queries, counted per query ([Model Garden pricing](https://cloud.google.com/model-garden/pricing), checked 2026-11-12). Two parts of Google's bill are not modeled. Google gives a monthly allowance of free grounding queries, and LiteLLM charges every query from the first one, so spend reads high while you are inside that allowance. Google also bills a Deferred tier at $1, $0.10 and $6 per 1M tokens. LiteLLM cannot tell a Deferred job from a Standard one and prices both at Standard rates, so spend for Deferred jobs reads high.

### Get, cancel and delete on Vertex AI

The proxy has no way to tell from an interaction ID which deployment created it, so name it with a `model` query parameter or an `x-litellm-model` header. Either one takes a model group or a deployment ID. The create response carries the ID of the deployment that served it in its `x-litellm-model-id` header, and sending that ID pins the follow-up to the same deployment, so it reaches the project and location that hold the interaction. Your key needs access to the deployment's model group, just as it does to create. A key or team limited to model access groups can only pin a deployment in one of those access groups, and pinning another deployment of the group is refused with a 400 before anything reaches Google. Without either, the call goes to Google AI Studio as before.

```bash showLineNumbers title="Poll, cancel and delete a Vertex AI interaction"
curl "http://localhost:4000/v1beta/interactions/{interaction_id}?model={x-litellm-model-id}" \
  -H "Authorization: Bearer $LITELLM_API_KEY"

curl -X POST "http://localhost:4000/v1beta/interactions/{interaction_id}/cancel" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "x-litellm-model: {x-litellm-model-id}"

curl -X DELETE "http://localhost:4000/v1beta/interactions/{interaction_id}?model={x-litellm-model-id}" \
  -H "Authorization: Bearer $LITELLM_API_KEY"
```

Cancel is sent to Vertex AI as `POST .../interactions/{id}/cancel`, the path in Google's [Interactions API reference](https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/models/interactions-api). From the SDK, pass `custom_llm_provider="vertex_ai"` and the same Vertex settings to `litellm.interactions.get`, `cancel` and `delete`.

A model group name is routed like any other request, so a group that load balances across Vertex deployments in different projects or locations can send a GET, cancel or delete to one that does not hold the interaction, and that call fails. Use the deployment ID from `x-litellm-model-id` for follow-ups. If you assign deployment IDs yourself, keep them distinct from model group names, because a group name takes precedence over an identical deployment ID. Alternatively, give interactions you poll, cancel or delete a model group with a single Vertex deployment, such as the dedicated agent deployment above.

## **Background jobs and cost tracking**

A `background: true` request returns before Google has finished, so the proxy keeps polling the interaction and logs its spend once it reaches a final status. It polls with the credentials of the deployment that created it. `BACKGROUND_INTERACTION_COST_POLL_TIMEOUT_SECONDS` sets how long it keeps trying; the default is 7800 seconds so a 120-minute Deep Research run still settles. A job that is still running when the timeout ends is not billed and its budget reservation is released. The [settings reference](/docs/proxy/config_settings#environment-variables---reference) lists the other poll settings.

Older releases lack parts of this. Earlier changes added three pieces: background jobs on Vertex AI poll with the deployment's own credentials since [#45743](https://github.com/BerriAI/litellm/pull/45743), `agent_config` is forwarded since [#48750](https://github.com/BerriAI/litellm/pull/48750), and a background job that ends in `requires_continuation` settles since [#50151](https://github.com/BerriAI/litellm/pull/50151). The change that added this section brought the rest. Before it, GET, cancel and delete through the proxy always went to Google AI Studio, cancel went to `:cancel` on Vertex AI, a request with both `model` and `agent` sent the model, agent-only interactions were logged without a model name and billed at $0 while routed ones were priced as the deployment's model, no Vertex row existed for `deep-research-preview-04-2026`, and the poll timeout defaulted to 3600 seconds.

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

`gemini` and `vertex_ai` are native: LiteLLM sends the request to Google's Interactions API as is. Every other provider is bridged: LiteLLM turns the request into a `/responses` call and the reply back into an interaction. Agents, background jobs, and GET, cancel and delete by ID need a native provider.

| Provider | Kind | Create and stream | `agent` | Background, GET, cancel, delete | Link to Usage |
|----------|------|-------------------|---------|---------------------------------|---------------|
| Google AI Studio (`gemini`) | Native | Yes | Yes | Yes | [Usage](#quick-start) |
| Vertex AI (`vertex_ai`) | Native | Yes | Yes | Yes, name the model group for GET, cancel and delete | [Usage](#vertex-ai) |
| All other LiteLLM providers | Bridged | Yes | No | No | [Bridge Usage](#calling-non-interactions-api-endpoints-interactions-to-responses-bridge) |
