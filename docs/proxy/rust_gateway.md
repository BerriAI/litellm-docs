---
title: "[Beta] Rust AI Gateway"
description: Run LiteLLM request translation on the Rust core. Enable it per model on your existing Python server, or run the standalone Axum server.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# [Beta] Rust AI Gateway

:::info

This is a beta feature and the surface it covers is still growing. The Rust core is opt-in, off by default, and any Rust path that fails or is not yet supported falls back to the existing Python path automatically, so turning it on cannot break a request that Python already handles.

The per-model `rust: true` flag for the Anthropic `/v1/messages` route is available in `v1.94.0` and above; it first shipped in `v1.94.0-rc.1`.

Coverage for `/chat/completions` on `anthropic` and `bedrock` is newer and ships in an upcoming release

On `/chat/completions` that automatic fallback covers the requests the Rust path does not accept, which is decided before the provider is called; a call that has already reached the provider and then fails returns its error instead of being retried on the Python path

:::

LiteLLM is porting its request/response translation to a Rust core (the `litellm-rust` workspace, shipped inside the LiteLLM wheel). The goal is lower per-request CPU and latency while Python keeps owning auth, configuration, routing, logging, callbacks, and spend tracking until each Rust path has parity coverage.

There are two ways to adopt it.

## Mode 1: Enable Rust on your existing Python server (low risk)

Mode 1 keeps your current deployment. The Python proxy still terminates the request, runs auth and routing, and calls your callbacks; only the provider translation and network call for the supported routes below run through the Rust core. Because it is opt-in per model and falls back to Python on any error, this is the recommended way to start.

Set `rust: true` in a model's `litellm_params`. Everything else about the deployment stays the same.

```yaml title="config.yaml"
model_list:
  - model_name: {{anthropic}}
    litellm_params:
      model: anthropic/{{anthropic}}
      api_key: os.environ/ANTHROPIC_API_KEY
      rust: true            # run this deployment through the Rust core

  - model_name: azure-claude
    litellm_params:
      model: azure_ai/{{anthropic}}
      api_base: os.environ/AZURE_AI_API_BASE
      api_key: os.environ/AZURE_AI_API_KEY
      rust: true
```

A response served by the Rust core carries an `x-litellm-rust: true` header, so you can confirm the path per request:

```bash
curl -i http://localhost:4000/v1/messages \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "content-type: application/json" \
  -d '{
    "model": "{{anthropic}}",
    "max_tokens": 128,
    "messages": [{"role": "user", "content": "hello from rust"}]
  }'
```

Look for `x-litellm-rust: true` in the response headers. If the header is absent, the request was served by the Python path (either because the route/provider is not on Rust yet, or because a Rust error triggered the automatic fallback).

### What `rust: true` covers today

The Rust core covers a growing subset of routes. When a route or provider is not listed, that deployment transparently stays on the Python path even with `rust: true` set.

| Route | Providers on the Rust path |
| --- | --- |
| `/chat/completions` | `anthropic`, `bedrock` (Converse) |
| Anthropic `/v1/messages` | `anthropic`, `azure_ai` |
| Audio transcription | `bedrock` |
| Responses API WebSockets | `openai` |

Streaming is supported on the Anthropic `/v1/messages` route; requests that need an agentic completion hook stay on the Python path so the hook still runs.

On `/chat/completions` the Rust core takes non-streaming text conversations. A request runs on Rust when every message is a `system`, `user` or `assistant` message whose content is a string or a non-empty list of `{"type": "text", "text": ...}` parts, the conversation opens on a user turn, and the only sampling parameters set are `max_tokens`, `temperature`, `top_p`, `stop` and, on `anthropic`, `top_k`. Bedrock is served through Converse, the default route for Claude models on Bedrock, and additionally needs the conversation to end on a user turn because Converse has no assistant prefill

Which path serves the request is decided before the provider is called, so anything outside that subset is served by Python with no config change and no error. That covers any request with `stream: true`, tool calls and tool results, images and other non-text content parts, a message with an empty content list, `response_format` and JSON mode, extended thinking, prompt caching, `top_k` on `bedrock`, `n` above 1, and any other parameter the Rust path does not recognize. On this route the choice is final once the provider call has gone out: a failure after that point comes back as an error rather than being retried on Python, since retrying would issue the same provider call a second time and bill for it twice

The response body is the same on either path, token counts included, so the header is the only way to tell them apart: a Rust-served response carries `x-litellm-rust: true` and a Python-served one carries no such header

## Mode 2: Run the standalone Axum server

Mode 2 replaces the Python host with the Rust `litellm-ai-gateway` Axum server binary, so routing and network I/O run entirely in Rust. This is the higher-ceiling option for throughput, but it currently covers fewer routes than the Python host and does not yet have the full proxy feature set.

:::note Pending

A prebuilt Docker image for the Axum server is not published yet. This section will be filled in with the image reference and a deployment example once it ships. In the meantime you can build the server from the `litellm-rust` workspace with the `server` feature; reach out in the community channel if you want to trial it early.

:::
