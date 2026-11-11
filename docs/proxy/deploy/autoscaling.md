---
title: Autoscaling
description: Scale the LiteLLM Helm chart with per-component HPA settings, request and token metrics, or KEDA.
---

# Autoscaling

{/* keep-version-note */}

Configure scaling in the [Helm chart's values.yaml](./helm.md). `gateway.hpa` scales the gateway in separate-service mode and the full proxy in single-service mode. `backend.hpa` and `ui.hpa` apply only to separate services.

These values match the [consolidated chart at `f52f26d`](https://github.com/BerriAI/litellm/blob/f52f26d9c636038c6e3609cc7d17cf625d434c3e/helm/litellm/values.yaml). Use its matching image and installation instructions in the Helm guide.

## CPU and replica limits

Install Kubernetes Metrics Server for CPU or memory utilization targets. Resource requests define the denominator for those percentages, so set requests before tuning targets.

| Component | HPA enabled by default | Default replica range | Default targets |
| --- | --- | --- | --- |
| Gateway or monolith | Yes | 1–10 | 70% CPU, 80% memory |
| Backend | Yes | 1–4 | 70% CPU |
| UI | No | 1–3 when enabled | 80% CPU |

Merge this example into your values. It keeps at least two gateway pods and disables the memory target; adjust the replica ceiling to your measured capacity and database budget.

```yaml
gateway:
  hpa:
    enabled: true
    minReplicas: 2
    maxReplicas: 10
    targetCPUUtilizationPercentage: 70
    targetMemoryUtilizationPercentage: 0
    behavior:
      scaleDown:
        stabilizationWindowSeconds: 300
```

With an autoscaler enabled, it owns the replica count. To use a fixed count instead, disable both `gateway.hpa.enabled` and `gateway.keda.enabled`, then set `gateway.replicaCount`. Backend and UI use their corresponding `hpa.enabled` and `replicaCount` fields.

Bound scale-out against PostgreSQL connections as well as available cluster capacity. Each worker has its own pool unless you enable `database.connectionPool`; that pool caps connections per gateway pod, not across the deployment. Reserve capacity for backend pods, migrations, and rolling updates. See [database connection limits](../prod.md#bound-database-connections).

## Requests and tokens per pod {#scale-on-requests-and-tokens-per-pod}

CPU alone can miss load from concurrent streams waiting on providers. The chart can also scale on requests per second (RPS) and tokens per second (TPS), using a Prometheus Operator ServiceMonitor and Prometheus Adapter. The adapter must expose per-pod metrics on `custom.metrics.k8s.io`.

Enable the Prometheus callback, metrics sidecar, and ServiceMonitor, then set workload targets. These example thresholds need validation against your own load test:

```yaml
gateway:
  config:
    proxy_config:
      litellm_settings:
        callbacks: [prometheus]
  metricsServer:
    enabled: true
  serviceMonitor:
    enabled: true
    interval: 15s
  hpa:
    enabled: true
    targetRequestsPerSecond: "90"
    targetTokensPerSecond: "6000000"
```

Keep your existing model configuration and callbacks when merging this block. Ensure your Prometheus instance selects the ServiceMonitor, including any required `gateway.serviceMonitor.labels`. The dedicated metrics Service has no virtual-key authentication; keep it private.

Configure [Prometheus Adapter](https://github.com/kubernetes-sigs/prometheus-adapter) to expose the two metric names used by the HPA. This is adapter configuration, separate from LiteLLM's values:

```yaml title="Prometheus Adapter configuration"
rules:
  - seriesQuery: 'litellm_proxy_total_requests_metric_total{namespace!="",pod!=""}'
    resources:
      overrides:
        namespace: {resource: namespace}
        pod: {resource: pod}
    name: {as: litellm_requests_per_second}
    metricsQuery: sum(rate(<<.Series>>{<<.LabelMatchers>>}[1m])) by (<<.GroupBy>>)
  - seriesQuery: 'litellm_total_tokens_metric_total{namespace!="",pod!=""}'
    resources:
      overrides:
        namespace: {resource: namespace}
        pod: {resource: pod}
    name: {as: litellm_tokens_per_second}
    metricsQuery: sum(rate(<<.Series>>{<<.LabelMatchers>>}[1m])) by (<<.GroupBy>>)
```

`rate()` already returns a per-second rate. The HPA uses the metric requesting the most replicas. For example, 1,000 RPS across ten pods is 100 RPS per pod; a target of 90 requests approximately twelve replicas, subject to configured limits and scaling behavior.

The scrape interval, rate window, and HPA reconciliation determine reaction time. Tokens are counted when a response completes, so TPS trails long streams; use it alongside another load signal. See [Prometheus metrics](../prometheus.md) for instrumentation.

## KEDA alternative

The same chart supports `gateway.keda` in either layout. Install KEDA first and disable `gateway.hpa`; the chart rejects a configuration that enables both. The Prometheus triggers below use release-wide rates and per-replica targets, without Prometheus Adapter.

```yaml
gateway:
  config:
    proxy_config:
      litellm_settings:
        callbacks: [prometheus]
  metricsServer:
    enabled: true
  serviceMonitor:
    enabled: true
    interval: 15s
  hpa:
    enabled: false
  keda:
    enabled: true
    minReplicaCount: 2
    maxReplicaCount: 10
    pollingInterval: 15
    cooldownPeriod: 300
    prometheus:
      serverAddress: http://prometheus-operated.monitoring.svc:9090
      targetRequestsPerSecond: "90"
      targetTokensPerSecond: "6000000"
```

Replace the Prometheus address and thresholds. The generated queries select the metrics Service's `job` and the release namespace; preserve those labels in your scrape setup. Custom triggers go under `gateway.keda.triggers`, fallback behavior under `gateway.keda.fallback`, and HPA behavior overrides under `gateway.keda.advanced.horizontalPodAutoscalerConfig.behavior`.

## Verify scaling

After your GitOps sync or Helm upgrade, inspect the autoscaler and generate representative load:

```bash
kubectl -n litellm get hpa
kubectl -n litellm describe hpa
kubectl get --raw '/apis/custom.metrics.k8s.io/v1beta1/namespaces/litellm/pods/*/litellm_requests_per_second'
```

The custom-metrics command applies to the Prometheus Adapter setup. For KEDA, also inspect `kubectl -n litellm get scaledobjects` and its generated HPA. Confirm metrics resolve, scale-out completes, requests stay healthy, and scale-in allows active streams to drain.

Use [Sizing & Scaling](./sizing.md) to establish capacity before selecting thresholds. For ECS or Cloud Run, use the scaling settings in the [Terraform guide](./terraform.md).
