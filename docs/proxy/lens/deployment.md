---
title: "Set up Lens"
description: "Use Lens in your LiteLLM dashboard or deploy it as a separate application."
slug: "/proxy/lens/deployment"
---

# Set up Lens

Lens lets you inspect agent traces, investigate failures, and save useful runs as datasets. You can open it inside your LiteLLM dashboard or use it as a separate application.

In both cases, Lens runs as its own service and stores its data in ClickHouse. Your agent can keep its existing model provider.

## Choose your starting point {#new-deployment}

| Your starting point | Follow this guide |
| --- | --- |
| You use LiteLLM and want Lens in its sidebar | [Add Lens to LiteLLM](./deployment/litellm.md) |
| You already run Lens and want to connect it to a gateway | [Connect your existing Lens deployment](./deployment/litellm.md#1-get-the-lens-address) |
| You want to run Lens without a gateway | [Start standalone Lens](./deployment/local.md) |
| Your team has already set up Lens | [Send your first trace](./first-trace.md) |

For a persistent standalone deployment, use [Docker Compose on a server](./deployment/server.md) or [Kubernetes](./deployment/kubernetes.md). The local quickstart builds from source. See [Releases and images](./deployment/releases.md) for the release status.

## Use Lens inside LiteLLM {#configure-an-existing-proxy}

A gateway administrator configures the connection once. Users then open **Lens** in the LiteLLM sidebar and use their existing LiteLLM session. They do not enter the standalone Lens admin token. LiteLLM supplies their identity and access scope to Lens.

If Lens is not configured, the dashboard shows its setup page. Connecting the service does not instrument your agents. After the connection is ready, send a trace from an agent.

Follow [Add Lens to LiteLLM](./deployment/litellm.md). If Lens already runs, use its current address, storage, and credentials. You do not need to install a second copy or move its data.

## Use Lens on its own

Start Lens and ClickHouse, then sign in at the Lens URL with its admin token. A LiteLLM gateway and PostgreSQL are not required. You can record and inspect traces before you configure an analysis model.

Follow the [standalone quickstart](./deployment/local.md). Add an [analysis model](https://github.com/BerriAI/lens/blob/main/docs/analysis.md) when you want to run investigations.

## Check your first result {#check-the-installation}

Open Lens, generate a tracing key, and follow [Send your first trace](./first-trace.md). Open the resulting run and inspect its content. A health check confirms that the service is ready; a stored trace confirms that your exporter can send data and you can read it.

For help from a coding agent, copy the **Set it up for me** prompt in the [Lens setup guide](https://github.com/BerriAI/lens/blob/main/docs/setup-with-agent.md). It covers standalone setup, an existing gateway, and connecting an agent.
