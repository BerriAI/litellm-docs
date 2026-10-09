# Scale for high-throughput workloads

Benchmark throughput: **13.5 billion tokens per minute (TPM)**. [View results](../benchmarks.md#high-throughput-profile-3000-rps-with-50k-to-100k-token-prompts).

## Requirements

Start with a working [microservices Helm deployment](./deploy.md#deploy-with-helm), external PostgreSQL and Redis, and your model configuration. This example also requires:

- Kubernetes 1.30+ and Metrics Server for CPU and memory autoscaling.
- Prometheus Operator to scrape each pod through a ServiceMonitor.
- Prometheus Adapter with the [RPS and TPS rules](./deploy.md#scale-on-requests-and-tokens-per-pod) for request and token autoscaling.

## Configure the gateway

Each snippet shows the fields to update in `values.yaml`.

### 1. Scale on requests per second

**Set a request-rate target per pod so capacity scales with traffic.** This example targets 83 requests per second per pod. The HPA also tracks tokens, CPU, and memory, and uses the metric that asks for the most replicas.

```yaml
gateway:
  hpa:
    enabled: true
    minReplicas: 2
    maxReplicas: 200
    targetRequestsPerSecond: "83"
    targetTokensPerSecond: "6.25M"
    targetCPUUtilizationPercentage: 60
    targetMemoryUtilizationPercentage: 80
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
```

Configure the [Prometheus Adapter rules](./deploy.md#scale-on-requests-and-tokens-per-pod) to expose these metrics to Kubernetes. Token metrics update when responses finish, so use both request and token targets for streaming traffic.

### 2. Set workers and resources

Run four workers per pod. Request 4 vCPUs and 16 GiB of memory, with a 16-vCPU limit for bursts.

```yaml
gateway:
  numWorkers: 4
  logLevel: ERROR
  resources:
    requests:
      cpu: "4"
      memory: 16Gi
    limits:
      cpu: "16"
      memory: 16Gi
```

### 3. Share database connections

Enable PgBouncer to share eight PostgreSQL connections across the workers and collector in each pod. Size this pool against your database connection limit and maximum replica count.

```yaml
database:
  connectionPool:
    enabled: true
    maxDbConnections: 8
    maxClientConn: 1000
```

### 4. Run metrics and spend processing in sidecars

Enable the metrics server and spend collector. Add `prometheus` to your callbacks, and use Redis to buffer spend updates for batch writes.

```yaml
gateway:
  metricsServer:
    enabled: true
  serviceMonitor:
    enabled: true
  collector:
    enabled: true
  config:
    proxy_config:
      general_settings:
        proxy_batch_write_at: 60
        use_redis_transaction_buffer: true
      litellm_settings:
        callbacks:
          - prometheus
        json_logs: true
```

Set `gateway.serviceMonitor.labels` to match your Prometheus instance's ServiceMonitor selector.

### 5. Set connection and shutdown timeouts

Add `KEEPALIVE_TIMEOUT` to `gateway.extraEnv` with a value above your load balancer's idle timeout. These settings allow 600 seconds per request and 620 seconds for shutdown, including a 10-second connection-draining delay.

```yaml
gateway:
  extraEnv:
    - name: KEEPALIVE_TIMEOUT
      value: "75"
  config:
    proxy_config:
      litellm_settings:
        request_timeout: 600
  terminationGracePeriodSeconds: 620
  lifecycle:
    preStop:
      exec:
        command: ["sh", "-c", "sleep 10"]
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 25%
  startupProbe:
    httpGet: { path: /health/readiness, port: http }
    failureThreshold: 30
    periodSeconds: 10
  pdb:
    enabled: true
    maxUnavailable: 10%
```

Use a load test with your prompt sizes, streaming duration, and callbacks to choose resource limits and autoscaling targets.

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

## Verify

Check that each gateway pod lists `gateway`, `metrics`, and `collector` containers:

```bash
kubectl -n "$NAMESPACE" get pods -l app.kubernetes.io/component=gateway \
  -o custom-columns='POD:.metadata.name,CONTAINERS:.spec.containers[*].name'
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
