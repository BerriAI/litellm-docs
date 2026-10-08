---
title: "Deployment"
description: "Choose how to install Lens locally or for a team, with new or existing LiteLLM."
slug: "/proxy/lens/deployment"
---

# Deployment

Lens runs alongside LiteLLM and stores traces in ClickHouse. Your agents send model requests to LiteLLM and traces to Lens. View traces and investigations in the LiteLLM dashboard.

![Your agent sends model requests to LiteLLM and traces directly to Lens.](/img/lens-architecture.svg)

If Lens is already installed, [send your first trace](./first-trace.md).

## New deployment {#new-deployment}

Choose where you want to run LiteLLM and Lens:

| Where | Guide | What it sets up |
| --- | --- | --- |
| On your computer | [Local quickstart](./deployment/local.md) | LiteLLM, Lens, PostgreSQL, and ClickHouse |
| On a Kubernetes cluster | [Kubernetes](./deployment/kubernetes.md#new-deployment) | LiteLLM, Lens, and ClickHouse, with your PostgreSQL and Redis |
| On a server with Docker | [Docker Compose](./deployment/server.md) | LiteLLM, Lens, PostgreSQL, and ClickHouse behind your HTTPS proxy |

## Add Lens to an existing deployment {#configure-an-existing-proxy}

Choose how you run LiteLLM. Keep your existing model configuration, database, and keys.

| Your deployment | Guide |
| --- | --- |
| Helm | [Add Lens with Helm](./deployment/kubernetes.md#existing-deployment) |
| Docker Compose | [Add Lens to your Compose project](./deployment/docker-compose.md) |
| Standalone Docker | [Add a Lens container](./deployment/docker.md) |

Each guide includes setup commands and a test trace. Use [Storage and secrets](./deployment/storage.md) for external ClickHouse or GitOps, and [Configuration](./deployment/configuration.md) for credential definitions and custom routing.

## Check the installation

1. Sign in to the LiteLLM dashboard as a proxy administrator.
2. Open **Lens**, then **Set up Lens**. If Lens already has traces, use **Traces > Set up tracing**. Under **Connection details**, check the **Traces endpoint**. It should include `/v1/traces`.
3. Click **Generate tracing key**, then **Send a test trace**.
4. Click **View trace**. Seeing the trace confirms upload, storage, and read access.

For investigations, open **Lens > Investigations > Connect worker**. Choose an analysis model and monthly budget, then click **Enable investigations**. Wait for **Worker connected**, then [create an investigation](./investigations.md). The service connects automatically; you do not need to start another worker or copy a worker token.

If a check fails, use [Troubleshooting](./deployment/configuration.md#troubleshooting). For a later release, follow [Upgrade Lens](./deployment/upgrades.md).
