---
title: "Kubernetes"
description: "Deploy independent Lens with its own Helm chart and optional LiteLLM connection."
slug: "/proxy/lens/deployment/kubernetes"
---

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

Keep the gateway's chart family, release name, namespace, model configuration, database and keys. Select a gateway artifact containing the compatible adapter and shared UI. The [current source integration guide](https://github.com/BerriAI/litellm/blob/d171e208a18d3f3559e3a338f7769387e01749e5/docs/lens-integration.md) identifies the source qualification boundary; published gateway support must be checked separately

Both LiteLLM charts consume the Lens chart through `lensWorker` settings:

| Mode | Ownership |
| --- | --- |
| `bundled` | The gateway release renders the shared Lens chart |
| `external` | Lens has its own release or application, and the gateway connects to it |
| `disabled` | The gateway does not deploy or connect this Lens service |

The [gateway connection settings](https://github.com/BerriAI/lens/blob/main/helm/lens/README.md#connect-a-gateway) cover the private service credential, signing credential and URLs. The Lens administrator credential remains separate. A Lens runtime version does not have to equal the gateway version

For existing Lens records, complete the [metadata migration](https://github.com/BerriAI/lens/blob/main/docs/migration.md) before changing writers. Moving from bundled to external ownership also requires the [ownership transfer](https://github.com/BerriAI/lens/blob/main/helm/lens/README.md#select-versions-independently). Preserve names, immutable selectors, credentials and persistent volumes; do not let two controllers own the same deployment

## Check the installation

For the standalone example:

```sh
kubectl get pods,services,pvc --namespace lens
kubectl logs --namespace lens deployment/lens --tail=100
```

Complete the [first-trace flow](../deployment.md#check-the-installation) in standalone Lens or the embedded gateway page, using an endpoint reachable by the agent. Open a stored trace after restarting Lens and verify a bounded investigation when analysis is configured

Keep ClickHouse data and Keeper state in the same recovery plan. The [backup guide](https://github.com/BerriAI/lens/blob/main/docs/backup.md) describes the required recovery boundary; its Compose helper does not manage Kubernetes backups. Use your cluster's snapshot and restore procedure and verify records after a restore
