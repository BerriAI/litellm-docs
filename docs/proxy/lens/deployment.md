---
title: "Deployment"
description: "Choose how to install Lens locally or for a team, with new or existing LiteLLM."
slug: "/proxy/lens/deployment"
---

# Deployment

Lens can run as its own application with ClickHouse, or integrate with LiteLLM. Your agents send telemetry to Lens and keep their existing model provider. Lens owns the shared UI used by its standalone application and the LiteLLM dashboard. An embedded UI update ships with a LiteLLM UI release.

If Lens is already installed, [send your first trace](./first-trace.md).

Prefer your coding agent to configure the project? [Set it up for me](https://github.com/BerriAI/lens/blob/main/docs/setup-with-agent.md) has optional copyable prompts for standalone Lens, an existing LiteLLM deployment, and external ClickHouse. Keep the manual path below if you prefer to run the commands yourself

## Standalone source preview

The independent [Lens repository](https://github.com/BerriAI/lens) includes the UI, API and background processing. [Start Lens locally](./deployment/local.md) with Docker and ClickHouse. You do not need a gateway, PostgreSQL or a provider key to record and inspect traces. The standalone release artifacts are still being qualified, so this path builds a source checkout.

For an existing Lens deployment, use the [metadata migration guide](https://github.com/BerriAI/lens/blob/main/docs/migration.md) before handing its writers to the independent service. Lens can keep its existing ClickHouse trace data; PostgreSQL is only an import source for Lens metadata. LiteLLM keeps its own gateway database.

## Gateway-bundled releases {#new-deployment}

The following deployment guides describe previously released gateway-bundled Lens installations. Keep the versions and configuration required by that release. They are retained for existing deployments while the independent release and gateway integration are qualified.

![In a gateway-bundled deployment, the agent sends model requests to LiteLLM and traces directly to Lens.](/img/lens-architecture.svg)

Choose where you want to run LiteLLM and Lens:

| Where | Guide | What it sets up |
| --- | --- | --- |
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
