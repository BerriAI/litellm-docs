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
- OpenAI Live models such as `gpt-live-1`, on their own `/v1/live/sessions` route ([see below](#openai-live-sessions-gpt-live-1))

## Proxy Usage

### Add model to config 


<Tabs>
<TabItem value="openai" label="OpenAI">

```yaml
model_list:
  - model_name: openai-gpt-4o-realtime-audio
    litellm_params:
      model: openai/gpt-4o-realtime-preview-2024-10-01
      api_key: os.environ/OPENAI_API_KEY
    model_info:
      mode: realtime
```
</TabItem>
<TabItem value="openai+azure" label="OpenAI + Azure">

```yaml
model_list:
  - model_name: azure-gpt-4o-realtime-audio
    litellm_params:
      model: azure/gpt-4o-realtime-preview
      api_key: os.environ/AZURE_SWEDEN_API_KEY
      api_base: os.environ/AZURE_SWEDEN_API_BASE

  - model_name: azure-gpt-realtime
    litellm_params:
      model: azure/gpt-realtime
      api_key: os.environ/AZURE_API_KEY
      api_base: os.environ/AZURE_API_BASE
    model_info:
      mode: realtime

  - model_name: openai-gpt-4o-realtime-audio
    litellm_params:
      model: openai/gpt-4o-realtime-preview-2024-10-01
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

const url = "ws://0.0.0.0:4000/v1/realtime?model=openai-gpt-4o-realtime-audio";
// const url = "wss://my-azure-endpoint.openai.azure.com/openai/realtime?api-version=2024-10-01-preview&deployment=gpt-4o-realtime-preview";
const ws = new WebSocket(url, {
    headers: {
        "api-key": `sk-<your-litellm-api-key>`,
        "OpenAI-Beta": "realtime=v1",
    },
});

ws.on("open", function open() {
    console.log("Connected to server.");
    ws.send(JSON.stringify({
        type: "response.create",
        response: {
            modalities: ["text"],
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

<SinceVersion v="1.107.0" /> OpenAI Live models such as `gpt-live-1` use their own WebSocket protocol, and LiteLLM serves them on `/v1/live/sessions`, first in `v1.107.0-rc.1`. OpenAI rejects a Live model on `/v1/realtime` with `invalid_model`, so a `/v1/realtime` client cannot use `gpt-live-1`. Use the route below instead.

### Add the model to config

```yaml
model_list:
  - model_name: gpt-live-1
    litellm_params:
      model: openai/gpt-live-1
      api_key: os.environ/OPENAI_API_KEY
```

Live sessions support the `openai` provider only. A session on a deployment of another provider, such as `azure/gpt-live-1`, gets an `error` event that says `OpenAI Live sessions require the openai provider`, and the session closes.

### Connect

Open a WebSocket to `/v1/live/sessions` on the proxy with a LiteLLM virtual key. `/live/sessions` and `/openai/v1/live/sessions` work too. The first message must be `session.start`, and its `session.model` is the `model_name` from your config. LiteLLM takes the model from that message and ignores a `?model=` query parameter. It swaps in the deployment's model, connects to OpenAI's `/v1/live/sessions`, and then passes every event through unchanged in both directions.

The OpenAI Python SDK does all of this when you point `base_url` at the proxy. `client.live` needs `openai` 3.12.0 or later, so install or upgrade it with `pip install -U "openai[realtime]>=3.12.0"`:

```python
import asyncio
import os

from openai import AsyncOpenAI

client = AsyncOpenAI(base_url="http://0.0.0.0:4000/v1", api_key=os.environ["LITELLM_API_KEY"])


async def main() -> None:
    async with client.live.connect() as connection:
        await connection.send({"type": "session.start", "session": {"model": "gpt-live-1"}})
        async for event in connection:
            print(event.type)
            if event.type == "session.started":
                await connection.send({"type": "session.close"})
            if event.type in ("session.closed", "error"):
                break


asyncio.run(main())
```

Wait for `session.started` before you send audio. Send audio as base64 chunks in `session.input_audio.append` events, and read the model's audio from `session.output_audio.delta` events. See OpenAI's [GPT-Live guide](https://developers.openai.com/api/docs/guides/live) and [WebSocket guide](https://developers.openai.com/api/docs/guides/voice-websockets?api=live) for the full list of events.

### Auth and errors

LiteLLM checks the virtual key when the WebSocket opens. It reads the key from the `Authorization: Bearer <key>` header, then from the `api-key` header, then from an `openai-insecure-api-key.<key>` WebSocket subprotocol for clients that cannot set headers. A missing or invalid key, or a key over its total budget (`max_budget`), gets HTTP 403 and the WebSocket never opens.

After `session.start`, LiteLLM runs the checks that need the model, such as model access and per-model budgets (`model_max_budget`). When a check fails, LiteLLM sends an `error` event with one of these codes and closes the session with code 1008:

| Code | Cause |
| --- | --- |
| `model_not_allowed` | The key may not call the model |
| `session_not_allowed` | Another check failed, such as a used-up per-model budget |
| `invalid_session_start` | First message is not `session.start` |

LiteLLM also sends `invalid_session_start` when no first message arrives within 30 seconds.

### Spend tracking

To end a session, send `session.close` and wait for `session.closed`, which carries the final `usage`. LiteLLM bills the session from the `usage.seconds` that OpenAI reports, at the model's `input_cost_per_second`. That is the deployment's own `input_cost_per_second` when you set one in `litellm_params`, else the model cost map's. For example, a session with 6 seconds of audio costs 6 times `input_cost_per_second`. If the client drops the socket without `session.close`, LiteLLM sends `session.close` to OpenAI itself and still bills the `usage.seconds` in OpenAI's `session.closed`. Only when OpenAI sends no `session.closed` within 5 seconds does LiteLLM bill the larger of the last reported `usage.seconds` and the time the session was open.

When the session hands work to a Responses model, OpenAI sends `response.event` events, and LiteLLM adds the tokens of each finished response at that model's token prices.

The whole cost goes to the session's spend log and to the key's spend, so key budgets apply the same way they do on `/v1/realtime`.

### Limits

Guardrails do not run on Live sessions. When a `pre_call`, `post_call`, or `realtime_input_transcription` guardrail applies to the session, LiteLLM sends an `error` event that says `Guardrails are not supported on OpenAI Live sessions` and closes the session. That includes a guardrail attached to the key and one with `default_on: true`, so a `default_on` guardrail in one of these modes closes every Live session on the proxy. Guardrails in other modes, such as `during_call`, and the `guardrails` query parameter do not close the session, and the session runs without them.

LiteLLM proxies the WebSocket route only. WebRTC session creation (`POST /v1/live/sessions`) and the call control routes under `/v1/live/sessions/{session_id}/`, such as `hangup` and `accept`, are not available through the proxy.

## Azure: GA vs beta realtime protocol

Azure exposes two realtime upstreams. The GA endpoint (`/openai/v1/realtime?model=<deployment>`) speaks the GA event schema (`session.type`, `output_modalities`, nested `audio`), and the older beta endpoint (`/openai/realtime?api-version=2024-10-01-preview&deployment=<deployment>`) speaks the beta schema (`modalities`, `voice`, flat audio formats). Sending a GA-shaped `session.update` to the beta endpoint fails with `Unknown parameter: 'session.type'`

LiteLLM picks the upstream from the client connection. A client that sends the `OpenAI-Beta: realtime=v1` header (the openai SDK's `client.beta.realtime.connect`) is bridged to the beta endpoint. A client without that header (the openai SDK's `client.realtime.connect`, and most voice agent frameworks) is bridged to the GA endpoint. Transcription sessions (`intent=transcription`) always use GA

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
      model: azure/gpt-realtime
      api_key: os.environ/AZURE_API_KEY
      api_base: os.environ/AZURE_API_BASE
      realtime_protocol: beta # or GA
```

```bash
export LITELLM_AZURE_REALTIME_PROTOCOL=beta # or GA
```

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
const url = `ws://0.0.0.0:4000/v1/realtime?model=openai-gpt-4o-realtime-audio&guardrails=${guardrails.join(",")}`;

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
    url = "ws://0.0.0.0:4000/v1/realtime?model=openai-gpt-4o-realtime-audio&guardrails=your-guardrail-name"
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
