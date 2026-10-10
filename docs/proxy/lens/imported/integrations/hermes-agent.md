---
title: "Hermes Agent"
description: "Run Hermes Agent examples and send their agent traces to LiteLLM Lens."
slug: "/proxy/lens/integrations/hermes-agent"
sidebar_label: "Hermes Agent"
custom_edit_url: "https://github.com/BerriAI/litellm-lens-example/edit/main/hermes-agent/README.md"
mdx:
  format: md
---

<!-- Generated from BerriAI/litellm-lens-example/hermes-agent/README.md at a2294277609202247b71c08d7b491f5212809988. Edit the source README. -->

# Hermes Agent

For optional help from your coding agent, use [Set it up for me](https://github.com/BerriAI/lens/blob/main/docs/setup-with-agent.md#connect-an-agent-to-lens-already-running). It preserves your model connection and verifies a real trace after setup

Send [Hermes Agent](https://github.com/NousResearch/hermes-agent) traces to [LiteLLM Lens](/docs/proxy/lens) using the runnable examples in this repository. The examples embed Hermes as a Python library and export its traces with the [hermes-otel](https://github.com/briancaffey/hermes-otel) plugin.

## Prerequisites

You need [Lens installed alongside LiteLLM](/docs/proxy/lens/deployment#configure-an-existing-proxy), a key with model access, and a configured model alias. The swarm example needs a model that supports tool calls. In **Lens > Traces > Set up tracing**, click **Generate tracing key** and copy the **Traces endpoint** under **Connection details**. Ask your administrator for these if you cannot create a tracing key.

Install [uv](https://docs.astral.sh/uv/getting-started/installation/) and Git. Hermes requires CPython 3.14 with the GIL; the checked-in `.python-version` selects it, and `uv python install 3.14` installs it if uv only finds a free-threaded build.

## Configuration

Hermes does not publish a wheel, so the examples install a pinned source checkout in editable mode. For a fresh checkout:

```bash
git clone https://github.com/BerriAI/litellm-lens-example.git
cd litellm-lens-example/hermes-agent
git clone https://github.com/NousResearch/hermes-agent.git vendor/hermes-agent
git -C vendor/hermes-agent checkout c225c4a04e8b517a357804ebb27367b0c961fd0e
uv sync --all-packages
HERMES_HOME="$PWD/home" uv run --package lens-hermes-agent-simple hermes plugins install briancaffey/hermes-otel/hermes_otel --ref d234865b13e997e0b3a50dc18aaad7c7d7b1b1fe --yes-deps --enable
cp .env.example .env
```

If you already cloned the repository, run the remaining commands from `hermes-agent/`. The plugin installs into `home/`, the Hermes home directory both examples use. Copy [.env.example](https://github.com/BerriAI/litellm-lens-example/blob/a2294277609202247b71c08d7b491f5212809988/hermes-agent/.env.example) to `.env` if it does not exist, then set:

| Variable              | Value                                                                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LITELLM_GATEWAY_URL` | Your gateway’s base URL without a trailing slash or `/v1`, for example `http://localhost:4000`                                                                                                    |
| `LITELLM_API_KEY`     | Your LiteLLM model key                                                                                                                                                                            |
| `LENS_URL`            | Copy **Traces endpoint** from Lens tracing setup and remove the final `/v1/traces`. Keep `/lens-ingest` if present. For example, `http://localhost:4318` or `https://gateway.example/lens-ingest` |
| `LENS_TRACING_KEY`    | The dedicated tracing key from Lens tracing setup                                                                                                                                                 |
| `LITELLM_MODEL`       | A model alias configured on your gateway                                                                                                                                                          |

The checked-in values target a local development gateway. Replace them for your deployment. [home/hermes\_otel.yaml](https://github.com/BerriAI/litellm-lens-example/blob/a2294277609202247b71c08d7b491f5212809988/hermes-agent/home/hermes_otel.yaml) sends traces to `LENS_URL/v1/traces` with the tracing key as a bearer token.

## Run an example

### Simple agent

One Hermes turn with no tools answers a question in a single model call.

```bash
uv run --env-file .env --package lens-hermes-agent-simple simple/main.py
```

See [simple/main.py](https://github.com/BerriAI/litellm-lens-example/blob/a2294277609202247b71c08d7b491f5212809988/hermes-agent/simple/main.py) for the implementation.

### Agent swarm

The coordinator hands fact gathering and drafting to two subagents with `delegate_task`, then answers from their results. Hermes runs top-level delegations in the background and returns their results as a follow-up turn, so the example waits for the subagents before running that turn.

```bash
uv run --env-file .env --package lens-hermes-agent-swarm swarm/main.py
```

See [swarm/main.py](https://github.com/BerriAI/litellm-lens-example/blob/a2294277609202247b71c08d7b491f5212809988/hermes-agent/swarm/main.py) for the implementation.

## Verify the trace

After the example prints its answer, open **Lens > Traces** on your gateway and select the new run from the `hermes-agent` service. Each Hermes turn is one trace rooted at an `agent` span, with an `llm.<model>` span per turn and an `api.<model>` span per model request. Trace spend should equal the spend logs for those requests.

For the swarm, the first trace contains the `tool.delegate_task` call and one `subagent.leaf` span per subagent, each nesting the subagent's own `agent` turn. The follow-up turn that reads the subagents' results is a second trace in the same Hermes session.

## How tracing works

hermes-otel turns Hermes lifecycle hooks into OpenInference and GenAI spans. Its spans carry no gateway response ID, so the examples route Hermes through the `litellm` provider in [home/plugins/model-providers/litellm](https://github.com/BerriAI/litellm-lens-example/blob/a2294277609202247b71c08d7b491f5212809988/hermes-agent/home/plugins/model-providers/litellm/__init__.py). That provider gives each Hermes OpenAI client the [shared gateway transport](https://github.com/BerriAI/litellm-lens-example/blob/a2294277609202247b71c08d7b491f5212809988/shared/README.md), which adds a request-attempt span with the gateway call ID under the active `api.<model>` span. hermes-otel never makes its spans current, so the provider looks up the active span for the request's Hermes session through hermes-otel's `get_current_traceparent`.

To trace your own Hermes install, copy the provider plugin into `~/.hermes/plugins/model-providers/`, install `gateway-tracing` into the Hermes environment, and select the `litellm` provider.

## Troubleshooting

If model calls fail, check the gateway URL, key, and model alias. If an answer appears but the trace is missing, set `HERMES_OTEL_DEBUG=true` and check `home/plugins/hermes_otel/debug.log` and the terminal for exporter errors, and confirm the Lens ingestion service is reachable with your tracing key. A model call succeeding does not confirm that its trace export succeeded.

If a trace shows no spend, confirm the examples pass `provider="litellm"` and that each `api.<model>` span has a `gateway.request` child. If the process exits with a segmentation fault, uv selected a free-threaded Python: run `uv python install 3.14`, remove `.venv` and `home/installs`, and repeat the setup.
