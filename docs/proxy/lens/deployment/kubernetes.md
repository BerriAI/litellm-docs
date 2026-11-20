---
title: "Kubernetes"
description: "Install Lens on Kubernetes with one Helm command, then expose it through your ingress controller."
slug: "/proxy/lens/deployment/kubernetes"
---

# Kubernetes

## Prerequisites

Use Helm 3.8 or newer and a cluster with a default StorageClass. Otherwise, set `clickhouse.storageClassName`

The chart installs Lens with its own ClickHouse on a persistent volume and generates its credentials. You do not create any Secrets, and Lens does not use PostgreSQL

## Install the chart {#new-deployment}

```sh
helm upgrade --install lens oci://ghcr.io/berriai/charts/lens \
  --namespace lens --create-namespace \
  --wait --timeout 10m
```

Argo CD and other GitOps tools render the chart without cluster access, so generated credentials would change on every sync. Use [pre-provisioned Secrets](./storage.md#gitops) there

On first start, the Lens pod can restart a few times until ClickHouse is ready. Persistent failures need [storage and startup diagnostics](./configuration.md#troubleshooting)

## Expose Lens {#ingress}

Save these overrides as `values.yaml`. Replace the hostname, the ingress class of your installed controller and the TLS Secret that holds the certificate for that hostname

```yaml title="values.yaml"
publicUrl: https://lens.example.com
ingress:
  enabled: true
  className: <your-ingress-class>
  host: lens.example.com
  tls:
    - secretName: lens-tls
      hosts: [lens.example.com]
```

Run the install command again with `--values values.yaml`. Then check that Lens is ready:

```sh
curl --fail https://lens.example.com/health/ready
```

## Sign in

Open `https://lens.example.com/ui/` and paste the generated admin token into the **Setup token** field. Read the token with:

```sh
kubectl --namespace lens get secret lens-admin \
  -o jsonpath='{.data.admin-token}' | base64 --decode
```

Next, [send your first trace](../first-trace.md) or [add Lens to LiteLLM](./litellm.md)

## values.yaml reference

See the [complete values.yaml](https://github.com/BerriAI/lens/blob/main/helm/lens/values.yaml) for all settings

| Value | Default | Description |
| --- | --- | --- |
| `publicUrl` | `http://localhost:4318` | Browser-facing origin of Lens, without `/ui/`. |
| `ingestionUrl` | `""` | Address agents send traces to. Uses `publicUrl` when empty. |
| `ingress.enabled` | `false` | Creates the Ingress. Install its controller separately. |
| `ingress.className`, `ingress.host` | Both `""` | Ingress class and hostname. The hostname is required when ingress is enabled. |
| `ingress.annotations`, `ingress.tls` | `{}`, `[]` | Controller settings and Kubernetes ingress TLS entries. |
| `adminTokenSecret.name`, `.key` | `""`, `admin-token` | Existing Secret with the admin token. The chart generates `lens-admin` when the name is empty. |
| `gateway.enabled` | `false` | Accepts sign-in from a LiteLLM gateway. See [Add Lens to LiteLLM](./litellm.md). |
| `gateway.secretName`, `serviceTokenSecret.name` | Both `""` | Existing Secrets with the two gateway connection values. |
| `clickhouse.storage`, `clickhouse.storageClassName` | `20Gi`, `null` | Size and StorageClass of the ClickHouse volume. Size it for your traffic and retention. |
| `clickhouseSecret.name`, `.key` | `""`, `url` | Secret with the URL of an [existing ClickHouse](./storage.md). Replaces the bundled one. |
| `retentionDays` | `14` | Days Lens keeps trace data. |
| `resources`, `clickhouse.resources` | Requests `100m` CPU with `256Mi` and `512Mi`, memory limit `2Gi` | Lens and ClickHouse container resources. |
| `extraEnv`, `extraEnvFrom` | Both `[]` | Extra [environment settings](./configuration.md), such as analysis model credentials. |

## Upgrade

[Back up ClickHouse](./storage.md) first. Run the install command again with the same values file. Helm installs the newest released chart and reuses the generated credentials and the ClickHouse volume

To stay on one chart version, add `--version` with a version from [Releases and images](./releases.md) to the install command
