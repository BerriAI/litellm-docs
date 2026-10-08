# Vertex AI Gemini Live - Realtime API

Use Vertex AI's Gemini Live API (BidiGenerateContent) through LiteLLM's unified `/realtime` endpoint, which speaks the OpenAI Realtime protocol.

| Feature | Supported |
|---------|-----------|
| Proxy (`/realtime`) | ✅ |
| Voice in / Voice out | ✅ |
| Text in / Text out | ✅ |
| Server VAD | ✅ |
| Output transcription | ✅ |

## Setup

### 1. Auth

LiteLLM uses your Google Cloud credentials (OAuth2 Bearer token), not an API key.

```bash
gcloud auth application-default login
```

Or set a service-account key file:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa-key.json
```

### 2. Proxy config

```yaml
model_list:
  - model_name: vertex-gemini-live
    litellm_params:
      model: vertex_ai/gemini-2.0-flash-live-001
      vertex_project: your-gcp-project-id
      vertex_location: us-east4   # or any supported region, or "global"

general_settings:
  master_key: sk-your-key
```

### 3. Start the proxy

```bash
litellm --config config.yaml --port 4000
```

## Usage

### Python (websockets)

```python
import asyncio
import json
import websockets

PROXY_URL = "ws://localhost:4000/realtime?model=vertex-gemini-live"
API_KEY = "sk-your-key"

async def main():
    async with websockets.connect(
        PROXY_URL,
        additional_headers={"api-key": API_KEY},
    ) as ws:
        # Wait for session.created
        event = json.loads(await ws.recv())
        print(f"session.created: {event['session']['id']}")

        # Send a text message
        await ws.send(json.dumps({
            "type": "conversation.item.create",
            "item": {
                "type": "message",
                "role": "user",
                "content": [{"type": "input_text", "text": "Say hello in one sentence."}],
            },
        }))

        # Collect the response
        async for raw in ws:
            ev = json.loads(raw)
            t = ev.get("type", "")
            if t == "response.text.delta":
                print(ev.get("delta", ""), end="", flush=True)
            elif t == "response.done":
                print("\n[done]")
                break

asyncio.run(main())
```

### Node.js

```js
const WebSocket = require("ws");

const ws = new WebSocket(
  "ws://localhost:4000/realtime?model=vertex-gemini-live",
  { headers: { "api-key": "sk-your-key" } }
);

ws.on("open", () => {
  ws.send(JSON.stringify({
    type: "conversation.item.create",
    item: {
      type: "message",
      role: "user",
      content: [{ type: "input_text", text: "Say hello." }],
    },
  }));
});

ws.on("message", (data) => {
  const ev = JSON.parse(data);
  if (ev.type === "response.text.delta") process.stdout.write(ev.delta);
  if (ev.type === "response.done") ws.close();
});
```

### OpenAI SDK (Python)

```python
import asyncio
from openai import AsyncOpenAI

client = AsyncOpenAI(
    base_url="http://localhost:4000",
    api_key="sk-your-key",
)

async def main():
    async with client.beta.realtime.connect(
        model="vertex-gemini-live"
    ) as conn:
        await conn.session.update(session={"modalities": ["text"]})

        await conn.conversation.item.create(
            item={
                "type": "message",
                "role": "user",
                "content": [{"type": "input_text", "text": "Say hello."}],
            }
        )

        async for event in conn:
            if event.type == "response.text.delta":
                print(event.delta, end="", flush=True)
            elif event.type == "response.done":
                print()
                break

asyncio.run(main())
```

## Voice in / Voice out

For a complete voice example see [`voice_realtime_test.py`](https://github.com/BerriAI/litellm/blob/main/voice_realtime_test.py).

Key settings for audio:
- Microphone input: **16 kHz** PCM16 (`audio/pcm;rate=16000`)
- Speaker output: **24 kHz** PCM16 (Vertex AI returns audio at 24 kHz)
- Server VAD is enabled by default with 800 ms silence threshold

```python
# session.update with server VAD — the proxy ignores this for Vertex AI
# because VAD is already configured in the initial setup message.
await ws.send(json.dumps({
    "type": "session.update",
    "session": {
        "modalities": ["audio"],
        "turn_detection": {"type": "server_vad", "silence_duration_ms": 800},
    },
}))
```

## Tool Calling

```python
import asyncio
import json
import websockets

PROXY_URL = "ws://localhost:4000/v1/realtime?model=vertex-gemini-live"

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get the current weather for a location.",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string"},
                    "unit": {"type": "string", "enum": ["fahrenheit", "celsius"]},
                },
                "required": ["location"],
            },
        },
    }
]


def get_weather(location: str, unit: str = "fahrenheit") -> dict:
    return {
        "location": location,
        "temperature": 72 if unit == "fahrenheit" else 22,
        "unit": unit,
        "conditions": "sunny",
    }


TOOL_FUNCTIONS = {"get_weather": get_weather}


async def main():
    async with websockets.connect(
        PROXY_URL,
        additional_headers={
            "Authorization": "Bearer sk-<your-litellm-api-key>",
            "X-Serverless-Authorization": "Bearer sk-<your-litellm-api-key>",
        },
    ) as ws:
        _ = json.loads(await ws.recv())  # session.created

        # Required for tool calling: send tools in session.update
        await ws.send(
            json.dumps(
                {
                    "type": "session.update",
                    "session": {
                        "instructions": "Use get_weather for weather questions.",
                        "modalities": ["audio"],
                        "tools": TOOLS,
                    },
                }
            )
        )

        await ws.send(
            json.dumps(
                {
                    "type": "conversation.item.create",
                    "item": {
                        "type": "message",
                        "role": "user",
                        "content": [
                            {"type": "input_text", "text": "What's the weather in San Francisco?"}
                        ],
                    },
                }
            )
        )
        await ws.send(json.dumps({"type": "response.create"}))

        async for raw in ws:
            ev = json.loads(raw)
            t = ev.get("type", "")

            if t == "response.text.delta":
                print(ev.get("delta", ""), end="", flush=True)
            elif t == "response.function_call_arguments.done":
                fn_name = ev.get("name", "")
                call_id = ev.get("call_id", "")
                args = json.loads(ev.get("arguments", "{}"))
                result = TOOL_FUNCTIONS[fn_name](**args)

                await ws.send(
                    json.dumps(
                        {
                            "type": "conversation.item.create",
                            "item": {
                                "type": "function_call_output",
                                "call_id": call_id,
                                "output": json.dumps(result),
                            },
                        }
                    )
                )
                await ws.send(json.dumps({"type": "response.create"}))
            elif t == "response.done":
                print("\n[done]")
                break
            elif t == "error":
                print(ev)
                break


if __name__ == "__main__":
    asyncio.run(main())
```

### Config + run

```yaml
model_list:
  - model_name: vertex-gemini-live
    litellm_params:
      model: vertex_ai/gemini-live-2.5-flash-native-audio
      vertex_project: your-gcp-project-id
      vertex_location: us-central1

litellm_settings:
  # Required for tool calling with Gemini/Vertex Live:
  # defer setup until client sends session.update (with tools)
  gemini_live_defer_setup: true
```

```bash
litellm --config config.yaml --port 4000
python test_realtime_tool_calling.py
```

## Session Configuration (`instructions`, `voice`, `turn_detection`)

Vertex AI Live accepts exactly one `setup` message per connection, and a second one closes the socket with a 1007 error. By default LiteLLM sends that setup itself as soon as the client connects, using its own defaults. Every `session.update` your client sends after `session.created` is then dropped, so `instructions`, `voice`, `turn_detection` and `tools` never reach the model, even though the client still receives `session.updated`

To configure the session from the client, set `gemini_live_defer_setup: true` under `litellm_settings` (or the `LITELLM_GEMINI_LIVE_DEFER_SETUP=true` environment variable). LiteLLM then waits for the client's first `session.update` and builds the Vertex AI setup from it: `instructions` becomes `systemInstruction`, `voice` becomes the speech config, `turn_detection` maps to `realtimeInputConfig.automaticActivityDetection`, and `tools` become function declarations. Send everything in that first `session.update`, since any later one is still dropped

```yaml
litellm_settings:
  gemini_live_defer_setup: true
```

```python
await ws.send(json.dumps({
    "type": "session.update",
    "session": {
        "instructions": "You are a helpful assistant. Reply only in Hindi.",
        "voice": "Aoede",
    },
}))
```

`gemini_live_defer_setup` is a proxy-wide setting. If you connect to a shared proxy, ask whoever runs it to enable it

## Supported OpenAI Realtime Events

**Client → Proxy (→ Vertex AI)**

| OpenAI event | Notes |
|---|---|
| `input_audio_buffer.append` | Forwarded as `realtime_input.audio` |
| `conversation.item.create` | Forwarded as `realtime_input.text` |
| `session.update` | With `gemini_live_defer_setup: true`, the first one is sent as the Vertex AI `setup`. Otherwise, and for every later one, it is dropped. See [Session Configuration](#session-configuration-instructions-voice-turn_detection) |
| `response.create` | Silently ignored — Vertex AI responds automatically after each turn |

**Vertex AI → Proxy (→ Client)**

| OpenAI event emitted | Vertex AI source |
|---|---|
| `session.created` | Synthesized after `setupComplete` |
| `response.text.delta` | `serverContent.modelTurn.parts[].text` |
| `response.audio.delta` | `serverContent.modelTurn.parts[].inlineData` |
| `response.audio_transcript.delta` | `serverContent.outputTranscription.text` |
| `conversation.item.input_audio_transcription.completed` | `serverContent.inputTranscription.text` |
| `response.done` | `serverContent.turnComplete` |

## Limitations

- Only the first `session.update` is used, and only when `gemini_live_defer_setup` is enabled (Vertex AI accepts one setup message per connection). The session cannot be reconfigured after setup.
- Audio transcription requires `outputAudioTranscription: {}` to be set in the initial setup (done automatically by LiteLLM).

## Precaution

- Tool calling depends on `session.update` with `tools`.
- If you skip `session.update`, tool calls will not be triggered.
- `gemini_live_defer_setup` defaults to `false` for backward compatibility.
