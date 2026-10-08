---
title: "Deployment"
description: "Set up Lens locally or for a team, with a new or existing LiteLLM deployment."
slug: "/proxy/lens/deployment"
---

# Deployment

Lens runs alongside LiteLLM and stores traces in ClickHouse. Your agents send model requests to LiteLLM and traces to Lens. View traces and investigations in the LiteLLM dashboard.

![Your agent sends model requests to LiteLLM and traces directly to Lens.](/img/lens-architecture.svg)

Choose your starting point:

| Your setup | Instructions |
| --- | --- |
| New installation on your machine | [Local quickstart](#quick-start) |
| New installation for a team | [Kubernetes](#new-shared-helm) or [containers on a server](#new-shared-docker) |
| LiteLLM already running | [Helm](#using-helm), [Docker Compose](#using-compose), or [standalone Docker](#using-docker) |

If Lens is already installed, [send your first trace](./first-trace.md).

## New local deployment {#quick-start}

This local setup starts LiteLLM, Lens, PostgreSQL, and ClickHouse together. You need Git, Python {{python_min_version}} or later, and Docker with Compose. Start Docker before running the commands.

### 1. Get the configuration

Clone LiteLLM and enter the repository:

```bash
git clone --depth 1 https://github.com/BerriAI/litellm.git
cd litellm
```

Choose a [LiteLLM release](https://github.com/BerriAI/litellm/releases) that includes a Lens image. Use its version below:

```bash
python3 deploy/lens/configure.py --version "<release-version>"
```

This saves private credentials in `deploy/lens/.env`. Back up that file with your databases. Running the command again preserves the credentials.

### 2. Start the services

```bash
docker compose --env-file deploy/lens/.env -f deploy/lens/stack.yaml up -d --wait
```

Docker downloads the images and starts the services. Check their status:

```bash
docker compose --env-file deploy/lens/.env -f deploy/lens/stack.yaml ps
```

`litellm` and `lens-worker` should be running. `db` and `clickhouse` should be healthy. If a service exits, [check its logs](#check-the-installation).

This stack binds to localhost and stores data in persistent volumes. For agents on other machines, use a [shared deployment](#new-shared-deployment).

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

For a team, use HTTPS addresses reachable by your agents and browser, persistent storage, and backups.

### Kubernetes with Helm {#new-shared-helm}

1. Follow the [LiteLLM production guide](../deploy.md#provision-the-data-stores) to prepare PostgreSQL, Redis, secrets, and your values file.
2. Before installing, add Lens to that values file:

```yaml
lensWorker:
  enabled: true
```

3. Configure the chart's ingress with your hostname and TLS, then follow the guide's [Helm install instructions](../deploy.md#deploy-with-helm). The chart creates Lens's service secret and ClickHouse storage. Your cluster needs a default storage class.
4. [Check the installation](#check-the-installation).

For custom routing or storage, use the [Helm settings](#using-helm) below before installing.

### Containers on a server {#new-shared-docker}

1. [Deploy LiteLLM](../deploy.md) with PostgreSQL, persistent master and encryption keys, and HTTPS.
2. Add Lens using the [Docker Compose](#using-compose) or [standalone Docker](#using-docker) steps below.

## Add Lens to an existing deployment {#configure-an-existing-proxy}

Choose how you run LiteLLM: [Helm](#using-helm), [Docker Compose](#using-compose), or [standalone Docker](#using-docker). Keep your existing database, model configuration, and keys.

Use a matching LiteLLM and Lens [release](https://github.com/BerriAI/litellm/releases). Published charts include their Lens image digest. For containers, copy the matching Lens image digest from the release.

### Helm {#using-helm}

#### 1. Enable Lens

Add this to your existing values file:

```yaml
lensWorker:
  enabled: true
```

The chart creates the service secret and ClickHouse with a 20 GiB persistent volume. Your cluster needs a default storage class. For another class, set `lensWorker.clickhouse.storageClassName`. For external ClickHouse or GitOps, use [existing storage and secrets](#existing-storage-and-secrets).

With one hostname in the chart's main ingress, the chart supplies the tracing URL and routes `/lens-ingest` to Lens. For custom routing, set `lensWorker.publicUrl` and [publish the trace endpoint](#publish-trace-endpoint).

#### 2. Deploy

Keep your chart, release name, namespace, and values file. From the matching release checkout, replace the example names and run:

```bash
helm dependency build ./helm/litellm
helm upgrade litellm ./helm/litellm \
  --namespace litellm -f values.yaml --wait
```

Use `./helm/litellm-helm` for the single-container chart. If you install from a chart registry, keep that reference and pin its release version. Update any gateway or backend image overrides to match. Source charts require `lensWorker.image.digest` from the matching release.

Then [check the installation](#check-the-installation).

### Docker Compose {#using-compose}

Add Lens to your existing Compose project. You need a [ClickHouse database](https://clickhouse.com/docs/install) whose user can create and alter tables, read data, and insert data.

#### 1. Set the connection values

Generate a service secret:

```bash
openssl rand -hex 32
```

Add these values to your Compose project's `.env` file. Replace the placeholders and URLs. URL-encode special characters in the ClickHouse username and password:

```dotenv
LENS_WORKER_IMAGE=ghcr.io/berriai/litellm-lens-worker@sha256:<matching-release-digest>
LITELLM_LENS_SERVICE_TOKEN=<generated-service-secret>
LITELLM_LENS_PUBLIC_URL=https://gateway.example.com/lens-ingest
CLICKHOUSE_URL=https://USER:PASSWORD@CLICKHOUSE_HOST:8443
```

For agents on the Docker host, use `http://localhost:4318` as the public URL. For other machines, [configure HTTPS routing](#publish-trace-endpoint) for that URL.

Protect the file:

```bash
chmod 600 .env
```

#### 2. Add Lens to your Compose file

Merge these settings into `compose.yaml`, keeping your existing services and settings. Replace `litellm` with your gateway's service name and `4000` with its container port:

```yaml title="compose.yaml"
services:
  litellm:
    environment:
      LITELLM_LENS_URL: http://lens-worker:4318
      LITELLM_LENS_PUBLIC_URL: ${LITELLM_LENS_PUBLIC_URL}
      LITELLM_LENS_SERVICE_TOKEN: ${LITELLM_LENS_SERVICE_TOKEN}
  lens-worker:
    image: ${LENS_WORKER_IMAGE}
    environment:
      LITELLM_URL: http://litellm:4000
      LITELLM_LENS_SERVICE_TOKEN: ${LITELLM_LENS_SERVICE_TOKEN}
      CLICKHOUSE_URL: ${CLICKHOUSE_URL}
    ports: ["127.0.0.1:4318:4318"]
    mem_limit: 2g
    cpus: 2
    pids_limit: 64
    restart: unless-stopped
    read_only: true
    tmpfs: ["/tmp:rw,noexec,nosuid,size=1g"]
    cap_drop: [ALL]
    security_opt: ["no-new-privileges:true"]
```

If LiteLLM uses a custom Compose network, add `networks: [your-network-name]` under `lens-worker` too. Both services must share a network.

#### 3. Start Lens

Use your usual Compose command with the updated configuration:

```bash
docker compose up -d
```

Then [check the installation](#check-the-installation).

### Standalone Docker {#using-docker}

Use this path when you start LiteLLM with `docker run`. You need a [ClickHouse database](https://clickhouse.com/docs/install) whose user can create and alter tables, read data, and insert data.

#### 1. Configure LiteLLM

Generate a service secret:

```bash
openssl rand -hex 32
```

Add these variables to LiteLLM's environment file, replacing the secret and public URL. Recreate LiteLLM with your usual `docker run` command and that file:

```dotenv
LITELLM_LENS_URL=http://lens-worker:4318
LITELLM_LENS_PUBLIC_URL=https://gateway.example.com/lens-ingest
LITELLM_LENS_SERVICE_TOKEN=<generated-service-secret>
```

For agents on the Docker host, use `http://localhost:4318` as the public URL. For other machines, [configure HTTPS routing](#publish-trace-endpoint) for that URL.

#### 2. Configure Lens

Create `~/lens.env` with the same service secret and your ClickHouse HTTP URL. Replace `litellm` with your gateway's container name and `4000` with its container port. URL-encode special characters in the ClickHouse username and password:

```dotenv title="lens.env"
LITELLM_URL=http://litellm:4000
LITELLM_LENS_SERVICE_TOKEN=<same-service-secret>
CLICKHOUSE_URL=https://USER:PASSWORD@CLICKHOUSE_HOST:8443
```

Protect the file and find LiteLLM's Docker network:

```bash
chmod 600 ~/lens.env
docker inspect "<your-litellm-container>" --format '{{json .NetworkSettings.Networks}}'
```

Use a user-defined network so the containers can reach each other by name. If LiteLLM only uses Docker's default `bridge` network, create a shared network:

```bash
docker network create lens
docker network connect lens "<your-litellm-container>"
```

#### 3. Start Lens

Replace the network name and image digest:

```bash
docker run -d --name lens-worker \
  --network "<your-litellm-network>" \
  --env-file ~/lens.env \
  -p 127.0.0.1:4318:4318 \
  --memory 2g --cpus 2 --pids-limit 64 \
  --read-only --tmpfs /tmp:rw,noexec,nosuid,size=1g \
  --cap-drop ALL --security-opt no-new-privileges:true \
  --restart unless-stopped \
  "ghcr.io/berriai/litellm-lens-worker@sha256:<matching-release-digest>"
```

Keep both containers on that network when you recreate them. Then [check the installation](#check-the-installation).

For a managed container platform, use the same image, environment variables, filesystem settings, and resource limits. Use private service addresses for the LiteLLM and Lens connection. Set `/health/live` for process health and `/health/ready` for readiness on port `4318`.

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

## Helm storage and secrets {#existing-storage-and-secrets}

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

### Publish the trace endpoint {#publish-trace-endpoint}

For agents on other machines, route HTTPS traffic to Lens on port `4318`:

| Public base URL | Route to Lens |
| --- | --- |
| `https://gateway.example.com/lens-ingest` | `/lens-ingest/` on your gateway hostname |
| `https://traces.example.com` | `/v1/` on a separate hostname |

Keep `/internal/` private. For Docker, a reverse proxy on the host can reach Lens at `127.0.0.1:4318`. A reverse proxy in a container must share Lens's network and use `http://lens-worker:4318`.

Set `LITELLM_LENS_PUBLIC_URL` on LiteLLM, or `lensWorker.publicUrl` in Helm, to the base URL. Leave off `/v1/traces`; the dashboard adds it.

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

If LiteLLM and Lens run in separate Compose projects, find LiteLLM's network:

```bash
docker inspect "<your-litellm-container>" --format '{{json .NetworkSettings.Networks}}'
```

Save this as `lens-network.yaml` in Lens's Compose project:

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
docker compose -f compose.yaml -f lens-network.yaml up -d
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
