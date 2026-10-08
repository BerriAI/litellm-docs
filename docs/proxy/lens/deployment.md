---
title: "Deployment"
description: "Set up Lens locally or for a team, with a new or existing LiteLLM deployment."
slug: "/proxy/lens/deployment"
---

# Deployment

Lens records agent activity and runs investigations alongside LiteLLM. Your agents send model requests to LiteLLM and traces to Lens. You view traces and findings in the LiteLLM dashboard. Lens stores traces in ClickHouse; LiteLLM keeps keys, settings, and findings in PostgreSQL.

![Your agent sends model requests to LiteLLM and traces directly to Lens.](/img/lens-architecture.svg)

Choose a path based on where you want to run Lens and whether LiteLLM is already installed:

| Your setup | Start here |
| --- | --- |
| New installation on your machine | [New local deployment](#quick-start): start the full stack with Docker Compose |
| New installation on a Kubernetes cluster | [New shared deployment with Helm](#new-shared-helm): install LiteLLM and Lens together |
| New installation on a server or container platform | [New shared deployment with Docker](#new-shared-docker): deploy LiteLLM, then add Lens |
| LiteLLM is already running, locally or for your team | [Add Lens to an existing deployment](#configure-an-existing-proxy): keep your gateway and add Lens |

**Local** means the dashboard and trace endpoint are reachable from your machine through `localhost`. **Shared** means your team and agents reach them through your server or cluster's addresses, which can be private to your network.

If Lens is already installed, go straight to [send your first trace](./first-trace.md).

## New local deployment {#quick-start}

This local setup starts LiteLLM, Lens, PostgreSQL, and ClickHouse together. You need Git, Python {{python_min_version}} or later, and Docker with Compose. Start Docker before running the commands.

### 1. Get the configuration

Clone LiteLLM and enter the repository:

```bash
git clone --depth 1 https://github.com/BerriAI/litellm.git
cd litellm
```

Choose a [published LiteLLM release](https://github.com/BerriAI/litellm/releases) that includes a Lens image. Replace `<release-version>` below with that version. Both services use the same release:

```bash
python3 deploy/lens/configure.py --version "<release-version>"
```

This saves your keys and database passwords in `deploy/lens/.env`, readable only by your user. Keep a private backup with your database backups. Running the command again preserves the credentials.

### 2. Start the services

```bash
docker compose --env-file deploy/lens/.env -f deploy/lens/stack.yaml up -d --wait
```

Docker downloads the published images and starts the services. No local image build is needed. Check their status:

```bash
docker compose --env-file deploy/lens/.env -f deploy/lens/stack.yaml ps
```

`litellm` and `lens-worker` should be running. `db` and `clickhouse` should be healthy. If a service exits, [check its logs](#check-the-installation).

The dashboard and tracing endpoint bind to localhost. Both databases use persistent volumes and private Docker networks. To make Lens available to a team or agents on other machines, follow [New shared deployment](#new-shared-deployment).

### 3. Open Lens

1. Open [http://localhost:4000/ui/](http://localhost:4000/ui/).
2. Sign in as `admin`. Use the `LITELLM_MASTER_KEY` value from `deploy/lens/.env` as the password.
3. Open **Lens**, then **Set up Lens**. Under **Send your first trace**, choose your framework and click **Generate tracing key**.
4. Click **Copy tracing configuration**, then follow the displayed installation and code snippets in your agent's project.

To check tracing before running an agent, click **Send a test trace** under **Connection details**, then **View trace**. This does not call a model or require a provider key.

Your trace endpoint is `http://localhost:4318/v1/traces`. Model requests use `http://localhost:4000`. To run an agent through this gateway, first add a provider model under **Models** and create a model key under **Virtual Keys**. The [first-trace examples](./first-trace.md) show how to name your agent and record its steps.

To stop the stack while keeping your data, run:

```bash
docker compose --env-file deploy/lens/.env -f deploy/lens/stack.yaml down
```

To start it again, repeat the `up -d --wait` command with the same environment file. Do not add `-v` to `down` unless you intend to delete the database volumes.

## New shared deployment {#new-shared-deployment}

Use this path to run LiteLLM and Lens for a team. Choose Helm for Kubernetes, or Docker for a server or container platform. You provide the hostname, HTTPS routing, persistent storage, and backups for your environment.

### Kubernetes with Helm {#new-shared-helm}

1. Follow the [LiteLLM production deployment guide](../deploy.md#provision-the-data-stores) to prepare PostgreSQL, Redis, secrets, and your chart's values file.
2. Before running the guide's Helm install command, add Lens to that values file:

```yaml
lensWorker:
  enabled: true
```

3. Configure the chart's ingress with your gateway hostname and TLS. With one hostname, the chart supplies the tracing address and routes `/lens-ingest` to Lens. For custom ingress, follow the [Lens routing settings](#using-helm).
4. Install the matching published chart using the [Helm installation instructions](../deploy.md#deploy-with-helm), then [check the Lens installation](#check-the-installation).

The same Helm installation starts LiteLLM and Lens. Lens's chart settings supply its shared service secret and a ClickHouse instance with persistent storage. The cluster needs a default storage class, or an explicit `lensWorker.clickhouse.storageClassName`. For a database or credentials you already manage, use [Existing storage and secrets](#existing-storage-and-secrets) before installing.

### Docker on a server or container platform {#new-shared-docker}

1. Deploy LiteLLM on your chosen host with PostgreSQL, a persistent master key and encryption key, and an HTTPS address. Use the [LiteLLM deployment guide](../deploy.md) for your platform.
2. Follow [Using Docker](#using-docker) below to connect ClickHouse, start Lens, and route trace uploads to it. Keep LiteLLM and Lens on the same release.
3. [Check the installation](#check-the-installation), then share the dashboard address with your team.

This path uses the same Lens container as the local quickstart. You connect it to your hosted gateway and database and configure its public tracing address. The local quickstart's `localhost` addresses are only reachable on the machine running Docker.

## Add Lens to an existing LiteLLM deployment {#configure-an-existing-proxy}

Use this path whether your LiteLLM deployment runs on your machine, a server, or Kubernetes. Keep your gateway, PostgreSQL database, model configuration, and encryption keys. Follow [Using Helm](#using-helm) for a Helm installation, or [Using Docker](#using-docker) for containers you run directly.

Use LiteLLM and Lens images from the same release. The published Helm chart supplies its matching Lens image. For Docker, choose the matching Lens image from the [release](https://github.com/BerriAI/litellm/releases), or [build it from source](#build-from-source).

### Using Docker

You need a ClickHouse HTTP URL with credentials. Lens creates its tables on startup, so its database user needs permission to create and alter tables, read data, and insert data. Use your existing ClickHouse service or follow the [ClickHouse installation guide](https://clickhouse.com/docs/install).

For a **local deployment**, use `http://localhost:4318` as the public base URL when your agent and browser run on the Docker host. You do not need an HTTPS reverse proxy for this local connection.

For a **shared deployment**, choose the HTTPS address your agents will use. With your gateway hostname, route `/lens-ingest` to Lens on port 4318 and use `https://<your-host>/lens-ingest`. With a separate hostname, route `/v1/` to Lens and use `https://<your-trace-host>`. Keep `/internal/` private.

#### 1. Set the service connection on LiteLLM

Generate a shared service secret once and store it privately:

```bash
openssl rand -hex 32
```

Add these variables to LiteLLM's container configuration and redeploy it. Replace the URLs and use the secret you generated. For local agents, set `LITELLM_LENS_PUBLIC_URL` to `http://localhost:4318`:

```dotenv
LITELLM_LENS_URL=http://lens-worker:4318
LITELLM_LENS_PUBLIC_URL=https://gateway.example.com/lens-ingest
LITELLM_LENS_SERVICE_TOKEN=<shared-service-secret>
```

The internal URL must be reachable from LiteLLM. The public URL must be reachable from your agents and browser. Leave `/v1/traces` off the public base URL; the dashboard adds it.

#### 2. Start Lens

Use a checkout of the same LiteLLM release. Create a private file outside the repository, such as `~/lens.env`, with the following values. Replace the image digest, gateway URL, secret, and ClickHouse URL:

```dotenv title="lens.env"
LENS_WORKER_IMAGE=ghcr.io/berriai/litellm-lens-worker@sha256:<matching-release-digest>
LITELLM_URL=https://gateway.example.com
LITELLM_LENS_SERVICE_TOKEN=<same-shared-service-secret>
CLICKHOUSE_URL=https://USER:PASSWORD@CLICKHOUSE_HOST:8443
CLICKHOUSE_DATABASE=litellm
AGENT_TRACING_RETENTION_DAYS=14
```

Use the same service secret on both containers. `LITELLM_URL` is the gateway address reachable from Lens. URL-encode special characters in the ClickHouse username and password.

Protect the file and start Lens with [`deploy/lens/compose.yaml`](https://github.com/BerriAI/litellm/blob/main/deploy/lens/compose.yaml):

```bash
chmod 600 ~/lens.env
docker compose --env-file ~/lens.env \
  -f deploy/lens/compose.yaml up -d
```

#### 3. Connect the network and check tracing

The Compose file exposes Lens at `127.0.0.1:4318` on the Docker host. Local agents can use that address directly. For a shared deployment, point your host's HTTPS reverse proxy at it. If LiteLLM or your reverse proxy runs in another container, [connect Lens to its Docker network](#docker-network) and use `http://lens-worker:4318` from that network. `localhost` inside a container refers to that container.

For a shared deployment, apply the HTTPS route you chose above. Then [check the installation](#check-the-installation). On a container host such as Render, run the Lens image as a web service on port 4318 with the same environment variables. Use `/health/live` for process health and `/health/ready` for readiness.

### Using Helm

Both `helm/litellm` and `helm/litellm-helm` support Lens on local or hosted Kubernetes clusters. These steps add Lens to an existing Helm release. Keep your chart, release name, namespace, and values file. For a new release, follow [New shared deployment with Helm](#new-shared-helm).

#### 1. Enable Lens

Add this to your values file:

```yaml
lensWorker:
  enabled: true
```

The chart creates a shared service secret, connects LiteLLM to Lens, and starts ClickHouse with a 20 GiB persistent volume. Your cluster needs a default storage class. To choose another class or size, add `storageClassName` and `storage` under `lensWorker.clickhouse` before installing.

With a single hostname in the chart's main ingress, the chart routes `/lens-ingest` to Lens and fills in the public tracing address. For a custom ingress or multiple hostnames, set `lensWorker.publicUrl` to your public base URL and route `/lens-ingest` to Lens on port 4318. Keep `/internal/` private. For a separate hostname, use the [dedicated ingress example](#dedicated-ingress).

If you use an existing ClickHouse database or manage secrets through GitOps, apply the [existing storage and secrets settings](#existing-storage-and-secrets) before deploying.

#### 2. Deploy

Choose the published chart for your LiteLLM release. Keep its Lens image digest and update any gateway or backend image overrides to that release. From the matching LiteLLM checkout, run the following with your release name, namespace, and values path. Use `./helm/litellm-helm` for the single-container chart:

```bash
helm dependency build ./helm/litellm
helm upgrade litellm ./helm/litellm \
  --namespace litellm -f values.yaml --wait
```

If you use a chart registry, keep your usual chart reference and pin its version to the chosen release. For a source chart without a published Lens image digest, set `lensWorker.image.digest` to the matching image digest.

#### 3. Connect your agent

Open **Lens** in the dashboard and click **Set up Lens**. If the page was already open, click **Check setup**. Once Lens and its storage are ready, choose your framework, generate a tracing key, and click **Copy tracing configuration**. Follow the displayed snippets, or [send a test trace](#check-the-installation) to verify the connection first.

### Existing storage and secrets {#existing-storage-and-secrets}

For external ClickHouse, create a Kubernetes Secret containing its HTTP URL. To manage the service credential yourself, create a second Secret with the same private token for LiteLLM and Lens. GitOps tools that render Helm without access to the cluster require both existing secrets, because Helm cannot look up saved credentials during rendering.

Create the secrets through your secret manager, or use these commands. Replace the namespace, then generate the service secret once:

```bash
export LITELLM_NAMESPACE="<your-existing-namespace>"
openssl rand -hex 32 | tr -d '\n' | kubectl create secret generic litellm-lens-service \
  --namespace "$LITELLM_NAMESPACE" --from-file=service-token=/dev/stdin
```

Paste your ClickHouse HTTP URL, including credentials, at the hidden prompt:

```bash
printf 'Paste your ClickHouse HTTP URL: '
IFS= read -r -s LENS_CLICKHOUSE_URL
printf '\n'
printf '%s' "$LENS_CLICKHOUSE_URL" | kubectl create secret generic litellm-lens-clickhouse \
  --namespace "$LITELLM_NAMESPACE" --from-file=url=/dev/stdin
unset LENS_CLICKHOUSE_URL
```

Use these names in your values file:

```yaml
lensWorker:
  enabled: true
  serviceTokenSecret:
    name: litellm-lens-service
    key: service-token
  clickhouseSecret:
    name: litellm-lens-clickhouse
    key: url
  clickhouseDatabase: litellm
  retentionDays: 14
```

`clickhouseSecret.name` selects your database instead of starting bundled ClickHouse. Set `clickhouseDatabase` and `retentionDays` to your database name and retention policy. Reuse the secrets on future deployments.

## Check the installation

1. Sign in to the LiteLLM dashboard as a proxy administrator.
2. Open **Lens**, then **Set up Lens**. If Lens already has traces, use **Traces > Set up tracing**. Under **Connection details**, check the **Traces endpoint**. It should include `/v1/traces`.
3. Click **Generate tracing key**, then **Send a test trace**.
4. Click **View trace**. Seeing the trace confirms upload, storage, and read access.

For investigations, open **Lens > Investigations > Connect worker**. Choose an analysis model and monthly budget, then click **Enable investigations**. Wait for **Worker connected**, then [create an investigation](./investigations.md). The service connects automatically; you do not need to start another worker or copy a worker token.

If the service does not start, read its logs. For the local stack:

```bash
docker compose --env-file deploy/lens/.env -f deploy/lens/stack.yaml logs --tail=100 litellm lens-worker
```

For a Helm deployment, replace the namespace:

```bash
kubectl logs --namespace "<your-namespace>" -l app.kubernetes.io/component=lens-worker --tail=100
```

| What you see | What to check |
| --- | --- |
| Setup asks for `LITELLM_LENS_PUBLIC_URL` | Set the public base URL on LiteLLM, or `lensWorker.publicUrl` in Helm. Roll out that change. |
| Lens service unavailable | Check the internal URL, connectivity between the services, and that their shared secrets match. |
| ClickHouse unavailable | Check Lens's database URL, credentials, permissions, and network access. |
| The test upload cannot connect | Check HTTPS routing and that the endpoint is reachable from the browser. |
| `429` just after creating a tracing key | Wait up to 30 seconds for credential sync and retry. If it persists, check the internal service connection. |

Share the dashboard URL and [first-trace guide](./first-trace.md) with your developers. Give them a dedicated tracing key if they cannot create one. They do not need the shared service secret or database credentials.

## Upgrade {#upgrade-litellm-and-the-worker}

To update an installed Lens deployment to a later release:

1. Read the release notes and select matching LiteLLM and Lens images, or the chart version for that release.
2. Pause scheduled investigations and finish or cancel active runs. Update the images through the same Docker or Helm deployment process you used to install Lens.
3. [Check the installation](#check-the-installation) and run an investigation before resuming schedules.

Keep your databases, encryption keys, shared service secret, and public trace URL. Reuse your environment or values file. For the local stack, update the saved version and start the matching images:

```bash
python3 deploy/lens/configure.py --version "<next-release-version>"
docker compose --env-file deploy/lens/.env -f deploy/lens/stack.yaml up -d --wait
```

Normal Helm upgrades reuse generated credentials. Helm retains the generated secrets on uninstall, and Kubernetes retains the ClickHouse volume. Back them up together. Changing the database, storage class, or secret reference requires a separate data migration plan.

Do not run `docker compose down -v`; it deletes the database volumes.

## Networking examples

### Use a separate trace hostname with Helm {#dedicated-ingress}

Point your trace hostname at the ingress controller and provision its TLS certificate. Merge these fields into the existing `lensWorker` block, keeping its image, secret, and database settings. Replace the hostname, ingress class, and TLS secret name with yours:

```yaml
lensWorker:
  publicUrl: https://traces.example.com
  ingress:
    enabled: true
    className: nginx
    host: traces.example.com
    tls:
      - secretName: lens-tls
        hosts:
          - traces.example.com
```

The chart routes `/v1/` on this hostname to Lens. Redeploy with your Helm upgrade command, then [check the installation](#check-the-installation).

### Connect Lens to an existing Docker network {#docker-network}

Find the network used by your LiteLLM container:

```bash
docker inspect "<your-litellm-container>" --format '{{json .NetworkSettings.Networks}}'
```

Save this as `lens-network.yaml` in the LiteLLM checkout:

```yaml title="lens-network.yaml"
services:
  lens-worker:
    networks: [gateway]
networks:
  gateway:
    external: true
    name: ${LITELLM_DOCKER_NETWORK}
```

Set the network name from the first command and start Lens with the override:

```bash
export LITELLM_DOCKER_NETWORK="<your-existing-network>"
docker compose --env-file ~/lens.env \
  -f deploy/lens/compose.yaml -f lens-network.yaml up -d
```

Include both Compose files whenever you recreate Lens. LiteLLM and your reverse proxy can reach it at `http://lens-worker:4318` on that network. Set Lens's `LITELLM_URL` to the gateway's service name and container port.

## Build from source

Build from the same source commit and `LITELLM_RELEASE_TAG` as your gateway:

```bash
export LITELLM_RELEASE_TAG='<gateway-release-identity>'
export LENS_WORKER_IMAGE='<your-registry>/litellm-lens-worker:<image-tag>'
docker build --build-arg LITELLM_RELEASE_TAG="$LITELLM_RELEASE_TAG" \
  -f deploy/lens/Dockerfile -t "$LENS_WORKER_IMAGE" .
docker push "$LENS_WORKER_IMAGE"
```

Use a registry your host can pull from. The image supports native amd64 and arm64. Development images use `ghcr.io/berriai/litellm-lens-worker-dev:sha-<full-commit>`; an image is available only after that commit's build and publication succeed.

### Development

For hot reload, start LiteLLM, Lens, and the dashboard from the repository root:

```bash
make lens-dev
```

Set `LENS_DEV_PROXY_PORT` and `LENS_DEV_UI_PORT` to change the local ports. For containers, pass the same release identity to both builds. Unversioned or incompatible workers are refused before claiming work.

## Service behavior

### Configuration reference

The Docker examples above show the values to set on each service. Helm supplies the connection settings from your `lensWorker` values.

| Variable | Used by LiteLLM | Used by Lens |
| --- | --- | --- |
| `LITELLM_LENS_SERVICE_TOKEN` | Yes | Yes |
| `LITELLM_LENS_URL` | Yes | No |
| `LITELLM_LENS_PUBLIC_URL` | Yes | No |
| `LITELLM_URL` | No | Yes |
| `CLICKHOUSE_URL`, or `CLICKHOUSE_HOST` and `CLICKHOUSE_PASSWORD` | No | Yes |
| `CLICKHOUSE_DATABASE` | No | Yes |
| `AGENT_TRACING_RETENTION_DAYS` | No | Yes |

Use the same private service secret on LiteLLM and Lens, with at least 32 characters. `CLICKHOUSE_DATABASE` defaults to `litellm`, and `AGENT_TRACING_RETENTION_DAYS` defaults to `14`. Agents authenticate with dedicated tracing keys from the dashboard.

### Availability and scaling

Agent exporters send traces directly to Lens. LiteLLM sends optional request logs through a bounded background queue. If Lens or ClickHouse is unavailable, model requests continue. Traces can be delayed or dropped according to the exporter's retry policy. The gateway does not wait for ClickHouse during startup or inference.

Bundled ClickHouse is a single instance. Use an external ClickHouse deployment when you need replication or high availability.

`lensWorker.replicaCount` scales ingestion and investigations. Each replica needs access to the same ClickHouse and gateway. Credentials refresh every 30 seconds; a newly created key may briefly receive a retryable `429`. Revocations propagate on refresh, and a replica stops accepting traces when its credential snapshot reaches 90 seconds.

Lens does not need provider credentials, PostgreSQL credentials, or a GPU. Its image includes the runtime for the investigator's calculation tool. Keep the shipped security settings, temporary filesystem, and resource limits.


After setup, [send your first trace](./first-trace.md), then [create an investigation](./investigations.md).
