import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Databricks Agents

Register a Databricks ResponsesAgent as a LiteLLM agent and call it through `/a2a/<agent>` or as `model: a2a/<agent>` on `/v1/chat/completions`, `/v1/responses`, and `/v1/messages`.

| Feature | Supported |
|---|---|
| Agent type | `databricks_agent` |
| Model Serving endpoints | ✅ |
| Databricks Apps | ✅ |
| Streaming | ✅ |
| Auth | Personal access token, OAuth M2M service principal |

## How it works

A Databricks ResponsesAgent speaks the OpenAI Responses API shape. LiteLLM flattens the chat messages to Responses `input` items, posts them to the agent, and maps the agent's `output` back to a chat completion or to an A2A message. Tool calls stay inside the agent, so none are mapped.

## Endpoint URLs

`api_base` takes any of these shapes. The endpoint name goes in `model` only where the URL does not already name it.

| `api_base` | `model` | What LiteLLM calls |
|---|---|---|
| `https://<workspace>` or `https://<workspace>/serving-endpoints` | required | `https://<workspace>/serving-endpoints/<model>/invocations` |
| `https://<workspace>/serving-endpoints/<endpoint>` | ignored | `https://<workspace>/serving-endpoints/<endpoint>/invocations` |
| `https://<workspace>/serving-endpoints/<endpoint>/invocations` | ignored | the URL as given |
| `https://<workspace>/serving-endpoints/responses` | required, sent as the body `model` | the URL as given |
| `https://<app>.databricksapps.com` | ignored | `https://<app>.databricksapps.com/responses` |
| `https://<app>.databricksapps.com/<path>` | ignored | the URL as given |

A workspace or unified URL without a `model` answers 400 before any call is made.

## Authentication

The agent's own credential wins over a client `Authorization` header. The order is the minted OAuth token, then the agent's `api_key` (a personal access token), then the `DATABRICKS_API_KEY` environment variable, then an OAuth M2M token minted from `DATABRICKS_CLIENT_ID` and `DATABRICKS_CLIENT_SECRET`. A client `Authorization` header is used only when the agent has none of these.

### OAuth M2M (recommended)

Databricks Apps accept OAuth tokens only, and OAuth M2M is the recommended production auth for Model Serving too. Set the service principal's `client_id` and `client_secret` on the agent. `workspace_url` defaults to the `api_base` origin for Model Serving. A Databricks App host is never a token endpoint, so an App agent must set `workspace_url`, and the client secret is never posted to the App host.

The minted token is cached until shortly before it expires and refreshed on the next call.

### Personal access token

Set `api_key` to a PAT, or set `DATABRICKS_API_KEY` in the proxy's environment. Databricks Apps reject PATs.

### Environment service principal

When the proxy's environment sets `DATABRICKS_CLIENT_ID` and `DATABRICKS_CLIENT_SECRET`, a `databricks_agent` with no `api_key` mints an OAuth M2M token from them on each call, the same way the `databricks` model provider does. The token endpoint is the `DATABRICKS_HOST` workspace when set, else the `api_base` origin. An App `api_base` with no `DATABRICKS_HOST` answers 400 naming `DATABRICKS_HOST`.

## Register the agent

<Tabs>
<TabItem value="ui" label="UI">

1. Go to **Agentic** > **Agents** in the LiteLLM dashboard.
2. Click **Add New Agent** and pick **Databricks Agent**.
3. Enter the agent name, the `api_base`, and the `model` (the serving endpoint name) where the URL does not already name it.
4. Fill in either a personal access token or the service principal's `client_id`, `client_secret`, and, for an App, `workspace_url`.
5. Save the agent.

</TabItem>
<TabItem value="config" label="config.yaml">

```yaml title="config.yaml"
agents:
  - agent_name: dbx-serving
    agent_card_params:
      name: "Databricks ResponsesAgent on Model Serving"
    litellm_params:
      custom_llm_provider: databricks_agent
      model: my-responses-agent
      api_base: https://adb-1234567890123456.7.azuredatabricks.net
      client_id: os.environ/DATABRICKS_CLIENT_ID
      client_secret: os.environ/DATABRICKS_CLIENT_SECRET

  - agent_name: dbx-app
    agent_card_params:
      name: "Databricks App ResponsesAgent"
    litellm_params:
      custom_llm_provider: databricks_agent
      api_base: https://my-agent-app-1234567890123456.7.azure.databricksapps.com
      client_id: os.environ/DATABRICKS_CLIENT_ID
      client_secret: os.environ/DATABRICKS_CLIENT_SECRET
      workspace_url: https://adb-1234567890123456.7.azuredatabricks.net
```

</TabItem>
<TabItem value="api" label="REST API">

```bash
curl -X POST http://localhost:4000/v1/agents \
  -H "Authorization: Bearer sk-admin" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_name": "dbx-serving",
    "agent_card_params": {"name": "Databricks ResponsesAgent on Model Serving"},
    "litellm_params": {
      "custom_llm_provider": "databricks_agent",
      "model": "my-responses-agent",
      "api_base": "https://adb-1234567890123456.7.azuredatabricks.net",
      "api_key": "os.environ/DATABRICKS_API_KEY"
    }
  }'
```

</TabItem>
</Tabs>

## Call the agent

<Tabs>
<TabItem value="chat" label="Chat completions">

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer sk-client-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "a2a/dbx-serving",
    "messages": [{"role": "user", "content": "Reply with exactly: pong"}],
    "custom_inputs": {"tenant": "t-1"}
  }'
```

`stream: true` streams the agent's `output_text` deltas as chat chunks. `/v1/responses` and `/v1/messages` take the same `model: a2a/<agent>`.

</TabItem>
<TabItem value="a2a" label="A2A">

```bash
curl http://localhost:4000/a2a/dbx-serving \
  -H "Authorization: Bearer sk-client-key" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "message/send",
    "params": {
      "message": {
        "role": "user",
        "messageId": "1",
        "parts": [{"kind": "text", "text": "Reply with exactly: pong"}]
      }
    }
  }'
```

`message/stream` streams a task, a working status, an artifact with the reply, and a completed status.

</TabItem>
</Tabs>

## Request parameters

`custom_inputs`, `context`, and `databricks_options` pass through to the agent as sent. Other OpenAI parameters such as `temperature` answer 400 unless `drop_params` is set, in which case they are dropped.

Messages are sent as text. Image, file, and audio content parts, assistant `tool_calls`, and `tool` or `function` messages answer 400 naming them. Under `drop_params` they are dropped, and a message with nothing left is left out of the request.

The agent's `custom_outputs`, when present, come back under `provider_specific_fields` on the chat message. A reply with no `usage` has its tokens counted locally.

## Related

- [Invoking A2A Agents](a2a_invoking_agents)
- [A2A Agent Authentication Headers](a2a_agent_headers)
- [Databricks model provider](/docs/providers/databricks)
