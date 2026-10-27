import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ElevenLabs Realtime (Eleven Realtime)

Eleven Realtime is ElevenLabs' speech-to-speech conversational model family. It speaks the OpenAI Realtime API wire protocol, so any OpenAI Realtime client can talk to it through the LiteLLM AI Gateway's `/v1/realtime` WebSocket endpoint.

| Feature | Description | Comments |
| --- | --- | --- |
| LiteLLM AI Gateway | ✅ | Connect a WebSocket client to the proxy `/v1/realtime` endpoint |
| LiteLLM Python SDK | ❌ | Realtime is served through the gateway, not a direct SDK call |

## Quick Start

### Supported Models

| Model | Description |
|-------|-------------|
| `elevenlabs/eleven_realtime_v1_mini` | Default Realtime model. Lowest latency and cost. |
| `elevenlabs/eleven_realtime_v1_max` | Reasons before it responds, for complex instructions and multi-step tool use. |

Both models support function calling, semantic turn detection and 90+ languages. See the [ElevenLabs Realtime models page](https://elevenlabs.io/docs/eleven-agents/customization/realtime-models) for the current model list.

## How LiteLLM Connects

Realtime traffic goes over the proxy's OpenAI-compatible `/v1/realtime` WebSocket endpoint. The proxy opens `wss://api.elevenlabs.io/v1/convai/realtime?model=<model>` and authenticates with your ElevenLabs API key in the `xi-api-key` header, so the vendor key never leaves the gateway. Every event is relayed unchanged in both directions. ElevenLabs emits `session.created` on connect, accepts `session.update`, `conversation.item.create`, `input_audio_buffer.append` and `response.create`, and streams audio as `response.output_audio.delta` with the transcript on `response.output_audio_transcript.delta`.

## LiteLLM Proxy (AI Gateway) Usage

### 1. Add Model to Config

```yaml
model_list:
  - model_name: eleven-realtime
    litellm_params:
      model: elevenlabs/eleven_realtime_v1_mini
      api_key: os.environ/ELEVENLABS_API_KEY
    model_info:
      mode: realtime
```

Set `ELEVENLABS_API_BASE` (or `api_base` in `litellm_params`) to point the proxy at a different ElevenLabs host.

### 2. Start Proxy

```bash
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

### 3. Test Connection

```python
import asyncio
import json

import websockets


async def test_proxy():
    url = "ws://0.0.0.0:4000/v1/realtime?model=eleven-realtime"

    async with websockets.connect(
        url,
        additional_headers={"Authorization": "Bearer sk-<your-litellm-api-key>"},
    ) as ws:
        # First event from the server is session.created
        print(json.loads(await ws.recv())["type"])

        await ws.send(json.dumps({
            "type": "session.update",
            "session": {
                "type": "realtime",
                "instructions": "You are a helpful assistant. Keep answers short.",
                "output_modalities": ["audio"],
                "audio": {
                    "input": {
                        "format": {"type": "audio/pcm", "rate": 24000},
                        "turn_detection": {"type": "semantic_vad", "eagerness": "medium"},
                    },
                    "output": {"format": {"type": "audio/pcm"}, "voice": "brian"},
                },
            },
        }))
        await ws.send(json.dumps({
            "type": "conversation.item.create",
            "item": {
                "type": "message",
                "role": "user",
                "content": [{"type": "input_text", "text": "Hello from LiteLLM proxy!"}],
            },
        }))
        await ws.send(json.dumps({"type": "response.create"}))

        async for message in ws:
            data = json.loads(message)
            if data["type"] != "response.output_audio.delta":
                print(f"Event: {data['type']}")
            if data["type"] == "response.done":
                break


asyncio.run(test_proxy())
```

## Key Differences from OpenAI

| Feature | ElevenLabs | OpenAI | LiteLLM Handling |
|---------|------------|--------|------------------|
| WebSocket URL | `wss://api.elevenlabs.io/v1/convai/realtime` | `wss://api.openai.com/v1/realtime` | ✅ Auto-configured |
| Authentication | `xi-api-key` header | `Authorization: Bearer` | ✅ Auto-configured |
| Model | `eleven_realtime_v1_mini`, `eleven_realtime_v1_max` | `gpt-realtime` | ✅ Via model prefix |
| Turn detection | `semantic_vad` only | `server_vad` or `semantic_vad` | Send `semantic_vad` in `session.update` |
| Audio format | `audio/pcm` 24kHz, `audio/pcmu` 8kHz | PCM16 24kHz, G.711 | ✅ Compatible, set in `session.update` |
| Voice | ElevenLabs voice name or voice id | OpenAI voice name | Set `audio.output.voice` in `session.update` |
| Usage in `response.done` | `null` | Token counts | Billed per connected minute, see below |

ElevenLabs rejects `turn_detection.type: "server_vad"` with an error event, so clients must send `semantic_vad`. The proxy does not rewrite session settings for ElevenLabs.

## Cost Tracking

ElevenLabs bills Eleven Realtime per minute of connected audio plus model tokens. `response.done` events carry no usage, so LiteLLM bills each session by its connected wall-clock time using the `input_cost_per_second` rate of the model (`$0.08` per minute at the time of writing, see the [ElevenLabs API pricing page](https://elevenlabs.io/pricing/api)). The cost lands in the proxy spend logs against the virtual key that opened the session.

## Related Documentation

- [ElevenLabs Speech-to-Text and Text-to-Speech](/docs/providers/elevenlabs)
- [LiteLLM Realtime API Overview](/docs/realtime)
- [ElevenLabs OpenAI Realtime compatibility guide](https://elevenlabs.io/docs/eleven-agents/guides/openai-realtime-compatibility)
