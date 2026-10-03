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

Choose your starting point below. New installations can start all four services with Docker Compose. Existing users can keep their deployment and add only the services they need. If Lens is already installed, go to [upgrading](#upgrade-litellm-and-the-worker)

<Tabs groupId="lens-install" queryString="install">
<TabItem value="compose" label="New installation" default>

This Docker Compose bundle includes LiteLLM, PostgreSQL, ClickHouse, and the Lens worker. Start the first three, then connect the worker once through the dashboard

#### 1. Start LiteLLM

Install [Docker with Compose](https://docs.docker.com/compose/install/). Choose a [LiteLLM release](https://github.com/BerriAI/litellm/releases) that includes the coordinated worker release, and replace `X.Y.Z` below with its version, without `v`

```bash
mkdir litellm-lens
cd litellm-lens
LENS_RELEASE=X.Y.Z
curl -fSLo compose.yaml "https://raw.githubusercontent.com/BerriAI/litellm/v${LENS_RELEASE}/deploy/lens/stack.yaml"
curl -fSLo config.yaml "https://raw.githubusercontent.com/BerriAI/litellm/v${LENS_RELEASE}/deploy/lens/config.yaml"
umask 077
printf 'LITELLM_VERSION=%s\nLITELLM_MASTER_KEY=sk-%s\nLITELLM_SALT_KEY=sk-%s\n' \
  "$LENS_RELEASE" "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" > .env
printf 'POSTGRES_PASSWORD=%s\nCLICKHOUSE_PASSWORD=%s\n' \
  "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" >> .env
docker compose up -d
```

This starts LiteLLM, PostgreSQL, and ClickHouse from published images. Open [http://localhost:4000/ui/](http://localhost:4000/ui/), sign in as `admin` with the `LITELLM_MASTER_KEY` from `.env`, and [add an analysis model](../docker_quick_start.md#3-add-your-first-model)

#### 2. Connect the worker

Go to **Lens > Investigations > Connect worker**, choose the model and monthly budget, then **Get install command**. Expand **Using Docker Compose or Helm?**, copy the worker token, and add it to `.env`:

![Copy the private worker token for Docker Compose or Helm](/img/lens/worker-install.png)

```bash title="Add to .env"
LENS_WORKER_TOKEN=<paste-your-worker-token>
```

Start the worker:

```bash
docker compose --profile lens up -d
```

When the dashboard shows **Worker connected**, continue to [send your first trace](./first-trace.md). Setup is performed once; the same version setting controls LiteLLM and the worker

Keep `.env` private and preserve its salt key and both database volumes. This local stack exposes LiteLLM on localhost. For a public production deployment, use your normal ingress and managed databases

</TabItem>
<TabItem value="existing" label="Existing LiteLLM">

Keep your existing LiteLLM installation and PostgreSQL database. Upgrade LiteLLM to a release that includes the coordinated worker release

There is no need to switch deployment tools or start a second proxy. Preserve your configuration, `DATABASE_URL`, `LITELLM_MASTER_KEY`, and `LITELLM_SALT_KEY`. If your proxy runs without PostgreSQL, [connect a database](../virtual_keys.md#setup) before enabling Lens

If you already use Compose, add the [worker service](https://github.com/BerriAI/litellm/blob/main/deploy/lens/compose.yaml) to your existing project and use the same release version for LiteLLM and the worker. Keep the existing database volumes and project name; the new-installation recipe creates fresh databases and keys

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

[Enable tracing](#configure-an-existing-proxy) with `CLICKHOUSE_URL=http://default:<clickhouse-password>@<clickhouse-host>:8123`, then restart LiteLLM. Keep the ClickHouse port accessible only to your proxy

#### 2. Connect the worker

In the dashboard, go to **Lens > Investigations > Connect worker**, choose an analysis model and monthly budget, then **Get install command**. Copy and run the command on any Docker host that can reach your proxy

The command already contains the matching image, proxy URL, and a limited worker token. No source checkout or second LiteLLM deployment is needed. Wait for **Worker connected**, then [send your first trace](./first-trace.md)

<details>
<summary>Standalone image, Render, and worker-only Compose</summary>

The worker is available independently from [GHCR](https://github.com/BerriAI/litellm/pkgs/container/litellm-lens-worker) and [Docker Hub](https://hub.docker.com/r/litellm/litellm-lens-worker), with tag `vX.Y.Z` matching LiteLLM release `X.Y.Z`. Images support amd64 and arm64, including matching RC and dev versions

On Render or another container host, create a background worker using that image. Set `LITELLM_URL` to your proxy's reachable base URL and `LENS_WORKER_TOKEN` to the token copied from **Using Docker Compose or Helm?** in setup. The worker needs outbound access to LiteLLM and no inbound port

To manage just the worker with Compose, download [`deploy/lens/compose.yaml`](https://github.com/BerriAI/litellm/blob/main/deploy/lens/compose.yaml) and put these values in a private `.env` file:

```bash
LITELLM_VERSION=X.Y.Z
LITELLM_URL=https://your-litellm-proxy
LENS_WORKER_TOKEN=<paste-your-worker-token>
```

Copy the token from **Using Docker Compose or Helm?** in worker setup, then run `docker compose up -d`. `LITELLM_URL` is the proxy's base URL without `/v1`. For another registry, set `LENS_WORKER_IMAGE` instead of `LITELLM_VERSION`. Setting `LENS_WORKER_IMAGE` on the proxy also changes the image shown in its setup command

</details>

</TabItem>
<TabItem value="helm" label="Kubernetes (Helm)">

Use the componentized [LiteLLM Helm deployment](../deploy.md#deploy-with-helm). The chart includes the optional worker; PostgreSQL and ClickHouse are configured separately. For a new installation, deploy LiteLLM and its database connections first. For an existing installation, keep your release, values, and databases

Configure [ClickHouse tracing](#configure-an-existing-proxy), then open **Lens > Investigations > Connect worker** and get a worker token. If you use a different chart or manage Kubernetes manifests yourself, you can keep that setup and deploy the standalone worker image instead

Store the token in a Secret named `litellm-lens-worker`, under key `token`, in the same namespace as LiteLLM. Use your existing secret manager, or save `token=<paste-your-worker-token>` in a private file and create the Secret:

```bash
kubectl -n litellm create secret generic litellm-lens-worker \
  --from-env-file=/path/to/private/lens-worker.env
```

Add this to your existing Helm values:

```yaml title="values.yaml"
lensWorker:
  enabled: true
  tokenSecret:
    name: litellm-lens-worker
    key: token
```

Upgrade to the matching chart version, replacing `X.Y.Z` and using your existing release name and namespace:

```bash
helm upgrade --install litellm oci://ghcr.io/berriai/litellm/chart/litellm \
  --namespace litellm --version X.Y.Z -f values.yaml
```

The chart selects matching gateway and worker images and connects the worker to the backend. Keep the values and Secret for future upgrades. `lensWorker.replicaCount` controls simultaneous investigations; `lensWorker.image.repository`, `lensWorker.image.tag`, and `lensWorker.url` support private registries and external proxies

</TabItem>
</Tabs>

### Upgrade LiteLLM and the worker

You choose when to upgrade. Publishing a new release does not update existing containers. Keep LiteLLM and the worker on matching release versions; PostgreSQL and ClickHouse have their own versions and do not need upgrading with every LiteLLM release

Read the release notes, back up your databases, pause scheduled investigations, and let active investigations finish before upgrading. Preserve your configuration, database volumes, master key, salt key, and worker token. Worker setup is performed once; you do not need a new token for each release

<Tabs groupId="lens-upgrade">
<TabItem value="compose" label="Docker Compose" default>

For the bundled stack, stop the worker and change `LITELLM_VERSION` in the existing `.env` file to the new release, without `v`. Then pull and restart:

```bash
docker compose --profile lens stop lens-worker
# Change LITELLM_VERSION in .env
docker compose --profile lens pull
docker compose --profile lens up -d
```

This updates LiteLLM and the worker together while retaining the databases. Do not repeat the first-install key-generation step or run `down -v`

If you added the worker to your own Compose project, follow the same process with your existing files and shared version setting. Omit `--profile lens` if your worker does not use that profile. If Compose manages only the worker, upgrade LiteLLM separately first, update the worker's `LITELLM_VERSION` or explicit `LENS_WORKER_IMAGE`, then run `docker compose pull` and `docker compose up -d`

</TabItem>
<TabItem value="standalone" label="Docker or hosted worker">

Stop the worker after active investigations finish, then upgrade LiteLLM using your usual deployment process. Recreate the worker with image `ghcr.io/berriai/litellm-lens-worker:vX.Y.Z`, replacing `X.Y.Z` with the upgraded LiteLLM release. The same tag is available on Docker Hub

For a worker started with `docker run`, use your saved install command with the new image tag and remove the stopped container after its replacement connects. Keep its proxy URL, token, and runtime options. For Render or another container host, update the existing worker service's image tag and redeploy it, keeping its environment settings

</TabItem>
<TabItem value="helm" label="Helm">

Upgrade the componentized chart using your existing release name, namespace, values, and token Secret. Replace `X.Y.Z` with the target chart version. Keep workers paused until all LiteLLM pods have finished upgrading, then restore the worker count from your values:

```bash
helm upgrade litellm oci://ghcr.io/berriai/litellm/chart/litellm \
  --namespace litellm --version X.Y.Z -f values.yaml \
  --set lensWorker.replicaCount=0 --wait

kubectl -n litellm wait --for=delete pod \
  -l app.kubernetes.io/instance=litellm,app.kubernetes.io/component=lens-worker \
  --timeout=120s

helm upgrade litellm oci://ghcr.io/berriai/litellm/chart/litellm \
  --namespace litellm --version X.Y.Z -f values.yaml --wait
```

The chart selects matching LiteLLM and worker images. The first Helm command pauses investigations while the gateway and backend update. Wait for the old worker pods to stop, then the final command resumes them with the same token. Use your own release name in the pod selector if it differs from `litellm`. Avoid running different LiteLLM versions against the same Lens data after investigations resume

If you explicitly set image tags in your values, update those overrides too so they do not hold either component on an older version. Custom charts and separately managed worker deployments must update both image versions through their normal deployment process

</TabItem>
</Tabs>

After any upgrade, check for **Worker connected** in the dashboard, run an investigation, and restore any schedules you paused. The gateway checks compatibility before handing out work. An outdated worker waits with an upgrade message, leaving queued investigations untouched; update its image to resume work

RC and dev releases follow the same process using matching version suffixes. Hourly development deployments build the gateway and worker from the same selected commit

For development from source, use `make lens-dev`. Custom container builds must use the same checkout and release identity for both components; follow the [source build instructions](https://github.com/BerriAI/litellm/blob/main/deploy/lens/README.md#release-compatibility). A build without that identity refuses worker setup instead of suggesting an unrelated released image

### Deploy with a coding agent

<AgentDeployPrompt prompt={`Deploy LiteLLM Lens on this machine by following https://docs.litellm.ai/docs/proxy/lens/deployment

1. If a LiteLLM proxy is already running, keep it and its PostgreSQL database. Otherwise choose a published release containing the coordinated Lens worker release and follow the New installation tab. Download its stack and configuration from that release; do not build from source.
2. For an existing proxy, configure ClickHouse tracing using the Existing LiteLLM tab. Check POST /v1/traces and GET /v1/traces with a LiteLLM key.
3. Ask me to open Lens > Investigations > Connect worker, select a model and budget, and get a worker token. For the bundled stack, save it in the private .env file and start the lens profile. For an existing proxy, use its generated Docker command.
4. Confirm the dashboard shows "Worker connected". Keep LiteLLM and the worker on the same release for future upgrades.

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
