---
title: "OpenTelemetry"
description: "Run OpenTelemetry examples and send their agent traces to LiteLLM Lens."
slug: "/proxy/lens/integrations/opentelemetry"
sidebar_label: "OpenTelemetry"
custom_edit_url: "https://github.com/BerriAI/litellm-lens-example/edit/main/opentelemetry/README.md"
mdx:
  format: md
---

<!-- Generated from BerriAI/litellm-lens-example/opentelemetry/README.md at a2294277609202247b71c08d7b491f5212809988. Edit the source README. -->

# OpenTelemetry

For optional help from your coding agent, use [Set it up for me](https://github.com/BerriAI/lens/blob/main/docs/setup-with-agent.md#connect-an-agent-to-lens-already-running). It preserves your model connection and verifies a real trace after setup

Send OpenTelemetry traces to [LiteLLM Lens](/docs/proxy/lens) using the runnable examples in this repository.

## Prerequisites

You need [Lens](https://github.com/BerriAI/lens/blob/main/deploy/lens/README.md), either standalone with ClickHouse or connected to LiteLLM. Open **Traces** and choose **Set up tracing** if the setup panel is not already open. Then create a tracing key, and copy the **Traces endpoint**. Keep provider credentials separate from that telemetry key. The examples support direct OpenAI calls or calls through an existing LiteLLM gateway

Install [uv](https://docs.astral.sh/uv/getting-started/installation/). It uses the checked-in Python version and resolves each example’s dependencies from its uv workspace.

## Configuration

For a fresh checkout:

```bash
git clone https://github.com/BerriAI/litellm-lens-example.git
cd litellm-lens-example/opentelemetry
cp .env.direct.example .env
```

If you already cloned the repository, run the remaining commands from `opentelemetry/`. For direct provider calls, set `OPENAI_API_KEY` and `OPENAI_MODEL` in `.env`, then set `LENS_URL` and `LENS_TRACING_KEY` as described below. Leave `LITELLM_GATEWAY_URL` unset. Your model requests go to OpenAI while telemetry goes to Lens

For gateway calls, use [.env.example](https://github.com/BerriAI/litellm-lens-example/blob/a2294277609202247b71c08d7b491f5212809988/opentelemetry/.env.example) instead and set the three `LITELLM_*` values. These examples retain the gateway request-attempt and spend-correlation behavior

| Variable              | Value                                                                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY`      | Your provider credential for direct calls                                                                                                                                                         |
| `OPENAI_MODEL`        | The provider model name for direct calls                                                                                                                                                          |
| `OPENAI_BASE_URL`     | Optional OpenAI-compatible provider base URL, including `/v1` when required by that provider                                                                                                      |
| `LITELLM_GATEWAY_URL` | Your gateway’s base URL without a trailing slash or `/v1`, for example `http://localhost:4002`                                                                                                    |
| `LITELLM_API_KEY`     | Your LiteLLM model key                                                                                                                                                                            |
| `LENS_URL`            | Copy **Traces endpoint** from Lens tracing setup and remove the final `/v1/traces`. Keep `/lens-ingest` if present. For example, `http://localhost:4318` or `https://gateway.example/lens-ingest` |
| `LENS_TRACING_KEY`    | The dedicated tracing key from Lens tracing setup                                                                                                                                                 |
| `LITELLM_MODEL`       | A model alias configured on your LiteLLM gateway                                                                                                                                                  |

The gateway template targets a local development gateway. Replace its model connection values for your deployment. Keep the exporter settings from `.env.example`; the examples configure their trace exporters in code. They send traces to `LENS_URL/v1/traces` with the tracing key as a bearer token.

Leave `MOCK_LITELLM_GATEWAY_URL` unset unless you intend to send an additional trace copy to the local [recorder](https://github.com/BerriAI/litellm-lens-example/blob/a2294277609202247b71c08d7b491f5212809988/recorder/AGENTS.md).

## Run an example

### Simple agent

A manual `research_agent` span wraps one OpenAI model call.

```bash
uv run --env-file .env --package lens-opentelemetry-simple simple/main.py
```

See [simple/main.py](https://github.com/BerriAI/litellm-lens-example/blob/a2294277609202247b71c08d7b491f5212809988/opentelemetry/simple/main.py) for the implementation.

### Agent swarm

A `research_agent` span contains `search_agent` and `writer_agent` child spans, each making a model call.

```bash
uv run --env-file .env --package lens-opentelemetry-swarm swarm/main.py
```

See [swarm/main.py](https://github.com/BerriAI/litellm-lens-example/blob/a2294277609202247b71c08d7b491f5212809988/opentelemetry/swarm/main.py) for the implementation.

## Verify the trace

After the example prints its answer, open **Lens > Traces** in your standalone or embedded Lens UI and select the new run. Look for the run associated with `research_agent`. Inspect the input, output, and model spans. For the swarm, inspect the specialist activity described above; its exact span layout depends on the framework.

## How tracing works

The examples create agent spans manually and set their names, inputs, and outputs. OpenInference instruments the OpenAI client, and, when a gateway is configured, the shared gateway transport adds request-attempt spans with gateway call IDs.

See the [shared gateway transport](https://github.com/BerriAI/litellm-lens-example/blob/a2294277609202247b71c08d7b491f5212809988/shared/README.md) for request-attempt and spend-correlation details.

## Troubleshooting

If model calls fail, check the provider key and model name, or the gateway URL, model key and alias when using a gateway. If an answer appears but the trace is missing, check the terminal for exporter errors and confirm the Lens ingestion service is reachable with your tracing key. A model call succeeding does not confirm that its trace export succeeded.
