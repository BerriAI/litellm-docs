---
title: Voice and realtime audio
sidebar_label: Voice (realtime)
description: Run realtime voice agents, live transcription, and live speech translation through the LiteLLM proxy with virtual keys, budgets, and spend tracking. Covers GPT-Live, the Realtime API, gpt-live-transcribe, and gpt-realtime-translate.
keywords:
  [
    voice,
    realtime voice,
    voice agent,
    speech to speech,
    GPT-Live,
    gpt-live-1,
    gpt-realtime,
    gpt-live-transcribe,
    gpt-realtime-translate,
    WebRTC,
    WebSocket,
  ]
---

# Voice and realtime audio

{/* keep-version-note */}

Put LiteLLM between your app and a voice model. Your app connects to the proxy with a LiteLLM virtual key, and the proxy connects to the provider with the provider key. You get one place to control model access, budgets, and spend for voice sessions.

This page helps you pick the route for your model, run a first session, and find the page for each task.

## Pick a route

Voice models fall into four families. Each family has its own route on the proxy, and a model from one family does not run on another family's route.

| You want to | Model | Route on the proxy | Providers |
| --- | --- | --- | --- |
| [Hold a voice conversation with turns and tools](/docs/realtime) | `gpt-realtime-2.1` and other Realtime models | `WS /v1/realtime` | OpenAI, Azure, xAI, Gemini, Vertex AI, Bedrock |
| [Hold a full-duplex voice conversation](/docs/live_sessions) | `gpt-live-1` | `WS /v1/live/sessions` | OpenAI, Azure |
| [Turn live speech into text](/docs/realtime#live-transcription-with-gpt-live-transcribe) | `gpt-live-transcribe` | `WS /v1/realtime?intent=transcription` | OpenAI, Azure |
| [Translate live speech](/docs/realtime_translation) | `gpt-realtime-translate` | `WS /v1/realtime/translations` | OpenAI, Azure |

Each task links to its setup guide.

`gpt-live-transcribe` has "live" in its name, but it runs on the Realtime route. Send `gpt-live-1` to `/v1/live/sessions` only.

For audio that does not need a live session, use [`/audio/transcriptions`](/docs/audio_transcription) to transcribe a file and [`/audio/speech`](/docs/text_to_speech) to generate speech.

## Pick a transport

| Your audio comes from | Use | Why |
| --- | --- | --- |
| Your server, such as a phone call or a media stream | WebSocket | Your server holds the LiteLLM key and sends the audio |
| A microphone in a browser or mobile app | [WebRTC](/docs/proxy/realtime_webrtc) | The browser gets a short-lived token, and audio goes to the provider without passing through the proxy |

WebRTC works for Realtime models, `gpt-live-transcribe`, and `gpt-realtime-translate` on OpenAI and Azure. `gpt-live-1` supports WebSocket only on the proxy. LiteLLM does not record spend for WebRTC calls, so use WebSocket when a call must count against a budget.

## Run a first session

This example starts a Realtime session on OpenAI and prints the model's reply as text. You need the LiteLLM proxy installed and an OpenAI API key.

1. Save this as `config.yaml`:

    ```yaml
    model_list:
      - model_name: gpt-realtime
        litellm_params:
          model: openai/gpt-realtime-2.1
          api_key: os.environ/OPENAI_API_KEY
        model_info:
          mode: realtime

    general_settings:
      master_key: os.environ/LITELLM_MASTER_KEY
    ```

2. Start the proxy. `LITELLM_MASTER_KEY` is the admin key you choose for the proxy, and it must start with `sk-`.

    ```bash
    export OPENAI_API_KEY="<your OpenAI key>"
    export LITELLM_MASTER_KEY="sk-<a long random string>"
    litellm --config config.yaml
    ```

3. In a second terminal, save this as `voice_test.py`:

    ```python
    import asyncio
    import json
    import os

    import websockets

    URL = "ws://0.0.0.0:4000/v1/realtime?model=gpt-realtime"


    async def main() -> None:
        headers = {"Authorization": f"Bearer {os.environ['LITELLM_API_KEY']}"}
        async with websockets.connect(URL, additional_headers=headers) as ws:
            session = {"type": "realtime", "output_modalities": ["text"]}
            await ws.send(json.dumps({"type": "session.update", "session": session}))
            await ws.send(
                json.dumps(
                    {
                        "type": "conversation.item.create",
                        "item": {
                            "type": "message",
                            "role": "user",
                            "content": [{"type": "input_text", "text": "Say hello in five words."}],
                        },
                    }
                )
            )
            await ws.send(json.dumps({"type": "response.create"}))
            async for message in ws:
                event = json.loads(message)
                if event["type"] == "response.output_text.delta":
                    print(event["delta"], end="", flush=True)
                if event["type"] in ("response.done", "error"):
                    print()
                    break


    asyncio.run(main())
    ```

4. Run it with your proxy key:

    ```bash
    pip install websockets
    export LITELLM_API_KEY="$LITELLM_MASTER_KEY"
    python voice_test.py
    ```

The script prints a short greeting from the model, such as `Hello there, my friend, hello.`

If the WebSocket closes with HTTP 403, the proxy rejected the key. Check that `LITELLM_API_KEY` matches `LITELLM_MASTER_KEY` or a virtual key that can call `gpt-realtime`.

To send and receive audio, follow the [Realtime guide](/docs/realtime). For a browser microphone, follow the [WebRTC guide](/docs/proxy/realtime_webrtc).

## What the proxy does for a voice session

The proxy checks the virtual key and its model access before it opens the session, and it refuses a key that is over budget. During the session it passes provider events to your client in the provider's own format. At the end it writes the session's cost to the spend log and adds it to the spend of the key, team, and user.

Billing follows the model family. LiteLLM bills Realtime models from the token usage the provider reports. It bills `gpt-live-1`, `gpt-live-transcribe`, and `gpt-realtime-translate` for each second of audio.

You can list several deployments under one `model_name` to load balance Realtime sessions across OpenAI and Azure.

[Realtime guardrails](/docs/proxy/guardrails/realtime_guardrails) run on `/v1/realtime` sessions. They do not run on GPT-Live or translation sessions, and LiteLLM closes those sessions when a guardrail applies to them.

## Provider guides

OpenAI and Azure setup is on the [Realtime](/docs/realtime) page, including the Azure GA and beta protocols. These providers have their own pages:

- [xAI Grok Voice](/docs/providers/xai_realtime)
- [Google AI Studio Gemini Live](/docs/providers/google_ai_studio/realtime)
- [Vertex AI Gemini Live](/docs/providers/vertex_realtime)
- [Vertex AI Chirp transcription](/docs/providers/vertex_transcription#chirp-realtime-transcription)
- [Bedrock Nova Sonic](/docs/providers/bedrock_realtime_with_audio)
- [Meta Muse Voice transcription](/docs/providers/meta#muse-voice-realtime-transcription)
