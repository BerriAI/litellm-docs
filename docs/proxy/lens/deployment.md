---
title: "Deployment"
description: "Add ClickHouse and a Lens worker to your LiteLLM gateway."
slug: "/proxy/lens/deployment"
---

# Deployment

import AgentDeployPrompt from '@site/src/components/AgentDeployPrompt';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

## Set up Lens {#quick-start}

Lens runs alongside LiteLLM. The worker investigates recorded activity, ClickHouse stores traces, and PostgreSQL stores findings and settings. The worker only needs access to LiteLLM, with no provider keys or database credentials

![LiteLLM Lens architecture: your agent sends LLM calls and traces to LiteLLM, which stores traces in ClickHouse; the Lens worker polls LiteLLM for investigations.](/img/lens-architecture.svg)

| Component | What it does | What we use |
| --- | --- | --- |
| LiteLLM proxy | Receives traces, serves the Lens UI and API | [`ghcr.io/berriai/litellm`](https://github.com/BerriAI/litellm/pkgs/container/litellm) with [tracing enabled](#configure-an-existing-proxy) |
| ClickHouse (new) | Stores traces and request logs | [`clickhouse/clickhouse-server:26.9.6.6`](https://hub.docker.com/r/clickhouse/clickhouse-server/tags?name=26.9.6.6) |
| Lens worker (new) | Runs investigations on your infrastructure. It polls LiteLLM over HTTPS and needs no database access or provider keys | [`ghcr.io/berriai/litellm-lens-worker-dev`](https://github.com/BerriAI/litellm/pkgs/container/litellm-lens-worker-dev), [`deploy/lens/compose.yaml`](https://github.com/BerriAI/litellm/blob/main/deploy/lens/compose.yaml) |
| PostgreSQL | Stores lenses, findings, and keys | Your existing LiteLLM database, or PostgreSQL from the local tracing stack |

:::info Preview installation

Coordinated Lens worker images and Helm releases are not published yet. For now, use the source setup below or keep your existing working gateway and worker. Both components must come from the same source commit and use the same release identity. The current `v1.105.0-rc.1` release predates this coordinated setup

:::

<Tabs groupId="lens-install" queryString="install">
<TabItem value="compose" label="New local installation" default>

The existing tracing stack starts LiteLLM, PostgreSQL, and ClickHouse. Build its standalone Lens worker from the same checkout, then connect it through the dashboard

#### 1. Build and start LiteLLM

Install [Docker with Compose](https://docs.docker.com/compose/install/) and Git. Run:

```bash
git clone https://github.com/BerriAI/litellm.git
cd litellm
export LITELLM_RELEASE_TAG="sha-$(git rev-parse HEAD)"
export LENS_WORKER_IMAGE="litellm-lens-worker:${LITELLM_RELEASE_TAG}"
export OPENAI_API_KEY='sk-...'
docker build --build-arg LITELLM_RELEASE_TAG="$LITELLM_RELEASE_TAG" \
  -f deploy/lens/Dockerfile -t "$LENS_WORKER_IMAGE" .
docker compose -f docker/docker-compose.tracing.yml up -d --build
```

Replace `sk-...` with your OpenAI key, or configure another provider in `docker/tracing-config.yaml` before starting. The first build takes several minutes. Both images are built locally; these steps do not depend on an unpublished release image

Open [http://localhost:4002/ui/](http://localhost:4002/ui/) and sign in as `admin` with password `sk-1234`

#### 2. Connect the worker

Go to **Lens > Investigations > Connect worker**, choose the analysis model and monthly budget, then **Get install command**. Run the command on the same Docker host where you built the worker. It already contains the worker image, proxy URL, and limited worker token

When the dashboard shows **Worker connected**, [send your first trace](./first-trace.md). Keep the command private and save it for future upgrades

This stack is for local evaluation. It binds to localhost and uses development database credentials. For a hosted installation, use your normal ingress, private credentials, and database backups. Preserve both database volumes; do not use `docker compose down -v` when upgrading

</TabItem>
<TabItem value="existing" label="Existing LiteLLM">

Keep your existing deployment, PostgreSQL database, configuration, master key, and salt key. If Lens already works, keep that gateway and worker together until you are ready to upgrade. You do not need to move to a different deployment tool

For a new Lens setup during the preview, use a source deployment with coordinated Lens support. Record the exact source commit and `LITELLM_RELEASE_TAG` used to build your running gateway. The worker needs both to match. These instructions do not retrofit that support into the existing RC

#### 1. Enable trace storage

If tracing already works, skip to the worker. Otherwise, run ClickHouse where LiteLLM can reach it:

```bash
docker run -d --name litellm-clickhouse --restart unless-stopped \
  -e CLICKHOUSE_USER=default \
  -e CLICKHOUSE_PASSWORD=<clickhouse-password> \
  -e CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT=1 \
  -v clickhouse_data:/var/lib/clickhouse \
  -p 8123:8123 \
  clickhouse/clickhouse-server:26.9.6.6
```

[Enable tracing](#configure-an-existing-proxy) with `CLICKHOUSE_URL=http://default:<clickhouse-password>@<clickhouse-host>:8123`, then restart LiteLLM. Keep the ClickHouse port accessible only to your proxy. Lens also requires PostgreSQL through `DATABASE_URL`

#### 2. Prepare the matching worker image

Public source workers use `ghcr.io/berriai/litellm-lens-worker-dev:sha-<full-commit>`. They currently support amd64 and publish on Lens-related changes. Use one only when its commit and `sha-<full-commit>` release identity match your gateway. Check that the exact image exists:

```bash
docker buildx imagetools inspect \
  ghcr.io/berriai/litellm-lens-worker-dev:sha-<full-commit>
```

If the image is unavailable, your gateway uses a different release identity, or you need native arm64, check out the gateway's exact source revision and build the worker there:

```bash
export LITELLM_RELEASE_TAG='<gateway-release-identity>'
export LENS_WORKER_IMAGE='<your-registry>/litellm-lens-worker:<your-image-tag>'
docker build --build-arg LITELLM_RELEASE_TAG="$LITELLM_RELEASE_TAG" \
  -f deploy/lens/Dockerfile -t "$LENS_WORKER_IMAGE" .
```

For another Docker host or a hosting service, publish the image to a registry that host can pull from. Configure `LENS_WORKER_IMAGE` on the gateway to that image, preferably by digest, and restart through your normal deployment process. Keep the gateway's existing release identity; changing it does not make a different worker compatible

#### 3. Connect the worker

Open **Lens > Investigations > Connect worker**, choose an analysis model and monthly budget, then **Get install command**. Run it on a Docker host that has the matching image and can reach your proxy. Wait for **Worker connected**, then [send your first trace](./first-trace.md)

<details>
<summary>Render, Kubernetes, and worker-only Compose</summary>

On Render or another container host, use the matching standalone worker image. Set `LITELLM_URL` to your proxy's reachable base URL, without `/v1`, and `LENS_WORKER_TOKEN` to the token copied from **Using Docker Compose or Helm?** in setup. The worker needs outbound access to LiteLLM and no inbound port

For Kubernetes, keep the token in a Secret and use the same image and two environment variables in your worker deployment. An existing source chart with Lens support can use an explicit `lensWorker.image.repository` and `lensWorker.image.digest`, plus its token Secret. Published chart versions do not yet provide this installation path

For worker-only Compose, download [`deploy/lens/compose.yaml`](https://github.com/BerriAI/litellm/blob/main/deploy/lens/compose.yaml) and use a private `.env` file:

```bash
LENS_WORKER_IMAGE=<matching-worker-image>
LITELLM_URL=https://your-litellm-proxy
LENS_WORKER_TOKEN=<paste-your-worker-token>
```

Run `docker compose up -d`. Use the explicit image during the preview; the `LITELLM_VERSION` shortcut requires a published coordinated worker release

</details>

</TabItem>
</Tabs>

### Upgrade LiteLLM and the worker

Publishing an image does not update an existing container. Pause scheduled investigations and let active investigations finish. Keep your databases, configuration, master key, salt key, and worker token

Choose one source commit for the next gateway and worker, and build both with the same release identity. Make the worker image available before updating the gateway's `LENS_WORKER_IMAGE`. Upgrade the gateway through your normal process, then recreate or redeploy the worker with the new image and its existing URL and token. Do not mix a released gateway with the newest source worker

For the local tracing stack, stop your standalone worker, update your source checkout, and repeat the build commands in **New local installation**. Keep the same Compose project and database volumes. Recreate the worker from your saved command with the new `LENS_WORKER_IMAGE`; do not register a new worker just to upgrade

For Render, update and redeploy the existing worker service. For worker-only Compose, update `LENS_WORKER_IMAGE` in `.env`, then run `docker compose pull` and `docker compose up -d`. Kubernetes users update their worker deployment or explicit chart image override alongside the gateway

After upgrading, confirm **Worker connected**, run an investigation, and restore paused schedules. The gateway checks compatibility before handing out work. An incompatible worker waits without consuming queued investigations

### Deploy with a coding agent

<AgentDeployPrompt prompt={`Deploy the current Lens preview by following https://docs.litellm.ai/docs/proxy/lens/deployment

1. If LiteLLM is already running, preserve its deployment, PostgreSQL database, configuration, master key, and salt key. Confirm its source commit and release identity before choosing a worker.
2. For a new local installation, follow the source-build commands in New local installation. Build the gateway and standalone worker from the same checkout and release identity. Coordinated public worker releases are not available yet.
3. Configure ClickHouse tracing and confirm a trace can be written and read through LiteLLM.
4. Ask me to open Lens > Investigations > Connect worker, select a model and budget, and get the install command. Confirm its image exists on the Docker host or in an accessible registry, then run it.
5. Confirm Worker connected and complete an investigation. Explain how to upgrade both components while preserving the databases and worker token.

Never print or commit keys, worker tokens, or passwords. Ask me before replacing an existing container, database, or config.`} />

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
