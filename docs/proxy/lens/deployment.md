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

Choose your starting point below. New installations can start all four services with Docker Compose. Existing users can keep their deployment and add only the services they need. If Lens is already installed, go to [upgrading](#upgrade-litellm-and-the-worker)

Build LiteLLM and its worker from the same source commit and use the same release identity

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

Replace `sk-...` with your OpenAI key, or configure another provider in `docker/tracing-config.yaml` before starting. The first build takes several minutes. Both images are built locally from the same checkout

Open [http://localhost:4002/ui/](http://localhost:4002/ui/) and sign in as `admin` with password `sk-1234`

#### 2. Connect the worker

Go to **Lens > Investigations > Connect worker**, choose the analysis model and monthly budget, then **Get install command**. Expand **Using Docker Compose or Helm?** and copy the worker token

![Copy the private worker token for Docker Compose or Helm](/img/lens/worker-install.png)

In the same terminal, start the worker on the gateway's Docker network:

```bash
export LITELLM_URL=http://litellm:4000
export LENS_WORKER_TOKEN='<paste-your-worker-token>'
docker compose -f docker/docker-compose.tracing.yml -f deploy/lens/compose.yaml up -d
```

When the dashboard shows **Worker connected**, [send your first trace](./first-trace.md). Keep the token private and save it for restarts and upgrades

This stack is for local evaluation. It binds to localhost and uses development database credentials. For a hosted installation, use your normal ingress, private credentials, and database backups. Preserve both database volumes; do not use `docker compose down -v` when upgrading

</TabItem>
<TabItem value="existing" label="Existing LiteLLM">

Keep your existing LiteLLM installation and PostgreSQL database. For a new Lens setup, use a source deployment with Lens support. Record the exact source commit and `LITELLM_RELEASE_TAG` used to build your running gateway; the worker needs both to match

There is no need to switch deployment tools or start a second proxy. Preserve your configuration, `DATABASE_URL`, `LITELLM_MASTER_KEY`, and `LITELLM_SALT_KEY`. If your proxy runs without PostgreSQL, [connect a database](../virtual_keys.md#setup) before enabling Lens

If you already use Compose, add the [worker service](https://github.com/BerriAI/litellm/blob/main/deploy/lens/compose.yaml) to your existing project and set `LENS_WORKER_IMAGE` to the matching worker. Keep the existing database volumes and project name; the new-installation recipe creates fresh databases and keys

#### 1. Enable trace storage

If tracing already works, skip to the worker. Otherwise, run ClickHouse where LiteLLM can reach it:

```bash
docker run -d --name litellm-clickhouse --restart unless-stopped \
  -e CLICKHOUSE_USER=default \
  -e CLICKHOUSE_PASSWORD='<clickhouse-password>' \
  -e CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT=1 \
  -v clickhouse_data:/var/lib/clickhouse \
  -p 8123:8123 \
  clickhouse/clickhouse-server:26.9.6.6
```

[Enable tracing](#configure-an-existing-proxy) with `CLICKHOUSE_URL=http://default:<clickhouse-password>@<clickhouse-host>:8123`, then restart LiteLLM. Keep the ClickHouse port accessible only to your proxy

#### 2. Prepare the matching worker image

Public source workers use `ghcr.io/berriai/litellm-lens-worker-dev:sha-<full-commit>`. They support amd64 and publish on Lens-related changes. Use one only when its commit and `sha-<full-commit>` release identity match your gateway. Check that the exact image exists:

```bash
docker buildx imagetools inspect \
  'ghcr.io/berriai/litellm-lens-worker-dev:sha-<full-commit>'
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
<summary>Standalone image, Render, and worker-only Compose</summary>

On Render or another container host, use the matching standalone worker image. Set `LITELLM_URL` to your proxy's reachable base URL, without `/v1`, and `LENS_WORKER_TOKEN` to the token copied from **Using Docker Compose or Helm?** in setup. The worker needs outbound access to LiteLLM and no inbound port

For worker-only Compose, download [`deploy/lens/compose.yaml`](https://github.com/BerriAI/litellm/blob/main/deploy/lens/compose.yaml) and use a private `.env` file:

```bash
LENS_WORKER_IMAGE=<matching-worker-image>
LITELLM_URL=https://your-litellm-proxy
LENS_WORKER_TOKEN=<paste-your-worker-token>
```

Run `docker compose up -d`. Keep `LENS_WORKER_IMAGE` matched to your gateway when upgrading

</details>

</TabItem>
<TabItem value="helm" label="Kubernetes (Helm)">

Use the componentized source chart at [`helm/litellm`](https://github.com/BerriAI/litellm/tree/main/helm/litellm) from the same checkout as your gateway. The chart includes the optional worker; PostgreSQL and ClickHouse are configured separately. For a new installation, deploy LiteLLM and its database connections first. For an existing installation, keep your release, values, and databases

Configure [ClickHouse tracing](#configure-an-existing-proxy), then open **Lens > Investigations > Connect worker** and get a worker token. If you use a different chart or manage Kubernetes manifests yourself, you can keep that setup and deploy the standalone worker image instead

Store the token in a Secret named `litellm-lens-worker`, under key `token`, in the same namespace as LiteLLM. Use your existing secret manager, or save `token=<paste-your-worker-token>` in a private file and create the Secret:

```bash
kubectl -n litellm create secret generic litellm-lens-worker \
  --from-env-file=/path/to/private/lens-worker.env
```

Build or select the worker image using the **Existing LiteLLM** instructions. Add its repository and digest to your existing Helm values:

```yaml title="values.yaml"
lensWorker:
  enabled: true
  image:
    repository: <your-worker-image-repository>
    digest: sha256:<matching-worker-image-digest>
  tokenSecret:
    name: litellm-lens-worker
    key: token
```

Keep your existing component image overrides and database settings in `values.yaml`. They must name images built from the same source commit and release identity as the worker. From that source checkout, use your existing release name and namespace:

```bash
helm upgrade --install litellm ./helm/litellm \
  --namespace litellm -f values.yaml
```

The chart uses your selected images and connects the worker to the backend. **Connect worker** supplies the same digest-pinned image selected in your values. The worker digest must match the gateway's source commit and release identity. Keep the values and Secret for future upgrades. `lensWorker.replicaCount` controls simultaneous investigations; `lensWorker.image.repository`, `lensWorker.image.digest`, and `lensWorker.url` support private registries and external proxies

</TabItem>
</Tabs>

### Upgrade LiteLLM and the worker

You choose when to upgrade. Publishing a new release does not update existing containers. Build LiteLLM and the worker from the same source commit and release identity; PostgreSQL and ClickHouse have their own versions and do not need upgrading with every LiteLLM release

Review the changes, back up your databases, pause scheduled investigations, and let active investigations finish before upgrading. Preserve your configuration, database volumes, master key, salt key, and worker token. Worker setup is performed once; you do not need a new token for each release

<Tabs groupId="lens-upgrade">
<TabItem value="compose" label="Docker Compose" default>

For the local tracing stack, stop the worker before changing your source checkout:

```bash
docker compose -f docker/docker-compose.tracing.yml -f deploy/lens/compose.yaml stop lens-worker
```

Select the new source revision and repeat the build commands in **New local installation**. Keep the same Compose project, database volumes, and saved worker token. Start the worker with both Compose files once the gateway is ready:

```bash
docker compose -f docker/docker-compose.tracing.yml -f deploy/lens/compose.yaml up -d
```

This updates LiteLLM and the worker while retaining the databases. Do not regenerate keys or run `down -v`

If you added the worker to your own Compose project, update its explicit image together with your gateway image. If Compose manages only the worker, upgrade LiteLLM separately first, update `LENS_WORKER_IMAGE`, then run `docker compose pull` and `docker compose up -d`

</TabItem>
<TabItem value="standalone" label="Docker or hosted worker">

Stop the worker after active investigations finish, then upgrade LiteLLM using your usual deployment process. Recreate the worker with an image built from the upgraded gateway's source commit and release identity. Make that image available on the Docker host or in an accessible registry before upgrading

For a worker started with `docker run`, use your saved install command with the new image reference and remove the stopped container after its replacement connects. Keep its proxy URL, token, and runtime options. For Render or another container host, update the existing worker service's image reference and redeploy it, keeping its environment settings

</TabItem>
<TabItem value="helm" label="Helm">

Use the source chart from the selected gateway checkout. Update your component and worker image overrides in your existing values; preserve the release name, namespace, and token Secret. Keep workers paused until all LiteLLM pods have finished upgrading, then restore the worker count from your values:

```bash
helm upgrade litellm ./helm/litellm \
  --namespace litellm -f values.yaml \
  --set lensWorker.replicaCount=0 --wait

kubectl -n litellm wait --for=delete pod \
  -l app.kubernetes.io/instance=litellm,app.kubernetes.io/component=lens-worker \
  --timeout=120s

helm upgrade litellm ./helm/litellm \
  --namespace litellm -f values.yaml --wait
```

The chart uses the matching images you selected in your values. Pinning the worker by digest keeps the selected image across restarts even if its registry tag changes. The first Helm command pauses investigations while the gateway and backend update. Wait for the old worker pods to stop, then the final command resumes them with the same token. Use your own release name in the pod selector if it differs from `litellm`. Avoid running different LiteLLM versions against the same Lens data after investigations resume

Update both image tags and digests in your values so neither component remains on an older build. A worker digest takes precedence over its tag. Custom charts and separately managed worker deployments must update both image versions through their normal deployment process

</TabItem>
</Tabs>

After any upgrade, check for **Worker connected** in the dashboard, run an investigation, and restore any schedules you paused. The gateway checks compatibility before handing out work. An outdated worker waits with an upgrade message, leaving queued investigations untouched; update its image to resume work

Hourly development deployments build the gateway and worker from the same selected commit

For development from source, use `make lens-dev`. Custom container builds must use the same checkout and release identity for both components; follow the [source build instructions](https://github.com/BerriAI/litellm/blob/main/deploy/lens/README.md#release-compatibility). A build without that identity refuses worker setup instead of suggesting an unrelated image

### Deploy with a coding agent

<AgentDeployPrompt prompt={`Deploy LiteLLM Lens on this machine by following https://docs.litellm.ai/docs/proxy/lens/deployment

1. If a LiteLLM proxy is already running, keep it and its PostgreSQL database. Otherwise follow New local installation, building the gateway and worker from the same checkout and release identity.
2. For an existing proxy, configure ClickHouse tracing using the Existing LiteLLM tab. Check POST /v1/traces and GET /v1/traces with a LiteLLM key.
3. Ask me to open Lens > Investigations > Connect worker, select a model and budget, and get a worker token. For the local stack, start the worker with both Compose files. For an existing proxy, confirm its generated command names an available matching image, then run it.
4. Confirm the dashboard shows "Worker connected". Keep LiteLLM and the worker on the same source commit and release identity for future upgrades.

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
