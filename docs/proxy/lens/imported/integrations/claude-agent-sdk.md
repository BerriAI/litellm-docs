---
title: "Claude Agent SDK"
description: "Run Claude Agent SDK examples and send their agent traces to LiteLLM Lens."
slug: "/proxy/lens/integrations/claude-agent-sdk"
sidebar_label: "Claude Agent SDK"
custom_edit_url: "https://github.com/BerriAI/litellm-lens-example/edit/main/claude-agent-sdk/README.md"
mdx:
  format: md
---

<!-- Generated from BerriAI/litellm-lens-example/claude-agent-sdk/README.md at a2294277609202247b71c08d7b491f5212809988. Edit the source README. -->

# Claude Agent SDK

For optional help from your coding agent, use [Set it up for me](https://github.com/BerriAI/lens/blob/main/docs/setup-with-agent.md#connect-an-agent-to-lens-already-running). It preserves your model connection and verifies a real trace after setup

Send Claude Agent SDK traces to [LiteLLM Lens](/docs/proxy/lens) using the runnable examples in this repository.

## Prerequisites

You need [Lens installed alongside LiteLLM](/docs/proxy/lens/deployment#configure-an-existing-proxy), a key with model access, and a configured model alias. The swarm example needs a model that supports tool calls. In **Lens > Traces > Set up tracing**, click **Generate tracing key** and copy the **Traces endpoint** under **Connection details**. Ask your administrator for these if you cannot create a tracing key.

Install [uv](https://docs.astral.sh/uv/getting-started/installation/). It uses the checked-in Python version and resolves each example’s dependencies from its uv workspace.

## Configuration

For a fresh checkout:

```bash
git clone https://github.com/BerriAI/litellm-lens-example.git
cd litellm-lens-example/claude-agent-sdk
cp .env.example .env
```

If you already cloned the repository, run the remaining commands from `claude-agent-sdk/`. Copy [.env.example](https://github.com/BerriAI/litellm-lens-example/blob/a2294277609202247b71c08d7b491f5212809988/claude-agent-sdk/.env.example) to `.env` if it does not exist, then set:

| Variable              | Value                                                                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LITELLM_GATEWAY_URL` | Your gateway’s base URL without a trailing slash or `/v1`, for example `http://localhost:4002`                                                                                                    |
| `LITELLM_API_KEY`     | Your LiteLLM model key                                                                                                                                                                            |
| `LENS_URL`            | Copy **Traces endpoint** from Lens tracing setup and remove the final `/v1/traces`. Keep `/lens-ingest` if present. For example, `http://localhost:4318` or `https://gateway.example/lens-ingest` |
| `LENS_TRACING_KEY`    | The dedicated tracing key from Lens tracing setup                                                                                                                                                 |
| `LITELLM_MODEL`       | A model alias configured on your gateway                                                                                                                                                          |

The checked-in values target a local development gateway. Replace them for your deployment. Keep the exporter settings from `.env.example`; the examples configure their trace exporters in code. They send traces to `LENS_URL/v1/traces` with the tracing key as a bearer token.

Leave `MOCK_LITELLM_GATEWAY_URL` unset unless you intend to send an additional trace copy to the local [recorder](https://github.com/BerriAI/litellm-lens-example/blob/a2294277609202247b71c08d7b491f5212809988/recorder/AGENTS.md).

## Run an example

### Simple agent

A `research_agent` answers one question.

```bash
uv run --env-file .env --package lens-claude-agent-sdk-simple simple/main.py
```

See [simple/main.py](https://github.com/BerriAI/litellm-lens-example/blob/a2294277609202247b71c08d7b491f5212809988/claude-agent-sdk/simple/main.py) for the implementation.

### Agent swarm

A coordinator delegates to `search_agent` and `writer_agent` subagents.

```bash
uv run --env-file .env --package lens-claude-agent-sdk-swarm swarm/main.py
```

See [swarm/main.py](https://github.com/BerriAI/litellm-lens-example/blob/a2294277609202247b71c08d7b491f5212809988/claude-agent-sdk/swarm/main.py) for the implementation.

## Verify the trace

After the example prints its answer, open **Lens > Traces** on your gateway and select the new run. Look for the run associated with `research_agent`. Inspect the input, output, and model spans. For the swarm, inspect the specialist activity described above; its exact span layout depends on the framework.

## How tracing works

OpenInference records SDK query and tool spans. The bundled CLI also exports its model and tool spans using the tracing environment configured in the example. Model calls use the gateway’s Anthropic messages endpoint.

## Troubleshooting

If model calls fail, check the gateway URL, key, and model alias. If an answer appears but the trace is missing, check the terminal for exporter errors and confirm the Lens ingestion service is reachable with your tracing key. A model call succeeding does not confirm that its trace export succeeded.

The swarm example uses bypassPermissions for its configured Agent tool. Review the example before adding tools that can modify files or run commands.

## Match model calls to spend

The local [adapter](https://github.com/BerriAI/litellm-lens-example/blob/a2294277609202247b71c08d7b491f5212809988/claude-agent-sdk/gateway.py) adds the actual Anthropic message ID as the `request-id` response header, which the CLI records on its model spans. Streaming response bytes pass through unchanged.

Start it in a separate terminal from `claude-agent-sdk/`, using the gateway configured in `.env`:

```bash
uv run --env-file .env --package lens-claude-agent-sdk-simple gateway.py
```

Run the examples against the adapter. Keep `MOCK_LITELLM_GATEWAY_URL` empty for these commands because the adapter handles any additional recorder export:

```bash
LITELLM_GATEWAY_URL=http://localhost:4319 MOCK_LITELLM_GATEWAY_URL= \
  uv run --env-file .env --package lens-claude-agent-sdk-simple simple/main.py

LITELLM_GATEWAY_URL=http://localhost:4319 MOCK_LITELLM_GATEWAY_URL= \
  uv run --env-file .env --package lens-claude-agent-sdk-swarm swarm/main.py
```

The adapter binds to localhost. `CLAUDE_GATEWAY_PORT` changes its default port `4319`; update the example URL to match. To copy trace exports to the optional recorder, set `MOCK_LITELLM_GATEWAY_URL=http://localhost:4318` when starting the adapter.

Run the adapter checks from this folder:

```bash
uv run --package lens-claude-agent-sdk-simple python -m unittest discover -s . -p test_gateway.py
```

## References

[Claude Agent SDK observability](https://code.claude.com/docs/en/agent-sdk/observability).
