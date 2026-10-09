---
title: "Standalone Docker"
description: "Add Lens to a LiteLLM container started with docker run."
slug: "/proxy/lens/deployment/docker"
---

# Standalone Docker

For optional help from your coding agent, [Set it up for me](https://github.com/BerriAI/lens/blob/main/docs/setup-with-agent.md) has prompts for an existing LiteLLM deployment, standalone Lens, and external ClickHouse. The agent should inspect the installed version before applying this guide

Use this path when you start LiteLLM with `docker run`. You need Docker, a running LiteLLM container, and a [ClickHouse HTTP endpoint](./storage.md#clickhouse-connection). Use [matching LiteLLM and Lens images](./releases.md#container-images).

## 1. Configure LiteLLM

Generate a service secret:

```bash
openssl rand -hex 32
```

Add these variables to LiteLLM's environment file, replacing the secret and public URL. Recreate LiteLLM with your usual `docker run` command and that file:

```dotenv
LITELLM_LENS_URL=http://lens-worker:4318
LITELLM_LENS_PUBLIC_URL=https://traces.example.com
LITELLM_LENS_SERVICE_TOKEN=<generated-service-secret>
```

For agents on the Docker host, use `http://localhost:4318` as the public URL. For other machines, add the trace-hostname server block from the [NGINX example](./server.md#3-route-https-traffic), using your hostname and TLS certificate. Keep your existing LiteLLM routing.

## 2. Configure Lens

Create `~/lens.env` with the same service secret and your ClickHouse HTTP URL. Replace `litellm` with your gateway's container name and `4000` with its container port. URL-encode special characters in the ClickHouse username and password:

```dotenv title="lens.env"
LITELLM_URL=http://litellm:4000
LITELLM_LENS_SERVICE_TOKEN=<same-service-secret>
CLICKHOUSE_URL=https://lens_user:URL_ENCODED_PASSWORD@clickhouse.example.com:8443
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

## 3. Start Lens

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
  "ghcr.io/berriai/litellm-lens-worker@sha256:RELEASE_DIGEST"
```

Keep both containers on that network when you recreate them.

For a managed container platform, use the same image, environment variables, filesystem settings, and resource limits. Use private service addresses for the LiteLLM and Lens connection. Set `/health/live` for process health and `/health/ready` for readiness on port `4318`.

## 4. Check the installation

1. Sign in to your LiteLLM dashboard as a proxy administrator.
2. Open **Lens > Set up Lens**, or **Traces > Set up tracing** if you already have traces.
3. Check the **Traces endpoint**, click **Generate tracing key**, then **Send a test trace**.
4. Click **View trace**, then [connect your agent](../first-trace.md).

If the check fails, use [Troubleshooting](./configuration.md#troubleshooting).
