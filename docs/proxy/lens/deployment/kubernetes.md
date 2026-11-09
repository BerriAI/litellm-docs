---
title: "Kubernetes"
description: "Deploy independent Lens with its own Helm chart and optional LiteLLM connection."
slug: "/proxy/lens/deployment/kubernetes"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Kubernetes

The [Lens Helm chart](https://github.com/BerriAI/lens/blob/main/helm/lens/README.md) deploys the complete Lens UI, Rust API and background processing with ClickHouse and Keeper. This source installation uses the public Lens repository and requires a Kubernetes cluster, Helm, kubectl and a storage class for the persistent volume. Standalone Lens does not require a gateway or PostgreSQL

For help from your coding agent, use [Set it up for me](https://github.com/BerriAI/lens/blob/main/docs/setup-with-agent.md) and specify Helm

## New deployment {#new-deployment}

Until an independent release is published, build the source image and push it to a registry your cluster can read. Use a native builder matching the cluster nodes' Linux architecture. From a fresh clone of [BerriAI/lens](https://github.com/BerriAI/lens), replace the example registry and team:

```sh
LENS_IMAGE_REPOSITORY=registry.example.com/your-team/lens
LENS_IMAGE_TAG=$(git rev-parse HEAD)
docker build --build-arg LENS_VERSION="$LENS_IMAGE_TAG" -f deploy/runtime/Dockerfile \
  -t "$LENS_IMAGE_REPOSITORY:$LENS_IMAGE_TAG" .
docker push "$LENS_IMAGE_REPOSITORY:$LENS_IMAGE_TAG"
helm upgrade --install lens ./helm/lens --namespace lens --create-namespace \
  --set image.repository="$LENS_IMAGE_REPOSITORY" --set image.tag="$LENS_IMAGE_TAG"
kubectl --namespace lens port-forward service/lens 4318:4318
```

Configure image-pull credentials if your registry is private. Open `http://localhost:4318/ui/`. Obtain the generated login credential locally:

```sh
kubectl --namespace lens get secret lens-admin \
  -o jsonpath='{.data.admin-token}' | base64 --decode
```

Keep that credential private. Helm reuses generated credentials on upgrades, and uninstall retains credentials and the ClickHouse volume. Before exposing Lens to agents, configure `publicUrl`, HTTPS ingress and a reachable ingestion address using the [Helm guide](https://github.com/BerriAI/lens/blob/main/helm/lens/README.md)

For [external ClickHouse](./storage.md#external-clickhouse), provide a stable endpoint reaching one server with KeeperMap. Multiple Lens replicas may share that server. Multi-server load balancing and automatic failover to a different ClickHouse server are outside the supported topology

## Connect an existing LiteLLM deployment {#existing-deployment}

Use **external** mode when Lens already runs in its own release or on a platform such as Render. This connects the gateway to Lens without deploying another Lens or ClickHouse instance.

First complete [steps 1–3 of Add Lens to LiteLLM](./litellm.md#1-get-the-lens-address). The gateway must have the adapter and UI described in that guide. Keep your existing gateway chart family, release name, namespace, and model configuration.

### 1. Store the connection secrets

Use your Kubernetes secret manager to create `lens-connection` in the **gateway namespace** with these keys:

| Secret key | Value from Lens |
| --- | --- |
| `service-token` | `LITELLM_LENS_SERVICE_TOKEN` |
| `gateway-secret` | `LENS_GATEWAY_SECRET` |

For a manual setup, save each value in a separate private file named `service-token` and `gateway-secret`. Do not include a trailing newline. Set your namespace and create the Secret:

```sh
export GATEWAY_NAMESPACE="YOUR_GATEWAY_NAMESPACE"
kubectl --namespace "$GATEWAY_NAMESPACE" create secret generic lens-connection \
  --from-file=service-token=./service-token \
  --from-file=gateway-secret=./gateway-secret
```

If this Secret already exists, reuse it after confirming the values match Lens. Keep the files out of Git. For GitOps, declare the Secret through your existing secret-management controller.

### 2. Add the Lens values

Save this as `lens-connection.yaml`, using the address of your existing Lens service:

```yaml
lensWorker:
  mode: external
  externalUrl: https://lens.example.com
  publicUrl: https://lens.example.com
  serviceTokenSecret:
    name: lens-connection
    key: service-token
  gateway:
    secretName: lens-connection
    secretKey: gateway-secret
```

`externalUrl` must be reachable by the gateway. `publicUrl` must be reachable by agent exporters. Neither address includes `/ui/` or `/v1/traces`.

Add the tracing store setting in the same file. Use the block for your existing chart:

<Tabs groupId="litellm-chart">
<TabItem value="combined" label="litellm-helm chart">

```yaml
proxy_config:
  general_settings:
    tracing:
      store:
        type: lens
```

</TabItem>
<TabItem value="split" label="Componentized litellm chart">

```yaml
gateway:
  config:
    proxy_config:
      general_settings:
        tracing:
          store:
            type: lens
```

</TabItem>
</Tabs>

If your deployment supplies `config.yaml` from an external ConfigMap instead, add `general_settings.tracing.store.type: lens` to that file through its existing owner.

### 3. Apply and check

Set `GATEWAY_RELEASE` to your existing Helm release name. Set `GATEWAY_CHART` to the same compatible chart package or local chart directory used by your gateway deployment. Do not switch chart families. You can inspect the installed release with:

```sh
helm list --namespace "$GATEWAY_NAMESPACE"
```

Apply the added values while retaining the release's saved values:

```sh
export GATEWAY_RELEASE="YOUR_GATEWAY_RELEASE"
export GATEWAY_CHART="PATH_TO_YOUR_EXISTING_CHART_PACKAGE"
helm upgrade "$GATEWAY_RELEASE" "$GATEWAY_CHART" \
  --namespace "$GATEWAY_NAMESPACE" --reuse-values \
  -f lens-connection.yaml --wait
```

This rolls the gateway pods to load the connection settings. For GitOps, commit the values and Secret references through your normal review and sync process instead.

Sign in to LiteLLM, select **Lens**, and complete [the connection check](./litellm.md#5-open-lens-in-the-gateway). Then [send your first trace](../first-trace.md).

If Lens is already owned by the gateway's Helm release, do not change it to external mode with this procedure. Use the [ownership-transfer guide](https://github.com/BerriAI/lens/blob/main/helm/lens/README.md#select-versions-independently) to preserve its resources and storage first.

## Check the installation

For the standalone example:

```sh
kubectl get pods,services,pvc --namespace lens
kubectl logs --namespace lens deployment/lens --tail=100
```

Complete the [first-trace flow](../deployment.md#check-the-installation) in standalone Lens or the embedded gateway page, using an endpoint reachable by the agent. Open a stored trace after restarting Lens and verify a bounded investigation when analysis is configured

Keep ClickHouse data and Keeper state in the same recovery plan. The [backup guide](https://github.com/BerriAI/lens/blob/main/docs/backup.md) describes the required recovery boundary; its Compose helper does not manage Kubernetes backups. Use your cluster's snapshot and restore procedure and verify records after a restore
