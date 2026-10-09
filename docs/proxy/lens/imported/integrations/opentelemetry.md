---
title: "OpenTelemetry"
description: "Run OpenTelemetry examples and send their agent traces to LiteLLM Lens."
slug: "/proxy/lens/integrations/opentelemetry"
sidebar_label: "OpenTelemetry"
custom_edit_url: "https://github.com/BerriAI/litellm-lens-example/edit/main/opentelemetry/README.md"
mdx:
  format: md
---

<!-- Generated from BerriAI/litellm-lens-example/opentelemetry/README.md at 79e58f44692b09a68b569ff104b36d0b00712272. Edit the source README. -->

# OpenTelemetry

Send OpenTelemetry traces to [LiteLLM Lens](/docs/proxy/lens) using the runnable examples in this repository.

## Prerequisites

You need [Lens installed alongside LiteLLM](/docs/proxy/lens/deployment#configure-an-existing-proxy), a key with model access, and a configured model alias. In **Lens > Traces > Set up tracing**, click **Generate tracing key** and copy the **Traces endpoint** under **Connection details**. Ask your administrator for these if you cannot create a tracing key.

Install [uv](https://docs.astral.sh/uv/getting-started/installation/). It uses the checked-in Python version and resolves each example’s dependencies from its uv workspace.

## Configuration

For a fresh checkout:

```bash
git clone https://github.com/BerriAI/litellm-lens-example.git
cd litellm-lens-example/opentelemetry
cp .env.example .env
```

If you already cloned the repository, run the remaining commands from `opentelemetry/`. Copy [.env.example](https://github.com/BerriAI/litellm-lens-example/blob/79e58f44692b09a68b569ff104b36d0b00712272/opentelemetry/.env.example) to `.env` if it does not exist, then set:

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

A manual `research_agent` span wraps one OpenAI model call.

```bash
uv run --env-file .env --package lens-opentelemetry-simple simple/main.py
```

See [simple/main.py](https://github.com/BerriAI/litellm-lens-example/blob/79e58f44692b09a68b569ff104b36d0b00712272/opentelemetry/simple/main.py) for the implementation.

### Agent swarm

A `research_agent` span contains `search_agent` and `writer_agent` child spans, each making a model call.

```bash
uv run --env-file .env --package lens-opentelemetry-swarm swarm/main.py
```

See [swarm/main.py](https://github.com/BerriAI/litellm-lens-example/blob/79e58f44692b09a68b569ff104b36d0b00712272/opentelemetry/swarm/main.py) for the implementation.

## Verify the trace

After the example prints its answer, open **Lens > Traces** on your gateway and select the new run. Look for the run associated with `research_agent`. Inspect the input, output, and model spans. For the swarm, inspect the specialist activity described above; its exact span layout depends on the framework.

## How tracing works

The examples create agent spans manually and set their names, inputs, and outputs. OpenInference instruments the OpenAI client, and the shared gateway transport adds request-attempt spans with gateway call IDs.

See the [shared gateway transport](https://github.com/BerriAI/litellm-lens-example/blob/79e58f44692b09a68b569ff104b36d0b00712272/shared/README.md) for request-attempt and spend-correlation details.

## Troubleshooting

If model calls fail, check the gateway URL, key, and model alias. If an answer appears but the trace is missing, check the terminal for exporter errors and confirm the Lens ingestion service is reachable with your tracing key. A model call succeeding does not confirm that its trace export succeeded.
