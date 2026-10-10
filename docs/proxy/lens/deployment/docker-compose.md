---
title: "Connect Lens to Docker Compose"
description: "Connect independent Lens to an existing LiteLLM Compose deployment."
slug: "/proxy/lens/deployment/docker-compose"
---

# Connect Lens to Docker Compose

Start Lens with its own [source Compose installation](https://github.com/BerriAI/lens/blob/main/deploy/lens/README.md), then connect your existing LiteLLM deployment. Lens owns its UI, processing and ClickHouse data. Keep the gateway's model configuration, authentication, PostgreSQL database and other services

The gateway must contain the compatible adapter and shared Lens UI. The [current source integration guide](https://github.com/BerriAI/litellm/blob/d171e208a18d3f3559e3a338f7769387e01749e5/docs/lens-integration.md) describes the qualified source boundary; it is not a claim that an installable gateway release already contains it. Select [available artifacts](./releases.md) before changing your deployment

For help adapting your existing deployment, copy the [existing LiteLLM setup prompt](https://github.com/BerriAI/lens/blob/main/docs/setup-with-agent.md#add-lens-to-existing-litellm) into your coding agent

## Set the private connection {#1-set-the-connection-values}

Reuse existing connection credentials when they are already configured. Otherwise generate separate private service and signing secrets with at least 32 characters each, using your secret manager. Put both in Lens's `deploy/lens/.env`:

```dotenv
LITELLM_LENS_SERVICE_TOKEN=<private-service-secret>
LENS_GATEWAY_SECRET=<private-signing-secret>
```

Give the gateway those same two values and the addresses it needs:

```dotenv
LITELLM_LENS_URL=http://lens:4318
LITELLM_LENS_PUBLIC_URL=https://lens.example.com
LITELLM_LENS_SERVICE_TOKEN=<same-private-service-secret>
LENS_GATEWAY_SECRET=<same-private-signing-secret>
```

The example internal hostname `lens` requires a shared Docker network. Use an address reachable from the gateway container. The public address must be reachable by the browser and agent exporters, without `/v1/traces` appended. See [network and routing configuration](./configuration.md#docker-network)

## Preserve the existing deployment {#2-add-lens-to-your-compose-file}

Supply the gateway variables through its existing Compose environment or secret configuration. Merge this tracing block into the gateway's configuration, preserving the other values under `general_settings` and the rest of the file:

```yaml
general_settings:
  tracing:
    store:
      type: lens
```

Lens retains its own administrator credential and ClickHouse connection

If the old gateway-hosted Lens has saved metadata, complete the [migration and writer handoff](https://github.com/BerriAI/lens/blob/main/docs/migration.md) before starting the new runtime against that data. A service token does not migrate records or replace an old enrolled-worker token

## Apply the changes {#3-start-lens}

From the Lens repository root, apply its environment change:

```sh
docker compose -f deploy/lens/compose.yaml up -d --wait
```

Recreate the gateway through its existing deployment command so it receives the new environment and tracing configuration. Preserve its unrelated services, volumes and credentials

## Check the embedded flow {#4-check-the-installation}

Verify ordinary gateway inference, then sign into LiteLLM and open `/ui/lens/`. The embedded UI uses your existing gateway session. Complete the [first-trace check](../deployment.md#check-the-installation) there and verify the same user and team access scope you had before

The integration guide also describes the authenticated `/lens/service` check. Expect `connected: true`, storage readiness and public contract 1. That check establishes connectivity; the real trace establishes ingestion, storage and authorized reads
