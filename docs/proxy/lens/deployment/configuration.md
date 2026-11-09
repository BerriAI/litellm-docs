---
title: "Configuration and troubleshooting"
description: "Configure standalone Lens credentials, networking and the optional LiteLLM connection."
slug: "/proxy/lens/deployment/configuration"
---

# Configuration and troubleshooting

Use the [Lens installation guide](https://github.com/BerriAI/lens/blob/main/deploy/lens/README.md) as the source of deployment settings. For help configuring an existing project, [Set it up for me](https://github.com/BerriAI/lens/blob/main/docs/setup-with-agent.md) provides prompts for standalone Lens, a gateway connection and external storage

## Credentials

| Credential | Purpose |
| --- | --- |
| Lens administrator token | Sign into standalone Lens and administer its API |
| Lens tracing key | Upload agent telemetry under its assigned scope |
| ClickHouse credential | Let Lens initialize, read and write its storage |
| Analysis or evaluation provider key | Let Lens call the configured provider |
| Gateway service and signing credentials | Authenticate the optional internal connection and delegated identity |
| LiteLLM user or model key | Access the gateway under its existing authentication and model rules |

The standalone starter creates its admin token and database password in `deploy/lens/.env`. A standalone tracing installation needs those credentials and a tracing key. Investigations, Signals and eval judging require their corresponding provider configuration. Gateway connection secrets are needed only when connecting LiteLLM

Keep deployment secrets private and retain them with your recovery materials. The gateway keeps its own database and encryption keys; those are separate from Lens's ClickHouse storage

## Publish the endpoint {#publish-trace-endpoint}

Set `LENS_PUBLIC_URL` to the browser origin, such as `https://lens.example.com`. The starter uses it for its UI, generated tracing address and secure session cookies. Forward the standalone UI and API to Lens port 4318 with the [HTTPS server example](./server.md#3-route-https-traffic)

An optional separate ingestion address uses `LITELLM_LENS_PUBLIC_URL` on Lens, or `ingestionUrl` in its Helm chart. It defaults to the Lens public URL. Retain an existing path prefix such as `/lens-ingest` and leave off `/v1/traces`; setup adds that suffix

The gateway separately uses `LITELLM_LENS_URL` for its private connection and `LITELLM_LENS_PUBLIC_URL` for the tracing address shown to users. Verify reachability from the actual gateway, browser and agent networks

## Use an ingress with Helm {#dedicated-ingress}

The independent Lens chart uses `publicUrl`, optional `ingestionUrl` and `ingress` at the top level. Its ingress can serve the standalone UI and API. Configure the hostname, TLS and ingress controller using the [Lens Helm guide](https://github.com/BerriAI/lens/blob/main/helm/lens/README.md)

When a gateway chart owns the Lens deployment, the adapter settings live under `lensWorker`. An external Lens deployment can preserve the gateway's `/lens-ingest` route through `lensWorker.externalServiceName`. Use the values for the chart and version you actually deploy

## Connect Docker networks {#docker-network}

Containers need a reachable service address. A gateway container's `127.0.0.1` points at itself. Give Lens and the gateway a shared user-defined network, preserving Lens's existing default and storage networks, or route through another private address reachable by both

Inspect the existing gateway networks without changing them:

```sh
docker inspect "<your-litellm-container>" --format '{{json .NetworkSettings.Networks}}'
```

Make any shared-network reference persistent in both Compose configurations, including the network override every time you recreate services. Use Lens's service name and port, such as `http://lens:4318`, for the private gateway URL. Follow [Add Lens to LiteLLM](./litellm.md) for the credentials and application settings

## Configuration reference

| Setting | Service | Meaning |
| --- | --- | --- |
| `LENS_ADMIN_TOKEN` | Lens | Standalone administrator credential |
| `LENS_PUBLIC_URL` | Lens | Browser origin and default ingestion address |
| `LITELLM_LENS_PUBLIC_URL` | Lens and gateway | Address advertised for agent ingestion |
| `LITELLM_LENS_URL` | Gateway | Private Lens API base address |
| `LITELLM_LENS_SERVICE_TOKEN` | Lens and gateway | Shared internal service credential |
| `LENS_GATEWAY_SECRET` | Lens and gateway | Shared delegated-identity signing credential |
| `CLICKHOUSE_URL`, or host/user/password settings | Lens | ClickHouse HTTP connection |
| `CLICKHOUSE_DATABASE` | Lens | Selected database, default `lens` in standalone Lens |
| `AGENT_TRACING_RETENTION_DAYS` | Lens | Trace retention, default 14 days |

Existing gateway integrations can retain the `litellm` ClickHouse database. Preserve the actual database that holds your records. See [analysis models](https://github.com/BerriAI/lens/blob/main/docs/analysis.md) and [Signals](https://github.com/BerriAI/lens/blob/main/docs/signals.md) for server-side provider configuration

## Availability and scaling

Standalone Lens initializes its ClickHouse schema and state before accepting requests. Missing Keeper configuration or insufficient permissions prevents readiness. See [external storage requirements](./storage.md#external-clickhouse)

Multiple Lens replicas can share one supported ClickHouse server. Keeper coordinates state publication; it does not replicate the local payload tables between servers. External storage does not make multi-server load balancing or automatic failover supported

The gateway forwards telemetry through a bounded asynchronous queue. If Lens is unavailable, ordinary gateway inference continues, while telemetry may be delayed or dropped after retry or queue limits. Agent exporters have their own retry behavior. Verify outage behavior for your selected deployment and exporter

## Troubleshooting

From a source Compose installation:

```sh
docker compose -f deploy/lens/compose.yaml ps
docker compose -f deploy/lens/compose.yaml logs --tail=100 lens clickhouse
curl --fail http://localhost:4318/health/ready
```

| What you see | What to check |
| --- | --- |
| Lens fails before readiness | ClickHouse connectivity, KeeperMap configuration and schema/write permissions |
| Gateway reports Lens unavailable | Private API URL, matching service and signing credentials, compatible contract and Lens readiness |
| Agent cannot upload | Reachable ingestion address, retained prefix and a valid tracing key |
| Standalone login fails through HTTPS | Correct `LENS_PUBLIC_URL`, forwarded HTTPS information and the retained admin token |
| No analysis provider is configured | Apply the analysis model settings and its server-side credential, restart and check **Settings > Analysis** |
| A saved trace is missing after replacement | Verify the original database, persistent volume and current user's scope |

After resolving the connection, complete the [first-trace check](../deployment.md#check-the-installation). A health response does not verify stored data or provider access
