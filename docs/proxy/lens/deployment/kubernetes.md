---
title: "Kubernetes"
description: "Deploy independent Lens with its own Helm chart and optional LiteLLM connection."
slug: "/proxy/lens/deployment/kubernetes"
---

# Kubernetes

The Lens Helm chart deploys Lens with ClickHouse and Keeper. You need a Kubernetes cluster, Helm, kubectl and a default storage class for the persistent volume. Standalone Lens does not require a gateway or PostgreSQL

## New deployment {#new-deployment}

Install the published v0.1.0 chart. It pulls the public Lens image by digest, with no build or registry credentials:

```sh
helm install lens oci://ghcr.io/berriai/charts/lens \
  --version 0.1.0 --namespace lens --create-namespace --wait --timeout 5m
kubectl --namespace lens port-forward service/lens 4318:4318
```

Keep port-forward running and open `http://localhost:4318/ui/`. In another terminal, check readiness and obtain the generated login credential:

```sh
curl --fail http://localhost:4318/health/ready
kubectl --namespace lens get secret lens-admin \
  -o jsonpath='{.data.admin-token}' | base64 --decode
```

Keep that credential private. Helm reuses generated credentials on upgrades, and uninstall retains credentials and the ClickHouse volume. Before exposing Lens to agents, configure `publicUrl`, HTTPS ingress and a reachable ingestion address using the [Helm guide](https://github.com/BerriAI/lens/blob/main/helm/lens/README.md)

For [external ClickHouse](./storage.md#external-clickhouse), provide a stable endpoint reaching one server with KeeperMap. Multiple Lens replicas may share that server. Multi-server load balancing and automatic failover to a different ClickHouse server are outside the supported topology

## Connect an existing LiteLLM deployment {#existing-deployment}

Connect the LiteLLM chart to Lens running in its own release or on a platform such as Render. This connects the gateway to Lens without deploying another Lens or ClickHouse instance.

First complete [steps 1–3 of Add Lens to LiteLLM](./litellm.md#1-get-the-lens-address). The gateway must have the adapter and UI described in that guide. Keep your release name, namespace, and model configuration. These values target the current [LiteLLM chart](../../deploy/helm.md). Migrate older chart values before upgrading.

### 1. Store the connection secrets

Use your Kubernetes secret manager to create `lens-connection` in the **gateway namespace** with these keys:

| Secret key | Value from Lens |
| --- | --- |
| `service-token` | `LITELLM_LENS_SERVICE_TOKEN` |
| `gateway-secret` | `LENS_GATEWAY_SECRET` |

For a manual setup, save each value in a private file named `service-token` and `gateway-secret`, without a trailing newline:

```sh
export GATEWAY_NAMESPACE="YOUR_GATEWAY_NAMESPACE"
kubectl --namespace "$GATEWAY_NAMESPACE" create secret generic lens-connection \
  --from-file=service-token=./service-token \
  --from-file=gateway-secret=./gateway-secret
```

Reuse an existing matching Secret. Keep the files out of Git. For GitOps, use your secret-management controller.

### 2. Add the Lens values

Save this as `lens-connection.yaml`, using the address of your existing Lens service:

```yaml
lens:
  enabled: true
  url: https://lens.example.com
  publicUrl: https://lens.example.com
  serviceTokenSecret:
    name: lens-connection
    key: service-token
  gatewaySecret:
    name: lens-connection
    key: gateway-secret
```

The gateway must be able to reach `url`. Agent exporters must be able to reach `publicUrl`. Neither address includes `/ui/` or `/v1/traces`.

Add the tracing store setting in the same file:

```yaml
gateway:
  config:
    proxy_config:
      general_settings:
        tracing:
          store:
            type: lens
```

If your deployment supplies `config.yaml` from an external ConfigMap instead, add `general_settings.tracing.store.type: lens` to that file through its existing owner.

### 3. Apply and check

Use your existing release name, namespace and [chart](../../deploy/helm.md#install-the-chart). Inspect the installed release with:

```sh
helm list --namespace "$GATEWAY_NAMESPACE"
```

Merge these settings with your complete values file. Then apply both:

```sh
export GATEWAY_RELEASE="YOUR_GATEWAY_RELEASE"
export GATEWAY_CHART="oci://ghcr.io/YOUR_ORG/charts/litellm"
export GATEWAY_CHART_VERSION="1.0.0"
helm upgrade "$GATEWAY_RELEASE" "$GATEWAY_CHART" \
  --version "$GATEWAY_CHART_VERSION" \
  --namespace "$GATEWAY_NAMESPACE" \
  -f gateway-values.yaml -f lens-connection.yaml --wait
```

This rolls the gateway pods to load the connection settings. For GitOps, commit the values and Secret references through your normal review and sync process instead.

Sign in to LiteLLM, select **Lens**, and complete [the connection check](./litellm.md#5-open-lens-in-the-gateway). Then [send your first trace](../first-trace.md).

If an older gateway Helm release owns Lens, transfer ownership before you upgrade. The current chart does not deploy Lens or ClickHouse. Use the [ownership-transfer guide](https://github.com/BerriAI/lens/blob/main/helm/lens/README.md#select-versions-independently) to preserve its resources and storage first.

## Check the installation

For the standalone example:

```sh
kubectl get pods,services,pvc --namespace lens
kubectl logs --namespace lens deployment/lens --tail=100
```

Complete the [first-trace flow](../deployment.md#check-the-installation) in standalone Lens or the embedded gateway page, using an endpoint reachable by the agent. Open a stored trace after restarting Lens and verify a bounded investigation when analysis is configured

Keep ClickHouse data and Keeper state in the same recovery plan. The [backup guide](https://github.com/BerriAI/lens/blob/main/docs/backup.md) describes the required recovery boundary; its Compose helper does not manage Kubernetes backups. Use your cluster's snapshot and restore procedure and verify records after a restore
