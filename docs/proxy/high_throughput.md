# Scale for high-throughput workloads

Use this Helm configuration for high request volumes and large prompts. It runs four gateway workers per pod, shares database connections, and uses separate containers for metrics and spend processing.

Benchmark throughput: **13.5 billion tokens per minute (TPM)**. [View results](../benchmarks.md#high-throughput-profile-3000-rps-with-50k-to-100k-token-prompts).

## Requirements

Start with a working [microservices Helm deployment](./deploy.md#deploy-with-helm), external PostgreSQL and Redis, and your model configuration. This example also requires:

- Kubernetes 1.30+ and Metrics Server for CPU and memory autoscaling.
- Prometheus Operator to scrape each pod through a ServiceMonitor.
- Prometheus Adapter with the [RPS and TPS rules](./deploy.md#scale-on-requests-and-tokens-per-pod) for request and token autoscaling.

Keep metrics port `4001` on the internal cluster network. Its endpoint allows unauthenticated Prometheus scrapes.

## Configure the gateway

Merge these settings into your existing `values.yaml`. Keep your database, Redis, secrets, ingress, and `gateway.config.proxy_config.model_list` settings. Preserve existing entries when updating the `extraEnv` and `callbacks` lists. Match `gateway.serviceMonitor.labels` to your Prometheus instance's ServiceMonitor selector.

```yaml title="values.yaml"
database:
  connectionPool:
    enabled: true
    maxDbConnections: 8
    maxClientConn: 1000

gateway:
  numWorkers: 4
  logLevel: ERROR
  extraEnv:
    - name: LITELLM_RUST
      value: "1"
    - name: KEEPALIVE_TIMEOUT
      value: "75"

  metricsServer:
    enabled: true
  serviceMonitor:
    enabled: true
  collector:
    enabled: true

  resources:
    requests:
      cpu: "4"
      memory: 16Gi
    limits:
      cpu: "16"
      memory: 16Gi

  hpa:
    enabled: true
    minReplicas: 2
    maxReplicas: 200
    targetCPUUtilizationPercentage: 60
    targetMemoryUtilizationPercentage: 80
    targetRequestsPerSecond: "83"
    targetTokensPerSecond: "6.25M"
    behavior:
      scaleUp:
        stabilizationWindowSeconds: 0
        policies:
          - type: Percent
            value: 100
            periodSeconds: 15
          - type: Pods
            value: 20
            periodSeconds: 15
      scaleDown:
        stabilizationWindowSeconds: 300
        policies:
          - type: Percent
            value: 25
            periodSeconds: 60

  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 25%
  lifecycle:
    preStop:
      exec:
        command: ["sh", "-c", "sleep 10"]
  terminationGracePeriodSeconds: 620
  startupProbe:
    httpGet: { path: /health/readiness, port: http }
    failureThreshold: 30
    periodSeconds: 10
  pdb:
    enabled: true
    maxUnavailable: 10%

  config:
    proxy_config:
      general_settings:
        proxy_batch_write_at: 60
        use_redis_transaction_buffer: true
        allow_requests_on_db_unavailable: true
      litellm_settings:
        callbacks:
          - prometheus
        request_timeout: 600
        json_logs: true
```

## Deploy

Chart `1.104.2` uses `v1.104.2` component images. Update any explicit component image tags in your values file to `v1.104.2`.

The commands use release `litellm` and its default resource names. Substitute your release, namespace, and any names set by `fullnameOverride`:

```bash
export NAMESPACE=litellm

helm upgrade --install litellm \
  oci://ghcr.io/berriai/litellm/chart/litellm \
  --version 1.104.2 \
  --namespace "$NAMESPACE" \
  -f values.yaml
```

## Tune for your workload

Use a load test with your prompt sizes, streaming duration, and callbacks to choose resource limits and autoscaling targets.

| Setting | Purpose |
|---|---|
| `numWorkers: 4`, CPU request `4`, CPU limit `16` | Runs four workers with CPU capacity for bursts of token counting. |
| `LITELLM_RUST=1` | Uses Rust to count prompt tokens for budget checks. |
| `connectionPool.maxDbConnections: 8` | Shares up to eight PostgreSQL connections across the workers and collector in each pod. Size the pool for your database connection limit and maximum replica count, with capacity for the backend and migrations. |
| `metricsServer.enabled` | Serves Prometheus metrics from a separate container. |
| `collector.enabled` | Processes spend logs, counters, and budget reconciliation in a separate container. |
| `targetRequestsPerSecond: "83"`, `targetTokensPerSecond: "6.25M"` | Sets per-pod targets of 83 requests and 6.25 million tokens per second. The HPA uses the metric that asks for the most replicas. |
| `KEEPALIVE_TIMEOUT: "75"` | Keeps idle connections open for 75 seconds. Set this above your load balancer's idle timeout. |
| `request_timeout: 600`, `terminationGracePeriodSeconds: 620` | Allows up to ten minutes per request, with 20 extra seconds for shutdown. |
| `preStop`, `maxUnavailable`, `pdb` | Gives the load balancer time to drain connections and preserves capacity during rollouts and pod disruptions. |
| `allow_requests_on_db_unavailable: true` | Keeps the pod ready and permits requests during temporary database connection failures. Set this to match your database failure policy. |

Token metrics update when a response finishes. Use both request and token targets for streaming traffic.

## Verify

Check that each gateway pod lists `gateway`, `metrics`, and `collector` containers:

```bash
kubectl -n "$NAMESPACE" get pods -l app.kubernetes.io/component=gateway \
  -o custom-columns='POD:.metadata.name,CONTAINERS:.spec.containers[*].name'
```

Confirm that the Rust extension loads. The command prints `rust ok`:

```bash
kubectl -n "$NAMESPACE" exec deploy/litellm-litellm-gateway -c gateway -- \
  python -c "import litellm.rust_bridge._native; print('rust ok')"
```

Send traffic through the gateway, then check the custom metrics and HPA:

```bash
kubectl get --raw \
  "/apis/custom.metrics.k8s.io/v1beta1/namespaces/$NAMESPACE/pods/*/litellm_requests_per_second"

kubectl get --raw \
  "/apis/custom.metrics.k8s.io/v1beta1/namespaces/$NAMESPACE/pods/*/litellm_tokens_per_second"

kubectl -n "$NAMESPACE" describe hpa litellm-litellm-gateway
```

Each metrics response lists per-pod values. The HPA shows request, token, CPU, and memory targets. New pods publish request and token metrics after serving traffic.
