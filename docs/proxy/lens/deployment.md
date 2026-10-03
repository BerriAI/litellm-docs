---
title: "Deployment"
description: "Add ClickHouse and a Lens worker to your LiteLLM gateway."
slug: "/proxy/lens/deployment"
---

# Deployment

import AgentDeployPrompt from '@site/src/components/AgentDeployPrompt';

## Stack {#quick-start}

![LiteLLM Lens architecture: your agent sends LLM calls and traces to LiteLLM, which stores traces in ClickHouse; the Lens worker polls LiteLLM for investigations.](/img/lens-architecture.svg)

Lens adds two things to your LiteLLM stack: ClickHouse and the Lens worker. PostgreSQL is the same database your proxy already uses.

| Component | What it does | What we use |
| --- | --- | --- |
| LiteLLM proxy | Receives traces, serves the Lens UI and API | [`ghcr.io/berriai/litellm`](https://github.com/BerriAI/litellm/pkgs/container/litellm) with [tracing enabled](#configure-an-existing-proxy) |
| ClickHouse (new) | Stores traces and request logs | [`clickhouse/clickhouse-server:26.9.6.6`](https://hub.docker.com/r/clickhouse/clickhouse-server/tags?name=26.9.6.6) |
| Lens worker (new) | Runs investigations on your infrastructure. It polls LiteLLM over HTTPS and needs no database access or provider keys | [`ghcr.io/berriai/litellm-lens-worker`](https://github.com/BerriAI/litellm/pkgs/container/litellm-lens-worker), [`deploy/lens/compose.yaml`](https://github.com/BerriAI/litellm/blob/main/deploy/lens/compose.yaml) |
| PostgreSQL | Stores lenses, findings, and keys | Your existing LiteLLM database |

### One-click Docker

For a new deployment, the [tracing Docker Compose stack](https://github.com/BerriAI/litellm/blob/main/docker/docker-compose.tracing.yml) starts LiteLLM, PostgreSQL, and ClickHouse together:

```bash
git clone https://github.com/BerriAI/litellm.git
cd litellm/docker
export OPENAI_API_KEY=sk-...
docker compose -f docker-compose.tracing.yml up --build
```

Open `http://localhost:4002/ui/` and sign in with username `admin` and password `local-tracing-master-key`. Then [connect the analyzer](./investigations.md#connect-the-analyzer) to start the Lens worker.

For an existing proxy, deploy ClickHouse where the proxy can reach it, then [enable tracing on your proxy](#configure-an-existing-proxy). In the examples below, replace `https://<your-litellm-proxy>` with your LiteLLM proxy URL.

### Deploy with a coding agent

<AgentDeployPrompt prompt={`Deploy LiteLLM Lens on this machine by following https://docs.litellm.ai/docs/proxy/lens/deployment

1. If a LiteLLM proxy is already running, keep it and its PostgreSQL database. Otherwise clone https://github.com/BerriAI/litellm and start docker/docker-compose.tracing.yml, which runs LiteLLM, PostgreSQL, and ClickHouse.
2. For an existing proxy, run ClickHouse (clickhouse/clickhouse-server:26.9.6.6) where the proxy can reach it. Add general_settings.tracing.store:
      type: clickhouse to the proxy config, set CLICKHOUSE_URL (and optionally a SELECT-only CLICKHOUSE_READER_URL), and restart the proxy.
3. Check tracing works: POST an OTLP/HTTP trace to <proxy>/v1/traces with Authorization: Bearer <key>, then GET <proxy>/v1/traces and confirm it is listed.
4. Ask me to open the dashboard, go to Observability > Lens > Investigations > Connect worker, and paste the generated worker command. Run it, or use https://github.com/BerriAI/litellm/blob/main/deploy/lens/compose.yaml with LITELLM_URL and LENS_WORKER_TOKEN.
5. Confirm the dashboard shows "Worker connected".

Never print or commit keys, worker tokens, or passwords. Ask me before replacing an existing container, database, or config.`} />

### Docker deployment

Use these steps to add Lens to a LiteLLM proxy you already run. If you don't have one yet, follow the [Docker quick start](/docs/proxy/docker_quick_start) or [production deployment](/docs/proxy/deploy) guide first. Lens also needs the PostgreSQL database configured through `DATABASE_URL`.

#### 1. Deploy ClickHouse

Run ClickHouse where your proxy can reach port `8123`:

```bash
docker run -d --name litellm-clickhouse --restart unless-stopped \
  -e CLICKHOUSE_USER=default \
  -e CLICKHOUSE_PASSWORD=<clickhouse-password> \
  -e CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT=1 \
  -v clickhouse_data:/var/lib/clickhouse \
  -p 8123:8123 \
  clickhouse/clickhouse-server:26.9.6.6
```

The URL your proxy needs is `http://default:<clickhouse-password>@<clickhouse-host>:8123`. LiteLLM creates the `litellm` database and tables on startup.

#### 2. Point LiteLLM at ClickHouse

Add this to your proxy's `config.yaml`:

```yaml
general_settings:
  tracing:
    store:
      type: clickhouse
```

Set these environment variables on the proxy, then restart it:

| Variable | Value |
| --- | --- |
| `CLICKHOUSE_URL` | `http://default:<clickhouse-password>@<clickhouse-host>:8123` |
| `CLICKHOUSE_READER_URL` | Optional. A SELECT-only ClickHouse user, same URL format. Defaults to `CLICKHOUSE_URL` |
| `CLICKHOUSE_DATABASE` | Optional. Defaults to `litellm` |

Check that tracing is on: `curl -H "Authorization: Bearer <your-litellm-key>" https://<your-litellm-proxy>/v1/traces` returns `{"data": [...]}`.

#### 3. Deploy the Lens worker

Open `https://<your-litellm-proxy>/ui/`, go to **Observability > Lens > Investigations**, click **Connect worker**, choose the analysis model and monthly limit, then **Get install command**. Run the generated command on any server that can reach your proxy over HTTPS. It looks like this:

```bash
docker run -d --restart unless-stopped --read-only --cap-drop ALL \
  --tmpfs /tmp:rw,noexec,nosuid,size=1g \
  --security-opt no-new-privileges --platform linux/amd64 --add-host host.docker.internal:host-gateway \
  -e LITELLM_URL=https://<your-litellm-proxy> \
  -e LENS_WORKER_TOKEN=<worker-token-from-the-dashboard> \
  <worker-image-from-your-dashboard>
```

| Variable | Value |
| --- | --- |
| `LITELLM_URL` | Your proxy's base URL, without `/v1`, for example `https://litellm.example.com`. Use `http://host.docker.internal:4000` if the proxy runs on the same machine |
| `LENS_WORKER_TOKEN` | The worker token from **Get install command**. Keep it private |

The worker needs outbound access to `LITELLM_URL` only. It needs no inbound ports, provider keys, or database access. Use [`deploy/lens/compose.yaml`](https://github.com/BerriAI/litellm/blob/main/deploy/lens/compose.yaml) instead if you manage containers with Compose. The dashboard shows **Worker connected** once the worker checks in.

Copy the full command from your dashboard, including its pinned worker image. After upgrading the gateway, use its compatible worker image and recreate the worker with the same proxy URL and token. A running container does not update automatically.

## Configure an existing proxy

Add this to `config.yaml`:

```yaml
general_settings:
  tracing:
    store:
      type: clickhouse
```

Set `CLICKHOUSE_URL` to the ClickHouse HTTP address your proxy can reach. `CLICKHOUSE_DATABASE` defaults to `litellm`. You can set `CLICKHOUSE_READER_URL` to use a separate read-only account; otherwise reads use `CLICKHOUSE_URL`.

Investigations also need PostgreSQL, a configured analysis model, and a connected Lens worker. Keep the proxy and worker versions compatible. See the [tracing config](https://github.com/BerriAI/litellm/blob/main/docker/tracing-config.yaml) and [worker setup guide](https://github.com/BerriAI/litellm/blob/main/deploy/lens/README.md) for deployment details.
