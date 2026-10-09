---
title: "Local quickstart"
description: "Start Lens with ClickHouse and inspect your first agent trace."
slug: "/proxy/lens/deployment/local"
---

# Local quickstart

Start Lens and ClickHouse with Git and Docker Compose v2. This source preview builds the current Lens checkout; an independently published release bundle is still being qualified. You do not need a LiteLLM gateway or PostgreSQL.

## Start Lens

For optional help from your coding agent, copy the [standalone setup prompt](https://github.com/BerriAI/lens/blob/main/docs/setup-with-agent.md#start-standalone-lens). It includes connecting this project's agent and verifying its first trace

Start Docker, then run:

```bash
git clone https://github.com/BerriAI/lens.git
cd lens
./deploy/lens/start
```

The first start builds the image, generates private credentials in `deploy/lens/.env`, and starts Lens with ClickHouse. Later starts retain those credentials and stored data. Open [http://localhost:4318/ui/](http://localhost:4318/ui/) and sign in with `LENS_ADMIN_TOKEN` from that private file.

## Record a run

Open **Traces** and choose **Set up tracing** if the setup panel is not already open. Choose your framework, create a tracing key and copy its configuration into your agent. Keep your existing model endpoint and model credential. The Lens tracing key authorizes telemetry uploads.

Run your agent, then use **Check for traces** or open **Traces**. Select the run and inspect its messages and tool calls. The **Demo data** switch contains examples and does not verify your connection.

The local trace endpoint is `http://localhost:4318/v1/traces`. That address works for an agent running on the same host. Agents in another container or on another machine need a reachable Lens address; see [deployment configuration](https://github.com/BerriAI/lens/blob/main/deploy/lens/README.md#configure-a-deployment).

For runnable projects, use the [OpenAI Agents SDK](/docs/proxy/lens/integrations/openai-agents) or [OpenTelemetry](/docs/proxy/lens/integrations/opentelemetry) direct-provider template. For personal coding sessions, follow [Claude Code or Codex](../coding-agents.md). A provider key is needed only for model calls.

## Investigate and keep your data

Once traces arrive, [configure an analysis model](https://github.com/BerriAI/lens/blob/main/docs/analysis.md), then create an investigation. You can connect Lens directly to a supported provider or use an existing LiteLLM model endpoint.

Stop the services while retaining their data:

```bash
docker compose -f deploy/lens/compose.yaml down
```

Run `./deploy/lens/start` to start them again. Retain `deploy/lens/.env` and the ClickHouse volume. Adding `--volumes` to `down` deletes stored Lens data. For persistence, troubleshooting and backups, use the [Lens deployment guide](https://github.com/BerriAI/lens/blob/main/deploy/lens/README.md).
