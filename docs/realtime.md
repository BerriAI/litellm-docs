import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# /realtime

Use this to loadbalance across Azure + OpenAI + xAI and more. 

Supported Providers:
- OpenAI
- Azure
- xAI ([see full docs](/docs/providers/xai_realtime))
- Google AI Studio (Gemini)
- Vertex AI
- Vertex AI Chirp, transcription only ([see full docs](/docs/providers/vertex_transcription#chirp-realtime-transcription))
- Bedrock
- Meta Muse Voice, transcription only ([see full docs](/docs/providers/meta#muse-voice-realtime-transcription))
- OpenAI Live models such as `gpt-live-1`, on their own `/v1/live/sessions` route ([see full docs](/docs/live_sessions))
- Live transcription with `gpt-live-transcribe` on OpenAI and Azure ([see below](#live-transcription-with-gpt-live-transcribe))
- Live speech translation with `gpt-realtime-translate` on OpenAI and Azure, on its own `/v1/realtime/translations` route ([see full docs](/docs/realtime_translation))

## Proxy Usage

### Add model to config 


<Tabs>
<TabItem value="openai" label="OpenAI">

```yaml
model_list:
  - model_name: openai-gpt-realtime
    litellm_params:
      model: openai/gpt-realtime-2.1
      api_key: os.environ/OPENAI_API_KEY
    model_info:
      mode: realtime
```
</TabItem>
<TabItem value="openai+azure" label="OpenAI + Azure">

```yaml
model_list:
  - model_name: azure-gpt-realtime
    litellm_params:
      model: azure/gpt-realtime-2.1
      api_key: os.environ/AZURE_API_KEY
      api_base: os.environ/AZURE_API_BASE
    model_info:
      mode: realtime

  - model_name: openai-gpt-realtime
    litellm_params:
      model: openai/gpt-realtime-2.1
      api_key: os.environ/OPENAI_API_KEY
```

</TabItem>
<TabItem value="xai" label="xAI Grok Voice Agent">

```yaml
model_list:
  - model_name: grok-voice-agent
    litellm_params:
      model: xai/grok-voice-latest
      api_key: os.environ/XAI_API_KEY
    model_info:
      mode: realtime
```

**[See full xAI Realtime documentation →](/docs/providers/xai_realtime)**

</TabItem>
</Tabs>

### Start proxy 

```bash
litellm --config /path/to/config.yaml 

# RUNNING on http://0.0.0.0:4000
```

### Test 

Run this script using node - `node test.js`

```js
// test.js
const WebSocket = require("ws");

const url = "ws://0.0.0.0:4000/v1/realtime?model=openai-gpt-realtime";
// const url = "wss://my-azure-endpoint.openai.azure.com/openai/v1/realtime?model=gpt-realtime-2.1";
const ws = new WebSocket(url, {
    headers: {
        "api-key": `sk-<your-litellm-api-key>`,
    },
});

ws.on("open", function open() {
    console.log("Connected to server.");
    ws.send(JSON.stringify({
        type: "response.create",
        response: {
            output_modalities: ["text"],
            instructions: "Please assist the user.",
        }
    }));
});

ws.on("message", function incoming(message) {
    console.log(JSON.parse(message.toString()));
});

ws.on("error", function handleError(error) {
    console.error("Error: ", error);
});
```

## OpenAI Live sessions (`gpt-live-1`)

GPT-Live models such as `gpt-live-1` do not run on `/v1/realtime`. They have their own route, `/v1/live/sessions`, and their own page. See [GPT-Live](/docs/live_sessions).

## Live transcription with `gpt-live-transcribe`

`gpt-live-transcribe` turns a stream of audio into text as it arrives. It runs on the Realtime route as a transcription session, on OpenAI and on Azure. It is not a GPT-Live model, so it does not use `/v1/live/sessions`.

```yaml
model_list:
  - model_name: gpt-live-transcribe
    litellm_params:
      model: openai/gpt-live-transcribe
      api_key: os.environ/OPENAI_API_KEY
  - model_name: azure-live-transcribe
    litellm_params:
      model: azure/gpt-live-transcribe
      api_key: os.environ/AZURE_API_KEY
      api_base: os.environ/AZURE_API_BASE
```

Connect to `/v1/realtime` with `intent=transcription` in the query string. Without it LiteLLM opens a conversation session, and the provider rejects the handshake for a transcription model.

```python
import asyncio
import base64
import json
import os

import websockets

URL = "ws://0.0.0.0:4000/v1/realtime?model=gpt-live-transcribe&intent=transcription"


async def main() -> None:
    headers = {"Authorization": f"Bearer {os.environ['LITELLM_API_KEY']}"}
    async with websockets.connect(URL, additional_headers=headers) as ws:
        await ws.send(
            json.dumps(
                {
                    "type": "session.update",
                    "session": {
                        "type": "transcription",
                        "audio": {
                            "input": {
                                "format": {"type": "audio/pcm", "rate": 24000},
                                "transcription": {"model": "gpt-live-transcribe"},
                            }
                        },
                    },
                }
            )
        )
        with open("speech.pcm", "rb") as f:
            pcm = f.read()
        for start in range(0, len(pcm), 4800):
            chunk = base64.b64encode(pcm[start : start + 4800]).decode()
            await ws.send(json.dumps({"type": "input_audio_buffer.append", "audio": chunk}))
        await ws.send(json.dumps({"type": "input_audio_buffer.commit"}))

        async for message in ws:
            event = json.loads(message)
            if event["type"] == "conversation.item.input_audio_transcription.delta":
                print(event["delta"], end="", flush=True)
            if event["type"] in ("conversation.item.input_audio_transcription.completed", "error"):
                break


asyncio.run(main())
```

`speech.pcm` is 16-bit mono PCM at 24 kHz. The text arrives in `conversation.item.input_audio_transcription.delta` events, and the `completed` event carries the full transcript.

For a browser, create a short-lived token with `POST /v1/realtime/client_secrets` and a `session.type` of `transcription`, then follow the [WebRTC guide](/docs/proxy/realtime_webrtc). `gpt-live-transcribe` does not work on `/v1/audio/transcriptions`, which is for file uploads to models such as `gpt-4o-transcribe`.

## Azure: GA vs beta realtime protocol

Azure exposes two realtime upstreams. The GA endpoint (`/openai/v1/realtime?model=<deployment>`) speaks the GA event schema (`session.type`, `output_modalities`, nested `audio`), and the older beta endpoint (`/openai/realtime?api-version=2024-10-01-preview&deployment=<deployment>`) speaks the beta schema (`modalities`, `voice`, flat audio formats). Sending a GA-shaped `session.update` to the beta endpoint fails with `Unknown parameter: 'session.type'`

LiteLLM picks the upstream from the client connection. A client that sends the `OpenAI-Beta: realtime=v1` header (the openai SDK's `client.beta.realtime.connect`) is bridged to the beta endpoint. A client without that header (the openai SDK's `client.realtime.connect`, and most voice agent frameworks) is bridged to the GA endpoint. Transcription sessions (`intent=transcription`) always use GA

<SinceVersion v="1.110.0" /> Models that Azure serves only on GA, such as `gpt-realtime-2.1`, use GA too, and LiteLLM bridges a beta client's events to the GA endpoint. LiteLLM recognizes these models by the deployment name in `model`, or by `base_model` when the deployment has a custom name. A deployment like `azure/my-realtime-prod` that runs `gpt-realtime-2.1` needs `base_model: azure/gpt-realtime-2.1` or `realtime_protocol: GA` in its `litellm_params`. Without either, LiteLLM sends a beta client to the beta endpoint, and Azure closes the session with `realtime_beta_access_required`

```python
import os

from openai import AsyncOpenAI

client = AsyncOpenAI(base_url="http://0.0.0.0:4000", api_key=os.environ["LITELLM_API_KEY"])

async with client.realtime.connect(model="azure-gpt-realtime") as connection:
    await connection.session.update(
        session={"type": "realtime", "output_modalities": ["audio"], "instructions": "Please assist the user."}
    )
    async for event in connection:
        print(event.type)
        if event.type == "session.updated":
            break
```

To pin one protocol regardless of what the client sends, set `realtime_protocol` on the deployment or `LITELLM_AZURE_REALTIME_PROTOCOL` in the proxy's environment. The deployment setting wins over the environment variable, and both win over the client header. The realtime health check (`/health` on a `mode: realtime` deployment, and the Admin UI's Test Connect) has no client header to read, so it probes the GA endpoint unless one of those pins the protocol

```yaml
model_list:
  - model_name: azure-gpt-realtime
    litellm_params:
      model: azure/gpt-realtime-2.1
      api_key: os.environ/AZURE_API_KEY
      api_base: os.environ/AZURE_API_BASE
      realtime_protocol: GA
```

```bash
export LITELLM_AZURE_REALTIME_PROTOCOL=GA
```

`beta` is the other value. Azure closes a `gpt-realtime-2.1` session on the beta endpoint with `realtime_beta_access_required`, so don't pin `beta` for it.

## Guardrails

You can apply [LiteLLM guardrails](https://docs.litellm.ai/docs/proxy/guardrails/quick_start) to realtime sessions.

### Set guardrails on a key or team

The easiest production setup: attach guardrails to a virtual key or team so they always apply automatically, without any client-side changes.

See [Virtual Keys → Guardrails](https://docs.litellm.ai/docs/proxy/virtual_keys#guardrails) and [Teams → Guardrails](https://docs.litellm.ai/docs/proxy/team_budgets).

### Pass guardrails dynamically (easy testing)

Pass `guardrails` as a query param when opening the WebSocket.
Useful for testing guardrails without modifying key/team config.

```js
// node test.js
const WebSocket = require("ws");

const guardrails = ["your-guardrail-name"]; // comma-separated list
const url = `ws://0.0.0.0:4000/v1/realtime?model=openai-gpt-realtime&guardrails=${guardrails.join(",")}`;

const ws = new WebSocket(url, {
    headers: {
        "Authorization": "Bearer sk-<your-litellm-api-key>",
    },
});

ws.on("open", function open() {
    console.log("Connected — guardrails active:", guardrails);
});

ws.on("message", function incoming(message) {
    const data = JSON.parse(message);
    if (data.type === "error") {
        // Guardrail block is sent as an error event before the connection closes
        console.error("Guardrail error:", data.error.message);
    }
});

ws.on("close", function close(code, reason) {
    console.log("Closed:", code, reason.toString());
    // code 1011 = blocked by guardrail at pre_call
});
```

Or with Python:

```python
import asyncio
import websockets

async def main():
    url = "ws://0.0.0.0:4000/v1/realtime?model=openai-gpt-realtime&guardrails=your-guardrail-name"
    async with websockets.connect(
        url,
        additional_headers={"Authorization": "Bearer sk-<your-litellm-api-key>"},
    ) as ws:
        print("Connected — guardrail active")
        async for msg in ws:
            import json
            data = json.loads(msg)
            if data["type"] == "error":
                print("Guardrail blocked:", data["error"]["message"])
                break

asyncio.run(main())
```

When a guardrail blocks the request, the proxy sends an `error` event over the WebSocket and then closes the connection:

```json
{
    "type": "error",
    "error": {
        "type": "guardrail_error",
        "message": "Guardrail blocked this request: <reason>"
    }
}
```

## Logging

To prevent requests from being dropped, by default LiteLLM just logs these event types:

- `session.created`
- `response.create`
- `response.done`

You can override this by setting the `logged_real_time_event_types` parameter in the config. For example:

```yaml
litellm_settings:
  logged_real_time_event_types: "*" # Log all events
  ## OR ## 
  logged_real_time_event_types: ["session.created", "response.create", "response.done"] # Log only these event types
```
