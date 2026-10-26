---
title: "Lens containers"
description: "Run the independent Lens container with ClickHouse and optionally connect LiteLLM."
slug: "/proxy/lens/deployment/docker"
---

# Lens containers

Lens's runtime image contains its Rust API, background processing, static UI and calculation sandbox. It requires ClickHouse with KeeperMap and its own administrator credential. Use the [source Compose quickstart](./local.md) for the shortest complete container installation, or the [source Helm chart](./kubernetes.md) in Kubernetes

For a managed container platform, use the current [runtime Dockerfile](https://github.com/BerriAI/lens/blob/main/deploy/runtime/Dockerfile) and [Compose configuration](https://github.com/BerriAI/lens/blob/main/deploy/lens/compose.yaml) as the deployment reference. [Build from source](./development.md#try-backend-changes) produces a local image; independently published artifacts are still being qualified

## Configure Lens {#2-configure-lens}

Supply `LENS_ADMIN_TOKEN`, the correct `LENS_PUBLIC_URL`, and its ClickHouse connection through private deployment configuration. The [storage requirements](./storage.md#external-clickhouse) include the single-server topology, Keeper configuration and permissions. Retain credentials and storage across container replacements

Preserve the shipped non-root user, read-only filesystem, bounded temporary space, dropped capabilities and sandbox settings. Use native Linux with the capabilities required by the [calculation sandbox](https://github.com/BerriAI/lens/blob/main/docs/sandbox.md) for investigations

## Connect an existing gateway {#1-configure-litellm}

A compatible LiteLLM gateway can connect to the running Lens service at a reachable HTTP or HTTPS address. Use the credentials and URL settings in [Add Lens to LiteLLM](./litellm.md), supplied through your existing container environment and recreation command. Keep both containers on a persistent user-defined network or use another reachable private address

Lens's public address serves agents and browsers. Its service and signing credentials authenticate the gateway connection; agent tracing keys and model credentials stay separate. Existing gateway-hosted Lens metadata needs the [documented migration](https://github.com/BerriAI/lens/blob/main/docs/migration.md) before the new runtime takes ownership

## Start and check {#3-start-lens}

Set `/health/live` for process health and `/health/ready` for readiness on port 4318. Route the standalone UI and API through your HTTPS proxy following the [server guide](./server.md#3-route-https-traffic)

## Verify useful operation {#4-check-the-installation}

Sign into standalone Lens at `/ui/`, or use the connected gateway's `/ui/lens/` page. Complete the [first-trace check](../deployment.md#check-the-installation), restart the Lens container and confirm the saved trace remains accessible. For recovery, use a backup procedure that retains ClickHouse payloads and Keeper state together
