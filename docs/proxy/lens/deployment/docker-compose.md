---
title: "Add Lens to Docker Compose"
description: "Add Lens to your existing LiteLLM Compose project."
slug: "/proxy/lens/deployment/docker-compose"
---

# Add Lens to Docker Compose

Add Lens to your existing Compose project. You need a [ClickHouse HTTP endpoint](./storage.md#clickhouse-connection) and [matching LiteLLM and Lens images](./releases.md#container-images). For a new deployment, use [Docker Compose on a server](./server.md).

## 1. Set the connection values

Generate a service secret:

```bash
openssl rand -hex 32
```

Add these values to your Compose project's `.env` file. Replace the placeholders and URLs. URL-encode special characters in the ClickHouse username and password:

```dotenv
LENS_WORKER_IMAGE=ghcr.io/berriai/litellm-lens-worker@sha256:RELEASE_DIGEST
LITELLM_LENS_SERVICE_TOKEN=<generated-service-secret>
LITELLM_LENS_PUBLIC_URL=https://traces.example.com
CLICKHOUSE_URL=https://lens_user:URL_ENCODED_PASSWORD@clickhouse.example.com:8443
```

For agents on the Docker host, use `http://localhost:4318` as the public URL. For other machines, add the trace-hostname server block from the [NGINX example](./server.md#3-route-https-traffic), using your hostname and TLS certificate. Keep your existing LiteLLM routing.

Protect the file:

```bash
chmod 600 .env
```

## 2. Add Lens to your Compose file

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

## 3. Start Lens

Use your usual Compose command with the updated configuration:

```bash
docker compose up -d
```

## 4. Check the installation

1. Sign in to your LiteLLM dashboard as a proxy administrator.
2. Open **Lens > Set up Lens**, or **Traces > Set up tracing** if you already have traces.
3. Check the **Traces endpoint**, click **Generate tracing key**, then **Send a test trace**.
4. Click **View trace**, then [connect your agent](../first-trace.md).

If the check fails, use [Troubleshooting](./configuration.md#troubleshooting).
