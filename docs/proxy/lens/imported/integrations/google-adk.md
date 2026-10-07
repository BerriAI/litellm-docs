---
title: "Google ADK"
description: "Run Google ADK examples and send their agent traces to LiteLLM Lens."
slug: "/proxy/lens/integrations/google-adk"
sidebar_label: "Google ADK"
custom_edit_url: "https://github.com/BerriAI/litellm-lens-example/edit/main/google-adk/README.md"
mdx:
  format: md
---

<!-- Generated from BerriAI/litellm-lens-example/google-adk/README.md at 20ab548e9b978fb6dfb681ca9b3e9f5736fb53e9. Edit the source README. -->

# Google ADK

Send Google ADK traces to [LiteLLM Lens](/docs/proxy/lens) using the runnable examples in this repository.

## Prerequisites

You need a LiteLLM gateway with [tracing enabled](/docs/proxy/lens/deployment#configure-an-existing-proxy), a LiteLLM key, and a configured model alias. The swarm example needs a model that supports tool calls. The Lens service receives and stores traces separately from the gateway and runs investigations. Generate a dedicated tracing key in **Lens > Traces > Set up tracing**.

Install uv. It uses the checked-in Python version and resolves each example’s dependencies from its uv workspace.

## Configuration

For a fresh checkout:

```bash
git clone https://github.com/BerriAI/litellm-lens-example.git
cd litellm-lens-example/google-adk
cp .env.example .env
```

If you already cloned the repository, run the remaining commands from `google-adk/`. Copy [.env.example](https://github.com/BerriAI/litellm-lens-example/blob/20ab548e9b978fb6dfb681ca9b3e9f5736fb53e9/google-adk/.env.example) to `.env` if it does not exist, then set:

| Variable              | Value                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `LITELLM_GATEWAY_URL` | Your gateway’s base URL without a trailing slash or `/v1`, for example `http://localhost:4002`                          |
| `LITELLM_API_KEY`     | Your LiteLLM model key                                                                                                  |
| `LENS_URL`            | The ingestion URL from Lens tracing setup, for example `http://localhost:4318` or `https://gateway.example/lens-ingest` |
| `LENS_TRACING_KEY`    | The dedicated tracing key from Lens tracing setup                                                                       |
| `LITELLM_MODEL`       | A model alias configured on your gateway                                                                                |

The checked-in values target a local development gateway. Replace them for your deployment. Keep the exporter settings from `.env.example`; the examples configure their trace exporters in code. They send traces to `LENS_URL/v1/traces` with the tracing key as a bearer token.

Leave `MOCK_LITELLM_GATEWAY_URL` unset unless you intend to send an additional trace copy to the local [recorder](https://github.com/BerriAI/litellm-lens-example/blob/20ab548e9b978fb6dfb681ca9b3e9f5736fb53e9/recorder/AGENTS.md).

## Run an example

### Simple agent

A `research_agent` answers one question.

```bash
uv run --env-file .env --package lens-google-adk-simple simple/main.py
```

See [simple/main.py](https://github.com/BerriAI/litellm-lens-example/blob/20ab548e9b978fb6dfb681ca9b3e9f5736fb53e9/google-adk/simple/main.py) for the implementation.

### Agent swarm

A coordinator invokes `search_agent` and `writer_agent` as AgentTool tools.

```bash
uv run --env-file .env --package lens-google-adk-swarm swarm/main.py
```

See [swarm/main.py](https://github.com/BerriAI/litellm-lens-example/blob/20ab548e9b978fb6dfb681ca9b3e9f5736fb53e9/google-adk/swarm/main.py) for the implementation.

### Streaming

Set `LITELLM_STREAM=1` to enable streaming in either example:

```bash
LITELLM_STREAM=1 uv run --env-file .env --package lens-google-adk-simple simple/main.py
```

### Request attempt validation

`validate_attempts.py` runs the simple agent through a fault-injecting `httpx` transport passed to `gateway_http_client(transport=...)` to check how billed attempts correlate. `retry` turns the first successful gateway response into a 503 after its body was read, so the OpenAI client retries once and the trace holds two `gateway.request` spans with two spend rows. `response-loss` keeps the real status and headers but fails the body stream, so the single billed attempt is recorded as a client error while its spend still resolves.

```bash
uv run --env-file .env --package lens-google-adk-simple validate_attempts.py retry
uv run --env-file .env --package lens-google-adk-simple validate_attempts.py response-loss
```

## Verify the trace

After the example prints its answer, open **Lens > Traces** on your gateway and select the new run. Look for the run associated with `research_agent`. Inspect the input, output, and model spans. For the swarm, inspect the specialist activity described above; its exact span layout depends on the framework.

## How tracing works

OpenInference instruments ADK invocations, agents, model calls, and tools. The shared gateway transport records request attempts and gateway call IDs under model calls.

See the [shared gateway transport](https://github.com/BerriAI/litellm-lens-example/blob/20ab548e9b978fb6dfb681ca9b3e9f5736fb53e9/shared/README.md) for request-attempt and spend-correlation details.

## Troubleshooting

If model calls fail, check the gateway URL, key, and model alias. If an answer appears but the trace is missing, check the terminal for exporter errors and confirm the Lens ingestion service is reachable with your tracing key. A model call succeeding does not confirm that its trace export succeeded.
