---
title: "Pydantic AI"
description: "Run Pydantic AI examples and send their agent traces to LiteLLM Lens."
slug: "/proxy/lens/integrations/pydantic-ai"
sidebar_label: "Pydantic AI"
custom_edit_url: "https://github.com/BerriAI/litellm-lens-example/edit/main/pydantic-ai/README.md"
mdx:
  format: md
---

<!-- Generated from BerriAI/litellm-lens-example/pydantic-ai/README.md at a6cce7983ec78ef9183627a0b05e0e3ce548b98a. Edit the source README. -->

# Pydantic AI

Send Pydantic AI traces to [LiteLLM Lens](/docs/proxy/lens) using the runnable examples in this repository.

## Prerequisites

You need a LiteLLM gateway with [tracing enabled](/docs/proxy/lens/deployment#configure-an-existing-proxy), a LiteLLM key, and a configured model alias. The swarm example needs a model that supports tool calls. A Lens worker is required for investigations; viewing traces does not require one.

Install uv. It uses the checked-in Python version and resolves each example’s dependencies from its uv workspace.

## Configuration

For a fresh checkout:

```bash
git clone https://github.com/BerriAI/litellm-lens-example.git
cd litellm-lens-example/pydantic-ai
cp .env.example .env
```

If you already cloned the repository, run the remaining commands from `pydantic-ai/`. Copy [.env.example](https://github.com/BerriAI/litellm-lens-example/blob/a6cce7983ec78ef9183627a0b05e0e3ce548b98a/pydantic-ai/.env.example) to `.env` if it does not exist, then set:

| Variable              | Value                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| `LITELLM_GATEWAY_URL` | Your gateway’s base URL without a trailing slash or `/v1`, for example `http://localhost:4002` |
| `LITELLM_API_KEY`     | Your LiteLLM key                                                                               |
| `LITELLM_MODEL`       | A model alias configured on your gateway                                                       |

The checked-in values target a local development gateway. Replace them for your deployment. Keep the exporter settings from `.env.example`; the examples configure their trace exporters in code. They send traces to `LITELLM_GATEWAY_URL/v1/traces` with the LiteLLM key as a bearer token.

Leave `MOCK_LITELLM_GATEWAY_URL` unset unless you intend to send an additional trace copy to the local [recorder](https://github.com/BerriAI/litellm-lens-example/blob/a6cce7983ec78ef9183627a0b05e0e3ce548b98a/recorder/AGENTS.md).

## Run an example

### Simple agent

A `research_agent` answers one question.

```bash
uv run --env-file .env --package lens-pydantic-ai-simple simple/main.py
```

See [simple/main.py](https://github.com/BerriAI/litellm-lens-example/blob/a6cce7983ec78ef9183627a0b05e0e3ce548b98a/pydantic-ai/simple/main.py) for the implementation.

### Agent swarm

A coordinator delegates to `search_agent` and `writer_agent` through tools.

```bash
uv run --env-file .env --package lens-pydantic-ai-swarm swarm/main.py
```

See [swarm/main.py](https://github.com/BerriAI/litellm-lens-example/blob/a6cce7983ec78ef9183627a0b05e0e3ce548b98a/pydantic-ai/swarm/main.py) for the implementation.

### Streaming

Set `LITELLM_STREAM=1` to enable streaming in either example:

```bash
LITELLM_STREAM=1 uv run --env-file .env --package lens-pydantic-ai-simple simple/main.py
```

## Verify the trace

After the example prints its answer, open **Lens > Traces** on your gateway and select the new run. Look for the run associated with `research_agent`. Inspect the input, output, and model spans. For the swarm, inspect the specialist activity described above; its exact span layout depends on the framework.

## How tracing works

Pydantic AI emits agent, tool, and model spans through Agent.instrument\_all(). The shared gateway transport records request attempts and gateway call IDs for matching model calls to spend.

See the [shared gateway transport](https://github.com/BerriAI/litellm-lens-example/blob/a6cce7983ec78ef9183627a0b05e0e3ce548b98a/shared/README.md) for request-attempt and spend-correlation details.

## Troubleshooting

If model calls fail, check the gateway URL, key, and model alias. If an answer appears but the trace is missing, check the terminal for exporter errors and confirm tracing is enabled on the same gateway. A model call succeeding does not confirm that its trace export succeeded.
