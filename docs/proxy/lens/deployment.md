---
title: "Deployment"
description: "Run Lens ingestion and investigations separately from your LiteLLM gateway."
slug: "/proxy/lens/deployment"
---

# Deployment

Lens records agent activity and runs investigations alongside LiteLLM. Your agents send model requests to LiteLLM and traces to Lens. You view traces and findings in the LiteLLM dashboard. Lens stores traces in ClickHouse; LiteLLM keeps keys, settings, and findings in PostgreSQL.

![Your agent sends model requests to LiteLLM and traces directly to Lens.](/img/lens-architecture.svg)

If you are starting from scratch, follow [New deployment](#quick-start). If you already run LiteLLM, follow [Add Lens to LiteLLM](#configure-an-existing-proxy). If your team has already set up Lens, go straight to [send your first trace](./first-trace.md).

## New deployment {#quick-start}

This local setup starts LiteLLM, Lens, PostgreSQL, and ClickHouse together. You need Git, OpenSSL, and Docker with Compose. Start Docker before running the commands.

### 1. Get the code and save your keys

Clone LiteLLM and enter the repository:

```bash
git clone --depth 1 https://github.com/BerriAI/litellm.git
cd litellm
```

Run this once to save your local keys in `.env`. It leaves an existing `.env` untouched:

```bash
(
  umask 077
  set -o noclobber
  cat > .env <<EOF
LITELLM_RELEASE_TAG=sha-$(git rev-parse HEAD)
LITELLM_MASTER_KEY=sk-$(openssl rand -hex 24)
LITELLM_LENS_SERVICE_TOKEN=$(openssl rand -hex 32)
OPENAI_API_KEY=
EOF
)
```

Keep this file when restarting or upgrading. LiteLLM excludes it from Git and Docker builds. To use the preconfigured OpenAI model, add your provider key after `OPENAI_API_KEY=` in `.env`. You can leave it empty to try the dashboard's test trace, then add a model through the dashboard later.

### 2. Start the services

Build and start the stack from the same checkout:

```bash
docker compose --env-file .env -f docker/docker-compose.tracing.yml up -d --build
```

The first build downloads and compiles dependencies. When it finishes, check that the services started:

```bash
docker compose --env-file .env -f docker/docker-compose.tracing.yml ps
```

`litellm` and `lens-worker` should be running. `db` and `clickhouse` should be healthy. If a service exits, [check its logs](#check-the-installation).

This stack uses local development database passwords and binds its ports to localhost. For a shared deployment, first [deploy LiteLLM](../deploy.md) with your organization's secrets, HTTPS routing, and databases, then [add Lens](#configure-an-existing-proxy).

### 3. Open Lens

1. Open [http://localhost:4002/ui/](http://localhost:4002/ui/).
2. Sign in as `admin`. Use the `LITELLM_MASTER_KEY` value from `.env` as the password.
3. Open **Lens > Traces > Set up tracing** and click **Generate tracing key**.
4. Click **Send a test trace**, then **View trace**. This verifies tracing without calling a model.

Your trace endpoint is `http://localhost:4318/v1/traces`. Model requests use `http://localhost:4002`. Next, [run a framework example](./first-trace.md) to see your own agent in Lens.

To stop the stack while keeping your data, run:

```bash
docker compose --env-file .env -f docker/docker-compose.tracing.yml down
```

To start it again, use the same `.env`:

```bash
docker compose --env-file .env -f docker/docker-compose.tracing.yml up -d
```

Do not add `-v` to `down` unless you intend to delete the database volumes.

## Add Lens to LiteLLM {#configure-an-existing-proxy}

Keep your gateway, PostgreSQL database, model configuration, and encryption keys. You will add the Lens service and connect it to ClickHouse. Use the instructions for your deployment: [Using Docker](#using-docker) or [Using Helm](#using-helm).

Before starting, you need a ClickHouse HTTP URL with credentials and a LiteLLM release that includes Lens. Lens creates its tables on startup, so its ClickHouse user needs permission to create and alter tables, read data, and insert data. To set up ClickHouse, follow the [ClickHouse installation guide](https://clickhouse.com/docs/install).

Use gateway and Lens images from the same release, or build both from the same source commit and release identity. Check that the release's Lens image is published before deploying it. To build it yourself, follow [Build from source](#build-from-source).

Choose the public address agents will use. With your existing gateway hostname, route `/lens-ingest` to Lens on port 4318 and set the public base URL to `https://<your-host>/lens-ingest`. Lens accepts that prefix. With a separate hostname, route `/v1/` to Lens and use `https://<your-trace-host>` as the base URL. Keep `/internal/` private. The [Helm chart handles routing](#using-helm) when you use its ingress.

### Using Docker

#### 1. Set the service connection on LiteLLM

Generate a shared service secret once and store it privately:

```bash
openssl rand -hex 32
```

Add these variables to LiteLLM's container configuration and redeploy it. Replace the URLs and use the secret you generated:

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

The Compose file exposes Lens at `127.0.0.1:4318` on the Docker host. Point your host's HTTPS reverse proxy at that address. If LiteLLM or your reverse proxy runs in another container, [connect Lens to its Docker network](#docker-network) and use `http://lens-worker:4318` from that network. `localhost` inside a container refers to that container.

Apply the public route you chose above, then [check the installation](#check-the-installation). On a container host such as Render, run the Lens image as a web service on port 4318 with the same environment variables. Use `/health/live` for process health and `/health/ready` for readiness.

### Using Helm

Both `helm/litellm` and `helm/litellm-helm` support Lens. Use your existing chart, release name, namespace, and values file.

#### 1. Create the secrets

Create `litellm-lens-service` with a `service-token` key and `litellm-lens-clickhouse` with a `url` key through your secret manager. If you do not use a secret manager, these commands create them directly. Replace the namespace, then run this once:

```bash
export LITELLM_NAMESPACE="<your-existing-namespace>"
openssl rand -hex 32 | tr -d '\n' | kubectl create secret generic litellm-lens-service \
  --namespace "$LITELLM_NAMESPACE" --from-file=service-token=/dev/stdin
```

Run this block and paste your ClickHouse HTTP URL at the hidden prompt:

```bash
printf 'Paste your ClickHouse HTTP URL: '
IFS= read -r -s LENS_CLICKHOUSE_URL
printf '\n'
printf '%s' "$LENS_CLICKHOUSE_URL" | kubectl create secret generic litellm-lens-clickhouse \
  --namespace "$LITELLM_NAMESPACE" --from-file=url=/dev/stdin
unset LENS_CLICKHOUSE_URL
```

Reuse the secrets on later upgrades. If your secret manager uses different names, use those names in the values below.

#### 2. Enable Lens

Add this to your values file. Replace the hostname and use your ClickHouse database name and retention:

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
  publicUrl: https://<your-litellm-host>/lens-ingest
```

The published chart for a coordinated release pins its approved Lens image digest. Keep that value. If you use a source chart, add the matching image under the same `lensWorker` block:

```yaml
  image:
    repository: ghcr.io/berriai/litellm-lens-worker
    digest: sha256:<matching-worker-image-digest>
```

When the chart's main ingress is enabled, it routes `/lens-ingest` directly to Lens on your gateway hostname. The chart also sets the internal URLs and gives both services the shared secret. With a custom ingress, add that route yourself. For a separate hostname, use the [dedicated ingress example](#dedicated-ingress).

#### 3. Deploy and verify

Update any gateway or backend image overrides to the same release as Lens. Run the following from that release's LiteLLM checkout. Replace the release name, namespace, and values path with yours. Use `./helm/litellm-helm` for the single-container chart:

```bash
helm dependency build ./helm/litellm
helm upgrade litellm ./helm/litellm \
  --namespace litellm -f values.yaml --wait
```

If you use a chart registry, keep your usual chart reference and pin its version to the chosen release. Continue to [check the installation](#check-the-installation).

## Check the installation

1. Sign in to the LiteLLM dashboard as a proxy administrator.
2. Open **Lens > Traces > Set up tracing**. Under **Connection details**, check that **Traces endpoint** shows your public URL with `/v1/traces` appended.
3. Click **Generate tracing key**, then **Send a test trace**.
4. Click **View trace**. Seeing the trace confirms upload, storage, and read access.

For investigations, open **Lens > Investigations > Connect worker**. Choose an analysis model and monthly budget, then click **Enable investigations**. Wait for **Worker connected**, then [create an investigation](./investigations.md). The service connects automatically; you do not need to start another worker or copy a worker token.

If the service does not start, read its logs. For the local stack:

```bash
docker compose --env-file .env -f docker/docker-compose.tracing.yml logs --tail=100 litellm lens-worker
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

Keep your databases, encryption keys, shared service secret, and public trace URL. Reuse your environment or values file. Do not run `docker compose down -v`; it deletes the database volumes.

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
| `CLICKHOUSE_URL` | No | Yes |
| `CLICKHOUSE_DATABASE` | No | Yes |
| `AGENT_TRACING_RETENTION_DAYS` | No | Yes |

Use the same private service secret on LiteLLM and Lens, with at least 32 characters. `CLICKHOUSE_DATABASE` defaults to `litellm`, and `AGENT_TRACING_RETENTION_DAYS` defaults to `14`. Agents authenticate with dedicated tracing keys from the dashboard.

### Availability and scaling

Agent exporters send traces directly to Lens. LiteLLM sends optional request logs through a bounded background queue. If Lens or ClickHouse is unavailable, model requests continue. Traces can be delayed or dropped according to the exporter's retry policy. The gateway does not wait for ClickHouse during startup or inference.

`lensWorker.replicaCount` scales ingestion and investigations. Each replica needs access to the same ClickHouse and gateway. Credentials refresh every 30 seconds; a newly created key may briefly receive a retryable `429`. Revocations propagate on refresh, and a replica stops accepting traces when its credential snapshot reaches 90 seconds.

Lens does not need provider credentials, PostgreSQL credentials, or a GPU. Its image includes the runtime for the investigator's calculation tool. Keep the shipped security settings, temporary filesystem, and resource limits.


After setup, [send your first trace](./first-trace.md), then [create an investigation](./investigations.md).
