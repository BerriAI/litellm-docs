---
title: "DeepAgents"
description: "Run DeepAgents examples and send their agent traces to LiteLLM Lens."
slug: "/proxy/lens/integrations/deepagents"
sidebar_label: "DeepAgents"
custom_edit_url: "https://github.com/BerriAI/litellm-lens-example/edit/main/deepagents/README.md"
mdx:
  format: md
---

<!-- Generated from BerriAI/litellm-lens-example/deepagents/README.md at a2294277609202247b71c08d7b491f5212809988. Edit the source README. -->

# DeepAgents

For optional help from your coding agent, use [Set it up for me](https://github.com/BerriAI/lens/blob/main/docs/setup-with-agent.md#connect-an-agent-to-lens-already-running). It preserves your model connection and verifies a real trace after setup

Send DeepAgents traces to [LiteLLM Lens](/docs/proxy/lens) using the runnable examples in this repository.

## Prerequisites

You need [Lens installed alongside LiteLLM](/docs/proxy/lens/deployment#configure-an-existing-proxy), a key with model access, and a configured model alias. The swarm example needs a model that supports tool calls. In **Lens > Traces > Set up tracing**, click **Generate tracing key** and copy the **Traces endpoint** under **Connection details**. Ask your administrator for these if you cannot create a tracing key.

Install [uv](https://docs.astral.sh/uv/getting-started/installation/). It uses the checked-in Python version and resolves each example’s dependencies from its uv workspace.

## Configuration

For a fresh checkout:

```bash
git clone https://github.com/BerriAI/litellm-lens-example.git
cd litellm-lens-example/deepagents
cp .env.example .env
```

If you already cloned the repository, run the remaining commands from `deepagents/`. Copy [.env.example](https://github.com/BerriAI/litellm-lens-example/blob/a2294277609202247b71c08d7b491f5212809988/deepagents/.env.example) to `.env` if it does not exist, then set:

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

A single deep agent answers one question.

```bash
uv run --env-file .env --package lens-deepagents-simple simple/main.py
```

See [simple/main.py](https://github.com/BerriAI/litellm-lens-example/blob/a2294277609202247b71c08d7b491f5212809988/deepagents/simple/main.py) for the implementation.

### Agent swarm

A coordinator delegates to `search_agent` and `writer_agent` through the built-in `task` tool.

```bash
uv run --env-file .env --package lens-deepagents-swarm swarm/main.py
```

See [swarm/main.py](https://github.com/BerriAI/litellm-lens-example/blob/a2294277609202247b71c08d7b491f5212809988/deepagents/swarm/main.py) for the implementation.

## Verify the trace

After the example prints its answer, open **Lens > Traces** on your gateway and select the new run. Look for the run associated with `research_agent`. Inspect the input, output, and model spans. For the swarm, inspect the specialist activity described above; its exact span layout depends on the framework.

## How tracing works

OpenInference instruments the LangChain runs used by DeepAgents. The examples explicitly use the Responses API; subagent runs nest under the coordinator’s task tool calls.

## Troubleshooting

If model calls fail, check the gateway URL, key, and model alias. If an answer appears but the trace is missing, check the terminal for exporter errors and confirm the Lens ingestion service is reachable with your tracing key. A model call succeeding does not confirm that its trace export succeeded.

Use a gateway model alias that supports the Responses API and tool calls.
