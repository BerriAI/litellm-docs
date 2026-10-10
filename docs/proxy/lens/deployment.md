---
title: "Deployment"
description: "Run Lens with ClickHouse, independently or connected to LiteLLM."
slug: "/proxy/lens/deployment"
---

# Deployment

Lens includes its UI, Rust API and background processing, with ClickHouse storing its data and coordination state. It runs on its own and can also appear inside the LiteLLM dashboard through the shared Lens UI package. Your agents keep their existing model provider

The current independent installation builds source and requires access to the internal [Lens repository](https://github.com/BerriAI/lens). Published Lens releases and the corresponding gateway integration must be qualified before you adopt them; source availability alone does not mean those artifacts have shipped. See [Releases and images](./deployment/releases.md)

For help from your coding agent, [Set it up for me](https://github.com/BerriAI/lens/blob/main/docs/setup-with-agent.md) has prompts for standalone Lens, existing LiteLLM and external ClickHouse

## New deployment {#new-deployment}

| Where you want to run Lens | Guide |
| --- | --- |
| On your computer | [Local quickstart](./deployment/local.md) |
| On a server behind HTTPS | [Docker Compose on a server](./deployment/server.md) |
| In Kubernetes | [Lens Helm deployment](./deployment/kubernetes.md#new-deployment) |
| With source changes and UI reload | [Build from source](./deployment/development.md) |

Recording and inspecting traces requires only Lens and ClickHouse. Add an analysis provider when you enable investigations or other model-backed features. PostgreSQL belongs to an optional gateway or a one-time metadata import. For external ClickHouse, check [Storage and secrets](./deployment/storage.md) before choosing its topology

## Connect an existing LiteLLM deployment {#configure-an-existing-proxy}

Keep the gateway's model routing, authentication, database and existing keys. Confirm that its actual version contains the compatible Lens adapter and shared UI. Official paired Lens and LiteLLM releases share a version and are tested together. Lens remains independently deployable; an embedded UI update requires a LiteLLM UI release

Use [Compose integration](./deployment/docker-compose.md), [container integration](./deployment/docker.md) or the [Helm connection](./deployment/kubernetes.md#existing-deployment) for your deployment method. Each points to the current source integration and its release boundary

If the previous Lens implementation has saved records, follow the [metadata migration guide](https://github.com/BerriAI/lens/blob/main/docs/migration.md) before handing its writers to the independent service. Keep existing ClickHouse traces and feedback. PostgreSQL is a one-time import source for Lens metadata; LiteLLM retains its own gateway database

## Check the installation

Sign into standalone Lens at `/ui/`, or use your existing LiteLLM session at the embedded `/ui/lens/` page. Open **Traces > Set up tracing**, select your framework, create a tracing key and copy the generated configuration into your agent. Verify that the endpoint is reachable from the agent's network and ends in `/v1/traces`

Run the agent, use **Check for traces**, then open that exact run and inspect its input, output and tool calls. Demo data and readiness alone do not verify ingestion or access scope. Follow [Send your first trace](./first-trace.md) for the detailed flow

For investigations, [configure an analysis provider](https://github.com/BerriAI/lens/blob/main/docs/analysis.md), check it in **Settings > Analysis**, then create an investigation with an analysis model and monthly spending limit. Lens runs the investigation inside its own service

Use [Configuration and troubleshooting](./deployment/configuration.md) for connection problems and [Upgrade Lens](./deployment/upgrades.md) when changing an existing installation
