---
title: Deploy with Helm
description: Install LiteLLM on Kubernetes with Argo CD or Helm. Look up chart settings and defaults in the values.yaml reference.
toc_max_heading_level: 2
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Deploy with Helm

{/* keep-version-note */}

## Prerequisites

Use Kubernetes 1.25 or newer and Helm 3.8 or newer.

Provision PostgreSQL and Redis with private access from your cluster. Use the [sizing guide](./sizing.md) to choose their capacity.

Create the `litellm` namespace and these Secrets before installation:

| Secret | Fields |
| --- | --- |
| `litellm-master-key-secret` | `master-key` |
| `litellm-writer-secret` | `username`, `password` |
| `litellm-redis` | `password` |
| `litellm-env` | `LITELLM_SALT_KEY` and any provider credentials |

## Install the chart

<Tabs queryString="install">
<TabItem value="argocd" label="Argo CD" default>

Add this Application to Argo CD. Set the database and Redis hosts. Add [ingress values](#ingress) for your controller.

```yaml title="application.yaml"
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: litellm
  namespace: argocd
spec:
  project: default
  source:
    repoURL: ghcr.io/berriai/litellm/chart
    chart: litellm
    targetRevision: "1.0.0"
    helm:
      valuesObject:
        image:
          tag: lts
        database:
          writer:
            host: postgres.internal.example.com
            dbname: litellm
        redis:
          host: redis.internal.example.com
          ssl: true
          sslCertReqs: required
          passwordSecret:
            name: litellm-redis
        gateway:
          envSecrets: [litellm-env]
          extraEnv:
            - name: STORE_MODEL_IN_DB
              value: "True"
        backend:
          envSecrets: [litellm-env]
          extraEnv:
            - name: STORE_MODEL_IN_DB
              value: "True"
        migrationJob:
          hooks:
            helm:
              enabled: false
            argocd:
              enabled: true
  destination:
    server: https://kubernetes.default.svc
    namespace: litellm
```

Sync the full Application. The migration Job runs before the services. See [Argo CD's Helm settings](https://argo-cd.readthedocs.io/en/stable/user-guide/helm/) and [sync hooks](https://argo-cd.readthedocs.io/en/stable/user-guide/sync-waves/).

</TabItem>
<TabItem value="cli" label="Helm CLI">

Save these overrides as `values.yaml`. Replace the database and Redis hosts. Add [ingress values](#ingress) for your controller.

```yaml title="values.yaml"
image:
  tag: lts
database:
  writer:
    host: postgres.internal.example.com
    dbname: litellm
redis:
  host: redis.internal.example.com
  ssl: true
  sslCertReqs: required
  passwordSecret:
    name: litellm-redis
gateway:
  envSecrets: [litellm-env]
  extraEnv:
    - name: STORE_MODEL_IN_DB
      value: "True"
backend:
  envSecrets: [litellm-env]
  extraEnv:
    - name: STORE_MODEL_IN_DB
      value: "True"
```

Install the public chart with your values:

```bash
helm upgrade --install litellm oci://ghcr.io/berriai/litellm/chart/litellm \
  --version 1.0.0 \
  --namespace litellm --values values.yaml \
  --wait --timeout 30m
```

</TabItem>
</Tabs>

## values.yaml reference

The tables below list common settings and their defaults. See the [complete values.yaml](https://github.com/BerriAI/litellm/blob/main/litellm/deploy/helm/litellm/values.yaml) for all settings.

`<component>` means `gateway`, `backend`, or `ui`. Short names on the same row share the first value's prefix.

<details>
<summary>Image and deployment mode</summary>

| Value | Default | Description |
| --- | --- | --- |
| `image.repository` | `ghcr.io/berriai/litellm` | Container image repository. |
| `image.tag` | `""` | Uses the chart's `appVersion` when empty. |
| `image.digest` | `""` | Container image digest. |
| `image.pullPolicy` | `IfNotPresent` | Kubernetes image pull policy. |
| `imagePullSecrets` | `[]` | Existing registry Secrets available in the release namespace. |
| `monolith.enabled` | `false` | Runs one proxy when true. It uses `gateway.*` and ignores `backend.*` and `ui.*`. |
| `monolith.extraArgs` | `[]` | Extra CLI arguments for the single-service proxy. |
| `gateway.enabled`, `backend.enabled`, `ui.enabled` | All `true` | Enables each service in separate-service mode. Ignored in single-service mode. |
| `nameOverride`, `fullnameOverride` | Both `""` | Overrides generated resource names. |

</details>

<details>
<summary>Secrets and connections</summary>

| Value | Default | Description |
| --- | --- | --- |
| `masterKey.secretName`, `masterKey.secretKey` | `litellm-master-key-secret`, `master-key` | Secret and field containing the master key. |
| `masterKey.generate` | `false` | Generates a master key only when true and `masterKey.secretName` is empty. |
| `database.writer.host` | `""` | Required unless you set `database.writer.passwordSecret.hostKey` or `urlKey`. |
| `database.writer.port` | `5432` | Writer port when using a host rather than a complete URL. |
| `database.writer.dbname`, `database.writer.schema` | Both `""` | Database name is required in host mode. Schema is optional. |
| `database.writer.passwordSecret` | Name `litellm-writer-secret`, keys `username` and `password` | Existing credentials Secret. `hostKey` and `urlKey` are empty by default. A complete URL replaces the separate connection settings. |
| `database.writer.useIAMAuth`, `useAzureEntraAuth` | Both `false` | Uses a database token instead of the password. Enable at most one and retain the username Secret. |
| `database.writer.sslMode`, `sslRootCert` | Both `""` | Database TLS settings. A root certificate alone implies `verify-full`. |
| `database.reader.host` | `""` | Optional read replica. Set a host, `passwordSecret.hostKey`, or `passwordSecret.urlKey` to enable it. |
| `database.reader.port`, `dbname`, `schema` | `5432`, `""`, `""` | Reader database name is required in host mode. A complete URL supplies its own connection fields. |
| `database.reader.passwordSecret` | Name `litellm-reader-secret`, keys `username` and `password` | Reader credentials. `hostKey` and `urlKey` are empty by default. |
| `database.reader.useIAMAuth`, `useAzureEntraAuth` | Both `false` | Reader token authentication requires the matching writer option. |
| `database.connectionPool` | `enabled: false`, `maxDbConnections: 20`, `maxClientConn: 1000` | Enables the in-container gateway connection pool. Backend and migration Jobs connect directly. |
| `redis.host`, `redis.passwordSecret.hostKey`, `redis.passwordSecret.urlKey` | All `""` | Redis endpoint options. A complete URL replaces separate connection settings. |
| `redis.port`, `redis.cluster` | `6379`, `false` | Redis port and cluster discovery mode. |
| `redis.passwordSecret.name`, `passwordKey` | `""`, `password` | Existing Redis Secret. A Secret is required for `hostKey` or `urlKey`. An empty name permits a host with no password. |
| `redis.ssl`, `sslCertReqs`, `sslCaCerts` | `false`, `""`, `""` | TLS, certificate verification mode, and mounted CA path. For a complete URL, use `rediss://` and URL TLS parameters instead. |

</details>

<details id="ingress">
<summary>Ingress</summary>

| Value | Default | Description |
| --- | --- | --- |
| `ingress.enabled` | `false` | Creates the Ingress. Install its controller separately. |
| `ingress.className` | `""` | Kubernetes ingress class. Set this for your installed controller. |
| `ingress.controller` | `alb` | Selects `alb` or `nginx` path syntax. |
| `ingress.host` | `""` | Shared hostname for path routing. Empty creates a rule without a host. |
| `ingress.annotations` | `{}` | Controller settings such as an internal frontend, certificate, and listener ports. |
| `ingress.tls` | `[]` | Kubernetes ingress TLS entries for controllers that use them. |
| `ingress.componentHosts.ui`, `.backend`, `.gateway` | All `""` | Separate component hostnames. Set all three together and leave `ingress.host` and `ingress.extraPaths` empty. |
| `ui.publicUrl`, `ui.backendUrl`, `backend.gatewayUrl` | All `""` | Required in separate-service mode when component hostnames are set. Use origins without paths. Shared-host path routing does not need these values. |
| `ingress.extraPaths` | `[]` | Adds paths before the backend catch-all. Entries need `path`. Component targets default to `service: gateway` and `pathType: Prefix`. Duplicate built-in routes are rejected. |
| `ingress.extraPaths[].serviceName`, `.servicePort` | Unset | Routes an extra path to another Kubernetes Service. Set both and omit `service`. |

In single-service mode, built-in and component-targeted paths use the monolith Service. Keep health and metrics endpoints private. Use the [cloud reference architectures](./cloud/overview.md) for network placement.

</details>

<details>
<summary>Resources and scaling</summary>

| Value | Default | Description |
| --- | --- | --- |
| `gateway.resources` | Requests `1` CPU / `4Gi`, limits `2` CPU / `4Gi` | Resources per gateway container. Also applies to the monolith. |
| `backend.resources` | Requests `1` CPU / `4Gi`, limits `2` CPU / `4Gi` | Resources per management backend container. |
| `ui.resources` | Requests `500m` CPU / `500Mi`, limits `1` CPU / `1Gi` | Resources per static UI container. |
| `gateway.numWorkers` | `1` | Worker processes per gateway or monolith pod. |
| `<component>.replicaCount` | `null` | Fixed count when HPA is disabled. Gateway also requires KEDA to be disabled. Empty omits the field. |
| `gateway.hpa` | Enabled, `1–10` replicas, CPU `70%`, memory `80%` | Gateway autoscaling targets. |
| `backend.hpa` | Enabled, `1–4` replicas, CPU `70%` | Backend autoscaling targets. |
| `ui.hpa` | Disabled, `1–3` replicas, CPU `80%` | UI autoscaling targets when enabled. |
| `<component>.hpa.behavior` | `{}` | Kubernetes scale-up and scale-down policies. |
| `gateway.hpa.targetRequestsPerSecond`, `targetTokensPerSecond` | Both `""` | Optional per-pod targets. Requires metrics collection and a Prometheus Adapter. |
| `gateway.keda` | Disabled, `minReplicaCount: 1`, `maxReplicaCount: 10` | Alternative gateway autoscaler. Requires KEDA and `gateway.hpa.enabled: false`. |
| `gateway.keda.pollingInterval`, `cooldownPeriod` | `30`, `300` seconds | KEDA polling and scale-to-zero cooldown settings. |
| `gateway.keda.triggers`, `advanced`, `fallback` | `[]`, `{}`, `{}` | Custom KEDA triggers and behavior. |
| `gateway.keda.prometheus` | Empty server address and workload targets | Set `serverAddress` with either `targetRequestsPerSecond` or `targetTokensPerSecond` to add a workload trigger. |
| `<component>.pdb` | Disabled, empty `minAvailable` and `maxUnavailable` | Pod disruption budget. Set one limit. Enabling with neither uses `maxUnavailable: 1`. |

Add [RPS and TPS targets](./autoscaling.md#scale-on-requests-and-tokens-per-pod) alongside CPU and memory for gateway autoscaling. See [Sizing & Scaling](./sizing.md) for capacity planning.

</details>

<details>
<summary>Configuration and pod settings</summary>

| Value | Default | Description |
| --- | --- | --- |
| `gateway.config.create` | `true` | Creates and mounts the shared proxy configuration. |
| `gateway.config.proxy_config` | `{}` | LiteLLM YAML configuration loaded by gateway and backend. See [Configuration](../configuration/overview.md). |
| `<component>.logLevel` | `INFO` | Component log level. |
| `<component>.extraEnv`, `envSecrets`, `envConfigMaps` | All `[]` | Environment variables and existing Secret or ConfigMap names. |
| `<component>.volumes`, `volumeMounts` | Both `[]` | Extra Kubernetes volumes and container mounts. |
| `<component>.service.type` | `ClusterIP` | Kubernetes Service type. |
| `gateway.service.port`, `backend.service.port`, `ui.service.port` | `4000`, `4001`, `3000` | Service ports. The monolith uses `gateway.service.port`. |
| `<component>.service.annotations`, `loadBalancerClass` | `{}`, `""` | Service annotations and optional load balancer class. |
| `<component>.livenessProbe`, `readinessProbe` | Gateway/backend: `/health/liveliness`, `/health/readiness`. UI: `/` | HTTP health probes. See full defaults for timings and thresholds. |
| `<component>.startupProbe`, `strategy` | Both `{}` | Optional startup probe and deployment strategy. Empty strategy inherits Kubernetes rolling-update defaults. |
| `<component>.minReadySeconds`, `terminationGracePeriodSeconds` | Both `""` | Omitted by default. Kubernetes defaults are `0` and `30` seconds. |
| `<component>.podSecurityContext`, `securityContext` | Both `{}` | Pod and container security settings. |
| `<component>.deploymentLabels`, `deploymentAnnotations`, `podLabels`, `podAnnotations` | All `{}` | Extra labels and annotations. |
| `<component>.nodeSelector`, `affinity`, `tolerations`, `topologySpreadConstraints` | `{}`, `{}`, `[]`, `[]` | Pod placement and zone distribution. |
| `<component>.lifecycle`, `extraContainers`, `extraInitContainers` | `{}`, `[]`, `[]` | Lifecycle hooks, sidecars, and init containers. |
| `serviceAccounts.<component>` | `create: false`, `name: ""`, `annotations: {}` | Uses an existing named account or the namespace's default account. Enable `create` to create one. |
| `serviceAccounts.<component>.automount` | Gateway/backend `true`, UI `false` | Mounts the Kubernetes service account token. |
| `extraResources` | `[]` | Additional Kubernetes resources rendered with the release. |

</details>

<details>
<summary>Metrics and optional workloads</summary>

| Value | Default | Description |
| --- | --- | --- |
| `gateway.metricsServer.enabled`, `.port` | `false`, `4001` | Separate metrics sidecar and private metrics Service. |
| `gateway.metricsServer.resources` | Requests `50m` CPU / `128Mi`, memory limit `512Mi` | Metrics sidecar resources. |
| `gateway.serviceMonitor.enabled`, `.interval`, `.scrapeTimeout` | `false`, `15s`, `10s` | Prometheus Operator monitoring. Requires `gateway.metricsServer.enabled: true`. |
| `gateway.serviceMonitor.scheme`, `.tlsConfig` | `http`, `{}` | Prometheus scrape transport settings. |
| `gateway.serviceMonitor.labels`, `.annotations`, `.relabelings`, `.namespaceSelector.matchNames` | `{}`, `{}`, `[]`, `[]` | Discovery labels and scrape options. Empty namespace selection uses the release namespace. |
| `gateway.collector.enabled`, `.address` | `false`, `unix:///var/run/litellm/collector.sock` | Moves post-response spend processing to a sidecar. |
| `gateway.collector.bufferSize`, `.onUnavailable`, `.drainTimeoutSeconds` | `1000`, `fallback`, `10` | Per-worker buffer, behavior when the collector is unavailable, and shutdown drain time. |
| `gateway.collector.resources` | Requests `500m` CPU / `1Gi`, limits `1` CPU / `2Gi` | Collector sidecar resources. |
| `gateway.collector.scaleOnGatewayContainerCpu` | `true` | With the collector and CPU HPA enabled, scales on the main container's CPU only. Requires Kubernetes 1.30 or newer. |
| `migrationJob.enabled`, `.hooks.helm.enabled`, `.hooks.argocd.enabled` | `true`, `true`, `false` | Migration Job and controller hooks. |
| `migrationJob.backoffLimit`, `.activeDeadlineSeconds`, `.ttlSecondsAfterFinished` | `4`, `1800`, `120` | Job retries, total deadline, and cleanup delay. |
| `migrationJob.serviceAccountName`, `.automountServiceAccountToken` | `""`, `false` | Job identity. Name an existing account when cloud database authentication needs it. |
| `billingMetrics.enabled` | `false` | Enterprise request metering. |
| `liteadmin.enabled` | `false` | Optional admin worker. Requires `liteadmin.existingSecret`, `liteadmin.gatewayUrl`, and `liteadmin.model`. |
| `lens.enabled` | `false` | Connects to a separately deployed Lens service. Requires its internal and public URLs plus gateway and service-token Secrets. |

</details>
