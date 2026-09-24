import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ThunderPhone Voice Agents (Realtime API)

[ThunderPhone](https://thunderphone.com) runs AI phone agents (speech recognition, language model, voice, turn-taking, 47 languages and tool calling on one stack) behind a realtime WebSocket that speaks the OpenAI Realtime API protocol. LiteLLM forwards `/v1/realtime` sessions to it, so any OpenAI Realtime client can talk to a ThunderPhone agent through the gateway.

| Feature | Description | Comments |
| --- | --- | --- |
| LiteLLM AI Gateway | ✅ | Connect a WebSocket client to the proxy `/v1/realtime` endpoint |
| LiteLLM Python SDK | ❌ | Realtime is served through the gateway, not a direct SDK call |

## Quick Start

### Supported Models

| Model | Description |
|-------|-------------|
| `openai/thunderphone-realtime` | The realtime endpoint. The agent's engine and voice are chosen in `session.update`, not by model name. |

ThunderPhone's endpoint is OpenAI Realtime compatible, so it is configured as an `openai/` model with a custom `api_base`. A session is one phone-agent call: the first `session.update` starts it, and ThunderPhone closes the socket when the call ends.

## How LiteLLM Connects

LiteLLM forwards the session to `wss://api.thunderphone.com/v1/realtime` with your ThunderPhone secret key (`sk_live_...`) as the bearer token. The proxy forwards the `model` query parameter only, so configure the agent through `session.update` (an *inline session*): `instructions`, `tools`, `voice`, and ThunderPhone's `config` block. Running a saved ThunderPhone agent needs the `agent_id` query parameter, which the gateway does not pass through; connect to ThunderPhone directly for that.

## LiteLLM Proxy (AI Gateway) Usage

### 1. Add Model to Config

```yaml
model_list:
  - model_name: thunderphone
    litellm_params:
      model: openai/thunderphone-realtime
      api_base: https://api.thunderphone.com
      api_key: os.environ/THUNDERPHONE_API_KEY
    model_info:
      mode: realtime
```

### 2. Start Proxy

```bash
export THUNDERPHONE_API_KEY=sk_live_...
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

### 3. Test Connection

#### Python Client

```python
import asyncio
import base64
import json
import websockets

async def test_proxy():
    url = "ws://0.0.0.0:4000/v1/realtime?model=thunderphone"

    async with websockets.connect(
        url,
        additional_headers={"Authorization": "Bearer sk-1234"},  # Your LiteLLM proxy key
    ) as ws:
        # First event from the server is session.created
        print(f"Connected: {await ws.recv()}")

        # The first session.update starts the call and fixes instructions,
        # tools and voice for its duration. Send everything at once.
        await ws.send(json.dumps({
            "type": "session.update",
            "session": {
                "type": "realtime",
                "instructions": "You are Acme Dental's receptionist. Be brief.",
                "audio": {
                    "input": {"format": {"type": "audio/pcm", "rate": 24000}},
                    "output": {"format": {"type": "audio/pcm", "rate": 24000}, "voice": "olivia"},
                },
                "tools": [{
                    "type": "function",
                    "name": "check_availability",
                    "description": "Free appointment slots on a date",
                    "parameters": {
                        "type": "object",
                        "properties": {"date": {"type": "string"}},
                        "required": ["date"],
                    },
                }],
                # Opt in to ThunderPhone's call.* events (hang-up reason, transfer, keypad)
                "config": {"call_events": True},
            },
        }))

        # Ask the agent to speak first, then stream caller audio with
        # input_audio_buffer.append (base64 pcm16, mono, 24 kHz).
        await ws.send(json.dumps({"type": "response.create"}))

        async for message in ws:
            data = json.loads(message)
            print(f"Event: {data['type']}")

            if data["type"] == "response.output_audio.delta":
                pcm = base64.b64decode(data["delta"])  # play or buffer the agent's voice
            elif data["type"] == "response.function_call_arguments.done":
                await ws.send(json.dumps({
                    "type": "conversation.item.create",
                    "item": {
                        "type": "function_call_output",
                        "call_id": data["call_id"],
                        "output": json.dumps({"slots": ["9:00 AM", "10:30 AM"]}),
                    },
                }))
            elif data["type"] == "call.ended":
                print(f"Call ended: {data.get('reason')}")
                break

asyncio.run(test_proxy())
```

#### Node.js Client

```javascript
// test.js - Run with: node test.js
const WebSocket = require("ws");

const url = "ws://0.0.0.0:4000/v1/realtime?model=thunderphone";

const ws = new WebSocket(url, {
  headers: { Authorization: "Bearer sk-1234" }, // Your LiteLLM proxy key
});

ws.on("open", () => {
  ws.send(JSON.stringify({
    type: "session.update",
    session: {
      type: "realtime",
      instructions: "You are Acme Dental's receptionist. Be brief.",
      audio: {
        input: { format: { type: "audio/pcm", rate: 24000 } },
        output: { format: { type: "audio/pcm", rate: 24000 }, voice: "olivia" },
      },
      config: { call_events: true },
    },
  }));
  ws.send(JSON.stringify({ type: "response.create" }));
});

ws.on("message", (raw) => {
  const data = JSON.parse(raw.toString());
  console.log("Event:", data.type);
  if (data.type === "call.ended") ws.close();
});
```

## Notes

- **A socket is a call.** Every session appears in ThunderPhone's call history with a recording and transcript, and is billed per minute. When the agent or caller hangs up, ThunderPhone sends `call.ended` (with `config.call_events`) and closes the socket normally. Do not reconnect automatically: a reconnect starts a new call.
- **Turn detection is server-side and always on.** Client VAD settings and manual commits are accepted but do not change who takes the turn.
- **Instructions, tools and voice are fixed once the call starts.** A later `session.update` that changes them gets a non-fatal `error` event; the call continues.
- **Audio** is 16-bit mono PCM at 24 kHz (16 kHz also supported) in both directions; G.711 μ-law/A-law at 8 kHz is available for telephony bridges.
- Full protocol reference: [ThunderPhone Realtime API](https://thunderphone.com/docs/api-reference/realtime).
