---
title: "Strands Agents"
description: "Run Strands Agents examples and send their agent traces to LiteLLM Lens."
slug: "/proxy/lens/integrations/strands"
sidebar_label: "Strands Agents"
custom_edit_url: "https://github.com/BerriAI/litellm-lens-example/edit/main/strands/README.md"
mdx:
  format: md
---

<!-- Generated from BerriAI/litellm-lens-example/strands/README.md at 79e58f44692b09a68b569ff104b36d0b00712272. Edit the source README. -->

# Strands Agents

Send Strands Agents traces to [LiteLLM Lens](/docs/proxy/lens) using the runnable examples in this repository.

## Prerequisites

You need [Lens installed alongside LiteLLM](/docs/proxy/lens/deployment#configure-an-existing-proxy), a key with model access, and a configured model alias. The swarm example needs a model that supports tool calls. In **Lens > Traces > Set up tracing**, click **Generate tracing key** and copy the **Traces endpoint** under **Connection details**. Ask your administrator for these if you cannot create a tracing key.

Install [uv](https://docs.astral.sh/uv/getting-started/installation/). It uses the checked-in Python version and resolves each example’s dependencies from its uv workspace.

## Configuration

For a fresh checkout:

```bash
git clone https://github.com/BerriAI/litellm-lens-example.git
cd litellm-lens-example/strands
cp .env.example .env
```

If you already cloned the repository, run the remaining commands from `strands/`. Copy [.env.example](https://github.com/BerriAI/litellm-lens-example/blob/79e58f44692b09a68b569ff104b36d0b00712272/strands/.env.example) to `.env` if it does not exist, then set:

| Variable              | Value                                                                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LITELLM_GATEWAY_URL` | Your gateway’s base URL without a trailing slash or `/v1`, for example `http://localhost:4002`                                                                                                    |
| `LITELLM_API_KEY`     | Your LiteLLM model key                                                                                                                                                                            |
| `LENS_URL`            | Copy **Traces endpoint** from Lens tracing setup and remove the final `/v1/traces`. Keep `/lens-ingest` if present. For example, `http://localhost:4318` or `https://gateway.example/lens-ingest` |
| `LENS_TRACING_KEY`    | The dedicated tracing key from Lens tracing setup                                                                                                                                                 |
| `LITELLM_MODEL`       | A model alias configured on your gateway                                                                                                                                                          |

The checked-in values target a local development gateway. Replace them for your deployment. Keep the exporter settings from `.env.example`; the examples configure their trace exporters in code. They send traces to `LENS_URL/v1/traces` with the tracing key as a bearer token.

Leave `MOCK_LITELLM_GATEWAY_URL` unset unless you intend to send an additional trace copy to the local [recorder](https://github.com/BerriAI/litellm-lens-example/blob/79e58f44692b09a68b569ff104b36d0b00712272/recorder/AGENTS.md).

## Run an example

### Simple agent

A `research_agent` answers one question.

```bash
uv run --env-file .env --package lens-strands-simple simple/main.py
```

See [simple/main.py](https://github.com/BerriAI/litellm-lens-example/blob/79e58f44692b09a68b569ff104b36d0b00712272/strands/simple/main.py) for the implementation.

### Agent swarm

A coordinator invokes `search_agent` and `writer_agent` as tools.

```bash
uv run --env-file .env --package lens-strands-swarm swarm/main.py
```

See [swarm/main.py](https://github.com/BerriAI/litellm-lens-example/blob/79e58f44692b09a68b569ff104b36d0b00712272/strands/swarm/main.py) for the implementation.

## Verify the trace

After the example prints its answer, open **Lens > Traces** on your gateway and select the new run. Look for the run associated with `research_agent`. Inspect the input, output, and model spans. For the swarm, inspect the specialist activity described above; its exact span layout depends on the framework.

## How tracing works

Strands exports agent, tool, and model spans. The shared gateway HTTP client records request attempts under model spans, including gateway call IDs for streamed responses and retries.

See the [shared gateway transport](https://github.com/BerriAI/litellm-lens-example/blob/79e58f44692b09a68b569ff104b36d0b00712272/shared/README.md) for request-attempt and spend-correlation details.

Validate retries and billed response loss against a real gateway with `uv run --env-file .env --package lens-strands-simple validate_attempts.py retry` or `... response-loss`. The driver wraps the real `httpx` transport in a fault-injecting one and passes it as `gateway_http_client(base_url, transport=...)`. The retry scenario reads the first real billed response and replaces it with a client-side HTTP 503 so the OpenAI client retries once, producing two `gateway.request` spans and two spend rows. The response-loss scenario keeps the real status and headers but fails the stream after the billed body was consumed, producing one errored attempt whose spend row still resolves. Neither scenario changes gateway or provider behavior.

## Troubleshooting

If model calls fail, check the gateway URL, key, and model alias. If an answer appears but the trace is missing, check the terminal for exporter errors and confirm the Lens ingestion service is reachable with your tracing key. A model call succeeding does not confirm that its trace export succeeded.

An “Attempting to instrument while already instrumented” warning can occur when Strands initializes threading instrumentation after the example has already initialized it.
