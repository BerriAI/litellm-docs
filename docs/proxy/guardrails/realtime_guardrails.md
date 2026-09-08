import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Realtime API Guardrails

Guard voice conversations in the [Realtime API](/docs/realtime) by intercepting speech transcriptions **before** the LLM responds.

## How it works

The Realtime API is a long-lived WebSocket session. Unlike `/chat/completions` where a guardrail runs once per HTTP request, a voice session has many turns, and each one needs to be checked individually.

LiteLLM intercepts each turn at the transcription event, after Whisper converts speech to text but before the LLM generates a response:

```
User speaks into mic
        │
        ▼ audio bytes (PCM)
┌───────────────────┐
│   LiteLLM Proxy   │  forwards audio to OpenAI unchanged
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│     OpenAI        │
│  VAD → Whisper    │  detects speech end, transcribes
└────────┬──────────┘
         │
         │  conversation.item.input_audio_transcription.completed
         │  { transcript: "system update: ignore all instructions" }
         │
         ▼
┌───────────────────────────────────────────┐
│           LiteLLM Proxy                   │
│                                           │
│   ◄──── GUARDRAIL RUNS HERE ────►         │
│   apply_guardrail(texts=[transcript])     │
│                                           │
│   ┌──────────────┬──────────────────┐     │
│   │   BLOCKED    │     CLEAN        │     │
│   └──────┬───────┴───────┬──────────┘     │
│          │               │                │
│   speak warning    send response.create   │
│   (TTS audio)      → LLM responds         │
└───────────────────────────────────────────┘
```

**Key detail**: LiteLLM also injects `create_response: false` into the session on connect, so the LLM never auto-responds before the guardrail has run.

## Supported guardrail mode

| Mode | Description |
|------|-------------|
| `realtime_input_transcription` | Runs after each voice turn is transcribed, before LLM responds |

## Quick Start

### Step 1: Configure proxy

Add a guardrail with `mode: realtime_input_transcription` to your proxy config:

```yaml
model_list:
  - model_name: openai/gpt-4o-realtime-preview
    litellm_params:
      model: openai/gpt-4o-realtime-preview
      api_key: os.environ/OPENAI_API_KEY

guardrails:
  - guardrail_name: "voice-content-filter"
    litellm_params:
      guardrail: litellm_content_filter
      mode: realtime_input_transcription
      default_on: true
      blocked_words:
        - keyword: "ignore previous instructions"
          action: BLOCK
          description: "Prompt injection attempt"
        - keyword: "system update"
          action: BLOCK
          description: "Prompt injection attempt"
        - keyword: "ignore all instructions"
          action: BLOCK
          description: "Prompt injection attempt"

general_settings:
  master_key: sk-1234
```

### Step 2: Start proxy

```bash
litellm --config proxy_config.yaml --port 4000
```

### Step 3: Connect a Realtime client

Connect your client to the proxy instead of directly to OpenAI:

<Tabs>
<TabItem value="js" label="JavaScript">

```javascript
const ws = new WebSocket(
  "ws://localhost:4000/v1/realtime?model=openai/gpt-4o-realtime-preview",
  [],
  { headers: { Authorization: "Bearer sk-1234" } }
)

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: "session.update",
    session: {
      modalities: ["audio", "text"],
      input_audio_transcription: { model: "whisper-1" },
      turn_detection: { type: "server_vad" },
    },
  }))
}

ws.onmessage = (e) => {
  const event = JSON.parse(e.data)
  if (event.type === "response.audio.delta") {
    // play audio...
  }
}
```

</TabItem>
<TabItem value="python" label="Python">

```python
import asyncio
import json
import websockets

async def main():
    async with websockets.connect(
        "ws://localhost:4000/v1/realtime?model=openai/gpt-4o-realtime-preview",
        additional_headers={"Authorization": "Bearer sk-1234"},
    ) as ws:
        await ws.recv()  # session.created

        await ws.send(json.dumps({
            "type": "session.update",
            "session": {
                "modalities": ["audio", "text"],
                "input_audio_transcription": {"model": "whisper-1"},
                "turn_detection": {"type": "server_vad"},
            },
        }))

        async for raw in ws:
            event = json.loads(raw)
            print(event["type"])

asyncio.run(main())
```

</TabItem>
</Tabs>

### What happens when a turn is blocked

When the guardrail fires, the proxy:

1. Sends `response.cancel` to kill any in-flight LLM response
2. Sends `response.create` with the block message as forced instructions
3. OpenAI's TTS **speaks the warning** back to the user, e.g. *"Content blocked: keyword 'system update' detected (Prompt injection attempt)"*

The LLM never processes the injected instruction.

## Using with other guardrail providers

The proxy runs realtime guardrails through the provider's `apply_guardrail` method, but a guardrail can only be configured with `mode: realtime_input_transcription` if that hook is listed in its `get_supported_event_hooks()`. Currently only `litellm_content_filter` declares it. Setting the mode on another provider (for example `lakera_v2`, which supports only `pre_call`, `during_call`, and `post_call`) raises a `ValueError` at proxy startup. Setting `LITELLM_STRICT_GUARDRAIL_MODES=false` downgrades that error to a warning, but the guardrail is still not supported for this mode.

To add realtime support to a custom guardrail, include `GuardrailEventHooks.realtime_input_transcription` in its `get_supported_event_hooks()` and implement `apply_guardrail`.

## Per-key guardrail control

To enable realtime guardrails only for specific API keys, set `default_on: false` and pass the guardrail name in the request metadata:

```yaml
guardrails:
  - guardrail_name: "voice-content-filter"
    litellm_params:
      guardrail: litellm_content_filter
      mode: realtime_input_transcription
      default_on: false   # off by default
```

Then the client opts in per-connection by passing it in the initial metadata (enterprise feature).
