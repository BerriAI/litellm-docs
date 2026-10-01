---
title: Deploy Lens
---

import AgentDeployPrompt from '@site/src/components/AgentDeployPrompt';

# Deploy Lens

Lens runs on your infrastructure. Add ClickHouse to store traces and a worker to run investigations. Your existing LiteLLM proxy serves the UI and API; its PostgreSQL database stores investigations and findings.

![The agent sends traces to LiteLLM, which stores them in ClickHouse. The worker requests investigations from LiteLLM and sends results back.](/img/lens-architecture.svg)

The worker only needs outbound access to your proxy. It needs no inbound port, direct database access, or provider key. Analysis calls go through LiteLLM to your selected model, so trace content is sent to that model's provider.

## Choose your starting point

Use the [local Docker stack](#local-docker-stack) to try Lens, or [add tracing to an existing proxy](#configure-an-existing-proxy). Both paths finish by connecting your agent and starting the worker.

### Local Docker stack

The tracing Compose file starts LiteLLM, PostgreSQL, and ClickHouse. The worker is started separately from the dashboard.

```bash
git clone https://github.com/BerriAI/litellm.git
cd litellm/docker
export OPENAI_API_KEY='<your-openai-api-key>'
docker compose -f docker-compose.tracing.yml up --build
```

Open `http://localhost:4002/ui/` and sign in with username `admin` and password `local-tracing-master-key`. This stack uses local development credentials. Use the [production deployment guide](./deploy.md) for a shared or public deployment.

### Existing proxy {#configure-an-existing-proxy}

Your proxy needs PostgreSQL configured through `DATABASE_URL` and a model configured for analysis. Run ClickHouse where the proxy can reach its HTTP port:

```bash
docker run -d --name litellm-clickhouse --restart unless-stopped \
  -e CLICKHOUSE_USER=default \
  -e CLICKHOUSE_PASSWORD='<clickhouse-password>' \
  -e CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT=1 \
  -v clickhouse_data:/var/lib/clickhouse \
  -p 127.0.0.1:8123:8123 \
  clickhouse/clickhouse-server:26.9.6.6
```

This binds ClickHouse to the host's loopback interface. For a containerized or remote proxy, connect them through your private container network or a private host address.

Add tracing to your proxy configuration:

```yaml
general_settings:
  tracing:
    store: clickhouse
```

Set `CLICKHOUSE_URL=http://default:<clickhouse-password>@<clickhouse-host>:8123` on the proxy, then restart it. LiteLLM creates the database and tables at startup.

<details>
<summary>Optional ClickHouse settings</summary>

| Variable | Purpose |
| --- | --- |
| `CLICKHOUSE_READER_URL` | Use a separate SELECT-only account for reads. Defaults to `CLICKHOUSE_URL` |
| `CLICKHOUSE_DATABASE` | Database name. Defaults to `litellm` |

</details>

## Connect your agent

Point your agent's OpenTelemetry OTLP/HTTP exporter at LiteLLM:

| Setting | Value |
| --- | --- |
| Trace endpoint | `https://<your-litellm-proxy>/v1/traces` |
| HTTP header | `Authorization: Bearer <your-litellm-key>` |

Record the task, tool calls, inputs, and final answer. Set `service.name` to a recognizable agent name so you can select it when creating an investigation. Other recorded metadata can be used as advanced filters.

For a working agent example, use [DeepLite](https://github.com/BerriAI/deeplite). Set `LITELLM_DEV_BASE=https://<your-litellm-proxy>/v1/traces` and `LITELLM_DEV_KEY=<your-litellm-key>` in its `.env` file, then run the agent.

Open **Lens > Traces** and check that the run and its content appear. Then return to **Investigations** to connect the worker.

## Start the worker

Select **Connect worker**, choose the analysis model and monthly limit, then select **Get install command**. Run the generated Docker command on a server that can reach your proxy. Keep it private: it contains the worker's credential.

The command already includes a compatible worker image and your proxy address. For the local Docker stack, check **Advanced options > LiteLLM proxy URL** is `http://host.docker.internal:4002`. The status changes to **Worker connected** when the worker checks in.

If you manage containers with Compose, use [`deploy/lens/compose.yaml`](https://github.com/BerriAI/litellm/blob/main/deploy/lens/compose.yaml) with `LITELLM_URL` and `LENS_WORKER_TOKEN` from the generated command. One worker can serve multiple investigations.

Return to the [Lens guide](./lens.md#run-your-first-investigation) to run your first investigation.

## Deploy with a coding agent

<AgentDeployPrompt prompt={`Set up LiteLLM Lens by following https://docs.litellm.ai/docs/proxy/lens_deployment

1. If a LiteLLM proxy exists, reuse it and its PostgreSQL database. Otherwise start docker/docker-compose.tracing.yml for a local development stack.
2. Make ClickHouse reachable from the proxy, configure general_settings.tracing.store: clickhouse and CLICKHOUSE_URL, then restart the proxy.
3. Help me configure my agent's OTLP/HTTP exporter to send traces to <proxy>/v1/traces with a LiteLLM key. Run one task and verify its content under Lens > Traces.
4. Ask me to open Lens > Investigations > Connect worker, choose the model and budget, and provide the generated Docker command privately. Check its proxy URL is reachable from Docker, then run it.
5. Verify the dashboard shows Worker connected and that I can start an investigation.

Never print or commit keys, worker tokens, or passwords. Ask before replacing an existing container, database, or config.`} />

## Troubleshooting

| What you see | What to check |
| --- | --- |
| No traces | Confirm the exporter URL and key, tracing configuration, and proxy access to ClickHouse |
| Waiting for the worker | Check the worker's container logs and `LITELLM_URL`. Pasting a URL alone does not start the worker |
| Model access error | Check the chosen model is allowed by the worker's virtual key by opening the worker status and selecting **Settings** |
| Budget exhausted | Check both the virtual key budget and the investigation's monthly limit |
| Analysis failed | Open the error details, then check the worker logs for the failing request |

Use `docker ps` to find the worker container, then `docker logs <container-id>` to read its logs. For additional network and storage configuration, see the [worker operations guide](https://github.com/BerriAI/litellm/blob/main/deploy/lens/README.md).

When upgrading, keep the proxy and worker compatible. See [upgrading an existing Lens setup](./lens_api.md#upgrading-an-existing-lens-setup).
