---
title: Autoscaling
description: Scale LiteLLM gateway pods with HPA using requests per second, tokens per second, CPU, and memory.
toc_max_heading_level: 2
---

# Autoscaling

{/* keep-version-note */}

Use requests per second (RPS) and tokens per second (TPS) alongside CPU and memory utilization to scale LiteLLM. CPU use can stay low while requests wait on model providers, so RPS and TPS add useful load signals.

Configure `gateway.hpa` in [Helm values](./helm.md). It scales the gateway in separate-service mode and the full proxy in single-service mode.

## HPA metrics {#scale-on-requests-and-tokens-per-pod}

| Metric | What it measures |
| --- | --- |
| RPS | Completed requests per second per pod |
| TPS | Input and output tokens per second per pod |
| CPU | CPU use as a percentage of the pod's CPU requests |
| Memory | Memory use as a percentage of the pod's memory requests |

Install Kubernetes Metrics Server for CPU and memory metrics. Install Prometheus Operator and Prometheus Adapter for RPS and TPS. The adapter must expose both rates for each gateway pod on `custom.metrics.k8s.io`.

### Helm values

Enable metrics and set per-pod HPA targets in `values.yaml`. This example uses 50 RPS and 100,000 TPS. Choose targets from load tests with your models and traffic mix.

```yaml title="values.yaml"
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
    minReplicas: 2
    maxReplicas: 10
    targetCPUUtilizationPercentage: 70
    targetMemoryUtilizationPercentage: 80
    targetRequestsPerSecond: "50"
    targetTokensPerSecond: "100000"
    behavior:
      scaleDown:
        stabilizationWindowSeconds: 300
```

The example keeps the chart's CPU and memory targets. Set container resource requests so Kubernetes can calculate utilization. Keep your model configuration and existing callbacks when you merge these values. Add `gateway.serviceMonitor.labels` if your Prometheus instance requires them to select the ServiceMonitor. Keep the metrics Service private.

### Prometheus Adapter

Add these rules to [Prometheus Adapter's configuration](https://github.com/kubernetes-sigs/prometheus-adapter/blob/master/docs/config.md). This is the adapter's `config.yaml`, separate from LiteLLM's Helm values:

```yaml title="Prometheus Adapter config.yaml"
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

Keep the `namespace` and `pod` scrape labels and scrape each pod once. `rate()` returns a per-second rate.

### Choose targets

The HPA uses the metric that asks for the most replicas. For example, 400 RPS across five pods is 80 RPS per pod. A target of 50 asks for eight replicas. TPS, CPU, or memory can ask for more. The configured replica limits still apply.

LiteLLM updates its request and token counters when requests finish. Long streams delay these signals, so keep spare replicas. Test scale-up with short and long requests. See [Prometheus metrics](../prometheus.md) for metric details.

## KEDA alternative

The chart supports `gateway.keda` in both deployment modes. Install KEDA and disable `gateway.hpa`. The chart rejects a configuration that enables both. This example keeps CPU and memory triggers alongside RPS and TPS. The Prometheus triggers use rates across the Helm release and targets for each replica. They do not need Prometheus Adapter. CPU and memory still require Metrics Server.

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
    triggers:
      - type: cpu
        metricType: Utilization
        metadata:
          value: "70"
      - type: memory
        metricType: Utilization
        metadata:
          value: "80"
    prometheus:
      serverAddress: http://prometheus-operated.monitoring.svc:9090
      targetRequestsPerSecond: "50"
      targetTokensPerSecond: "100000"
```

Replace the Prometheus address and thresholds. The generated queries select the metrics Service's `job` and the release namespace. Keep those labels in your scrape setup. Put custom triggers under `gateway.keda.triggers`. Set fallback behavior under `gateway.keda.fallback` and HPA behavior overrides under `gateway.keda.advanced.horizontalPodAutoscalerConfig.behavior`.

## Verify scaling

After applying the values, inspect the autoscaler and test with your normal traffic mix:

```bash
kubectl -n litellm get hpa
kubectl -n litellm describe hpa
kubectl get --raw '/apis/custom.metrics.k8s.io/v1beta1/namespaces/litellm/pods/*/litellm_requests_per_second'
kubectl get --raw '/apis/custom.metrics.k8s.io/v1beta1/namespaces/litellm/pods/*/litellm_tokens_per_second'
```

For the HPA setup, confirm that both custom metrics return current values for each gateway pod. For KEDA, run `kubectl -n litellm get scaledobjects` and inspect the HPA that KEDA creates.

Confirm that the autoscaler adds replicas under load. Check that requests succeed and active streams finish before replicas stop.

Use [Sizing & Scaling](./sizing.md) to measure capacity before selecting thresholds. For ECS or Cloud Run, use the scaling settings in the [Terraform guide](./terraform.md).

## Replica limits and chart defaults

Set `maxReplicas` to fit your cluster capacity and PostgreSQL connection budget. Each worker has its own connection pool unless you enable `database.connectionPool`. That pool limits connections per gateway pod. Reserve connections for backend pods, migrations, and rolling updates. See [database connection limits](../prod.md#bound-database-connections).

The chart defaults to the targets below. The recommended example adds RPS and TPS to the gateway's CPU and memory targets.

| Component | HPA enabled by default | Default replica range | Default targets |
| --- | --- | --- | --- |
| Gateway or monolith | Yes | 1–10 | 70% CPU, 80% memory |
| Backend | Yes | 1–4 | 70% CPU |
| UI | No | 1–3 when enabled | 80% CPU |

CPU and memory targets require Kubernetes Metrics Server and container resource requests. Targets express use as a percentage of those requests.

For a fixed gateway replica count, disable both `gateway.hpa.enabled` and `gateway.keda.enabled`. Then set `gateway.replicaCount`. Backend and UI use their own `hpa.enabled` and `replicaCount` fields. See the [Helm values reference](./helm.md#valuesyaml-reference) for all settings.
