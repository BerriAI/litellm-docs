---
title: "Start standalone Lens"
description: "Run Lens and ClickHouse locally, sign in, and send a first trace without a LiteLLM gateway."
slug: "/proxy/lens/deployment/local"
---

# Start standalone Lens

Run Lens on your computer to inspect agent traces. You need Git, Docker, and Docker Compose v2. Docker must be running. You do not need a LiteLLM gateway, PostgreSQL, or a model provider key to start Lens.

This quickstart builds Lens from the [source repository](https://github.com/BerriAI/lens). The first build can take several minutes. See [Releases and images](./releases.md) for published artifact availability.

## 1. Start Lens

Run these commands in a terminal:

```sh
git clone https://github.com/BerriAI/lens.git
cd lens
./deploy/lens/start
```

The script builds Lens, generates credentials in `deploy/lens/.env`, and starts Lens with ClickHouse. Wait for `Lens is ready at http://localhost:4318/ui/`.

The script keeps existing credentials and stored data when you run it again. Keep the environment file private.

## 2. Sign in

Open [Lens at localhost:4318](http://localhost:4318/ui/). Open `deploy/lens/.env` in your editor and copy the `LENS_ADMIN_TOKEN` value into the Lens sign-in page.

This token is for administrator access. The next step creates a separate tracing key for your agent.

## 3. Send a trace

Follow [Send your first trace](../first-trace.md). The example records one model call. Then use your framework guide to connect your own agent.

For an agent on the same computer, the trace endpoint is `http://localhost:4318/v1/traces`. An agent in another container or on another machine needs an address it can reach. Do not use that agent's `localhost` to refer to your Lens server.

## 4. Choose your next step

To use Lens in an existing LiteLLM dashboard, [connect this Lens deployment](./litellm.md#1-get-the-lens-address). To make Lens available to a team, follow [Docker Compose on a server](./server.md) or [Kubernetes](./kubernetes.md).

You can inspect traces before configuring an analysis model. When you want Lens to investigate them, [configure an analysis model](https://github.com/BerriAI/lens/blob/main/docs/analysis.md) and [create an investigation](../investigations.md).

## Stop and restart

From the Lens repository root, stop the services while keeping their data:

```sh
docker compose -f deploy/lens/compose.yaml down
```

Start them again with `./deploy/lens/start`. Keep `deploy/lens/.env` and the ClickHouse volume. Adding `--volumes` to the stop command deletes stored Lens data.

If startup fails, check Docker and the service logs:

```sh
docker info
docker compose -f deploy/lens/compose.yaml ps
docker compose -f deploy/lens/compose.yaml logs --tail=100 lens clickhouse
```

For help from a coding agent, copy the [standalone setup prompt](https://github.com/BerriAI/lens/blob/main/docs/setup-with-agent.md#start-standalone-lens). For persistent data, use the [backup guide](https://github.com/BerriAI/lens/blob/main/docs/backup.md).
