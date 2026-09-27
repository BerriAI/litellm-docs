import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Deepgram Realtime (`/listen`) WebSocket Passthrough

Stream live audio to Deepgram's realtime speech-to-text API (`wss://api.deepgram.com/v1/listen`) through the LiteLLM proxy. The proxy authenticates the caller with a LiteLLM virtual key, injects the Deepgram credential server-side, relays audio and transcript frames unchanged in both directions, and logs the session's audio duration as spend when the socket closes

| Feature | Supported | Notes |
|-------|-------|-------|
| Cost Tracking | ✅ | Billed at socket close from the `Metadata.duration` frame, times the channel count, using the `deepgram/<model>` per-second price |
| Logging | ✅ | Works across all integrations, one SpendLogs row per WebSocket session |
| Streaming | ✅ | Interim and final `Results` frames are relayed as Deepgram sends them |
| Guardrails | ❌ | Audio frames are opaque bytes; no request or response guardrails run on them |

## Endpoints

`ws://<proxy>/deepgram/v1/listen` and its alias `ws://<proxy>/deepgram/listen`. Both relay to `<DEEPGRAM_API_BASE>/listen` (default `wss://api.deepgram.com/v1/listen`)

## Configuration

Set the Deepgram credential in one of two places. The proxy checks the configured pass-through deployments first and falls back to the `DEEPGRAM_API_KEY` environment variable

<Tabs>
<TabItem value="env" label="Environment variable">

```bash
export DEEPGRAM_API_KEY="your-deepgram-key"
export LITELLM_MASTER_KEY="sk-1234"
litellm --config config.yaml --port 4000
```

</TabItem>
<TabItem value="config" label="config.yaml / Admin UI">

Add a Deepgram deployment with `use_in_pass_through: true`. The same flag is the "Use in pass through routes" toggle under Advanced Settings when you add a Deepgram model from the Admin UI, so the credential can be managed from the dashboard without any extra setup

```yaml
model_list:
  - model_name: nova-3
    litellm_params:
      model: deepgram/nova-3
      api_key: os.environ/DEEPGRAM_API_KEY
      use_in_pass_through: true

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

</TabItem>
</Tabs>

`DEEPGRAM_API_BASE` (optional) overrides the upstream base URL, for example a self-hosted or regional Deepgram deployment. `https://` and `http://` bases are converted to `wss://` and `ws://`. The base URL is read only from the server; a client cannot pick the destination the proxy's Deepgram key is sent to

## Authentication

The WebSocket handshake accepts the same LiteLLM key mechanisms as the other WebSocket routes: an `Authorization: Bearer <litellm-key>` header, an `api-key: <litellm-key>` header, or the `Sec-WebSocket-Protocol: openai-insecure-api-key.<litellm-key>` subprotocol for browsers that cannot set headers. The handshake is rejected when the key is invalid, and the socket is closed with code `1011` when no Deepgram credential is configured on the proxy

## Query parameters

Everything after `?` is forwarded to Deepgram verbatim (`encoding`, `sample_rate`, `channels`, `language`, `interim_results`, `smart_format`, `punctuate`, and so on, per the [Deepgram listen reference](https://developers.deepgram.com/reference/speech-to-text-api/listen-streaming)). If `model` is missing or empty the proxy appends `model=nova-3`

## Usage

<Tabs>
<TabItem value="python" label="Python (websockets)">

```python
import asyncio
import json

import websockets

PROXY_URL = "ws://localhost:4000/deepgram/v1/listen?model=nova-3&encoding=linear16&sample_rate=16000&interim_results=true"
LITELLM_KEY = "sk-1234"


async def main() -> None:
    async with websockets.connect(
        PROXY_URL,
        additional_headers={"Authorization": f"Bearer {LITELLM_KEY}"},
    ) as ws:

        async def send_audio() -> None:
            with open("audio.raw", "rb") as f:  # 16 kHz, 16-bit, mono PCM
                while chunk := f.read(8000):
                    await ws.send(chunk)
                    await asyncio.sleep(0.25)
            await ws.send(json.dumps({"type": "CloseStream"}))

        async def read_frames() -> None:
            async for frame in ws:
                data = json.loads(frame)
                if data.get("type") == "Results":
                    alt = data["channel"]["alternatives"][0]
                    label = "final" if data.get("is_final") else "interim"
                    print(f"[{label}] {alt['transcript']}")
                elif data.get("type") == "Metadata":
                    print(f"[metadata] duration={data['duration']}s")

        await asyncio.gather(send_audio(), read_frames())


asyncio.run(main())
```

</TabItem>
<TabItem value="websocat" label="websocat">

```bash
websocat -b \
  -H "Authorization: Bearer sk-1234" \
  "ws://localhost:4000/deepgram/v1/listen?model=nova-3&encoding=linear16&sample_rate=16000" \
  < audio.raw
```

</TabItem>
<TabItem value="browser" label="Browser">

```javascript
const ws = new WebSocket(
  "ws://localhost:4000/deepgram/v1/listen?model=nova-3&encoding=linear16&sample_rate=16000",
  ["openai-insecure-api-key.sk-1234"],
);
ws.onmessage = (event) => console.log(JSON.parse(event.data));
// send Int16 PCM chunks with ws.send(arrayBuffer)
```

</TabItem>
</Tabs>

## What is and is not forwarded

Client to Deepgram: binary frames (audio) are sent as binary, text frames (`KeepAlive`, `Finalize`, `CloseStream` control messages) as text, and the query string as-is. The caller's `Authorization`, `api-key`, and other request headers are not forwarded; the proxy sends only `Authorization: Token <DEEPGRAM_API_KEY>` upstream

Deepgram to client: every frame is relayed byte for byte in the order received, including interim `Results`, final `Results`, `UtteranceEnd`, `SpeechStarted`, and the closing `Metadata` frame. The proxy does not reshape, merge, or filter transcripts. When Deepgram closes the connection with a non-normal code (for example `1008` for an invalid request), that code and reason are propagated to the client

## Cost tracking

When the socket closes, the proxy reads the last `Metadata` frame's `duration` (seconds of audio Deepgram processed) and multiplies it by the `input_cost_per_second` of the `deepgram/<model>` entry in [`model_prices_and_context_window.json`](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json). If Deepgram never sends `Metadata` (for example the client dropped the connection), the proxy falls back to the furthest `start + duration` seen across `Results` frames. Deepgram bills every channel it processes, so a stereo session with `multichannel=true&channels=2` costs twice its wall-clock duration. The proxy multiplies the duration by the channel count from `Metadata.channels`, falling back to the widest `channel_index` seen in `Results` frames and then to the `channels` query parameter, and defaulting to one. The spend is written to SpendLogs with `call_type: pass_through_endpoint`, attributed to the calling key, team, and user like any other route

```bash
curl -s "http://localhost:4000/spend/logs?api_key=sk-1234" -H "Authorization: Bearer sk-1234"
```

## Known limitations

Cost is billed once at socket close, so a session that is still open has no spend row yet and budgets are checked at connect time only. Audio frames are not inspected, so request and response guardrails do not apply to this route. Interim results are relayed verbatim; there is no server-side deduplication of interim versus final transcripts. Deepgram's `/listen` does not report token counts, so SpendLogs shows the audio duration as the usage measure and `prompt_tokens`/`completion_tokens` stay at zero. A model that has no `deepgram/<model>` pricing entry is logged with zero cost and a warning in the proxy logs. Deepgram's `callback` and `callback_method` query parameters are refused with close code 1008 because callback delivery sends the transcript frames to your URL instead of down this socket, which would leave the session unmetered
