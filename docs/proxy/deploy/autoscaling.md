---
title: Autoscaling
description: Configure LiteLLM autoscaling with Helm, Kubernetes HPA, KEDA, and request or token metrics. Understand AWS and GCP scaling options.
---

# Autoscaling

{/* keep-version-note */}

Autoscaling adds or removes LiteLLM instances as traffic changes. This guide covers the settings for both [Helm charts](./helm.md), including CPU, requests per second, and tokens per second, plus the scaling options in the [Terraform modules](./terraform.md).

Both charts can scale themselves, and both ship autoscaling off or conservative by default. For the thresholds to aim at, and why memory is not one of them, see [autoscaling in the production checklist](../prod.md#autoscaling).

`litellm-helm` offers two mutually exclusive mechanisms. `autoscaling.*` renders a standard HorizontalPodAutoscaler, and `keda.*` renders a KEDA `ScaledObject` for scaling on queue depth, Prometheus queries, or anything else KEDA can read. Enabling both renders only the HPA, so pick one.

```yaml
autoscaling:
  enabled: false
  minReplicas: 1
  maxReplicas: 100
  targetCPUUtilizationPercentage: 80
  # targetMemoryUtilizationPercentage and behavior are also accepted

keda:
  enabled: false
  minReplicas: 1
  maxReplicas: 100
  pollingInterval: 30   # seconds between trigger evaluations
  cooldownPeriod: 300   # seconds of quiet before scaling back to minReplicas
  triggers: []          # required; a ScaledObject with no triggers will not scale
```

`keda.triggers` is empty by default and has no useful default, so supply the trigger yourself; the chart's `values.yaml` carries a commented Prometheus example. `keda.fallback`, `keda.behavior`, and `keda.restoreToOriginalReplicaCount` are passed through for controlling what happens when the metric source is unavailable and how replicas settle after a scale event.

The componentized chart scales each component on its own, under `gateway.hpa`, `backend.hpa`, and `ui.hpa`. The gateway and backend autoscale out of the box and the UI does not, with maximums sized to the shape of each component's traffic: the gateway defaults to `maxReplicas: 10` at 70 percent CPU and 80 percent memory, the backend to `maxReplicas: 4` at 70 percent CPU, and the UI to `maxReplicas: 3` at 80 percent CPU with `enabled: false`. Raising the gateway's ceiling is usually all you need, since it is the only component that sees LLM traffic.

Whichever mechanism you use, set the maximum against what your database can serve. The connection pool is per worker, so the ceiling on replicas is also a ceiling on Postgres connections; `litellm-helm` defaults `maxReplicas` to 100, which at the default pool limit of 10 asks for roughly 1000 connections at full scale-out. See [bounding database connections](../prod.md#bound-database-connections).

## Scale on requests and tokens per pod

CPU lags LLM traffic: a pod streaming forty responses is mostly waiting on providers, so its CPU stays low while its capacity is gone. Both charts can scale on the two counters the proxy already exports, `litellm_proxy_total_requests_metric_total` and `litellm_total_tokens_metric_total`, expressed as requests per second (RPS) and tokens per second (TPS) per pod, the way load is usually quoted (1k rps, 75M tok/s). The targets are opt-in and empty by default, so nothing changes until you set one, and they sit next to the CPU and memory targets: an HPA follows whichever metric asks for the most replicas. `averageValue` is a Kubernetes quantity, so `"6M"` and `"6000000"` are the same tokens per second.

```yaml
# litellm-helm
autoscaling:
  enabled: true
  targetRequestsPerSecond: "90"
  targetTokensPerSecond: "6M"
metricsServer:
  enabled: true
serviceMonitor:
  enabled: true

# componentized chart
gateway:
  metricsServer:
    enabled: true
  serviceMonitor:
    enabled: true
  hpa:
    targetRequestsPerSecond: "90"
    targetTokensPerSecond: "6M"
```

Each target renders an `autoscaling/v2` `Pods` metric, `litellm_requests_per_second` or `litellm_tokens_per_second`, with an `AverageValue` target. Kubernetes cannot read Prometheus by itself, so two things have to be in place. The chart's ServiceMonitor (Prometheus Operator) scrapes every pod on its own so each sample carries the `pod` label. Turn on the dedicated metrics listener with it (`gateway.metricsServer.enabled` on the componentized chart, `metricsServer.enabled` on `litellm-helm`): the main port serves `/metrics/` behind virtual-key auth and answers an unauthenticated scrape with 401, so the componentized chart refuses to render a ServiceMonitor without it. Then a [Prometheus Adapter](https://github.com/kubernetes-sigs/prometheus-adapter) has to serve those two names on `custom.metrics.k8s.io`, grouped by pod. `rate()` already returns a per-second value, so there is no `* 60`:

```yaml
rules:
  - seriesQuery: 'litellm_proxy_total_requests_metric_total{namespace!="",pod!=""}'
    resources: { overrides: { namespace: { resource: namespace }, pod: { resource: pod } } }
    name: { as: litellm_requests_per_second }
    metricsQuery: sum(rate(<<.Series>>{<<.LabelMatchers>>}[1m])) by (<<.GroupBy>>)
  - seriesQuery: 'litellm_total_tokens_metric_total{namespace!="",pod!=""}'
    resources: { overrides: { namespace: { resource: namespace }, pod: { resource: pod } } }
    name: { as: litellm_tokens_per_second }
    metricsQuery: sum(rate(<<.Series>>{<<.LabelMatchers>>}[1m])) by (<<.GroupBy>>)
```

The unit is a constant factor and does not make the HPA react any faster. What sets the lag is the `rate()` window in the adapter rule, the scrape interval, and the HPA sync period (15s by default). Keep the window at `[1m]` and the ServiceMonitor interval at the chart default of 15s or faster so the window always holds at least four samples: after a traffic step the signal moves on the next scrape and reaches its full value 60s later, where a `[2m]` window is still at half.

Both counters are split by model, key, and team labels, so the `sum by (pod)` folds a pod's series into one number. `kubectl get --raw /apis/custom.metrics.k8s.io/v1beta1/namespaces/<ns>/pods/*/litellm_tokens_per_second` shows what the HPA sees. Worked example: 1,000 rps across 10 gateway pods is 100 rps per pod against a target of 90, so the HPA asks for `ceil(10 * 100 / 90) = 12` replicas. The token metric does the same arithmetic: ten pods serving 70,000,000 tokens per second between them average 7,000,000 TPS against a target of 6,000,000, so `ceil(10 * 7000000 / 6000000) = 12`.

Tokens are counted when a response finishes, so a long stream shows up in TPS only once it completes. RPS reacts first and TPS catches up, which is fine for scale-out but means a burst of long streams is under-counted for as long as they run. Do not set a TPS target alone if your traffic is dominated by multi-minute streams.

On `litellm-helm` the same signals are available through KEDA without an adapter. `keda.prometheus.requestsPerSecond` and `keda.prometheus.tokensPerSecond` are the load one replica should carry, and each adds a Prometheus trigger on `sum(rate(<counter>{namespace="<release namespace>",job="<release>-metrics"}[1m]))`, selected by release namespace and the `job` label the chart's ServiceMonitor produces. KEDA divides the release-wide rate by the per-replica threshold to pick the replica count, so the result matches the HPA path for the same traffic. Keep `keda.pollingInterval` at 15s or lower for the same reason as the scrape interval above.

```yaml
keda:
  enabled: true
  prometheus:
    serverAddress: http://prometheus-operated.monitoring.svc:9090
    requestsPerSecond: "90"
    tokensPerSecond: "6000000"
metricsServer:
  enabled: true
serviceMonitor:
  enabled: true
```

On AWS ECS the Terraform module takes the same per-second inputs, `gateway_target_requests_per_second` on `ALBRequestCountPerTarget` and `gateway_target_tokens_per_second` once you publish the token counter to CloudWatch, and converts them itself because the ALB publishes a per-minute count. CloudWatch target tracking aggregates every metric over 60-second periods with no period setting, so ECS reacts on a roughly one-minute cadence whatever the unit; the [module README](https://github.com/BerriAI/litellm/blob/main/terraform/litellm/aws/README.md#scaling-the-gateway-on-requests-and-tokens) covers both policies. Cloud Run scales on request concurrency and has no custom-metric input, so there is no TPS path on GCP outside GKE.

## Next steps

Use [Sizing & Scaling](./sizing.md) to plan resources, then [verify the deployment](../deploy.md#verify-the-deployment). The [production checklist](../prod.md) covers worker counts and database connection limits. Return to the [deployment overview](../deploy.md) to compare deployment methods.
