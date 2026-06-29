import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Invoking A2A Agents

Learn how to invoke A2A agents through LiteLLM using different methods.

:::tip Deploy Your Own A2A Agent

Want to test with your own agent? Deploy this template A2A agent powered by Google Gemini:

[**shin-bot-litellm/a2a-gemini-agent**](https://github.com/shin-bot-litellm/a2a-gemini-agent) - Simple deployable A2A agent with streaming support

:::

## A2A SDK

Use the [A2A Python SDK](https://pypi.org/project/a2a-sdk) (**>= 1.1.0**) to invoke agents through LiteLLM using the A2A protocol.

```bash
pip install "a2a-sdk>=1.1.0,<2.0" httpx
```

Pin `protocolVersion: "1.0"` on the agent (recommended) so responses match the 1.x SDK. For legacy `0.3` wire format, pin `"0.3"` instead — see [Protocol versioning](./a2a#protocol-versioning).

:::info Migration from a2a-sdk 0.3.x

a2a-sdk 1.x replaces `A2AClient` + dict `MessageSendParams` with `ClientFactory`, protobuf `Message` / `Part` types, and `send_message` as an async generator of stream events. See the examples below.

:::

### Non-Streaming

This example shows how to:
1. **List available agents** - Query `/v1/agents` to see which agents your key can access
2. **Select an agent** - Pick an agent from the list
3. **Invoke via A2A** - Use the A2A protocol to send messages to the agent

```python showLineNumbers title="invoke_a2a_agent.py"
import asyncio
from uuid import uuid4

import httpx
from a2a.client import A2ACardResolver, ClientConfig, ClientFactory
from a2a.types import Message, Part, Role, SendMessageRequest
from a2a.utils.constants import TransportProtocol

# === CONFIGURE THESE ===
LITELLM_BASE_URL = "http://localhost:4000"  # Your LiteLLM proxy URL
LITELLM_VIRTUAL_KEY = "sk-1234"             # Your LiteLLM Virtual Key
# =======================


def extract_text(parts) -> str:
    return "".join(getattr(p, "text", "") or "" for p in (parts or []))


def handle_event(event) -> None:
    populated = event.ListFields()
    if not populated:
        return
    field, value = populated[0]
    if field.name in ("message", "msg"):
        print(f"[message] {extract_text(value.parts)}")
    elif field.name == "task":
        print(f"[task {value.id}] {value.status.state}")


async def main():
    headers = {"Authorization": f"Bearer {LITELLM_VIRTUAL_KEY}"}

    async with httpx.AsyncClient(headers=headers, timeout=60.0) as http_client:
        # Step 1: List available agents
        response = await http_client.get(f"{LITELLM_BASE_URL}/v1/agents")
        agents = response.json()

        print("Available agents:")
        for agent in agents:
            print(f"  - {agent['agent_name']} (ID: {agent['agent_id']})")

        if not agents:
            print("No agents available for this key")
            return

        # Step 2: Select an agent and invoke it
        selected_agent = agents[0]
        agent_id = selected_agent["agent_id"]
        print(f"\nInvoking: {selected_agent['agent_name']}")

        # Step 3: Discover agent card and create a2a-sdk 1.x client
        base_url = f"{LITELLM_BASE_URL}/a2a/{agent_id}"
        resolver = A2ACardResolver(httpx_client=http_client, base_url=base_url)
        agent_card = await resolver.get_agent_card()

        config = ClientConfig(
            httpx_client=http_client,
            streaming=False,
            supported_protocol_bindings=[
                TransportProtocol.JSONRPC,
                TransportProtocol.HTTP_JSON,
            ],
        )
        client = ClientFactory(config).create(agent_card)

        msg = Message(
            message_id=uuid4().hex,
            role=Role.ROLE_USER,
            parts=[Part(text="Hello, what can you do?")],
        )
        request = SendMessageRequest(message=msg)

        async for event in client.send_message(request):
            handle_event(event)


if __name__ == "__main__":
    asyncio.run(main())
```

### Streaming

In a2a-sdk 1.x, set `streaming=True` on `ClientConfig` and iterate `send_message` — the same API handles streaming and non-streaming:

```python showLineNumbers title="invoke_a2a_agent_streaming.py"
import asyncio
from uuid import uuid4

import httpx
from a2a.client import A2ACardResolver, ClientConfig, ClientFactory
from a2a.types import Message, Part, Role, SendMessageRequest
from a2a.utils.constants import TransportProtocol

# === CONFIGURE THESE ===
LITELLM_BASE_URL = "http://localhost:4000"  # Your LiteLLM proxy URL
LITELLM_VIRTUAL_KEY = "sk-1234"             # Your LiteLLM Virtual Key
LITELLM_AGENT_NAME = "ij-local"             # Agent name registered in LiteLLM
# =======================


async def main():
    base_url = f"{LITELLM_BASE_URL}/a2a/{LITELLM_AGENT_NAME}"
    headers = {"Authorization": f"Bearer {LITELLM_VIRTUAL_KEY}"}

    async with httpx.AsyncClient(headers=headers, timeout=60.0) as http_client:
        resolver = A2ACardResolver(httpx_client=http_client, base_url=base_url)
        agent_card = await resolver.get_agent_card()

        config = ClientConfig(
            httpx_client=http_client,
            streaming=True,
            supported_protocol_bindings=[
                TransportProtocol.JSONRPC,
                TransportProtocol.HTTP_JSON,
            ],
        )
        client = ClientFactory(config).create(agent_card)

        msg = Message(
            message_id=uuid4().hex,
            role=Role.ROLE_USER,
            parts=[Part(text="Tell me a long story")],
        )
        request = SendMessageRequest(message=msg)

        async for event in client.send_message(request):
            populated = event.ListFields()
            if populated:
                field, value = populated[0]
                if field.name in ("message", "msg"):
                    text = "".join(getattr(p, "text", "") or "" for p in value.parts)
                    print(text, end="", flush=True)
        print()


if __name__ == "__main__":
    asyncio.run(main())
```

## /chat/completions API (OpenAI SDK)

You can also invoke A2A agents using the familiar OpenAI SDK by using the `a2a/` model prefix.

### Non-Streaming

<Tabs>
<TabItem value="python" label="Python" default>

```python showLineNumbers title="openai_non_streaming.py"
import openai

client = openai.OpenAI(
    api_key="sk-1234",  # Your LiteLLM Virtual Key
    base_url="http://localhost:4000"  # Your LiteLLM proxy URL
)

response = client.chat.completions.create(
    model="a2a/my-agent",  # Use a2a/ prefix with your agent name
    messages=[
        {"role": "user", "content": "Hello, what can you do?"}
    ]
)

print(response.choices[0].message.content)
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

```typescript showLineNumbers title="openai_non_streaming.ts"
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'sk-1234',  // Your LiteLLM Virtual Key
  baseURL: 'http://localhost:4000'  // Your LiteLLM proxy URL
});

const response = await client.chat.completions.create({
  model: 'a2a/my-agent',  // Use a2a/ prefix with your agent name
  messages: [
    { role: 'user', content: 'Hello, what can you do?' }
  ]
});

console.log(response.choices[0].message.content);
```

</TabItem>
<TabItem value="curl" label="cURL">

```bash showLineNumbers title="curl_non_streaming.sh"
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "a2a/my-agent",
    "messages": [
      {"role": "user", "content": "Hello, what can you do?"}
    ]
  }'
```

</TabItem>
</Tabs>

### Streaming

<Tabs>
<TabItem value="python" label="Python" default>

```python showLineNumbers title="openai_streaming.py"
import openai

client = openai.OpenAI(
    api_key="sk-1234",  # Your LiteLLM Virtual Key
    base_url="http://localhost:4000"  # Your LiteLLM proxy URL
)

stream = client.chat.completions.create(
    model="a2a/my-agent",  # Use a2a/ prefix with your agent name
    messages=[
        {"role": "user", "content": "Tell me a long story"}
    ],
    stream=True
)

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

```typescript showLineNumbers title="openai_streaming.ts"
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'sk-1234',  // Your LiteLLM Virtual Key
  baseURL: 'http://localhost:4000'  // Your LiteLLM proxy URL
});

const stream = await client.chat.completions.create({
  model: 'a2a/my-agent',  // Use a2a/ prefix with your agent name
  messages: [
    { role: 'user', content: 'Tell me a long story' }
  ],
  stream: true
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) {
    process.stdout.write(content);
  }
}
```

</TabItem>
<TabItem value="curl" label="cURL">

```bash showLineNumbers title="curl_streaming.sh"
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "a2a/my-agent",
    "messages": [
      {"role": "user", "content": "Tell me a long story"}
    ],
    "stream": true
  }'
```

</TabItem>
</Tabs>

## Task APIs (`tasks/get`, `tasks/list`, …)

Agents that return a `submitted` task from `message/send` expect clients to poll with `tasks/get`. Call the same LiteLLM base URL with JSON-RPC:

```bash showLineNumbers title="tasks_get.sh"
curl -X POST "http://localhost:4000/a2a/${AGENT_ID}" \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "req-2",
    "method": "tasks/get",
    "params": {"id": "TASK_ID_FROM_SEND_RESPONSE"}
  }'
```

LiteLLM forwards `tasks/get`, `tasks/list`, `tasks/cancel`, push-notification methods, and `agent/getAuthenticatedExtendedCard` to the upstream agent URL. See the full method list in [Supported A2A methods](./a2a_agent_card#supported-a2a-methods).

## Key Differences

| Method | Use Case | Advantages |
|--------|----------|------------|
| **A2A SDK** | Native A2A protocol integration | • Full A2A protocol support<br/>• Access to task states and artifacts<br/>• Context management |
| **OpenAI SDK** | Familiar OpenAI-style interface | • Drop-in replacement for OpenAI calls<br/>• Easier migration from LLM to agent workflows<br/>• Works with existing OpenAI tooling |

:::tip Model Prefix

When using the OpenAI SDK, always prefix your agent name with `a2a/` (e.g., `a2a/my-agent`) to route requests to the A2A agent instead of an LLM provider.

:::
