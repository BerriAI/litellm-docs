---
title: "Mastra"
description: "Run Mastra examples and send their agent traces to LiteLLM Lens."
slug: "/proxy/lens/integrations/mastra"
sidebar_label: "Mastra"
custom_edit_url: "https://github.com/BerriAI/litellm-lens-example/edit/main/mastra/README.md"
mdx:
  format: md
---

<!-- Generated from BerriAI/litellm-lens-example/mastra/README.md at a2294277609202247b71c08d7b491f5212809988. Edit the source README. -->

# Mastra

For optional help from your coding agent, use [Set it up for me](https://github.com/BerriAI/lens/blob/main/docs/setup-with-agent.md#connect-an-agent-to-lens-already-running). It preserves your model connection and verifies a real trace after setup

Send Mastra traces to [LiteLLM Lens](/docs/proxy/lens) using the runnable examples in this repository.

## Prerequisites

You need [Lens installed alongside LiteLLM](/docs/proxy/lens/deployment#configure-an-existing-proxy), a key with model access, and a configured model alias. The swarm example needs a model that supports tool calls. In **Lens > Traces > Set up tracing**, click **Generate tracing key** and copy the **Traces endpoint** under **Connection details**. Ask your administrator for these if you cannot create a tracing key.

Use Node.js with built-in TypeScript support and npm. Install dependencies from the repository root so the shared npm workspaces are available.

## Configuration

For a fresh checkout:

```bash
git clone https://github.com/BerriAI/litellm-lens-example.git
cd litellm-lens-example
npm install
cd mastra
cp .env.example .env
```

If you already cloned the repository, run the remaining commands from `mastra/`. Run `npm install` from the repository root if you have not installed the workspace dependencies. Copy [.env.example](https://github.com/BerriAI/litellm-lens-example/blob/a2294277609202247b71c08d7b491f5212809988/mastra/.env.example) to `.env` if it does not exist, then set:

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
node --env-file=.env simple/main.ts
```

See [simple/main.ts](https://github.com/BerriAI/litellm-lens-example/blob/a2294277609202247b71c08d7b491f5212809988/mastra/simple/main.ts) for the implementation.

### Agent swarm

A coordinator delegates to `search_agent` and `writer_agent` subagents.

```bash
node --env-file=.env swarm/main.ts
```

See [swarm/main.ts](https://github.com/BerriAI/litellm-lens-example/blob/a2294277609202247b71c08d7b491f5212809988/mastra/swarm/main.ts) for the implementation.

## Verify the trace

After the example prints its answer, open **Lens > Traces** on your gateway and select the new run. Look for the run associated with `research_agent`. Inspect the input, output, and model spans. For the swarm, inspect the specialist activity described above; its exact span layout depends on the framework.

## How tracing works

Mastra’s OtelBridge converts agent, step, model, and tool spans into OpenTelemetry spans exported by the NodeSDK. The shared gateway fetch records request attempts and gateway call IDs.

See the [shared gateway transport](https://github.com/BerriAI/litellm-lens-example/blob/a2294277609202247b71c08d7b491f5212809988/shared/README.md) for request-attempt and spend-correlation details.

## Troubleshooting

If model calls fail, check the gateway URL, key, and model alias. If an answer appears but the trace is missing, check the terminal for exporter errors and confirm the Lens ingestion service is reachable with your tracing key. A model call succeeding does not confirm that its trace export succeeded.

Install npm dependencies from the repository root so all workspaces use the same OpenTelemetry API instance. An in-memory storage warning is expected for these one-shot examples.

## References

[Mastra OpenTelemetry integration](https://mastra.ai/integrations/observability/opentelemetry).
