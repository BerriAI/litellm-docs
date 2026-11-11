---
title: Autoscaling
description: Scale the LiteLLM Helm chart with per-component HPA settings, request and token metrics, or KEDA.
---

# Autoscaling

{/* keep-version-note */}

Configure scaling in the [Helm chart's values.yaml](./helm.md). `gateway.hpa` scales the gateway in separate-service mode and the full proxy in single-service mode. `backend.hpa` and `ui.hpa` apply only to separate services.

See the [chart values reference](https://github.com/BerriAI/litellm/blob/f52f26d9c636038c6e3609cc7d17cf625d434c3e/helm/litellm/values.yaml) for all scaling options and the [Helm guide](./helm.md) for installation.

## CPU and replica limits

Install Kubernetes Metrics Server to scale on CPU or memory use. Targets express use as a percentage of the container's resource request. Set resource requests before tuning these targets.

| Component | HPA enabled by default | Default replica range | Default targets |
| --- | --- | --- | --- |
| Gateway or monolith | Yes | 1–10 | 70% CPU, 80% memory |
| Backend | Yes | 1–4 | 70% CPU |
| UI | No | 1–3 when enabled | 80% CPU |

Merge this example into your values. It keeps at least two gateway pods and disables the memory target. Set the maximum replica count from your load tests and database connection budget.

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

The autoscaler controls the replica count when you enable it. For a fixed count, disable both `gateway.hpa.enabled` and `gateway.keda.enabled`. Then set `gateway.replicaCount`. Backend and UI use their own `hpa.enabled` and `replicaCount` fields.

Limit scaling to fit PostgreSQL connections and available cluster capacity. Each worker has its own connection pool unless you enable `database.connectionPool`. That pool limits connections for each gateway pod. It does not set a limit across the deployment. Reserve capacity for backend pods, migrations, and rolling updates. See [database connection limits](../prod.md#bound-database-connections).

## Requests and tokens per pod {#scale-on-requests-and-tokens-per-pod}

Streams can wait on providers while using little CPU. The chart can also scale on requests per second (RPS) and tokens per second (TPS). This setup uses a Prometheus Operator ServiceMonitor and Prometheus Adapter. The adapter must expose metrics for each pod on `custom.metrics.k8s.io`.

Enable the Prometheus callback, metrics sidecar, and ServiceMonitor. Then set the request and token targets. Check these example thresholds with your own load test:

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

Keep your existing model configuration and callbacks when merging this block. Check that your Prometheus instance selects the ServiceMonitor. Add any required `gateway.serviceMonitor.labels`. The dedicated metrics Service has no virtual-key authentication. Keep it private.

Configure [Prometheus Adapter](https://github.com/kubernetes-sigs/prometheus-adapter) to expose the two metric names that the HPA uses. Keep this adapter configuration separate from LiteLLM's values:

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

`rate()` returns a per-second rate. The HPA uses the metric that asks for the most replicas. For example, 1,000 RPS across ten pods is 100 RPS per pod. A target of 90 asks for about twelve replicas. The configured limits and scaling behavior still apply.

The scrape interval, rate window, and HPA control loop determine how quickly scaling responds. LiteLLM counts tokens when a response completes. TPS therefore lags behind long streams. Use it with another load signal. See [Prometheus metrics](../prometheus.md) for metric setup.

## KEDA alternative

The chart supports `gateway.keda` in both deployment modes. Install KEDA first and disable `gateway.hpa`. The chart rejects a configuration that enables both. The Prometheus triggers below use rates across the Helm release and targets for each replica. They do not need Prometheus Adapter.

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

Replace the Prometheus address and thresholds. The generated queries select the metrics Service's `job` and the release namespace. Keep those labels in your scrape setup. Put custom triggers under `gateway.keda.triggers`. Set fallback behavior under `gateway.keda.fallback` and HPA behavior overrides under `gateway.keda.advanced.horizontalPodAutoscalerConfig.behavior`.

## Verify scaling

After your GitOps sync or Helm upgrade, inspect the autoscaler and test with your normal traffic mix:

```bash
kubectl -n litellm get hpa
kubectl -n litellm describe hpa
kubectl get --raw '/apis/custom.metrics.k8s.io/v1beta1/namespaces/litellm/pods/*/litellm_requests_per_second'
```

The custom-metrics command applies to the Prometheus Adapter setup. For KEDA, run `kubectl -n litellm get scaledobjects` and inspect the HPA that KEDA creates. Confirm that the autoscaler reads metrics and adds replicas under load. Check that requests succeed and active streams finish before replicas stop.

Use [Sizing & Scaling](./sizing.md) to measure capacity before selecting thresholds. For ECS or Cloud Run, use the scaling settings in the [Terraform guide](./terraform.md).
