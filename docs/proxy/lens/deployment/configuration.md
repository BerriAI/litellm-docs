---
title: "Configuration and troubleshooting"
description: "Lens credentials, networking, service settings, and connection troubleshooting."
slug: "/proxy/lens/deployment/configuration"
---

# Configuration and troubleshooting

Use this page when you need to change routing or diagnose a connection. To install Lens, choose a [deployment guide](../deployment.md).

## Credentials

Use the credential for the task you are performing:

| Credential | Used by | Purpose |
| --- | --- | --- |
| Master key | Proxy administrator | Sign in and manage LiteLLM |
| Model key | Your application | Make model requests through LiteLLM |
| Tracing key | Your agent | Send traces directly to Lens |
| Service token | LiteLLM and Lens | Authenticate their internal connection |
| Database credentials | LiteLLM for PostgreSQL; Lens for ClickHouse | Connect to each service's database |

The local setup and Helm chart generate the Lens service token for you. Developers only need a tracing key to send traces. `LITELLM_SALT_KEY` is a separate encryption key that LiteLLM uses for stored provider credentials; preserve it with your database backups.

## Publish the trace endpoint {#publish-trace-endpoint}

For agents on other machines, route HTTPS traffic to Lens on port `4318`:

| Public base URL | Route to Lens |
| --- | --- |
| `https://gateway.example.com/lens-ingest` | `/lens-ingest/` on your gateway hostname |
| `https://traces.example.com` | `/v1/` on a separate hostname |

For a complete NGINX configuration, use the [server example](./server.md#3-route-https-traffic). Keep `/internal/` private. For Docker, a reverse proxy on the host can reach Lens at `127.0.0.1:4318`. A reverse proxy in a container must share Lens's network and use `http://lens-worker:4318`.

Set `LITELLM_LENS_PUBLIC_URL` on LiteLLM, or `lensWorker.publicUrl` in Helm, to the base URL. Leave off `/v1/traces`; the dashboard adds it.

## Use a separate trace hostname with Helm {#dedicated-ingress}

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

The chart routes `/v1/` on this hostname to Lens. Redeploy with your Helm upgrade command, then [check the installation](../deployment.md#check-the-installation).

## Connect Lens to an existing Docker network {#docker-network}

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

## Configuration reference

The [Compose](./docker-compose.md) and [Docker](./docker.md) guides show the values to set on each service. Helm supplies the connection settings from your `lensWorker` values.

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

## Availability and scaling

Agent exporters send traces directly to Lens. LiteLLM sends optional request logs through a bounded background queue. If Lens or ClickHouse is unavailable, model requests continue. Traces can be delayed or dropped according to the exporter's retry policy. The gateway does not wait for ClickHouse during startup or inference.

Bundled ClickHouse is a single instance. Use an external ClickHouse deployment when you need replication or high availability.

`lensWorker.replicaCount` scales ingestion and investigations. Each replica needs access to the same ClickHouse and gateway. Credentials refresh every 30 seconds; a newly created key may briefly receive a retryable `429`. Revocations propagate on refresh, and a replica stops accepting traces when its credential snapshot reaches 90 seconds.

Lens does not need provider credentials, PostgreSQL credentials, or a GPU. Its image includes the runtime for the investigator's calculation tool. Keep the shipped security settings, temporary filesystem, and resource limits.

## Troubleshooting

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

Share the dashboard URL and [first-trace guide](../first-trace.md) with your developers. Give them a dedicated tracing key if they cannot create one. They do not need the shared service secret or database credentials.
