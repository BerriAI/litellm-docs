---
title: "OpenAI Agents SDK"
description: "Run OpenAI Agents SDK examples and send their agent traces to LiteLLM Lens."
slug: "/proxy/lens/integrations/openai-agents"
sidebar_label: "OpenAI Agents SDK"
custom_edit_url: "https://github.com/BerriAI/litellm-lens-example/edit/main/openai-agents/README.md"
mdx:
  format: md
---

<!-- Generated from BerriAI/litellm-lens-example/openai-agents/README.md at a2294277609202247b71c08d7b491f5212809988. Edit the source README. -->

# OpenAI Agents SDK

For optional help from your coding agent, use [Set it up for me](https://github.com/BerriAI/lens/blob/main/docs/setup-with-agent.md#connect-an-agent-to-lens-already-running). It preserves your model connection and verifies a real trace after setup

Send OpenAI Agents SDK traces to [LiteLLM Lens](/docs/proxy/lens) using the runnable examples in this repository.

## Prerequisites

You need [Lens](https://github.com/BerriAI/lens/blob/main/deploy/lens/README.md), either standalone with ClickHouse or connected to LiteLLM. Open **Traces** and choose **Set up tracing** if the setup panel is not already open. Then create a tracing key, and copy the **Traces endpoint**. Keep provider credentials separate from that telemetry key. The examples support direct OpenAI calls or calls through an existing LiteLLM gateway

Install [uv](https://docs.astral.sh/uv/getting-started/installation/). It uses the checked-in Python version and resolves each example’s dependencies from its uv workspace.

## Configuration

For a fresh checkout:

```bash
git clone https://github.com/BerriAI/litellm-lens-example.git
cd litellm-lens-example/openai-agents
cp .env.direct.example .env
```

If you already cloned the repository, run the remaining commands from `openai-agents/`. For direct provider calls, set `OPENAI_API_KEY` and `OPENAI_MODEL` in `.env`, then set `LENS_URL` and `LENS_TRACING_KEY` as described below. Leave `LITELLM_GATEWAY_URL` unset. Your model requests go to OpenAI while telemetry goes to Lens

For gateway calls, use [.env.example](https://github.com/BerriAI/litellm-lens-example/blob/a2294277609202247b71c08d7b491f5212809988/openai-agents/.env.example) instead and set the three `LITELLM_*` values. These examples retain the gateway request-attempt and spend-correlation behavior

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

The gateway template targets a local development gateway. Replace its model connection values for your deployment. The examples configure their trace exporters in code and explicitly replace the SDK’s default OpenAI trace exporter. They send traces to `LENS_URL/v1/traces` with the tracing key as a bearer token.

Leave `MOCK_LITELLM_GATEWAY_URL` unset unless you intend to send an additional trace copy to the local [recorder](https://github.com/BerriAI/litellm-lens-example/blob/a2294277609202247b71c08d7b491f5212809988/recorder/AGENTS.md).

## Run an example

### Simple agent

A `research_agent` answers one question inside `research_workflow`.

```bash
uv run --env-file .env --package lens-openai-agents-simple simple/main.py
```

See [simple/main.py](https://github.com/BerriAI/litellm-lens-example/blob/a2294277609202247b71c08d7b491f5212809988/openai-agents/simple/main.py) for the implementation.

### Agent swarm

A coordinator invokes `search_agent` and `writer_agent` through agents-as-tools.

```bash
uv run --env-file .env --package lens-openai-agents-swarm swarm/main.py
```

See [swarm/main.py](https://github.com/BerriAI/litellm-lens-example/blob/a2294277609202247b71c08d7b491f5212809988/openai-agents/swarm/main.py) for the implementation.

## Verify the trace

After the example prints its answer, open **Lens > Traces** in your standalone or embedded Lens UI and select the new run. Look for `research_workflow` and its `research_agent` span. Inspect the input, output, and model spans. For the swarm, inspect the specialist activity described above; its exact span layout depends on the framework.

## How tracing works

OpenInference exports SDK agent and Responses API spans to Lens. When a gateway is configured, the shared gateway transport records each physical model request and its gateway call ID, including retries.

See the [shared gateway transport](https://github.com/BerriAI/litellm-lens-example/blob/a2294277609202247b71c08d7b491f5212809988/shared/README.md) for request-attempt and spend-correlation details.

## Troubleshooting

If model calls fail, check the provider key and model name, or the gateway URL, model key and alias when using a gateway. If an answer appears but the trace is missing, check the terminal for exporter errors and confirm the Lens ingestion service is reachable with your tracing key. A model call succeeding does not confirm that its trace export succeeded.

Use a model that supports the Responses API. The swarm also requires tool calls.
