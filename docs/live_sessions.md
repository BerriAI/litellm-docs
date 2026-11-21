---
title: GPT-Live API with gpt-live-1
sidebar_label: /live/sessions
description: Run GPT-Live voice sessions with gpt-live-1 on OpenAI and Azure through the LiteLLM proxy on /v1/live/sessions, with virtual keys, model access, budgets, and spend for each second of audio.
keywords:
  [
    GPT-Live,
    gpt-live-1,
    OpenAI Live API,
    live sessions,
    voice agent,
    speech to speech,
    WebSocket voice API,
  ]
---

# GPT-Live (`/v1/live/sessions`)

GPT-Live is OpenAI's full-duplex voice API. Its models, such as `gpt-live-1`, listen and speak at the same time over one session. It is a different protocol from the [Realtime API](/docs/realtime), so a `/v1/realtime` client cannot use a GPT-Live model.

## Which voice route do I need

The model names look alike, but each family has its own route.

| Model | What it does | Route on the proxy | Docs |
| --- | --- | --- | --- |
| `gpt-live-1` | Full-duplex voice conversation | `WS /v1/live/sessions` | [GPT-Live](/docs/live_sessions) |
| `gpt-realtime` and other Realtime models | Voice or text conversation with turns and tools | `WS /v1/realtime`, or [WebRTC](/docs/proxy/realtime_webrtc) | [Realtime](/docs/realtime) |
| `gpt-live-transcribe` | Live speech to text | `WS /v1/realtime?intent=transcription` | [Live transcription](/docs/realtime#live-transcription-with-gpt-live-transcribe) |
| `gpt-realtime-translate` | Live speech translation | `WS /v1/realtime/translations` | [Realtime translation](/docs/realtime_translation) |

`gpt-live-transcribe` has "live" in its name but is not a GPT-Live model. It runs on the Realtime route.

<SinceVersion v="1.107.0" /> LiteLLM serves GPT-Live models on `/v1/live/sessions`, first in `v1.107.0-rc.1`. OpenAI rejects a Live model on `/v1/realtime` with `invalid_model`, so use the route below instead.

## Add the model to config

```yaml
model_list:
  - model_name: gpt-live-1
    litellm_params:
      model: openai/gpt-live-1
      api_key: os.environ/OPENAI_API_KEY
```

For Azure, point the deployment at your Azure resource:

```yaml
model_list:
  - model_name: azure-gpt-live-1
    litellm_params:
      model: azure/gpt-live-1
      api_key: os.environ/AZURE_API_KEY
      api_base: os.environ/AZURE_API_BASE
```

<SinceVersion v="1.112.0" /> LiteLLM serves Azure GPT-Live deployments. Earlier versions answer an Azure deployment with an `error` event that says `OpenAI Live sessions require the openai provider`. LiteLLM sends the `api_key` in the `api-key` header. When the deployment has no key, it sends a Microsoft Entra token as a bearer token, from `azure_ad_token` or the Entra settings you already use for other Azure models.

Live sessions support the `openai` and `azure` providers. A session on a deployment of another provider gets an `error` event, and the session closes with code 1011. LiteLLM connects to `/v1/live/sessions` on the host in `api_base` for OpenAI and to `/openai/v1/live/sessions` for Azure. It drops any path in `api_base`, so an `api_base` behind a path prefix does not work.

## Connect

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

## Auth and errors

LiteLLM checks the virtual key when the WebSocket opens. It reads the key from the `Authorization: Bearer <key>` header, then from the `api-key` header, then from an `openai-insecure-api-key.<key>` WebSocket subprotocol for clients that cannot set headers. A key sent from a browser is readable by anyone who uses the page, so give that key only the models and budget the page needs. A missing or invalid key, or a key over its total budget (`max_budget`), gets HTTP 403 and the WebSocket never opens.

After `session.start`, LiteLLM runs the checks that need the model, such as whether the key may call `session.model` and per-model budgets (`model_max_budget`). When a check fails, LiteLLM sends an `error` event with one of these codes and closes the session with code 1008:

| Code | Cause |
| --- | --- |
| `model_not_allowed` | The key may not call the model |
| `session_not_allowed` | Another check failed, such as a used-up per-model budget |
| `invalid_session_start` | First message is not `session.start` |

LiteLLM also sends `invalid_session_start` when no first message arrives within 30 seconds. If the key may call the model but no `model_name` in your config matches it, LiteLLM sends an `error` event of type `server_error` and closes the session with code 1011.

The key's rate limits, such as `rpm_limit`, are checked after `session.start` too. A session over a limit gets an `error` event of type `guardrail_error` whose message starts with `429`, and the session closes with code 1011. Without Redis, each proxy worker counts on its own, so a proxy with several workers can let more sessions through than the limit.

## Spend tracking

To end a session, send `session.close` and wait for `session.closed`, which carries the final `usage`. LiteLLM bills the session from the `usage.seconds` that OpenAI reports, at the model's `input_cost_per_second`. That is the deployment's own `input_cost_per_second` when you set one in `litellm_params`, else the model cost map's. For example, a session with 6 seconds of audio costs 6 times `input_cost_per_second`. If the client drops the socket without `session.close`, LiteLLM sends `session.close` to OpenAI itself and still bills the `usage.seconds` in OpenAI's `session.closed`. When a session ends with no `session.closed` from OpenAI, such as when the connection to OpenAI drops or OpenAI sends none within 5 seconds of a dropped client, LiteLLM bills the larger of the last reported `usage.seconds` and the time the session was open.

When the session hands work to a Responses model, OpenAI sends `response.event` events, and LiteLLM adds the tokens of each finished response at that model's token prices. A model that is missing from LiteLLM's model cost map adds $0 for its tokens. LiteLLM adds only token costs, so fees for tools such as web search are not billed.

The whole cost goes to the session's spend log and to the key's spend, so key budgets apply the same way they do on `/v1/realtime`. LiteLLM checks budgets when a session starts and adds the cost when the session ends, so one long session can spend past a budget. Later sessions on that key or model are then refused.

## Limits

Guardrails do not run on Live sessions. When a `pre_call`, `post_call`, or `realtime_input_transcription` guardrail applies to the session, LiteLLM sends an `error` event that says `Guardrails are not supported on OpenAI Live sessions` and closes the session with code 1011. That includes a guardrail attached to the key and one with `default_on: true`, so a `default_on` guardrail in one of these modes closes every Live session on the proxy. Guardrails in other modes, such as `during_call`, and the `guardrails` query parameter do not close the session, and the session runs without them.

LiteLLM checks and bills Live sessions on the WebSocket route only. WebRTC session creation (`POST /v1/live/sessions`) and the call control routes under `/v1/live/sessions/{session_id}/`, such as `hangup` and `accept`, have no Live route on the proxy. The [OpenAI pass-through](/docs/pass_through/openai_passthrough) on `/openai/v1/live/sessions` forwards them to OpenAI as plain pass-through calls, and LiteLLM does not bill them as Live sessions, so their use never counts toward key spend or budgets. A proxy admin can keep a key on the Live WebSocket route by setting the key's `allowed_routes` to `["/v1/live/sessions"]`.
