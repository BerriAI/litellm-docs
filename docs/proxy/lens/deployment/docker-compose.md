---
title: "Connect Lens to Docker Compose"
description: "Add a running Lens service to your existing LiteLLM Compose deployment."
slug: "/proxy/lens/deployment/docker-compose"
---

# Connect Lens to Docker Compose

Use this guide when LiteLLM already runs with Docker Compose. Lens can run in another Compose project, on Render, or on another reachable server. Keep your gateway's existing services, model configuration, database, and volumes.

## 1. Prepare the connection {#1-set-the-connection-values}

Complete [steps 1–3 of Add Lens to LiteLLM](./litellm.md#1-get-the-lens-address). You need a ready Lens URL and two connection secrets already configured on Lens.

In the directory that contains your gateway's Compose file, create a private `lens-gateway.env` file with these values:

```dotenv
LITELLM_LENS_URL=https://lens.example.com
LITELLM_LENS_PUBLIC_URL=https://lens.example.com
LITELLM_LENS_SERVICE_TOKEN=YOUR_SERVICE_SECRET
LENS_GATEWAY_SECRET=YOUR_SIGNING_SECRET
```

Replace the URL and secrets with your values. Keep this file out of Git and restrict access:

```sh
chmod 600 lens-gateway.env
```

Using the public HTTPS Lens URL for both addresses works when the gateway and agents can reach it. For a shared Docker network, the private URL can instead be `http://lens:4318`. Keep the public URL reachable by your agents. See [Docker networking](./configuration.md#docker-network).

<span id="2-add-lens-to-your-compose-file" />

## 2. Apply the gateway settings {#2-apply-the-gateway-settings}

Add the environment file to your gateway service in its existing Compose file. This example uses the service name `litellm`; use the name in your file. Preserve any existing `env_file` entries:

```yaml
services:
  litellm:
    env_file:
      - lens-gateway.env
```

An explicit `environment` value overrides the same name in an environment file. Update any existing definitions of these four Lens variables so they agree. In a split deployment, add the file to both the gateway and backend/API services.

Merge this block into the gateway's existing `config.yaml`:

```yaml
general_settings:
  tracing:
    store:
      type: lens
```

Do not replace other `general_settings` values or the model list.

## 3. Recreate the gateway {#3-start-lens}

From your gateway's Compose directory, list the service names:

```sh
docker compose config --services
```

Recreate the gateway service so it loads the settings. Replace `litellm` with its service name. Include the backend service too if you use a split deployment:

```sh
docker compose up -d --no-deps litellm
```

Keep any Compose file or project flags that your deployment normally uses. This step restarts the selected service and can interrupt requests.

## 4. Check the result {#4-check-the-installation}

Sign in to LiteLLM and select **Lens**. Use [the connection check](./litellm.md#5-open-lens-in-the-gateway), then [send your first trace](../first-trace.md). Your existing model requests should continue to work.
