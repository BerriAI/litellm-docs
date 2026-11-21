---
title: Realtime voice over WebRTC
sidebar_label: /realtime - WebRTC Support
description: Connect a browser or mobile app to OpenAI and Azure Realtime models over WebRTC through the LiteLLM proxy, with short-lived tokens so your provider key and LiteLLM key stay on the server.
keywords:
  [
    WebRTC,
    Realtime API,
    client secrets,
    browser voice agent,
    LiteLLM proxy,
    OpenAI,
    Azure,
  ]
---

{/* keep-version-note */}

Use WebRTC to connect a microphone in a browser or mobile app to a Realtime model. Your app asks the LiteLLM proxy for a short-lived token, and the browser uses that token to start the call. The provider key never reaches the browser, and audio flows between the browser and OpenAI or Azure without passing through the proxy.

For a server that already holds a LiteLLM key, use the [WebSocket route](/docs/realtime) instead. For `gpt-realtime-translate`, use the [translation routes](/docs/realtime_translation#translate-microphone-audio-in-a-browser-or-mobile-app). For `gpt-live-1`, use [GPT-Live](/docs/live_sessions), which the proxy serves over WebSocket only. The [Voice overview](/docs/voice) compares every route.

:::warning WebRTC calls are not in spend logs
LiteLLM checks the virtual key, its budget, and its model access when it issues the token. After the call connects, audio and usage go between the browser and the provider, so LiteLLM writes no spend log for the call and does not add its cost to the key, team, or user. Guardrails do not see the audio. Use the [WebSocket route](/docs/realtime) when a session must count against a budget.
:::

## How it works

The proxy handles two HTTP requests and then steps out of the call.

```
Browser                  LiteLLM Proxy              OpenAI/Azure
  |                           |                          |
  |-- POST client_secrets --->|-- POST client_secrets -->|
  |<-- encrypted token -------|<-- ek_... ---------------|
  |-- POST calls [SDP+token] ->|-- POST calls ----------->|
  |<-- SDP answer ------------|<-- SDP answer -----------|
  |===== audio, browser to provider =====================>|
```

The token that LiteLLM returns is the provider's ephemeral key, encrypted together with the deployment LiteLLM chose. Only the proxy can read it, and it works only on the proxy's `/v1/realtime/calls` route.

## Before you start

You need a running LiteLLM proxy, a LiteLLM virtual key, and an OpenAI or Azure deployment of a Realtime model. Serve the page that captures the microphone over HTTPS or from `localhost`, because browsers block microphone access elsewhere.

## 1. Add the model to config

```yaml
model_list:
  - model_name: gpt-realtime
    litellm_params:
      model: openai/gpt-realtime-2.1
      api_key: os.environ/OPENAI_API_KEY
    model_info:
      mode: realtime
```

For Azure, set `model: azure/gpt-realtime-2.1` with the `api_key` and `api_base` of your resource, and `api_version` if your resource needs one.

```bash
litellm --config /path/to/config.yaml
```

## 2. Get a token on your server

Call `POST /v1/realtime/client_secrets` from your backend with the LiteLLM key and the `model_name` from your config. Do not call it from the browser, because that puts the LiteLLM key in client code.

```bash
curl -X POST http://localhost:4000/v1/realtime/client_secrets \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-realtime"}'
```

The response has the token in `value` and its expiry in `expires_at`. Pass `value` to the browser. Tokens expire after 10 minutes, so request one right before each call.

## 3. Start the call in the browser

Create an `RTCPeerConnection`, add the microphone track and a data channel named `oai-events`, and send the SDP offer to `POST /v1/realtime/calls`. Authenticate with the token from step 2 and send `Content-Type: application/sdp`. Do not send a `model`, because the token already carries the routing.

```javascript
// token: the `value` your backend got from /v1/realtime/client_secrets
const pc = new RTCPeerConnection();
const audio = document.createElement("audio");
audio.autoplay = true;
pc.ontrack = (e) => (audio.srcObject = e.streams[0]);

const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
pc.addTrack(ms.getTracks()[0]);
const dc = pc.createDataChannel("oai-events");

const offer = await pc.createOffer();
await pc.setLocalDescription(offer);

const sdpRes = await fetch("http://localhost:4000/v1/realtime/calls", {
  method: "POST",
  headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/sdp" },
  body: offer.sdp,
});
await pc.setRemoteDescription({ type: "answer", sdp: await sdpRes.text() });

dc.onopen = () =>
  dc.send(JSON.stringify({ type: "session.update", session: { type: "realtime", instructions: "..." } }));
dc.onmessage = (e) => console.log(JSON.parse(e.data).type);
```

Send `session.update` and other client events on the data channel, and read server events from it.

## 4. Check that it works

`/v1/realtime/calls` returns `201` with the SDP answer as the body. After `setRemoteDescription`, the data channel opens and the console logs the type of each server event. Speak, and you hear the model and see `response.done` when it finishes a reply.

If `/v1/realtime/calls` returns `401` with `Invalid or expired token`, the request used a LiteLLM key or a token from another proxy. Send the `value` from `client_secrets`. If it returns `401` with `Token has expired`, the token is older than 10 minutes, so request a new one right before you create the offer.

If `client_secrets` returns `401` or `403`, the LiteLLM key is invalid, over budget, or not allowed to use the model.

If the call connects but you hear nothing, check that the page has microphone permission, that `pc.ontrack` attaches the stream to an audio element with `autoplay`, and that your network allows WebRTC traffic to the provider.

On Azure, a `404` or a version error from either route usually means the `api_base` or `api_version` in `litellm_params` does not match the resource.
