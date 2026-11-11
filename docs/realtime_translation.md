---
title: Realtime Translation API with gpt-realtime-translate
sidebar_label: /realtime/translations
description: Live speech-to-speech translation with OpenAI gpt-realtime-translate and Azure OpenAI through one LiteLLM proxy, over WebSocket or WebRTC, with virtual keys, budgets, and cost for each second of audio.
keywords:
  [
    realtime translation,
    live translation API,
    speech to speech translation,
    speech translation API,
    gpt-realtime-translate,
    OpenAI realtime translation,
    Azure OpenAI realtime translation,
    WebRTC translation,
    live captions,
  ]
faq:
  - question: What is gpt-realtime-translate?
    answer: gpt-realtime-translate is an OpenAI model for live speech translation. It gets a continuous stream of audio and sends back the translation as audio and as text, with a short delay. It is available on OpenAI and on Azure OpenAI.
  - question: How much does realtime translation cost?
    answer: As of November 2026, gpt-realtime-translate costs $0.000567 for each second of input audio. This is approximately $0.034 for each minute, or $2.04 for each hour, on OpenAI and on Azure. LiteLLM adds this cost to the key, team, and user spend.
  - question: Can I use gpt-realtime-translate on Azure OpenAI?
    answer: Yes. Set model to azure/gpt-realtime-translate with your api_base and api_key. If your deployment has a different name, add base_model azure/gpt-realtime-translate in model_info.
  - question: Do I use WebSocket or WebRTC for realtime translation?
    answer: Use WebSocket when your server has the audio, for example a file, a phone call, or a media server. Use WebRTC for a microphone in a browser or a mobile app, because the browser does not get your LiteLLM key.
  - question: How is realtime translation different from the Realtime API?
    answer: The Realtime API on /v1/realtime is a conversation, and the model gives an answer to each question. Realtime translation on /v1/realtime/translations is a live interpreter. It has no turns, prompts, or tools.
  - question: Can I use guardrails with realtime translation?
    answer: No. Guardrails cannot read translated audio. LiteLLM stops a translation session when a pre_call, post_call, or realtime_input_transcription guardrail applies to it. If the guardrail has default_on set to true, create the key with disable_global_guardrails set to true to let it use translation. This setting is an Enterprise feature.
  - question: Why does my translation session close after the audio stops?
    answer: Azure closes a translation session approximately 10 seconds after it gets no input. Send session.close when your audio ends.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import RealtimeTranslationFlow from '@site/src/components/RealtimeTranslationFlow';

# Realtime translation

<SinceVersion v="1.110.0" />

Realtime translation changes speech from one language to a different language while the person speaks. Your app sends the audio as the person talks. The model `gpt-realtime-translate` sends back the translation as audio and as text, with a short delay. LiteLLM serves it on `/v1/realtime/translations` for OpenAI, Azure, and `azure_ai`.

## What it is

A translation session is a live interpreter. You set the target language one time and send a continuous stream of audio. The model sends back the same words in the target language. The session has no turns, prompts, tools, or `response.create` events.

Use realtime translation for live captions, live voice-over, calls and meetings between persons who speak different languages, and voice apps for users in many countries. For a recorded file when speed is not important, [`/audio/transcriptions`](/docs/audio_transcription) and [`/audio/speech`](/docs/text_to_speech) cost less.

## How it works

Select a step, or let the diagram play.

<RealtimeTranslationFlow />

When the session starts, LiteLLM checks your LiteLLM key and selects a deployment. During the session, LiteLLM sends each event to the other side without changes. When the session ends, LiteLLM adds the cost to the key, team, and user spend.

## Set up the proxy

Do these two steps one time. All the use cases on this page use this setup.

### 1. Add the model to your config

<Tabs>
<TabItem value="openai" label="OpenAI">

```yaml
model_list:
  - model_name: translation
    litellm_params:
      model: openai/gpt-realtime-translate
      api_key: os.environ/OPENAI_API_KEY
```

</TabItem>
<TabItem value="azure" label="Azure">

```yaml
model_list:
  - model_name: translation
    litellm_params:
      model: azure/gpt-realtime-translate
      api_base: os.environ/AZURE_API_BASE
      api_key: os.environ/AZURE_API_KEY
```

If your Azure deployment has a different name, set `model: azure/<deployment-name>` and add `base_model: azure/gpt-realtime-translate` in `model_info`. LiteLLM then uses the correct price and protocol.

</TabItem>
</Tabs>

Clients send the `model_name` in the `?model=` query parameter. If a client does not send `model`, LiteLLM uses the `model_name` `gpt-realtime-translate`.

### 2. Start the proxy

```bash
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

## Pick your use case

| You want to | Connection | Go to |
| --- | --- | --- |
| Translate a recorded audio file, or try the model | WebSocket, from a script | [Translate an audio file](#translate-an-audio-file) |
| Translate live audio that your server gets, for example a phone call or a media stream | WebSocket, from your server | [Translate live audio in a server app](#translate-live-audio-in-a-server-app) |
| Translate microphone audio in a browser or a mobile app | WebRTC, from the device | [Translate microphone audio in a browser or mobile app](#translate-microphone-audio-in-a-browser-or-mobile-app) |

## Translate an audio file

Use this to try the model, or to translate a recorded file. Use the script [`cookbook/gpt_realtime_translate.py`](https://github.com/BerriAI/litellm/blob/main/cookbook/gpt_realtime_translate.py) from the LiteLLM repo. The script sends a WAV file through the proxy at the speed of the recorded speech. It shows the translated text as it comes back and writes the translated speech to `translated.wav`.

```bash
pip install websockets
export LITELLM_API_KEY=sk-<your-litellm-api-key>   # a LiteLLM virtual key
curl -sO https://raw.githubusercontent.com/BerriAI/litellm/main/cookbook/gpt_realtime_translate.py

python gpt_realtime_translate.py speech.wav \
  --base-url http://localhost:4000 \
  --model translation \
  --target-language fr
```

The input must be a mono, 16-bit PCM WAV file at 24 kHz. To change a different audio file to this format, use `ffmpeg`:

```bash
ffmpeg -i input.mp3 -ac 1 -ar 24000 -sample_fmt s16 speech.wav
```

## Translate live audio in a server app

Use this when your server gets the audio, for example from a phone call, a media server, or a live stream. Your server keeps the LiteLLM key. All WebSocket clients work. This Python example uses the [`websockets`](https://websockets.readthedocs.io/) library and shows the full protocol:

```python
import asyncio
import base64
import json
import os

import websockets

URL = "ws://localhost:4000/v1/realtime/translations?model=translation"
CHUNK = 4800  # 100 ms of 24 kHz mono PCM16


async def translate(pcm: bytes, language: str = "fr") -> None:
    headers = {"Authorization": f"Bearer {os.environ['LITELLM_API_KEY']}"}
    async with websockets.connect(URL, additional_headers=headers) as ws:
        # 1. Set the target language and wait until the session accepts it
        await ws.send(json.dumps({
            "type": "session.update",
            "session": {"audio": {"output": {"language": language}}},
        }))
        while json.loads(await ws.recv())["type"] != "session.updated":
            pass

        async def send_audio() -> None:
            # 2. Stream audio at real-time speed, then close the session
            for i in range(0, len(pcm), CHUNK):
                chunk = pcm[i : i + CHUNK]
                await ws.send(json.dumps({
                    "type": "session.input_audio_buffer.append",
                    "audio": base64.b64encode(chunk).decode(),
                }))
                await asyncio.sleep(len(chunk) / 48_000)
            await ws.send(json.dumps({"type": "session.close"}))

        sender = asyncio.create_task(send_audio())
        # 3. Read translated text (and audio) until the session closes
        async for raw in ws:
            event = json.loads(raw)
            if event["type"] == "session.output_transcript.delta":
                print(event["delta"], end="", flush=True)
            elif event["type"] == "session.output_audio.delta":
                pass  # base64 PCM16: play it or write it to a file
            elif event["type"] in ("session.closed", "error"):
                print("\n", event)
                break
        await sender
```

The route without `/v1`, `/realtime/translations`, also works. If the proxy uses TLS, use `wss://`.

## Translate microphone audio in a browser or mobile app

Use WebRTC when the audio comes from a microphone in a browser or a mobile app. The browser does not get your LiteLLM key, and the audio goes directly between the browser and the provider. The flow is the same as [realtime WebRTC](/docs/proxy/realtime_webrtc), on the translation routes.

**Step 1.** On your server, get a short-term token with your LiteLLM key. Set the target language in the same request:

```bash
curl -X POST http://localhost:4000/v1/realtime/translations/client_secrets \
  -H "Authorization: Bearer sk-<your-litellm-api-key>" \
  -H "Content-Type: application/json" \
  -d '{"model": "translation", "session": {"audio": {"output": {"language": "fr"}}}}'
```

The `value` in the response is the token. Only LiteLLM can decrypt it.

**Step 2.** In the browser, send the SDP offer with the token:

```javascript
const pc = new RTCPeerConnection();
const player = document.createElement("audio");
player.autoplay = true;
pc.ontrack = (e) => (player.srcObject = e.streams[0]); // translated speech
const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
pc.addTrack(mic.getTracks()[0]);

const offer = await pc.createOffer();
await pc.setLocalDescription(offer);
const res = await fetch("http://localhost:4000/v1/realtime/translations/calls", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/sdp" },
  body: offer.sdp,
});
await pc.setRemoteDescription({ type: "answer", sdp: await res.text() });
```

A token from `/v1/realtime/translations/client_secrets` works only on `/v1/realtime/translations/calls`. If you send `"type": "translation"` to `/v1/realtime/client_secrets`, LiteLLM returns 400.

## Reference

This section gives the routes, the events, the cost rules, and the guardrail rules.

### Routes

| Route | Method | Function |
| --- | --- | --- |
| `/v1/realtime/translations?model=<model_name>` | WebSocket | Translation session with a LiteLLM key |
| `/v1/realtime/translations/client_secrets` | POST | Gets a short-term token for WebRTC |
| `/v1/realtime/translations/calls` | POST | Changes a WebRTC SDP offer into an SDP answer |

All three routes also work without the `/v1` prefix.

### Events

| From | Event | Function |
| --- | --- | --- |
| Your app | `session.update` | Sets the target language in `session.audio.output.language` |
| Your app | `session.input_audio_buffer.append` | Sends one chunk of base64 PCM16 audio |
| Your app | `session.close` | Stops the session and asks for the final usage |
| Model | `session.created`, `session.updated` | Confirms the session and its settings |
| Model | `session.output_audio.delta` | One chunk of translated speech, base64 PCM16 |
| Model | `session.output_transcript.delta` | One chunk of the translated text |
| Model | `session.input_transcript.delta` | One chunk of the text in the language of the speaker |
| Model | `session.closed` | The session stopped. Contains `usage` |
| Model | `error` | A failure occurred. The session can close |

LiteLLM does not change these events. For all the fields, see the OpenAI [realtime translation guide](https://developers.openai.com/api/docs/guides/realtime-translation).

### Spend tracking

LiteLLM bills each second of input audio at the `input_cost_per_second` of the model. As of November 2026, `gpt-realtime-translate` costs approximately $0.034 for each minute on OpenAI and on Azure. See the [gpt-realtime-translate price and limits](https://models.litellm.ai/models/gpt-realtime-translate) on models.litellm.ai. The cost goes to the spend log and to the key, team, and user spend, so budgets apply as for other calls.

The count of seconds comes from `usage.input_seconds` in `session.closed`. If the provider does not send this value, LiteLLM counts the seconds of audio that your client sent. Thus, always send `session.close` and wait for `session.closed`. A session that gets only error events, for example from an unknown model, is recorded as a failure and LiteLLM does not bill it.

To use a different price, set `input_cost_per_second` on the deployment:

```yaml
model_list:
  - model_name: translation
    litellm_params:
      model: openai/gpt-realtime-translate
      api_key: os.environ/OPENAI_API_KEY
      input_cost_per_second: 0.0005
```

### Guardrails

Guardrails cannot read translated audio. Thus, LiteLLM stops a translation session when a `pre_call`, `post_call`, or `realtime_input_transcription` guardrail applies to it. The WebSocket closes with code 1008, and the WebRTC routes return 400.

A guardrail of these modes with `default_on: true` stops translation for all keys on the proxy. To let a key use translation, create the key or its team with `disable_global_guardrails: true`. This setting is an [Enterprise](/docs/enterprise) feature, and it turns off only `default_on` guardrails. A guardrail that the key or the team attaches, or that the request names, continues to stop translation. Guardrails in `during_call` mode, and `post_call` guardrails with [`stream_scope: non_streaming`](/docs/proxy/guardrails/quick_start#run-on-streaming-or-non-streaming-requests-only-with-stream_scope), do not stop translation.

For guardrails on other realtime sessions, see [realtime guardrails](/docs/proxy/guardrails/realtime_guardrails).

## Troubleshooting

| Problem | Cause | Fix |
| --- | --- | --- |
| The session closes approximately 10 seconds after the audio stops | Azure closes a translation session when it gets no input | Send `session.close` when your audio ends. The cookbook script adds 1.5 seconds of silence, so the model can complete the last sentence. |
| The handshake fails with 403 | The key is missing, not valid, over budget, or cannot use the model | Compare the `models` of the key with the `model_name` in your config |
| The WebSocket closes with 1008 immediately | A guardrail applies to the session | See [Guardrails](#guardrails) |
| An error says that the provider is not supported | Translation works only on OpenAI and Azure, and on `azure_ai` over WebSocket | Use a deployment on one of these providers |
| The translation is not clear, or there is no sound | The audio is not 24 kHz mono PCM16 | Change the sample rate and the format before you send the audio |

## FAQ

{/* Keep these answers the same as the faq list in the front matter. */}

### What is gpt-realtime-translate?

`gpt-realtime-translate` is an OpenAI model for live speech translation. It gets a continuous stream of audio and sends back the translation as audio and as text, with a short delay. It is available on OpenAI and on Azure OpenAI.

### How much does realtime translation cost?

As of November 2026, `gpt-realtime-translate` costs $0.000567 for each second of input audio. This is approximately $0.034 for each minute, or $2.04 for each hour, on OpenAI and on Azure. LiteLLM adds this cost to the key, team, and user spend.

### Can I use gpt-realtime-translate on Azure OpenAI?

Yes. Set `model` to `azure/gpt-realtime-translate` with your `api_base` and `api_key`. If your deployment has a different name, add `base_model` `azure/gpt-realtime-translate` in `model_info`.

### Do I use WebSocket or WebRTC for realtime translation?

Use WebSocket when your server has the audio, for example a file, a phone call, or a media server. Use WebRTC for a microphone in a browser or a mobile app, because the browser does not get your LiteLLM key.

### How is realtime translation different from the Realtime API?

The Realtime API on `/v1/realtime` is a conversation, and the model gives an answer to each question. Realtime translation on `/v1/realtime/translations` is a live interpreter. It has no turns, prompts, or tools.

### Can I use guardrails with realtime translation?

No. Guardrails cannot read translated audio. LiteLLM stops a translation session when a `pre_call`, `post_call`, or `realtime_input_transcription` guardrail applies to it. If the guardrail has `default_on` set to `true`, create the key with `disable_global_guardrails` set to `true` to let it use translation. This setting is an Enterprise feature.

### Why does my translation session close after the audio stops?

Azure closes a translation session approximately 10 seconds after it gets no input. Send `session.close` when your audio ends.
